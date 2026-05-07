from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.user import User
from app.utils import (
    any_authenticated,
    success_response,
    error_response,
    validate_password,
    validate_course_section,
)

profile_bp = Blueprint("profile", __name__, url_prefix="/api/profile")


@profile_bp.route("", methods=["GET"])
@any_authenticated
def get_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("Not found.", 404)
    return success_response(user.to_dict())


@profile_bp.route("", methods=["PATCH", "PUT"])
@any_authenticated
def update_profile():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user:
        return error_response("Not found.", 404)

    data = request.get_json(silent=True) or {}

    if "name" in data and str(data["name"]).strip():
        user.name = str(data["name"]).strip()

    if "course_section" in data:
        new_cs = str(data.get("course_section") or "").strip().upper()
        if new_cs and not validate_course_section(new_cs):
            return error_response(
                "Course/Section must follow the format AAAA X-X (e.g. BSIT 1-1).", 422
            )
        user.course_section = new_cs or None

    if "password" in data:
        valid, msg = validate_password(str(data.get("password") or ""))
        if not valid:
            return error_response(msg, 422)
        user.set_password(str(data.get("password") or ""))

    db.session.commit()
    return success_response(user.to_dict(), "Profile updated.")

