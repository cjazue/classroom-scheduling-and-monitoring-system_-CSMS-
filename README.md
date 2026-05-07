# Classroom Scheduling and Monitoring System (CSMS)

This repo is split into a Flask API backend and a static HTML/JS/CSS frontend.

## Folder structure

- `backend/` - Flask API (`run.py`, app package, migrations, tests)
- `frontend/` - Static pages (`*.html`) + assets
  - `frontend/assets/css/` - stylesheets
  - `frontend/assets/js/` - JavaScript modules
  - `frontend/assets/img/` - images

## Quick start (Windows PowerShell)

### 1) Backend + Frontend (single server)

#### Prereqs
- Python dependencies
- SQLite DB initialization

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt

REM (Optional) initialize database from the provided SQL files
REM If CSMS_BOOTSTRAP_SQLITE=true (default), it will bootstrap only when DB looks uninitialized.
set CSMS_BOOTSTRAP_SQLITE=true

REM Use the default local DB file (backend/app.db)
set SQLALCHEMY_DATABASE_URI=sqlite:///app.db

python run.py
```

Then open `http://localhost:5000/`.

> Notes
> - API is served under `/api/*`.
> - The app serves the static frontend under `/`.
> - Bootstrap is conservative and will skip if `users` table exists and has rows.


Notes:
- The backend serves the frontend from `frontend/` and exposes the API under `/api/*`.
- Seeding prints the Superadmin credentials to the terminal. You can override them via env vars in `backend/seeds/seed.py`.

## Roles & pages

- Students / Authorized users: `dashboard.html`, `campus.html` → `building.html` → `room.html`
- Admins / Superadmin: `Admindashboard.html`
  - Reservation approvals: `Reservation.html` (approves/rejects `pending` reservations)
  - Permission requests: `PermissionReq.html` (promotes `student` → `authorized_user`)

## Configuration

- Backend env vars (optional): `SQLALCHEMY_DATABASE_URI`, `SECRET_KEY`, `JWT_SECRET_KEY`, `PORT`, `FLASK_ENV`
- Frontend API base URL: `frontend/assets/js/api.js` (`API_BASE`, auto-detected; override via `localStorage.API_BASE` if needed)
