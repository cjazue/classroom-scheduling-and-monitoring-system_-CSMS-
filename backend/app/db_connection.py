from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class DBConfig:
    sqlalchemy_uri: str


def get_db_config() -> DBConfig:
    """Central place to read DB-related environment variables."""
    return DBConfig(
        sqlalchemy_uri=os.getenv("SQLALCHEMY_DATABASE_URI")
        or os.getenv("DATABASE_URL")
        or f"sqlite:///{(Path(__file__).resolve().parents[1] / 'app.db')}"
    )

