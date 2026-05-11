# Classroom Scheduling and Monitoring System (CSMS)

CSMS is a classroom scheduling and reservation system with role-based access (Super Admin, Admin, Authorized User, Student). It runs as a single Flask application that serves both:

- A JSON API under `/api/*`
- A static HTML/CSS/JS frontend under `/`

## Technologies Used

- **Python 3.14**
- **Flask** (API + static frontend serving)
- **Flask-SQLAlchemy** + **Flask-Migrate** (database access + migrations)
- **Flask-JWT-Extended** (JWT auth: access + refresh tokens)
- **SQLite** (local/dev) and **PostgreSQL** (production-ready option via `DATABASE_URL`/`SQLALCHEMY_DATABASE_URI`)
- **openpyxl** (XLSX imports + template generation)
- **HTML/CSS/JavaScript** (no build step)

## System Architecture

- `backend/app/__init__.py` creates the Flask app and registers blueprints.
- Backend routes live in `backend/app/routes/*` and are mounted under `/api/*`.
- Frontend is static:
  - HTML pages: `frontend/templates/<role>/*.html`
  - CSS/JS: `frontend/static/css/**`, `frontend/static/js/**`
  - Images/icons: `frontend/ASSETS/**`
- When serving an HTML page, the backend injects `/static/js/common/csms.js` into `<head>`. This script provides:
  - `window.CSMS.api.request()` (API client wrapper)
  - login/logout + token storage
  - role-based route guarding based on URL prefix (`/superadmin/*`, `/admin/*`, `/auth/*`, `/user/*`)

## User Roles & Features

- **Super Admin**
  - Manage Admin accounts
  - Import Students (`.xlsx`) and Schedules (`.xlsx`) + view import history
  - View schedules and overall users
- **Admin**
  - Manage Students / Authorized Users
  - Approve / reject reservations
  - View room occupancy (schedule + reservations)
- **Authorized User**
  - Create reservations, view status, cancel requests
- **Student**
  - View occupied/available rooms

## Key Functionalities

- Room directory + availability queries
- Reservation workflow (create → pending → approve/reject; cancel)
- Schedule imports (XLSX) and schedule/occupancy dashboards
- Student imports (XLSX) with a required default password

## Setup Instructions (Local / Windows PowerShell)

### 1) Install backend dependencies

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
```

### 2) Configure environment

```powershell
# Environment selection
$env:FLASK_ENV = "development"   # use "production" for deploys

# Database (SQLite dev default)
$env:SQLALCHEMY_DATABASE_URI = "sqlite:///app.db"

# Optional: auto-bootstrap SQLite from SQL scripts if DB looks uninitialized
$env:CSMS_BOOTSTRAP_SQLITE = "true"

# Optional: CORS allowlist (disabled by default). Example:
# $env:CORS_ORIGINS = "https://csms.example.com,https://admin.example.com"

# Optional: upload limit (bytes). Default: 10 MiB
# $env:MAX_CONTENT_LENGTH = "10485760"
```

### 3) Run

```powershell
python run.py
```

Then open `http://localhost:5000/`.

## Deployment Notes

- Set `FLASK_ENV=production` and provide **both** `SECRET_KEY` and `JWT_SECRET_KEY`. The app will refuse to start in production if they are missing.
- Use a production WSGI server (don’t rely on the Flask dev server).
  - Windows-friendly example (from `backend/`): `waitress-serve --listen=0.0.0.0:5000 run:app`
  - Linux example (from `backend/`): `gunicorn -w 2 -b 0.0.0.0:5000 run:app`
- Prefer PostgreSQL for multi-user deployments.
- Put the app behind a reverse proxy (nginx/Apache) for HTTPS and caching.

## Imports (XLSX)

- Student imports require `openpyxl`.
- Student imports require a `default_password` (set in the Super Admin Imports page, or via `CSMS_DEFAULT_STUDENT_PASSWORD`).

## Tests

```powershell
cd backend
.\.venv\Scripts\Activate.ps1
pip install -r requirements-dev.txt
python -m pytest -q
```

## File Structure Overview

- `backend/`
  - `app/` Flask app package (config, models, routes, utils)
  - `migrations/` Alembic migrations
  - `seeds/` seed script for local/dev
  - `tests/` pytest test suite
- `frontend/`
  - `templates/` HTML pages grouped by role
  - `static/` CSS + JS assets
  - `ASSETS/` shared images/icons
