from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict

INSECURE_SECRET = "dev-only-insecure-secret-change-me"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "development"
    # Any SQLAlchemy URL. A Neon/Postgres URL works as-is, e.g.
    # postgresql://user:pass@ep-xxx.neon.tech/db?sslmode=require
    database_url: str = "sqlite:///./gymflow.db"
    # Serverless hosts run many small instances, so keep each one's pool small.
    db_pool_size: int = 5
    db_max_overflow: int = 5

    jwt_secret: str = INSECURE_SECRET
    jwt_algorithm: str = "HS256"
    access_token_minutes: int = 15
    refresh_token_days: int = 7
    bcrypt_rounds: int = 12

    # "Today" for attendance and expiry maths is the gym's local day, not UTC.
    app_timezone: str = "Asia/Kolkata"
    # Set true behind HTTPS so the refresh cookie is never sent over plain HTTP.
    cookie_secure: bool = False
    # Comma-separated. Only needed if the SPA is served from a different origin.
    cors_origins: str = ""
    frontend_dist: str = ""

    @property
    def cors_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def dist_path(self) -> Path:
        if self.frontend_dist:
            return Path(self.frontend_dist)
        return Path(__file__).resolve().parents[2] / "frontend" / "dist"

    def assert_production_safe(self) -> None:
        if self.app_env == "production" and (self.jwt_secret == INSECURE_SECRET or len(self.jwt_secret) < 32):
            raise RuntimeError("JWT_SECRET must be set to a random string of 32+ characters in production.")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
