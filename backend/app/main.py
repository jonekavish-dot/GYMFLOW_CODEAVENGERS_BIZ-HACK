from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles

from .config import settings
from .db import Base, engine
from .routers import attendance, auth, checkins, classes, members, plans, settings as settings_router, slots, trainers


@asynccontextmanager
async def lifespan(_: FastAPI):
    settings.assert_production_safe()
    Base.metadata.create_all(engine)
    yield


app = FastAPI(
    title="GymFlow API",
    description="Membership, class & slot booking, attendance and front-desk check-in.",
    version="2.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
)

if settings.cors_list:
    app.add_middleware(
        CORSMiddleware, allow_origins=settings.cors_list, allow_credentials=True,
        allow_methods=["*"], allow_headers=["*"],
    )


@app.middleware("http")
async def headers(request: Request, call_next):
    response = await call_next(request)
    response.headers.setdefault("X-Content-Type-Options", "nosniff")
    response.headers.setdefault("X-Frame-Options", "DENY")
    response.headers.setdefault("Referrer-Policy", "same-origin")
    path = request.url.path
    if path.startswith("/api/"):
        response.headers["Cache-Control"] = "no-store"
    elif path.startswith("/assets/"):
        response.headers["Cache-Control"] = "public, max-age=31536000, immutable"  # filenames are content-hashed
    return response


@app.exception_handler(RequestValidationError)
async def validation_error(_: Request, exc: RequestValidationError):
    """One readable sentence instead of pydantic's nested list, so the UI can show it as-is."""
    first = exc.errors()[0]
    field = ".".join(str(p) for p in first["loc"] if p not in ("body", "query", "path"))
    message = first["msg"].removeprefix("Value error, ")
    return JSONResponse(status_code=422, content={"detail": f"{field}: {message}" if field else message})


@app.get("/api/health", tags=["meta"])
def health():
    return {"ok": True}


for module in (auth, members, plans, classes, slots, trainers, attendance, checkins, settings_router):
    app.include_router(module.router, prefix="/api")


# ── the built React app, served from the same origin so the refresh cookie needs no CORS ──
_dist: Path = settings.dist_path
if (_dist / "index.html").exists():
    app.mount("/assets", StaticFiles(directory=_dist / "assets"), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    def spa(full_path: str):
        if full_path.startswith("api/"):
            raise HTTPException(status_code=404)
        candidate = (_dist / full_path).resolve()
        if full_path and candidate.is_file() and _dist.resolve() in candidate.parents:
            headers = {"Cache-Control": "no-cache"} if candidate.name in ("sw.js", "manifest.webmanifest") else None
            return FileResponse(candidate, headers=headers)
        # Any other path is a client-side route (/admin/members, ...): hand it to the SPA.
        return FileResponse(_dist / "index.html", headers={"Cache-Control": "no-cache"})
