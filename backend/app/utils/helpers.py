from datetime import datetime, date, time
from flask import jsonify, request
import re

def success_response(data=None, message: str = "Success", status_code: int = 200):
    resp = {"success": True, "message": message}
    if data is not None:
        resp["data"] = data
    return jsonify(resp), status_code


def error_response(message: str = "An error occurred", status_code: int = 400, errors=None):
    resp = {"success": False, "error": message}
    if errors:
        resp["errors"] = errors
    return jsonify(resp), status_code


def paginate_query(query, schema_fn):
    page = request.args.get("page", 1, type=int)
    per_page = min(request.args.get("per_page", 20, type=int), 100)
    pagination = query.paginate(page=page, per_page=per_page, error_out=False)
    return {
        "items": [schema_fn(item) for item in pagination.items],
        "pagination": {
            "page": pagination.page,
            "per_page": pagination.per_page,
            "total": pagination.total,
            "pages": pagination.pages,
            "has_next": pagination.has_next,
            "has_prev": pagination.has_prev,
        },
    }


def validate_email(email: str) -> bool:
    pattern = r"^[a-zA-Z0-9_.+-]+@plv\.edu\.ph$"
    return bool(re.match(pattern, email))


def validate_student_id(student_id: str) -> bool:
    return bool(re.fullmatch(r"\d{2}-\d{4}", student_id))


def validate_course_section(value: str) -> bool:
    """
    Format: AAAA X-X
    """
    return bool(re.fullmatch(r"[A-Z]{4} (10|[1-9])-(10|[1-9])", value))


def validate_password(password: str) -> tuple[bool, str]:
    """Minimum: 8 chars, 1 uppercase, 1 lowercase, 1 digit."""
    if len(password) < 8:
        return False, "Password must be at least 8 characters."
    if not re.search(r"[A-Z]", password):
        return False, "Password must contain at least one uppercase letter."
    if not re.search(r"[a-z]", password):
        return False, "Password must contain at least one lowercase letter."
    if not re.search(r"\d", password):
        return False, "Password must contain at least one digit."
    return True, ""


def parse_date(date_str: str) -> date | None:
    try:
        return datetime.strptime(date_str, "%Y-%m-%d").date()
    except (ValueError, TypeError):
        return None


def parse_time(time_str: str) -> time | None:
    try:
        return datetime.strptime(time_str, "%H:%M").time()
    except (ValueError, TypeError):
        return None


def require_json_fields(data: dict, required: list[str]) -> list[str]:
    return [f for f in required if not data.get(f)]