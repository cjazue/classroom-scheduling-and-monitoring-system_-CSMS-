from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.reservation import Reservation, ReservationStatus, STATUS_API_TO_DB
from app.models.room import Room, Building, Campus
from app.models.user import User
from app.utils import (
    admin_required,
    authorized_user_required,
    any_authenticated,
    success_response,
    error_response,
    paginate_query,
    parse_date,
    parse_time,
)

reservations_bp = Blueprint("reservations", __name__, url_prefix="/api/reservations")


def _gen_id(prefix: str = "RES") -> str:
    return f"{prefix}{uuid4().hex[:10].upper()}"


@reservations_bp.route("", methods=["POST"])
@authorized_user_required
def create_reservation():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    data = request.get_json(silent=True) or {}

    room_id = str(data.get("room_id") or "").strip()
    requestor_name = (data.get("requestor_name") or "").strip()
    course_section = (data.get("course_section") or "").strip().upper()
    date_str = data.get("date")
    start_str = data.get("start_time")
    end_str = data.get("end_time")
    purpose = (data.get("purpose") or "").strip()

    errors = {}
    if not room_id:
        errors["room_id"] = "Room is required."
    if not requestor_name:
        errors["requestor_name"] = "Requestor name is required."
    if not course_section:
        errors["course_section"] = "Course/Section is required."
    if not date_str:
        errors["date"] = "Date is required."
    if not start_str:
        errors["start_time"] = "Start time is required."
    if not end_str:
        errors["end_time"] = "End time is required."
    if errors:
        return error_response("Validation failed.", 422, errors)

    reserve_date = parse_date(date_str)
    if not reserve_date:
        return error_response("Invalid date format. Use YYYY-MM-DD.", 422)
    if reserve_date < datetime.utcnow().date():
        return error_response("Cannot make a reservation for a past date.", 422)

    start_time = parse_time(start_str)
    end_time = parse_time(end_str)
    if not start_time:
        return error_response("Invalid start_time format. Use HH:MM.", 422)
    if not end_time:
        return error_response("Invalid end_time format. Use HH:MM.", 422)
    if start_time >= end_time:
        return error_response("start_time must be before end_time.", 422)

    start_hhmm = start_time.strftime("%H:%M")
    end_hhmm = end_time.strftime("%H:%M")

    room = Room.query.get(room_id)
    if not room or not room.is_active:
        return error_response("Room not found or inactive.", 404)

    if Reservation.has_conflict(room_id, reserve_date, start_hhmm, end_hhmm):
        return error_response("The requested time slot conflicts with an existing reservation.", 409)

    reservation = Reservation(
        id=_gen_id("RES"),
        user_id=user_id,
        room_id=room_id,
        requestor_name=requestor_name,
        role=user.role,
        purpose=purpose or None,
        date=reserve_date,
        start_time=start_hhmm,
        end_time=end_hhmm,
        status=Reservation.db_status(ReservationStatus.PENDING),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    reservation.course_section = course_section

    db.session.add(reservation)
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation request submitted.", 201)


@reservations_bp.route("", methods=["GET"])
@any_authenticated
def list_reservations():
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    query = Reservation.query.join(Room).join(Building, Room.building_id == Building.id).join(
        Campus, Building.campus_id == Campus.id
    )

    if user.role_key == "authorized_user":
        query = query.filter(Reservation.user_id == user_id)
    elif user.role_key == "student":
        query = query.filter(Reservation.status == Reservation.db_status(ReservationStatus.APPROVED))

    status = (request.args.get("status") or "").strip().lower()
    if status:
        if status in STATUS_API_TO_DB:
            query = query.filter(Reservation.status == Reservation.db_status(status))
        else:
            return error_response("Invalid status filter.", 422)

    room_id = (request.args.get("room_id") or "").strip()
    building_id = (request.args.get("building_id") or "").strip()
    campus_id = (request.args.get("campus_id") or "").strip()
    date_str = request.args.get("date")

    if room_id:
        query = query.filter(Reservation.room_id == room_id)
    if building_id:
        query = query.filter(Room.building_id == building_id)
    if campus_id:
        query = query.filter(Building.campus_id == campus_id)
    if date_str:
        d = parse_date(date_str)
        if d:
            query = query.filter(Reservation.date == d)

    query = query.order_by(Reservation.date.desc(), Reservation.start_time.asc())
    data = paginate_query(query, lambda r: r.to_dict())
    return success_response(data)


@reservations_bp.route("/<reservation_id>", methods=["GET"])
@any_authenticated
def get_reservation(reservation_id: str):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role_key == "student" and reservation.status_key != ReservationStatus.APPROVED:
        return error_response("Not found.", 404)
    if user.role_key == "authorized_user" and reservation.user_id != user_id:
        return error_response("Not found.", 404)

    return success_response(reservation.to_dict())


@reservations_bp.route("/<reservation_id>/approve", methods=["PATCH"])
@admin_required
def approve_reservation(reservation_id: str):
    reviewer_id = get_jwt_identity()
    reservation = Reservation.query.get_or_404(reservation_id)

    if reservation.status_key != ReservationStatus.PENDING:
        return error_response(
            f"Only pending reservations can be approved. Current: {reservation.status_key}.",
            409,
        )

    if Reservation.has_conflict(
        reservation.room_id,
        reservation.date,
        reservation.start_time,
        reservation.end_time,
        exclude_id=reservation.id,
    ):
        return error_response("Cannot approve: another reservation already occupies this slot.", 409)

    reservation.status = Reservation.db_status(ReservationStatus.APPROVED)
    reservation.reviewed_by = reviewer_id
    reservation.reviewed_at = datetime.utcnow()
    reservation.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation approved.")


@reservations_bp.route("/<reservation_id>/reject", methods=["PATCH"])
@admin_required
def reject_reservation(reservation_id: str):
    reviewer_id = get_jwt_identity()
    data = request.get_json(silent=True) or {}
    review_note = (data.get("review_note") or "").strip()
    reservation = Reservation.query.get_or_404(reservation_id)

    if reservation.status_key not in (ReservationStatus.PENDING, ReservationStatus.APPROVED):
        return error_response(f"Cannot reject a reservation with status: {reservation.status_key}", 409)

    reservation.status = Reservation.db_status(ReservationStatus.REJECTED)
    reservation.reviewed_by = reviewer_id
    reservation.reviewed_at = datetime.utcnow()
    reservation.review_note = review_note or None
    reservation.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation rejected.")


@reservations_bp.route("/<reservation_id>/cancel", methods=["PATCH"])
@authorized_user_required
def cancel_reservation(reservation_id: str):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role_key == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only cancel your own reservations.", 403)

    if reservation.status_key in (ReservationStatus.REJECTED, ReservationStatus.CANCELLED):
        return error_response(f"Reservation is already {reservation.status_key}.", 409)

    reservation.status = Reservation.db_status(ReservationStatus.CANCELLED)
    reservation.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation cancelled.")


@reservations_bp.route("/<reservation_id>", methods=["PATCH"])
@authorized_user_required
def update_reservation(reservation_id: str):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role_key == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only edit your own reservations.", 403)
    if reservation.status_key != ReservationStatus.PENDING:
        return error_response("Only pending reservations can be edited.", 409)

    data = request.get_json(silent=True) or {}
    if "requestor_name" in data and str(data["requestor_name"]).strip():
        reservation.requestor_name = str(data["requestor_name"]).strip()
    if "course_section" in data and str(data["course_section"]).strip():
        reservation.course_section = str(data["course_section"]).strip().upper()
    if "purpose" in data:
        reservation.purpose = str(data["purpose"]).strip() or None

    new_date = reservation.date
    if "date" in data:
        parsed_date = parse_date(data.get("date"))
        if not parsed_date:
            return error_response("Invalid date format. Use YYYY-MM-DD.", 422)
        if parsed_date < datetime.utcnow().date():
            return error_response("Cannot make a reservation for a past date.", 422)
        new_date = parsed_date

    new_start = reservation.start_time
    if "start_time" in data:
        parsed_start = parse_time(data.get("start_time"))
        if not parsed_start:
            return error_response("Invalid start_time format. Use HH:MM.", 422)
        new_start = parsed_start.strftime("%H:%M")

    new_end = reservation.end_time
    if "end_time" in data:
        parsed_end = parse_time(data.get("end_time"))
        if not parsed_end:
            return error_response("Invalid end_time format. Use HH:MM.", 422)
        new_end = parsed_end.strftime("%H:%M")

    if new_start >= new_end:
        return error_response("start_time must be before end_time.", 422)

    if (new_date, new_start, new_end) != (reservation.date, reservation.start_time, reservation.end_time):
        if Reservation.has_conflict(reservation.room_id, new_date, new_start, new_end, exclude_id=reservation.id):
            return error_response("Updated time slot conflicts with an existing reservation.", 409)
        reservation.date = new_date
        reservation.start_time = new_start
        reservation.end_time = new_end

    reservation.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation updated.")
