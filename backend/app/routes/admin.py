from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.utils import (
    admin_required,
    success_response,
    error_response,
    paginate_query,
    validate_email,
    validate_password,
    validate_course_section,
)

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")

@admin_bp.route("/authorized-users", methods=["POST"])
@admin_required
def create_authorized_user():
    creator_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    name           = (data.get("name")           or "").strip()
    email          = (data.get("email")          or "").strip().lower()
    password       =  data.get("password")       or ""
    course_section = (data.get("course_section") or "").strip().upper()

    errors = {}
    if not name:
        errors["name"] = "Name is required."
    if not email:
        errors["email"] = "Email is required."
    elif not validate_email(email):
        errors["email"] = "Must be a valid PLV email (@plv.edu.ph)."
    if not password:
        errors["password"] = "Password is required."
    else:
        valid, msg = validate_password(password)
        if not valid:
            errors["password"] = msg
    if course_section and not validate_course_section(course_section):
        errors["course_section"] = (
            "Course/Section must follow the format AAAA X-X (e.g. BSIT 1-1)."
        )

    if errors:
        return error_response("Validation failed.", 422, errors)

    if User.query.filter_by(email=email).first():
        return error_response("Email is already registered.", 409)

    user = User(
        name=name,
        email=email,
        role="authorized_user",
        course_section=course_section or None,
        created_by=creator_id,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return success_response(
        user.to_dict(include_sensitive=True),
        "Authorized user account created.", 201
    )


@admin_bp.route("/authorized-users", methods=["GET"])
@admin_required
def list_authorized_users():
    query = User.query.filter_by(role="authorized_user").order_by(User.created_at.desc())

    is_active = request.args.get("is_active")
    if is_active is not None:
        query = query.filter_by(is_active=is_active.lower() == "true")

    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(
            db.or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )

    data = paginate_query(query, lambda u: u.to_dict(include_sensitive=True))
    return success_response(data)


@admin_bp.route("/authorized-users/<int:user_id>", methods=["GET"])
@admin_required
def get_authorized_user(user_id):
    user = User.query.filter_by(id=user_id, role="authorized_user").first_or_404()
    return success_response(user.to_dict(include_sensitive=True))


@admin_bp.route("/authorized-users/<int:user_id>", methods=["PATCH"])
@admin_required
def update_authorized_user(user_id):
    user = User.query.filter_by(id=user_id, role="authorized_user").first_or_404()
    data = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()
    if "course_section" in data:
        new_cs = data["course_section"].strip().upper()
        if new_cs and not validate_course_section(new_cs):
            return error_response(
                "Course/Section must follow the format AAAA X-X (e.g. BSIT 1-1).", 422
            )
        user.course_section = new_cs or None
    if "is_active" in data:
        user.is_active = bool(data["is_active"])
    if "password" in data:
        valid, msg = validate_password(data["password"])
        if not valid:
            return error_response(msg, 422)
        user.set_password(data["password"])

    db.session.commit()
    return success_response(user.to_dict(include_sensitive=True), "Authorized user updated.")


@admin_bp.route("/authorized-users/<int:user_id>", methods=["DELETE"])
@admin_required
def deactivate_authorized_user(user_id):
    user = User.query.filter_by(id=user_id, role="authorized_user").first_or_404()
    user.is_active = False
    db.session.commit()
    return success_response(message="Authorized user account deactivated.")

@admin_bp.route("/users", methods=["GET"])
@admin_required
def list_all_users():
    """View all users across all roles."""
    role  = request.args.get("role")
    query = User.query.order_by(User.created_at.desc())
    if role:
        query = query.filter_by(role=role)

    search = request.args.get("search", "").strip()
    if search:
        query = query.filter(
            db.or_(User.name.ilike(f"%{search}%"), User.email.ilike(f"%{search}%"))
        )

    data = paginate_query(query, lambda u: u.to_dict(include_sensitive=True))
    return success_response(data)


@admin_bp.route("/users/<int:user_id>/activate", methods=["PATCH"])
@admin_required
def activate_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.role in ("admin", "superadmin"):
        return error_response("Admins and superadmins cannot be managed here.", 403)
    user.is_active = True
    db.session.commit()
    return success_response(message=f"User '{user.name}' activated.")


@admin_bp.route("/users/<int:user_id>/deactivate", methods=["PATCH"])
@admin_required
def deactivate_user(user_id):
    user = User.query.get_or_404(user_id)
    if user.role in ("admin", "superadmin"):
        return error_response("Admins and superadmins cannot be managed here.", 403)
    user.is_active = False
    db.session.commit()
    return success_response(message=f"User '{user.name}' deactivated.")