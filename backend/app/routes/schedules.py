from __future__ import annotations

from datetime import datetime

from flask import Blueprint, request

from app.extensions import db
from app.models.reservation import Reservation, ReservationStatus
from app.models.room import Room, Building, Campus
from app.models.schedule import Schedule, normalize_room_token
from app.utils import (
    any_authenticated,
    success_response,
    error_response,
    parse_date,
    parse_time,
)

schedules_bp = Blueprint("schedules", __name__, url_prefix="/api/schedules")


def _minutes(t) -> int:
    return t.hour * 60 + t.minute


def _room_token_map(rooms: list[Room]) -> dict[str, set[str]]:
    token_to_ids: dict[str, set[str]] = {}
    for r in rooms:
        for token in (normalize_room_token(r.id), normalize_room_token(r.code)):
            if not token:
                continue
            token_to_ids.setdefault(token, set()).add(r.id)
    return token_to_ids


def _room_by_id(rooms: list[Room]) -> dict[str, Room]:
    return {r.id: r for r in rooms}


@schedules_bp.route("", methods=["GET"])
@any_authenticated
def list_schedules():
    """List weekly schedules for a given date/day, enriched with room metadata when possible."""
    date_str = request.args.get("date")
    day_str = (request.args.get("day") or "").strip()

    target_date = None
    if date_str:
        target_date = parse_date(date_str)
        if not target_date:
            return error_response("Invalid date format. Use YYYY-MM-DD.", 422)

    if target_date:
        day_name = target_date.strftime("%A")
        date_out = target_date.isoformat()
    else:
        # Default to today.
        today = datetime.utcnow().date()
        day_name = day_str or today.strftime("%A")
        date_out = today.isoformat()

    # Optional time slot filter (HH:MM, 24-hour)
    avail_from = parse_time(request.args.get("available_from", ""))
    avail_until = parse_time(request.args.get("available_until", ""))
    start_min = _minutes(avail_from) if avail_from else None
    end_min = _minutes(avail_until) if avail_until else None

    include_unresolved = (request.args.get("include_unresolved") or "false").lower() == "true"

    room_id = (request.args.get("room_id") or "").strip() or None
    building_id = (request.args.get("building_id") or "").strip() or None
    campus_id = (request.args.get("campus_id") or "").strip() or None

    room_query = Room.query.join(Building).join(Campus).filter(Room.is_active == 1)
    if room_id:
        room_query = room_query.filter(Room.id == room_id)
    if building_id:
        room_query = room_query.filter(Room.building_id == building_id)
    if campus_id:
        room_query = room_query.filter(Building.campus_id == campus_id)

    rooms = room_query.order_by(Room.code.asc()).all()
    token_to_room_ids = _room_token_map(rooms)
    rooms_by_id = _room_by_id(rooms)

    schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()

    items: list[dict] = []
    for s in schedules:
        if not s or not s.room_token:
            continue
        if start_min is not None and end_min is not None and start_min < end_min:
            if not s.overlaps(start_min, end_min):
                continue

        room_ids = token_to_room_ids.get(s.room_token, set())
        if not room_ids:
            if include_unresolved:
                row = s.to_dict(include_room_key=True)
                row["room"] = {"id": None, "code": s.room_key}
                items.append(row)
            continue

        for rid in sorted(room_ids):
            room = rooms_by_id.get(rid)
            row = s.to_dict(include_room_key=False)
            row["room_id"] = rid
            row["room"] = room.to_dict(include_occupancy=False) if room else {"id": rid}
            items.append(row)

    # Sort by room code, then time
    items.sort(
        key=lambda x: (
            (x.get("room") or {}).get("code") or "ZZZ",
            x.get("start_time") or "99:99",
            x.get("end_time") or "99:99",
        )
    )

    return success_response({"date": date_out, "day": day_name, "items": items})


@schedules_bp.route("/occupancy", methods=["GET"])
@any_authenticated
def occupancy():
    """Return occupied rooms/events for a given date + time slot.

    A room is considered occupied if *any* weekly schedule overlaps the slot,
    and (optionally) if any approved reservation overlaps the same slot.
    """
    date_str = request.args.get("date")
    if not date_str:
        return error_response("date is required (YYYY-MM-DD).", 422)

    target_date = parse_date(date_str)
    if not target_date:
        return error_response("Invalid date format. Use YYYY-MM-DD.", 422)

    avail_from = parse_time(request.args.get("available_from", ""))
    avail_until = parse_time(request.args.get("available_until", ""))
    if not avail_from or not avail_until:
        return error_response("available_from and available_until are required (HH:MM).", 422)

    start_hhmm = avail_from.strftime("%H:%M")
    end_hhmm = avail_until.strftime("%H:%M")
    start_min = _minutes(avail_from)
    end_min = _minutes(avail_until)
    if start_min >= end_min:
        return error_response("available_from must be before available_until.", 422)

    include_reservations = (request.args.get("include_reservations") or "true").lower() == "true"

    room_id = (request.args.get("room_id") or "").strip() or None
    building_id = (request.args.get("building_id") or "").strip() or None
    campus_id = (request.args.get("campus_id") or "").strip() or None

    room_query = Room.query.join(Building).join(Campus).filter(Room.is_active == 1)
    if room_id:
        room_query = room_query.filter(Room.id == room_id)
    if building_id:
        room_query = room_query.filter(Room.building_id == building_id)
    if campus_id:
        room_query = room_query.filter(Building.campus_id == campus_id)

    rooms = room_query.order_by(Room.code.asc()).all()
    token_to_room_ids = _room_token_map(rooms)
    rooms_by_id = _room_by_id(rooms)

    day_name = target_date.strftime("%A")

    events: list[dict] = []
    occupied_room_ids: set[str] = set()

    # Weekly schedules
    schedules = Schedule.query.filter(db.func.lower(Schedule.day) == day_name.lower()).all()
    for s in schedules:
        if not s or not s.room_token:
            continue
        if not s.overlaps(start_min, end_min):
            continue
        for rid in token_to_room_ids.get(s.room_token, set()):
            room = rooms_by_id.get(rid)
            occupied_room_ids.add(rid)
            events.append(
                {
                    "type": "schedule",
                    "room_id": rid,
                    "room": room.to_dict(include_occupancy=False) if room else {"id": rid},
                    "schedule": s.to_dict(include_room_key=True),
                }
            )

    # Approved reservations (date-specific)
    if include_reservations:
        approved = Reservation.db_status(ReservationStatus.APPROVED)
        resv_query = Reservation.query.join(Room).join(Building).join(Campus).filter(
            Reservation.status == approved,
            Reservation.date == target_date,
            Reservation.start_time < end_hhmm,
            Reservation.end_time > start_hhmm,
        )
        if room_id:
            resv_query = resv_query.filter(Reservation.room_id == room_id)
        if building_id:
            resv_query = resv_query.filter(Room.building_id == building_id)
        if campus_id:
            resv_query = resv_query.filter(Building.campus_id == campus_id)

        for r in resv_query.all():
            rid = r.room_id
            occupied_room_ids.add(rid)
            events.append(
                {
                    "type": "reservation",
                    "room_id": rid,
                    "room": r.room.to_dict(include_occupancy=False) if getattr(r, "room", None) else {"id": rid},
                    "reservation": r.to_dict(include_room=False),
                }
            )

    events.sort(
        key=lambda x: (
            (x.get("room") or {}).get("code") or "ZZZ",
            # sort by event start_time if available
            ((x.get("schedule") or {}).get("start_time") if x.get("type") == "schedule" else (x.get("reservation") or {}).get("start_time"))
            or "99:99",
        )
    )

    return success_response(
        {
            "date": target_date.isoformat(),
            "day": day_name,
            "available_from": start_hhmm,
            "available_until": end_hhmm,
            "occupied_room_ids": sorted(occupied_room_ids),
            "events": events,
        }
    )

