from functools import wraps
from flask import jsonify
from flask_jwt_extended import verify_jwt_in_request, get_jwt_identity
from app.models.user import User

def _get_current_user():
    return User.query.get(get_jwt_identity())

def _guard(*roles):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            verify_jwt_in_request()
            user = _get_current_user()
            if not user or not user.is_active:
                return jsonify({"error": "Account is inactive or does not exist."}), 403
            if user.role not in roles:
                return jsonify({"error": "Insufficient permissions."}), 403
            return fn(*args, **kwargs)
        return wrapper
    return decorator

def superadmin_required(fn):
    return _guard("superadmin")(fn)


def admin_required(fn):
    return _guard("admin", "superadmin")(fn)


def authorized_user_required(fn):
    return _guard("authorized_user", "admin", "superadmin")(fn)


def any_authenticated(fn):
    return _guard("student", "authorized_user", "admin", "superadmin")(fn)


def roles_required(*roles):
    return _guard(*roles)