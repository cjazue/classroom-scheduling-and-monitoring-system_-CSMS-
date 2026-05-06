import os
from datetime import timedelta
from pathlib import Path
from dotenv import load_dotenv

load_dotenv()


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
    SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-key-change-in-prod")
    SQLALCHEMY_TRACK_MODIFICATIONS = False

    JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "jwt-secret-key-change-in-prod")
    JWT_ACCESS_TOKEN_EXPIRES = timedelta(hours=8)
    JWT_REFRESH_TOKEN_EXPIRES = timedelta(days=7)

    SQLALCHEMY_DATABASE_URI = get_database_url()


class DevelopmentConfig(Config):
    DEBUG = True
    SQLALCHEMY_ECHO = False


class ProductionConfig(Config):
    DEBUG = False

    @classmethod
    def init_app(cls, app):
        uri = cls.SQLALCHEMY_DATABASE_URI or ""
        if uri.startswith("postgres://"):
            cls.SQLALCHEMY_DATABASE_URI = uri.replace("postgres://", "postgresql://", 1)


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
