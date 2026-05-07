import os
from pathlib import Path
from flask import Flask, jsonify
from app.config import config
from app.extensions import db, migrate, jwt, cors
from app.routes.auth import is_token_revoked
from dotenv import load_dotenv
load_dotenv()


def create_app(config_name: str = None) -> Flask:
    config_name = config_name or os.environ.get("FLASK_ENV", "default")
    app = Flask(__name__)
    app.config.from_object(config[config_name])

    # ---- SQLite bootstrap (dev/local) ----
    # If your provided database is already initialized, this will automatically skip.
    if os.environ.get("CSMS_BOOTSTRAP_SQLITE", "true").lower() == "true":
        try:
            from app.db_bootstrap import bootstrap_sqlite_db

            bootstrap_sqlite_db(app.config.get("SQLALCHEMY_DATABASE_URI"), verbose=False)
        except Exception as e:
            # Don’t prevent app start.
            # If tables already exist, treat it as non-fatal.
            msg = str(e).lower()
            if "already exists" in msg and ("table" in msg or "campus" in msg):
                print("[db_bootstrap] Bootstrap skipped (schema already exists).")
            else:
                print(f"[db_bootstrap] Failed: {e}")


    # Initialize SQLAlchemy after SQLite bootstrap.
    db.init_app(app)

    migrate.init_app(app, db)
    jwt.init_app(app)
    cors.init_app(app, resources={r"/api/*": {"origins": "*"}})


    @jwt.token_in_blocklist_loader
    def check_if_token_revoked(jwt_header, jwt_payload):
        return is_token_revoked(jwt_header, jwt_payload)

    from app.routes import (
        auth_bp,
        admin_bp,
        superadmin_bp,
        rooms_bp,
        reservations_bp,
        requests_bp,
        schedules_bp,
        profile_bp,
    )

    app.register_blueprint(auth_bp)
    app.register_blueprint(admin_bp)
    app.register_blueprint(superadmin_bp)
    app.register_blueprint(rooms_bp)
    app.register_blueprint(reservations_bp)
    app.register_blueprint(requests_bp)
    app.register_blueprint(schedules_bp)
    app.register_blueprint(profile_bp)

    @app.errorhandler(404)
    def not_found(e):
        return jsonify({"success": False, "error": "Resource not found."}), 404

    @app.errorhandler(405)
    def method_not_allowed(e):
        return jsonify({"success": False, "error": "Method not allowed."}), 405

    @app.errorhandler(500)
    def internal_error(e):
        db.session.rollback()
        return jsonify({"success": False, "error": "Internal server error."}), 500

    @jwt.expired_token_loader
    def expired_token_callback(jwt_header, jwt_payload):
        return jsonify({"success": False, "error": "Token has expired."}), 401

    @jwt.invalid_token_loader
    def invalid_token_callback(error):
        return jsonify({"success": False, "error": "Invalid token."}), 401

    @jwt.unauthorized_loader
    def missing_token_callback(error):
        return jsonify({"success": False, "error": "Authorization token required."}), 401

    @jwt.revoked_token_loader
    def revoked_token_callback(jwt_header, jwt_payload):
        return jsonify({"success": False, "error": "Token has been revoked."}), 401


    @app.route("/api/health", methods=["GET"])
    def health():
        return jsonify({"status": "ok", "service": "PLV Room Monitor API"}), 200

    # -------------------------
    # Frontend (static)
    # -------------------------
    repo_root = Path(__file__).resolve().parents[2]
    frontend_dir = repo_root / "frontend"

    @app.route("/", defaults={"path": "index.html"})
    @app.route("/<path:path>")
    def serve_frontend(path: str):
        # Keep API namespace purely for JSON routes.
        if path.startswith("api/") or path == "api":
            return jsonify({"success": False, "error": "Resource not found."}), 404

        if not frontend_dir.exists():
            return jsonify({"success": False, "error": "Frontend directory not found."}), 500

        # If `frontend/index.html` isn't present, fall back to the auth landing page.
        # (The repo uses role-based folders like `frontend/auth/*` instead of a root index.)
        if path == "index.html" and not (frontend_dir / "index.html").exists():
            from flask import redirect

            return redirect("/auth/homepage.html", code=302)

        # Serve HTML with a tiny bootstrap script injected into <head> so the static
        # pages can talk to the Flask API (auth guard, token handling, logout wiring).
        requested = frontend_dir / path
        if requested.exists() and requested.is_file() and requested.suffix.lower() == ".html":
            try:
                html = requested.read_text(encoding="utf-8")
            except Exception:
                # Be permissive for legacy encodings in student-provided HTML.
                html = requested.read_text(encoding="utf-8", errors="ignore")

            inject = '<script src="/common/csms.js"></script>'
            lower = html.lower()
            if "/common/csms.js" not in lower:
                if "</head>" in lower:
                    # Case-insensitive insert before </head>.
                    idx = lower.rfind("</head>")
                    html = html[:idx] + inject + html[idx:]
                else:
                    html = inject + html

            from flask import Response

            return Response(html, mimetype="text/html")

        # Serve files directly from /frontend (css, js, images, etc.)
        from flask import send_from_directory
        return send_from_directory(str(frontend_dir), path)

    return app
