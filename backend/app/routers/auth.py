import uuid
from datetime import timedelta

import jwt
from fastapi import APIRouter, HTTPException, Request, Response
from sqlalchemy import func, select, update

from ..config import settings
from ..deps import DB, CurrentUser
from ..models import RefreshToken, User
from ..ratelimit import login_limiter
from ..schemas import BootstrapIn, ChangePasswordIn, LoginIn, StatusOut, TokenOut, UserOut
from ..security import (
    create_access_token, create_refresh_token, decode_token, hash_password, verify_password,
)
from ..timeutil import utcnow

router = APIRouter(prefix="/auth", tags=["auth"])

REFRESH_COOKIE = "gf_refresh"
# A refresh token rotated a moment ago may legitimately arrive again (two tabs racing).
# Inside this window a replay is refused but doesn't burn the whole token family.
REPLAY_GRACE = timedelta(seconds=10)
_dummy_hash: str | None = None


def _set_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        REFRESH_COOKIE, token, max_age=settings.refresh_token_days * 86400,
        httponly=True, samesite="lax", secure=settings.cookie_secure, path="/api/auth",
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(REFRESH_COOKIE, path="/api/auth")


def _issue(db, user: User, response: Response, family_id: str | None = None) -> TokenOut:
    fam = family_id or uuid.uuid4().hex
    access, ttl = create_access_token(user.id, user.role)
    refresh, jti, expires = create_refresh_token(user.id, fam)
    db.add(RefreshToken(jti=jti, family_id=fam, user_id=user.id, expires_at=expires))
    db.commit()
    _set_cookie(response, refresh)
    return TokenOut(access_token=access, expires_in=ttl, user=UserOut.model_validate(user))


def _revoke_family(db, family_id: str) -> None:
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.family_id == family_id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    db.commit()


def _fail_refresh(response: Response) -> HTTPException:
    _clear_cookie(response)
    return HTTPException(status_code=401, detail="Session expired — please sign in again.")


@router.get("/status", response_model=StatusOut)
def status(db: DB):
    """Public: lets the login page show a connection badge and whether first-admin setup is needed."""
    return StatusOut(bootstrapped=db.scalar(select(func.count(User.id))) > 0)


@router.post("/bootstrap", response_model=TokenOut, status_code=201)
def bootstrap(body: BootstrapIn, response: Response, db: DB):
    """One-time creation of the first admin. Refused as soon as any account exists."""
    if db.scalar(select(func.count(User.id))) > 0:
        raise HTTPException(status_code=409, detail="Setup is already complete.")
    user = User(email=body.email, name=body.name.strip(), password_hash=hash_password(body.password), role="admin")
    db.add(user)
    db.commit()
    return _issue(db, user, response)


@router.post("/login", response_model=TokenOut)
def login(body: LoginIn, request: Request, response: Response, db: DB):
    global _dummy_hash
    key = f"{request.client.host if request.client else '?'}|{body.email}"
    login_limiter.check(key)

    user = db.scalar(select(User).where(User.email == body.email))
    if _dummy_hash is None:
        _dummy_hash = hash_password("dummy-password")
    # Always run one bcrypt comparison so "no such user" and "wrong password" take the same time.
    ok = verify_password(body.password, user.password_hash if user else _dummy_hash)
    if not user or not ok or not user.is_active:
        login_limiter.fail(key)
        raise HTTPException(status_code=401, detail="Wrong email or password.")
    login_limiter.clear(key)
    return _issue(db, user, response)


@router.post("/refresh", response_model=TokenOut)
def refresh(request: Request, response: Response, db: DB):
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise HTTPException(status_code=401, detail="Not signed in.")
    try:
        payload = decode_token(raw, "refresh")
    except jwt.PyJWTError:
        raise _fail_refresh(response)

    row = db.scalar(select(RefreshToken).where(RefreshToken.jti == payload["jti"]))
    if row is None:
        raise _fail_refresh(response)

    now = utcnow()
    if row.revoked_at is not None:
        if now - row.revoked_at > REPLAY_GRACE:
            # A rotated-out token showing up later means it was copied: end every session in this family.
            _revoke_family(db, row.family_id)
            raise _fail_refresh(response)
        raise HTTPException(status_code=401, detail="Refresh already in progress.")
    if row.expires_at <= now:
        raise _fail_refresh(response)

    user = db.get(User, row.user_id)
    if user is None or not user.is_active:
        raise _fail_refresh(response)

    row.revoked_at = now
    return _issue(db, user, response, family_id=row.family_id)


@router.post("/logout", status_code=204)
def logout(request: Request, response: Response, db: DB):
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        try:
            row = db.scalar(select(RefreshToken).where(RefreshToken.jti == decode_token(raw, "refresh")["jti"]))
            if row is not None:
                _revoke_family(db, row.family_id)
        except jwt.PyJWTError:
            pass
    _clear_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: CurrentUser):
    return user


@router.post("/change-password", response_model=TokenOut)
def change_password(body: ChangePasswordIn, response: Response, user: CurrentUser, db: DB):
    """Changing the password ends every session on every device, then starts a fresh one here,
    so the person who just changed it isn't logged out of the device they're holding."""
    if not verify_password(body.current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is wrong.")
    user.password_hash = hash_password(body.new_password)
    db.execute(
        update(RefreshToken).where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=utcnow())
    )
    db.commit()
    return _issue(db, user, response)
