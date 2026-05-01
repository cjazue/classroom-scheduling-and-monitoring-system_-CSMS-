from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity
from app.extensions import db
from app.models.user import User
from app.utils import (
    superadmin_required,
    success_response,
    error_response,
    paginate_query,
    validate_email,
    validate_password,
)

superadmin_bp = Blueprint("superadmin", __name__, url_prefix="/api/superadmin")

@superadmin_bp.route("/admins", methods=["POST"])
@superadmin_required
def create_admin():
    """Create an Admin account."""
    creator_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}

    name           = (data.get("name")           or "").strip()
    email          = (data.get("email")          or "").strip().lower()
    password       =  data.get("password")       or ""
    course_section = (data.get("course_section") or "").strip()

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

    if errors:
        return error_response("Validation failed.", 422, errors)

    if User.query.filter_by(email=email).first():
        return error_response("Email is already registered.", 409)

    admin = User(
        name=name,
        email=email,
        role="admin",
        course_section=course_section or None,
        created_by=creator_id,
    )
    admin.set_password(password)
    db.session.add(admin)
    db.session.commit()

    return success_response(admin.to_dict(include_sensitive=True), "Admin account created.", 201)


@superadmin_bp.route("/admins", methods=["GET"])
@superadmin_required
def list_admins():
    query = User.query.filter_by(role="admin").order_by(User.created_at.desc())

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


@superadmin_bp.route("/admins/<int:admin_id>", methods=["GET"])
@superadmin_required
def get_admin(admin_id):
    admin = User.query.filter_by(id=admin_id, role="admin").first_or_404()
    return success_response(admin.to_dict(include_sensitive=True))


@superadmin_bp.route("/admins/<int:admin_id>", methods=["PATCH"])
@superadmin_required
def update_admin(admin_id):
    admin = User.query.filter_by(id=admin_id, role="admin").first_or_404()
    data  = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        admin.name = data["name"].strip()
    if "course_section" in data:
        admin.course_section = data["course_section"].strip() or None
    if "is_active" in data:
        admin.is_active = bool(data["is_active"])
    if "password" in data:
        valid, msg = validate_password(data["password"])
        if not valid:
            return error_response(msg, 422)
        admin.set_password(data["password"])

    db.session.commit()
    return success_response(admin.to_dict(include_sensitive=True), "Admin updated.")


@superadmin_bp.route("/admins/<int:admin_id>", methods=["DELETE"])
@superadmin_required
def delete_admin(admin_id):
    admin = User.query.filter_by(id=admin_id, role="admin").first_or_404()
    admin.is_active = False
    db.session.commit()
    return success_response(message="Admin account deactivated.")