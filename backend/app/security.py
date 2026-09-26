import base64
import hashlib
import uuid
from datetime import datetime, timedelta
from typing import Literal

import bcrypt
import jwt

from .config import settings
from .timeutil import utcnow

TokenType = Literal["access", "refresh"]


def _prehash(password: str) -> bytes:
    # bcrypt rejects inputs over 72 bytes; hashing first lets any length through safely.
    return base64.b64encode(hashlib.sha256(password.encode()).digest())


def hash_password(password: str) -> str:
    return bcrypt.hashpw(_prehash(password), bcrypt.gensalt(rounds=settings.bcrypt_rounds)).decode()


def verify_password(password: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(_prehash(password), hashed.encode())
    except ValueError:
        return False


def _encode(payload: dict) -> str:
    return jwt.encode(payload, settings.jwt_secret, algorithm=settings.jwt_algorithm)


def create_access_token(user_id: int, role: str) -> tuple[str, int]:
    now = utcnow()
    ttl = timedelta(minutes=settings.access_token_minutes)
    token = _encode({
        "sub": str(user_id), "role": role, "type": "access",
        "iat": now, "exp": now + ttl, "jti": uuid.uuid4().hex,
    })
    return token, int(ttl.total_seconds())


def create_refresh_token(user_id: int, family_id: str) -> tuple[str, str, datetime]:
    now = utcnow()
    expires = now + timedelta(days=settings.refresh_token_days)
    jti = uuid.uuid4().hex
    token = _encode({
        "sub": str(user_id), "type": "refresh", "fam": family_id,
        "iat": now, "exp": expires, "jti": jti,
    })
    return token, jti, expires


def decode_token(token: str, expected: TokenType) -> dict:
    """Raises jwt.PyJWTError on any problem, including a token of the wrong type."""
    payload = jwt.decode(token, settings.jwt_secret, algorithms=[settings.jwt_algorithm])
    if payload.get("type") != expected:
        raise jwt.InvalidTokenError("wrong token type")
    return payload
