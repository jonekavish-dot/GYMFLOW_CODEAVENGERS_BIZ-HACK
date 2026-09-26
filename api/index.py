"""Vercel entry point: exposes the FastAPI app in backend/ as a serverless function.

Vercel serves frontend/dist as static files and routes /api/* here (see vercel.json).
"""
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "backend"))

from app.main import app  # noqa: E402,F401  (Vercel looks for a module-level `app`)
