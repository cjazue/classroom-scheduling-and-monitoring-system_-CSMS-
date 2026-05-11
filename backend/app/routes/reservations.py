from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from flask import Blueprint, request
from flask_jwt_extended import get_jwt_identity

from app.extensions import db
from app.models.reservation import Reservation, ReservationStatus, STATUS_API_TO_DB
from app.models.room import Room, Building, Campus
from app.models.schedule import Schedule, normalize_room_token
from app.models.user import User
from app.models.cancellation_request import CancellationRequest, CancellationStatus
from app.utils import (
    admin_required,
    authorized_user_required,
    any_authenticated,
    success_response,
    error_response,
    paginate_query,
    parse_date,
    parse_time,
    validate_course_section,
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

    # Block reservations that overlap an existing class schedule.
    start_min = start_time.hour * 60 + start_time.minute
    end_min = end_time.hour * 60 + end_time.minute
    day_name = reserve_date.strftime("%A")
    room_tokens = {normalize_room_token(room.id), normalize_room_token(room.code)}
    class_schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()
    for s in class_schedules:
        if not s or not s.room_token or s.room_token not in room_tokens:
            continue
        if s.overlaps(start_min, end_min):
            label = s.subject_code or s.subject or "scheduled class"
            return error_response(f"Room is occupied by a {label} schedule during this time slot.", 409)

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
        aliases = {"accepted": "approved", "declined": "rejected", "canceled": "cancelled"}
        status = aliases.get(status, status)
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

    # Enrich with pending cancellation requests (if any).
    try:
        items = data.get("items") if isinstance(data, dict) else None
        ids = [it.get("id") for it in (items or []) if isinstance(it, dict) and it.get("id")]
        if ids:
            pending_rows = (
                CancellationRequest.query.filter(
                    CancellationRequest.reservation_id.in_(ids),
                    CancellationRequest.status == CancellationRequest.db_status(CancellationStatus.PENDING),
                )
                .order_by(CancellationRequest.requested_at.desc())
                .all()
            )
            pending_by_res = {}
            for req in pending_rows:
                if req.reservation_id and req.reservation_id not in pending_by_res:
                    pending_by_res[req.reservation_id] = req

            for it in items:
                rid = it.get("id")
                req = pending_by_res.get(rid)
                if req:
                    it["cancellation"] = req.to_dict()
    except Exception:
        # Non-fatal; keep list endpoint resilient.
        pass
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

    # Ensure this approved reservation doesn't overlap a class schedule.
    room = Room.query.get(reservation.room_id)
    if room and reservation.date and reservation.start_time and reservation.end_time:
        day_name = reservation.date.strftime("%A")
        room_tokens = {normalize_room_token(room.id), normalize_room_token(room.code)}

        start_t = parse_time(reservation.start_time)
        end_t = parse_time(reservation.end_time)
        if start_t and end_t:
            start_min = start_t.hour * 60 + start_t.minute
            end_min = end_t.hour * 60 + end_t.minute
        else:
            start_min = None
            end_min = None

        if start_min is not None and end_min is not None and start_min < end_min:
            class_schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()
            for s in class_schedules:
                if not s or not s.room_token or s.room_token not in room_tokens:
                    continue
                if s.overlaps(start_min, end_min):
                    label = s.subject_code or s.subject or "scheduled class"
                    return error_response(f"Cannot approve: room is occupied by a {label} schedule.", 409)

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

    if user.role_key != "authorized_user":
        return error_response("Only authorized users can request cancellations.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role_key == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only cancel your own reservations.", 403)

    if reservation.status_key in (ReservationStatus.REJECTED, ReservationStatus.CANCELLED):
        return error_response(f"Reservation is already {reservation.status_key}.", 409)

    existing = (
        CancellationRequest.query.filter(
            CancellationRequest.reservation_id == reservation.id,
            CancellationRequest.status == CancellationRequest.db_status(CancellationStatus.PENDING),
        )
        .order_by(CancellationRequest.requested_at.desc())
        .first()
    )
    if existing:
        return success_response(existing.to_dict(), "Cancellation request already submitted.")

    req = CancellationRequest(
        id=_gen_id("CAN"),
        reservation_id=reservation.id,
        requested_by=user_id,
        requested_at=datetime.utcnow(),
        status=CancellationRequest.db_status(CancellationStatus.PENDING),
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )

    db.session.add(req)
    db.session.commit()
    return success_response(req.to_dict(), "Cancellation requested. Awaiting admin review.", 201)


@reservations_bp.route("/<reservation_id>/cancellation/approve", methods=["PATCH"])
@admin_required
def approve_cancellation(reservation_id: str):
    reviewer_id = get_jwt_identity()
    reservation = Reservation.query.get_or_404(reservation_id)

    req = (
        CancellationRequest.query.filter(
            CancellationRequest.reservation_id == reservation.id,
            CancellationRequest.status == CancellationRequest.db_status(CancellationStatus.PENDING),
        )
        .order_by(CancellationRequest.requested_at.desc())
        .first()
    )
    if not req:
        return error_response("No pending cancellation request found.", 404)

    req.status = CancellationRequest.db_status(CancellationStatus.APPROVED)
    req.reviewed_by = reviewer_id
    req.reviewed_at = datetime.utcnow()
    req.updated_at = datetime.utcnow()

    reservation.status = Reservation.db_status(ReservationStatus.CANCELLED)
    reservation.updated_at = datetime.utcnow()

    db.session.commit()
    return success_response(
        {"reservation": reservation.to_dict(), "cancellation": req.to_dict()},
        "Cancellation approved.",
    )


@reservations_bp.route("/<reservation_id>/cancellation/reject", methods=["PATCH"])
@admin_required
def reject_cancellation(reservation_id: str):
    reviewer_id = get_jwt_identity()
    reservation = Reservation.query.get_or_404(reservation_id)

    data = request.get_json(silent=True) or {}
    review_note = (data.get("review_note") or "").strip() or None

    req = (
        CancellationRequest.query.filter(
            CancellationRequest.reservation_id == reservation.id,
            CancellationRequest.status == CancellationRequest.db_status(CancellationStatus.PENDING),
        )
        .order_by(CancellationRequest.requested_at.desc())
        .first()
    )
    if not req:
        return error_response("No pending cancellation request found.", 404)

    req.status = CancellationRequest.db_status(CancellationStatus.REJECTED)
    req.reviewed_by = reviewer_id
    req.reviewed_at = datetime.utcnow()
    req.review_note = review_note
    req.updated_at = datetime.utcnow()

    db.session.commit()
    return success_response(
        {"reservation": reservation.to_dict(), "cancellation": req.to_dict()},
        "Cancellation rejected.",
    )


@reservations_bp.route("/<reservation_id>", methods=["PATCH"])
@authorized_user_required
def update_reservation(reservation_id: str):
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    is_admin = user.role_key in ("admin", "superadmin")

    if not is_admin and reservation.user_id != user_id:
        return error_response("You can only edit your own reservations.", 403)

    if not is_admin and reservation.status_key not in (ReservationStatus.PENDING, ReservationStatus.APPROVED):
        return error_response("Only pending/approved reservations can be edited.", 409)

    data = request.get_json(silent=True) or {}

    # -------------------------
    # Admin-only updates
    # -------------------------
    new_status_key = None
    review_note = None
    if "status" in data:
        if not is_admin:
            return error_response("Only admins can change reservation status.", 403)
        new_status_key = str(data.get("status") or "").strip().lower()
        # Accept common UI wording.
        aliases = {
            "accepted": ReservationStatus.APPROVED,
            "declined": ReservationStatus.REJECTED,
            "canceled": ReservationStatus.CANCELLED,
        }
        new_status_key = aliases.get(new_status_key, new_status_key)
        if new_status_key not in (
            ReservationStatus.PENDING,
            ReservationStatus.APPROVED,
            ReservationStatus.REJECTED,
            ReservationStatus.CANCELLED,
        ):
            return error_response("Invalid status. Allowed: pending, approved, rejected, cancelled.", 422)

    if "review_note" in data:
        if not is_admin:
            return error_response("Only admins can set review_note.", 403)
        review_note = str(data.get("review_note") or "").strip() or None

    # -------------------------
    # Shared field updates
    # -------------------------
    if "requestor_name" in data:
        next_name = str(data.get("requestor_name") or "").strip()
        if not next_name:
            return error_response("requestor_name is required.", 422)
        reservation.requestor_name = next_name

    if "course_section" in data:
        next_cs = str(data.get("course_section") or "").strip().upper()
        if next_cs and not validate_course_section(next_cs):
            return error_response("course_section must follow the format AAAA X-X (e.g. BSIT 1-1).", 422)
        reservation.course_section = next_cs or None

    if "purpose" in data:
        reservation.purpose = str(data.get("purpose") or "").strip() or None

    # Room change is admin-only (authorized users can only adjust schedule details).
    new_room_id = reservation.room_id
    if "room_id" in data:
        if not is_admin:
            return error_response("Only admins can change room_id.", 403)
        next_room = str(data.get("room_id") or "").strip()
        if not next_room:
            return error_response("room_id is required.", 422)
        room = Room.query.get(next_room)
        if not room or not room.is_active:
            return error_response("Room not found or inactive.", 404)
        new_room_id = next_room

    new_date = reservation.date
    if "date" in data:
        parsed_date = parse_date(data.get("date"))
        if not parsed_date:
            return error_response("Invalid date format. Use YYYY-MM-DD.", 422)
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

    slot_changed = (new_room_id, new_date, new_start, new_end) != (
        reservation.room_id,
        reservation.date,
        reservation.start_time,
        reservation.end_time,
    )

    # If an authorized user edits an approved reservation's schedule, re-queue it for approval.
    if not is_admin and reservation.status_key == ReservationStatus.APPROVED and slot_changed:
        new_status_key = ReservationStatus.PENDING

    # Validate "past" rule for active statuses.
    effective_status = new_status_key or reservation.status_key
    if effective_status in (ReservationStatus.PENDING, ReservationStatus.APPROVED):
        if new_date and new_date < datetime.utcnow().date():
            return error_response("Cannot set a reservation to a past date.", 422)

    if slot_changed:
        # Only check conflicts / schedule overlap when the reservation can affect availability.
        if effective_status in (ReservationStatus.PENDING, ReservationStatus.APPROVED):
            if Reservation.has_conflict(new_room_id, new_date, new_start, new_end, exclude_id=reservation.id):
                return error_response("Updated time slot conflicts with an existing reservation.", 409)

            # Also avoid overlapping class schedules.
            room = Room.query.get(new_room_id)
            if room and new_date and new_start and new_end:
                day_name = new_date.strftime("%A")
                room_tokens = {normalize_room_token(room.id), normalize_room_token(room.code)}

                start_t = parse_time(new_start)
                end_t = parse_time(new_end)
                if start_t and end_t:
                    start_min = start_t.hour * 60 + start_t.minute
                    end_min = end_t.hour * 60 + end_t.minute
                else:
                    start_min = None
                    end_min = None

                if start_min is not None and end_min is not None and start_min < end_min:
                    class_schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()
                    for s in class_schedules:
                        if not s or not s.room_token or s.room_token not in room_tokens:
                            continue
                        if s.overlaps(start_min, end_min):
                            label = s.subject_code or s.subject or "scheduled class"
                            return error_response(f"Updated time slot overlaps a {label} schedule.", 409)

        reservation.room_id = new_room_id
        reservation.date = new_date
        reservation.start_time = new_start
        reservation.end_time = new_end

    # Apply status changes last, so validations see the final slot.
    if new_status_key:
        if new_status_key == ReservationStatus.APPROVED:
            # Approving a reservation makes it active -> verify again.
            if Reservation.has_conflict(new_room_id, new_date, new_start, new_end, exclude_id=reservation.id):
                return error_response("Cannot approve: another reservation already occupies this slot.", 409)

            room = Room.query.get(new_room_id)
            if room and new_date and new_start and new_end:
                day_name = new_date.strftime("%A")
                room_tokens = {normalize_room_token(room.id), normalize_room_token(room.code)}

                start_t = parse_time(new_start)
                end_t = parse_time(new_end)
                if start_t and end_t:
                    start_min = start_t.hour * 60 + start_t.minute
                    end_min = end_t.hour * 60 + end_t.minute
                else:
                    start_min = None
                    end_min = None

                if start_min is not None and end_min is not None and start_min < end_min:
                    class_schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()
                    for s in class_schedules:
                        if not s or not s.room_token or s.room_token not in room_tokens:
                            continue
                        if s.overlaps(start_min, end_min):
                            label = s.subject_code or s.subject or "scheduled class"
                            return error_response(f"Cannot approve: room is occupied by a {label} schedule.", 409)

            reservation.status = Reservation.db_status(ReservationStatus.APPROVED)
            reservation.reviewed_by = user_id
            reservation.reviewed_at = datetime.utcnow()
            reservation.review_note = review_note

        elif new_status_key == ReservationStatus.REJECTED:
            reservation.status = Reservation.db_status(ReservationStatus.REJECTED)
            reservation.reviewed_by = user_id
            reservation.reviewed_at = datetime.utcnow()
            reservation.review_note = review_note

        elif new_status_key == ReservationStatus.CANCELLED:
            reservation.status = Reservation.db_status(ReservationStatus.CANCELLED)
            reservation.reviewed_by = None
            reservation.reviewed_at = None
            reservation.review_note = None

        elif new_status_key == ReservationStatus.PENDING:
            reservation.status = Reservation.db_status(ReservationStatus.PENDING)
            reservation.reviewed_by = None
            reservation.reviewed_at = None
            reservation.review_note = None

    reservation.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(reservation.to_dict(), "Reservation updated.")


@reservations_bp.route("/<reservation_id>", methods=["DELETE"])
@authorized_user_required
def delete_reservation(reservation_id: str):
    """Delete a reservation.

    - Authorized users: request cancellation (admin-reviewed).
    - Admin/superadmin: hard-delete any reservation record.
    """
    user_id = get_jwt_identity()
    user = User.query.get(user_id)
    if not user or not user.is_active:
        return error_response("Account inactive.", 403)

    reservation = Reservation.query.get_or_404(reservation_id)

    if user.role_key == "authorized_user" and reservation.user_id != user_id:
        return error_response("You can only delete your own reservations.", 403)

    if user.role_key == "authorized_user":
        if reservation.status_key in (ReservationStatus.REJECTED, ReservationStatus.CANCELLED):
            return error_response(f"Reservation is already {reservation.status_key}.", 409)

        existing = (
            CancellationRequest.query.filter(
                CancellationRequest.reservation_id == reservation.id,
                CancellationRequest.status == CancellationRequest.db_status(CancellationStatus.PENDING),
            )
            .order_by(CancellationRequest.requested_at.desc())
            .first()
        )
        if existing:
            return success_response(existing.to_dict(), "Cancellation request already submitted.")

        req = CancellationRequest(
            id=_gen_id("CAN"),
            reservation_id=reservation.id,
            requested_by=user_id,
            requested_at=datetime.utcnow(),
            status=CancellationRequest.db_status(CancellationStatus.PENDING),
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )

        db.session.add(req)
        db.session.commit()
        return success_response(req.to_dict(), "Cancellation requested. Awaiting admin review.", 201)

    # Admin / superadmin: remove from history entirely.
    db.session.delete(reservation)
    db.session.commit()
    return success_response(message="Reservation deleted.")
