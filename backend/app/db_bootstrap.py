from __future__ import annotations

import os
import sqlite3
from pathlib import Path


def _parse_sql_statements(sql_text: str) -> list[str]:
    # Use sqlite3 executescript which handles splitting on semicolons.
    # Keeping this function for possible future customization.
    return [sql_text]


def _sqlite_file_from_sqlalchemy_uri(uri: str) -> str | None:
    """Extract sqlite file path from common SQLAlchemy URIs.

    Supported:
      - sqlite:///relative/path.db
      - sqlite:////absolute/path.db
      - sqlite:///:memory:

    Returns absolute path where possible, else None.
    """
    if not uri:
        return None

    if uri.startswith("sqlite:///:memory:"):
        return ":memory:"

    if uri.startswith("sqlite:////"):
        return uri.replace("sqlite:////", "", 1)

    # (guard for odd strings; not expected in normal config)
    if uri.startswith("sqlite:///'"):
        return uri.replace("sqlite:///", "", 1)

    if uri.startswith("sqlite:///"):

        rel = uri.replace("sqlite:///", "", 1)
        # relative to backend/ (current working dir when run.py is called)
        return str(Path(rel).resolve())

    return None


def _db_needs_bootstrap(sqlite_path: str) -> bool:
    """Decide whether to run SQL bootstrap.

    This should be idempotent: if the schema already exists, skip.
    """
    if sqlite_path == ":memory:":
        # Always needs schema in memory.
        return True

    if not os.path.exists(sqlite_path):
        return True

    # Check for core schema presence.
    # If the expected tables exist, assume schema is present.
    try:
        conn = sqlite3.connect(sqlite_path)
        try:
            conn.execute("PRAGMA foreign_keys = ON")

            # Legacy schema shipped under backend/database/*.sql
            required_tables = ["Campus", "Buildings", "Room", "Reservations", "Schedules", "users"]
            existing = {
                r[0]
                for r in conn.execute(
                    "SELECT name FROM sqlite_master WHERE type='table'"
                ).fetchall()
            }

            # If any of the required tables are missing, bootstrap.
            return any(t not in existing for t in required_tables)
        finally:
            conn.close()
    except sqlite3.Error:
        return True




def bootstrap_sqlite_db(
    sqlalchemy_uri: str | None = None,
    sql_dir: str | Path | None = None,
    verbose: bool = True,
) -> None:
    """Bootstrap SQLite DB using the provided backend/database/*.sql files.

    This is intentionally conservative: it only runs when the DB appears uninitialized.
    """

    sqlalchemy_uri = sqlalchemy_uri or os.getenv("SQLALCHEMY_DATABASE_URI") or "sqlite:///app.db"
    sql_dir = Path(sql_dir or Path(__file__).resolve().parents[1] / "database")

    sqlite_path = _sqlite_file_from_sqlalchemy_uri(sqlalchemy_uri)
    if not sqlite_path:
        if verbose:
            print(f"[db_bootstrap] Unsupported SQLALCHEMY_DATABASE_URI: {sqlalchemy_uri}. Skipping.")
        return

    if not _db_needs_bootstrap(sqlite_path):
        if verbose:
            print("[db_bootstrap] DB already initialized. Skipping SQL bootstrap.")
        return

    if verbose:
        print(f"[db_bootstrap] Bootstrapping SQLite DB at: {sqlite_path}")

    sql_files = [
        # Core tables without FK dependencies first.
        "CAMPUS.sql",
        "BUILDINGS.sql",
        "ROOMS.sql",
        "users/TABLE.sql",
        # Reservations (depends on users + rooms).
        "RESERVATIONS.sql",
        "SCHEDULES.sql",
        # Optional inserts (if your SQL includes them).
        "users/ADMIN.sql",
        "users/AUTHUSERS.sql",
        "users/SADMIN.sql",
        "users/1-6.sql",
        "users/1-7.sql",
        "users/1-8.sql",
        "users/1-9.sql",
        "users/1-10.sql",
        # Some projects include a master TABLE.sql—run it last if present.
        "TABLE.sql",
    ]

    # If some files don’t exist, we just skip them.
    ordered_existing: list[Path] = []
    for f in sql_files:
        p = sql_dir / f
        if p.exists() and p.is_file():
            ordered_existing.append(p)

    if not ordered_existing:
        raise RuntimeError(f"[db_bootstrap] No SQL files found in {sql_dir}")

    # Ensure parent dirs exist for sqlite file.
    if sqlite_path != ":memory:":
        Path(sqlite_path).parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(sqlite_path)
    try:
        # Disable FK constraints during bootstrap so seed data with stale references can be inserted.
        # The schema itself defines FK constraints; SQLite will enforce them once enabled in the app.
        conn.execute("PRAGMA foreign_keys = OFF")

        # Execute in order.
        for p in ordered_existing:
            if verbose:
                print(f"[db_bootstrap] Running {p.relative_to(sql_dir.parent)}")
            conn.executescript(p.read_text(encoding="utf-8"))

        conn.commit()
    finally:
        conn.close()

