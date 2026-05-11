import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()

DEFAULT_SECRET_KEY = "dev-secret-key-change-in-prod-please-set-SECRET_KEY"
DEFAULT_JWT_SECRET_KEY = "jwt-secret-key-change-in-prod-please-set-JWT_SECRET_KEY"


def get_database_url():

    return (
        os.getenv("SQLALCHEMY_DATABASE_URI")
        or os.getenv("DATABASE_URL")
        # Default to the repo's `backend/app.db` (NOT `backend/instance/app.db`).
        # Flask-SQLAlchemy resolves relative SQLite paths against `app.instance_path`,
        # which previously pointed at an empty `backend/instance/app.db` and broke login.
        or f"sqlite:///{(Path(__file__).resolve().parents[1] / 'app.db')}"
    )


class Config:
    SECRET_KEY = os.getenv("SECRET_KEY", DEFAULT_SECRET_KEY)
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", DEFAULT_JWT_SECRET_KEY)
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    SQLALCHEMY_DATABASE_URI = get_database_url()

    # Upload safety: default 10 MiB (set MAX_CONTENT_LENGTH to override).
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_CONTENT_LENGTH", str(10 * 1024 * 1024)))

    # CORS: keep disabled by default (same-origin frontend). Set to a comma-separated
    # allowlist (e.g., "https://csms.example.com,https://admin.example.com") if you
    # serve the frontend from a different origin.
    CORS_ORIGINS = [o.strip() for o in os.getenv("CORS_ORIGINS", "").split(",") if o.strip()]


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False

    @classmethod
    def init_app(cls, app):
        # Enforce secrets for production deployments.
        if not app.config.get("SECRET_KEY") or app.config.get("SECRET_KEY") == DEFAULT_SECRET_KEY:
            raise RuntimeError("SECRET_KEY must be set for production.")
        if not app.config.get("JWT_SECRET_KEY") or app.config.get("JWT_SECRET_KEY") == DEFAULT_JWT_SECRET_KEY:
            raise RuntimeError("JWT_SECRET_KEY must be set for production.")

        uri = app.config.get("SQLALCHEMY_DATABASE_URI") or ""
        if uri.startswith("postgres://"):
            app.config["SQLALCHEMY_DATABASE_URI"] = uri.replace("postgres://", "postgresql://", 1)


class TestingConfig(Config):
    TESTING = True
    SQLALCHEMY_DATABASE_URI = os.getenv("TEST_DATABASE_URL", "sqlite:///test.db")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(minutes=5)


config = {
    "development": DevelopmentConfig,
    "production": ProductionConfig,
    "testing": TestingConfig,
    "default": DevelopmentConfig,
}
