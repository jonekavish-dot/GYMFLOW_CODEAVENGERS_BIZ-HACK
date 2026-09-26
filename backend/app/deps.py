from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from .db import get_db
from .models import Member, User
from .security import decode_token
from .timeutil import utcnow

bearer = HTTPBearer(auto_error=False)
DB = Annotated[Session, Depends(get_db)]


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status_code=401, detail=detail, headers={"WWW-Authenticate": "Bearer"})


def get_current_user(creds: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)], db: DB) -> User:
    if creds is None:
        raise _unauthorized("Not authenticated")
    try:
        payload = decode_token(creds.credentials, "access")
    except jwt.ExpiredSignatureError:
        raise _unauthorized("Token expired")
    except jwt.PyJWTError:
        raise _unauthorized("Invalid token")
    user = db.get(User, int(payload["sub"]))
    if user is None or not user.is_active:
        raise _unauthorized("Account not available")
    return user


def require_role(*roles: str):
    """RBAC guard. The role is read from the database row, not the token, so demoting or
    disabling a user takes effect immediately instead of when their access token expires."""

    def guard(user: Annotated[User, Depends(get_current_user)]) -> User:
        if user.role not in roles:
            raise HTTPException(status_code=403, detail="You don't have access to this.")
        return user

    return guard


CurrentUser = Annotated[User, Depends(get_current_user)]
AdminUser = Annotated[User, Depends(require_role("admin"))]
MemberUser = Annotated[User, Depends(require_role("member"))]


def get_active_member(user: MemberUser, db: DB) -> Member:
    member = db.get(Member, user.id)
    if member is None:
        raise HTTPException(status_code=403, detail="No membership on file.")
    if member.expiry_date <= utcnow():
        raise HTTPException(status_code=403, detail="Your membership has expired — renew at the front desk.")
    return member


ActiveMember = Annotated[Member, Depends(get_active_member)]
