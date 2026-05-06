from app.routes.auth import auth_bp
from app.routes.admin import admin_bp
from app.routes.superadmin import superadmin_bp
from app.routes.rooms import rooms_bp
from app.routes.reservations import reservations_bp

__all__ = [
    "auth_bp",
    "admin_bp",
    "superadmin_bp",
    "rooms_bp",
    "reservations_bp",
]
