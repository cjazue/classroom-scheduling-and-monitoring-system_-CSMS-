from flask import Blueprint, request
from flask_jwt_extended import (
    create_access_token,
    create_refresh_token,
    jwt_required,
    get_jwt_identity,
    get_jwt,
)
from app.extensions import db
from app.models.user import User
from app.utils import (
    success_response,
    error_response,
    validate_email,
    validate_password,
    validate_student_id,
    validate_course_section,
    any_authenticated,
)

auth_bp = Blueprint("auth", __name__, url_prefix="/api/auth")

_blocklist: set = set()


@auth_bp.route("/register", methods=["POST"])
def register():
    """
    Public endpoint — students self-register.
    Admins are created by superadmin only.
    """
    data = request.get_json(silent=True) or {}

    name           = (data.get("name")           or "").strip()
    email          = (data.get("email")          or "").strip().lower()
    student_id     = (data.get("student_id")     or "").strip()
    course_section = (data.get("course_section") or "").strip().upper()
    password       = data.get("password") or ""

    # --- Validation ---
    errors = {}
    if not name:
        errors["name"] = "Name is required."

    if not email:
        errors["email"] = "School email is required."
    elif not validate_email(email):
        errors["email"] = "Must be a valid PLV email (e.g. juandelacruz@plv.edu.ph)."

    if not student_id:
        errors["student_id"] = "Student ID is required."
    elif not validate_student_id(student_id):
        errors["student_id"] = "Student ID must follow the format XX-XXXX (e.g. 21-0001)."

    if not course_section:
        errors["course_section"] = "Course/Section is required."
    elif not validate_course_section(course_section):
        errors["course_section"] = (
            "Course/Section must follow the format AAAA X-X "
            "(e.g. BSIT 1-1, BSED 3-10)."
        )

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
    if User.query.filter_by(student_id=student_id).first():
        return error_response("Student ID is already registered.", 409)

    user = User(
        name=name,
        email=email,
        student_id=student_id,
        role="student",
        course_section=course_section,
    )
    user.set_password(password)
    db.session.add(user)
    db.session.commit()

    return success_response(user.to_dict(), "Registration successful.", 201)


@auth_bp.route("/login", methods=["POST"])
def login():
    data = request.get_json(silent=True) or {}

    email    = (data.get("email")    or "").strip().lower()
    password =  data.get("password") or ""

    if not email or not password:
        return error_response("Email and password are required.", 400)

    user = User.query.filter_by(email=email).first()
    if not user or not user.check_password(password):
        return error_response("Invalid email or password.", 401)

    if not user.is_active:
        return error_response("Your account has been deactivated. Contact the administrator.", 403)

    access_token  = create_access_token(identity=user.id)
    refresh_token = create_refresh_token(identity=user.id)

    return success_response(
        {
            "access_token":  access_token,
            "refresh_token": refresh_token,
            "user":          user.to_dict(),
        },
        "Login successful.",
    )


@auth_bp.route("/refresh", methods=["POST"])
@jwt_required(refresh=True)
def refresh():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    access_token = create_access_token(identity=user_id)
    return success_response({"access_token": access_token}, "Token refreshed.")


@auth_bp.route("/logout", methods=["POST"])
@jwt_required()
def logout():
    jti = get_jwt()["jti"]
    _blocklist.add(jti)
    return success_response(message="Logged out successfully.")


@auth_bp.route("/me", methods=["GET"])
@any_authenticated
def me():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    return success_response(user.to_dict())


@auth_bp.route("/me", methods=["PATCH"])
@any_authenticated
def update_me():
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)
    data    = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        user.name = data["name"].strip()

    if "course_section" in data:
        new_cs = data["course_section"].strip().upper()
        if new_cs and not validate_course_section(new_cs):
            return error_response(
                "Course/Section must follow the format AAAA X-X (e.g. BSIT 1-1).", 422
            )
        user.course_section = new_cs or None

    if "password" in data:
        valid, msg = validate_password(data["password"])
        if not valid:
            return error_response(msg, 422)
        user.set_password(data["password"])

    db.session.commit()
    return success_response(user.to_dict(), "Profile updated.")


def is_token_revoked(jwt_header, jwt_payload):
    return jwt_payload["jti"] in _blocklist