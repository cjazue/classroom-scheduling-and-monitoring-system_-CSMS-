from datetime import datetime
from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity
from app.extensions import db
from app.models.reservation import Reservation, ReservationStatus
from app.models.room import Room
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

@reservations_bp.route("", methods=["POST"])
@authorized_user_required
def create_reservation():
    user_id = get_jwt_identity()
    data    = request.get_json(silent=True) or {}

    room_id        =  data.get("room_id")
    requestor_name = (data.get("requestor_name") or "").strip()
    course_section = (data.get("course_section") or "").strip()
    date_str       =  data.get("date")
    start_str      =  data.get("start_time")
    end_str        =  data.get("end_time")
    purpose        = (data.get("purpose") or "").strip()

    errors = {}
    if not room_id:        errors["room_id"]        = "Room is required."
    if not requestor_name: errors["requestor_name"] = "Requestor name is required."
    if not course_section: errors["course_section"] = "Course/Section is required."
    if not date_str:       errors["date"]           = "Date is required."
    if not start_str:      errors["start_time"]     = "Start time is required."
    if not end_str:        errors["end_time"]        = "End time is required."
    if errors:
        return error_response("Validation failed.", 422, errors)

    reserve_date = parse_date(date_str)
    if not reserve_date:
        return error_response("Invalid date format. Use YYYY-MM-DD.", 422)
    if reserve_date < datetime.utcnow().date():
        return error_response("Cannot make a reservation for a past date.", 422)

    start_time = parse_time(start_str)
    end_time   = parse_time(end_str)
    if not start_time: return error_response("Invalid start_time format. Use HH:MM.", 422)
    if not end_time:   return error_response("Invalid end_time format. Use HH:MM.", 422)
    if start_time >= end_time:
        return error_response("start_time must be before end_time.", 422)

    room = Room.query.get(room_id)
    if not room or not room.is_active:
        return error_response("Room not found or inactive.", 404)

    if Reservation.has_conflict(room_id, reserve_date, start_time, end_time):
        return error_response(
            "The requested time slot conflicts with an existing reservation.", 409
        )

    reservation = Reservation(
        user_id=user_id, room_id=room_id,
        requestor_name=requestor_name, course_section=course_section,
        date=reserve_date, start_time=start_time, end_time=end_time,
        purpose=purpose or None, status=ReservationStatus.PENDING,
    )
    db.session.add(reservation)
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation request submitted.", 201)

@reservations_bp.route("", methods=["GET"])
@any_authenticated
def list_reservations():
    from app.models.user import User
    from app.models.room import Building
    user_id = get_jwt_identity()
    user    = User.query.get(user_id)

    query = Reservation.query.join(Room)

    if user.role == "authorized_user":
        query = query.filter(Reservation.user_id == user_id)
    elif user.role == "student":
        query = query.filter(Reservation.status == ReservationStatus.APPROVED)

    status = request.args.get("status")
    if status and status in [s.value for s in ReservationStatus]:
        query = query.filter(Reservation.status == status)

    room_id     = request.args.get("room_id",     type=int)
    building_id = request.args.get("building_id", type=int)
    campus_id   = request.args.get("campus_id",   type=int)
    date_str    = request.args.get("date")

    if room_id:     query = query.filter(Reservation.room_id == room_id)
    if date_str:
        d = parse_date(date_str)
        if d: query = query.filter(Reservation.date == d)
    if building_id: query = query.filter(Room.building_id == building_id)
    if campus_id:
        query = query.join(Building, Room.building_id == Building.id).filter(
            Building.campus_id == campus_id
        )

    query = query.order_by(Reservation.date.desc(), Reservation.start_time.asc())
    data  = paginate_query(query, lambda r: r.to_dict())
    return success_response(data)


@reservations_bp.route("/<int:reservation_id>", methods=["GET"])
@any_authenticated
def get_reservation(reservation_id):
    from app.models.user import User
    user_id     = get_jwt_identity()
    user        = User.query.get(user_id)
    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role == "student" and reservation.status != ReservationStatus.APPROVED:
        return error_response("Not found.", 404)
    if user.role == "authorized_user" and reservation.user_id != user_id:
        return error_response("Not found.", 404)

    return success_response(reservation.to_dict())

@reservations_bp.route("/<int:reservation_id>/approve", methods=["PATCH"])
@admin_required
def approve_reservation(reservation_id):
    reviewer_id = get_jwt_identity()
    reservation = Reservation.query.get_or_404(reservation_id)

    if reservation.status != ReservationStatus.PENDING:
        return error_response(
            f"Only PENDING reservations can be approved. Current: {reservation.status}", 409
        )
    if Reservation.has_conflict(
        reservation.room_id, reservation.date,
        reservation.start_time, reservation.end_time,
        exclude_id=reservation.id,
    ):
        return error_response(
            "Cannot approve: another reservation already occupies this slot.", 409
        )

    reservation.status      = ReservationStatus.APPROVED
    reservation.reviewed_by = reviewer_id
    reservation.reviewed_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation approved.")


@reservations_bp.route("/<int:reservation_id>/reject", methods=["PATCH"])
@admin_required
def reject_reservation(reservation_id):
    reviewer_id = get_jwt_identity()
    data        = request.get_json(silent=True) or {}
    review_note = (data.get("review_note") or "").strip()
    reservation = Reservation.query.get_or_404(reservation_id)

    if reservation.status not in (ReservationStatus.PENDING, ReservationStatus.APPROVED):
        return error_response(
            f"Cannot reject a reservation with status: {reservation.status}", 409
        )

    reservation.status      = ReservationStatus.REJECTED
    reservation.reviewed_by = reviewer_id
    reservation.reviewed_at = datetime.utcnow()
    reservation.review_note = review_note or None
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation rejected.")


@reservations_bp.route("/<int:reservation_id>/cancel", methods=["PATCH"])
@authorized_user_required
def cancel_reservation(reservation_id):
    from app.models.user import User
    user_id     = get_jwt_identity()
    user        = User.query.get(user_id)
    reservation = Reservation.query.get_or_404(reservation_id)

    # authorized_user can only cancel their own
    if user.role == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only cancel your own reservations.", 403)

    if reservation.status in (ReservationStatus.REJECTED, ReservationStatus.CANCELLED):
        return error_response(f"Reservation is already {reservation.status}.", 409)

    reservation.status = ReservationStatus.CANCELLED
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation cancelled.")

@reservations_bp.route("/<int:reservation_id>", methods=["PATCH"])
@authorized_user_required
def update_reservation(reservation_id):
    from app.models.user import User
    user_id     = get_jwt_identity()
    user        = User.query.get(user_id)
    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only edit your own reservations.", 403)
    if reservation.status != ReservationStatus.PENDING:
        return error_response("Only PENDING reservations can be edited.", 409)

    data = request.get_json(silent=True) or {}
    if "requestor_name" in data and data["requestor_name"].strip():
        reservation.requestor_name = data["requestor_name"].strip()
    if "course_section" in data and data["course_section"].strip():
        reservation.course_section = data["course_section"].strip()
    if "purpose" in data:
        reservation.purpose = data["purpose"].strip() or None

    new_date  = parse_date(data["date"])       if "date"       in data else reservation.date
    new_start = parse_time(data["start_time"]) if "start_time" in data else reservation.start_time
    new_end   = parse_time(data["end_time"])   if "end_time"   in data else reservation.end_time

    if new_start >= new_end:
        return error_response("start_time must be before end_time.", 422)

    if (new_date, new_start, new_end) != (reservation.date, reservation.start_time, reservation.end_time):
        if Reservation.has_conflict(
            reservation.room_id, new_date, new_start, new_end, exclude_id=reservation.id
        ):
            return error_response("Updated time slot conflicts with an existing reservation.", 409)
        reservation.date       = new_date
        reservation.start_time = new_start
        reservation.end_time   = new_end

    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation updated.")