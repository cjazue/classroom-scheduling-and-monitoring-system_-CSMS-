from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request

from app.models.reservation import Reservation, ReservationStatus
from app.models.room import Room, Building, Campus
from app.utils import (
    any_authenticated,
    success_response,
    error_response,
    parse_date,
)

schedules_bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")


@schedules_bp.route("", methods=["GET"])
@any_authenticated
def list_schedules():
    """Return approved schedules grouped per room."""
    date_str = request.args.get("date")
    target_date = parse_date(date_str) if date_str else datetime.utcnow().date()
    if date_str and not target_date:
        return error_response("Invalid date format. Use YYYY-MM-DD.", 422)

    include_empty = (request.args.get("include_empty") or "false").lower() == "true"

    room_id = (request.args.get("room_id") or "").strip() or None
    building_id = (request.args.get("building_id") or "").strip() or None
    campus_id = (request.args.get("campus_id") or "").strip() or None

    room_query = Room.query.join(Building, Room.building_id == Building.id).join(
        Campus, Building.campus_id == Campus.id
    )
    room_query = room_query.filter(Room.is_active == 1)

    if room_id:
        room_query = room_query.filter(Room.id == room_id)
    if building_id:
        room_query = room_query.filter(Room.building_id == building_id)
    if campus_id:
        room_query = room_query.filter(Building.campus_id == campus_id)

    rooms = room_query.order_by(Room.code.asc()).all() if include_empty else []
    rooms_by_id = {r.id: r for r in rooms}

    approved = Reservation.db_status(ReservationStatus.APPROVED)
    resv_query = Reservation.query.join(Room).join(Building, Room.building_id == Building.id).join(
        Campus, Building.campus_id == Campus.id
    )
    resv_query = resv_query.filter(Reservation.status == approved, Reservation.date == target_date)

    if room_id:
        resv_query = resv_query.filter(Reservation.room_id == room_id)
    if building_id:
        resv_query = resv_query.filter(Room.building_id == building_id)
    if campus_id:
        resv_query = resv_query.filter(Building.campus_id == campus_id)

    reservations = resv_query.order_by(Room.code.asc(), Reservation.start_time.asc()).all()

    grouped: dict[str, dict] = {}
    for r in reservations:
        room = getattr(r, "room", None)
        if room:
            rooms_by_id[room.id] = room

        rid = r.room_id
        if rid not in grouped:
            grouped[rid] = {
                "room": room.to_dict(include_occupancy=False) if room else {"id": rid},
                "schedule": [],
            }
        grouped[rid]["schedule"].append(r.to_dict(include_room=False))

    if include_empty:
        for rid, room in rooms_by_id.items():
            if rid not in grouped:
                grouped[rid] = {
                    "room": room.to_dict(include_occupancy=False),
                    "schedule": [],
                }

    return success_response(
        {
            "date": target_date.isoformat(),
            "rooms": list(grouped.values()),
        }
    )
