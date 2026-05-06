from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from flask import Blueprint, request

from app.extensions import db
from app.models.room import Campus, Building, Room, ROOM_TYPES
from app.utils import (
    admin_required,
    any_authenticated,
    success_response,
    error_response,
    paginate_query,
    parse_date,
    parse_time,
)

rooms_bp = Blueprint("rooms", __name__, url_prefix="/api")


def _gen_id(prefix: str) -> str:
    return f"{prefix}{uuid4().hex[:10].upper()}"


@rooms_bp.route("/campuses", methods=["GET"])
@any_authenticated
def list_campuses():
    include_buildings = request.args.get("include_buildings", "false").lower() == "true"
    campuses = Campus.query.order_by(Campus.name).all()
    return success_response([c.to_dict(include_buildings=include_buildings) for c in campuses])


@rooms_bp.route("/campuses/<campus_id>", methods=["GET"])
@any_authenticated
def get_campus(campus_id: str):
    campus = Campus.query.get_or_404(campus_id)
    return success_response(campus.to_dict(include_buildings=True))


@rooms_bp.route("/campuses", methods=["POST"])
@admin_required
def create_campus():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or data.get("campus_code") or "").strip().upper()
    address = (data.get("address") or data.get("description") or "").strip()

    if not name:
        return error_response("Name is required.", 422)

    campus = Campus(
        id=(data.get("id") or _gen_id("CAM")),
        name=name,
        campus_code=code or None,
        address=address or None,
        created_at=datetime.utcnow(),
    )
    db.session.add(campus)
    db.session.commit()
    return success_response(campus.to_dict(), "Campus created.", 201)


@rooms_bp.route("/campuses/<campus_id>", methods=["PATCH"])
@admin_required
def update_campus(campus_id: str):
    campus = Campus.query.get_or_404(campus_id)
    data = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        campus.name = data["name"].strip()
    if "address" in data:
        campus.address = data["address"].strip() or None
    if "campus_code" in data:
        campus.campus_code = data["campus_code"].strip() or None

    db.session.commit()
    return success_response(campus.to_dict(), "Campus updated.")


@rooms_bp.route("/campuses/<campus_id>", methods=["DELETE"])
@admin_required
def delete_campus(campus_id: str):
    campus = Campus.query.get_or_404(campus_id)
    db.session.delete(campus)
    db.session.commit()
    return success_response(message="Campus deleted.")


@rooms_bp.route("/buildings", methods=["GET"])
@any_authenticated
def list_buildings():
    campus_id = (request.args.get("campus_id") or "").strip() or None
    include_rooms = request.args.get("include_rooms", "false").lower() == "true"

    query = Building.query.order_by(Building.name)
    if campus_id:
        query = query.filter_by(campus_id=campus_id)

    return success_response([b.to_dict(include_rooms=include_rooms) for b in query.all()])


@rooms_bp.route("/buildings/<building_id>", methods=["GET"])
@any_authenticated
def get_building(building_id: str):
    building = Building.query.get_or_404(building_id)
    return success_response(building.to_dict(include_rooms=True))


@rooms_bp.route("/buildings", methods=["POST"])
@admin_required
def create_building():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip().upper()
    campus_id = (data.get("campus_id") or "").strip()
    description = (data.get("description") or "").strip()

    if not name or not code or not campus_id:
        return error_response("Name, code, and campus_id are required.", 422)
    if not Campus.query.get(campus_id):
        return error_response("Campus not found.", 404)
    if Building.query.filter_by(code=code, campus_id=campus_id).first():
        return error_response(f"Building code '{code}' already exists in this campus.", 409)

    building = Building(
        id=(data.get("id") or _gen_id("BLDG")),
        name=name,
        code=code,
        campus_id=campus_id,
        description=description or None,
        created_at=datetime.utcnow(),
    )
    db.session.add(building)
    db.session.commit()
    return success_response(building.to_dict(), "Building created.", 201)


@rooms_bp.route("/buildings/<building_id>", methods=["PATCH"])
@admin_required
def update_building(building_id: str):
    building = Building.query.get_or_404(building_id)
    data = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        building.name = data["name"].strip()
    if "description" in data:
        building.description = data["description"].strip() or None
    if "is_active" in data:
        # legacy table doesn't have is_active; ignore silently for compatibility
        pass

    db.session.commit()
    return success_response(building.to_dict(), "Building updated.")


@rooms_bp.route("/buildings/<building_id>", methods=["DELETE"])
@admin_required
def delete_building(building_id: str):
    building = Building.query.get_or_404(building_id)
    db.session.delete(building)
    db.session.commit()
    return success_response(message="Building deleted.")


@rooms_bp.route("/rooms", methods=["GET"])
@any_authenticated
def list_rooms():
    query = Room.query.join(Building).join(Campus)

    campus_id = (request.args.get("campus_id") or "").strip() or None
    building_id = (request.args.get("building_id") or "").strip() or None
    is_active = request.args.get("is_active")
    search = request.args.get("search", "").strip()

    if campus_id:
        query = query.filter(Building.campus_id == campus_id)
    if building_id:
        query = query.filter(Room.building_id == building_id)
    if is_active is not None:
        want_active = is_active.lower() == "true"
        query = query.filter(Room.is_active == (1 if want_active else 0))
    if search:
        query = query.filter(db.or_(Room.name.ilike(f"%{search}%"), Room.code.ilike(f"%{search}%")))

    avail_date = parse_date(request.args.get("available_on", ""))
    avail_from = parse_time(request.args.get("available_from", ""))
    avail_until = parse_time(request.args.get("available_until", ""))

    if avail_date and avail_from and avail_until:
        from app.models.reservation import Reservation, ReservationStatus

        start_hhmm = avail_from.strftime("%H:%M")
        end_hhmm = avail_until.strftime("%H:%M")

        conflicts = (
            db.session.query(Reservation.room_id)
            .filter(
                Reservation.status == Reservation.db_status(ReservationStatus.APPROVED),
                Reservation.date == avail_date,
                Reservation.start_time < end_hhmm,
                Reservation.end_time > start_hhmm,
            )
            .subquery()
        )
        query = query.filter(Room.id.not_in(conflicts))

    data = paginate_query(query.order_by(Room.code), lambda r: r.to_dict(include_occupancy=True))
    return success_response(data)


@rooms_bp.route("/rooms/<room_id>", methods=["GET"])
@any_authenticated
def get_room(room_id: str):
    room = Room.query.get_or_404(room_id)
    return success_response(room.to_dict(include_occupancy=True))


@rooms_bp.route("/rooms/<room_id>/schedule", methods=["GET"])
@any_authenticated
def get_room_schedule(room_id: str):
    room = Room.query.get_or_404(room_id)
    date_str = request.args.get("date")
    target_date = parse_date(date_str) if date_str else datetime.utcnow().date()

    from app.models.reservation import Reservation, ReservationStatus

    reservations = (
        Reservation.query.filter(
            Reservation.room_id == room_id,
            Reservation.date == target_date,
            Reservation.status == Reservation.db_status(ReservationStatus.APPROVED),
        )
        .order_by(Reservation.start_time.asc())
        .all()
    )

    return success_response(
        {
            "room": room.to_dict(),
            "date": target_date.isoformat(),
            "schedule": [r.to_dict(include_room=False) for r in reservations],
        }
    )


@rooms_bp.route("/rooms", methods=["POST"])
@admin_required
def create_room():
    data = request.get_json(silent=True) or {}
    name = (data.get("name") or "").strip()
    code = (data.get("code") or "").strip().upper()
    building_id = (data.get("building_id") or "").strip()

    errors = {}
    if not name:
        errors["name"] = "Room name is required."
    if not code:
        errors["code"] = "Room code is required."
    if not building_id:
        errors["building_id"] = "Building ID is required."
    if errors:
        return error_response("Validation failed.", 422, errors)

    if not Building.query.get(building_id):
        return error_response("Building not found.", 404)
    if Room.query.filter_by(code=code, building_id=building_id).first():
        return error_response(f"Room code '{code}' already exists in this building.", 409)

    floor = data.get("floor")
    floor_raw = str(floor).strip() if floor is not None else None

    room = Room(
        id=(data.get("id") or _gen_id("RM")),
        name=name,
        code=code,
        building_id=building_id,
        floor_raw=floor_raw,
        floor_type=(data.get("floor_type") or None),
        is_active=1,
        created_at=datetime.utcnow(),
        updated_at=datetime.utcnow(),
    )
    db.session.add(room)
    db.session.commit()
    return success_response(room.to_dict(), "Room created.", 201)


@rooms_bp.route("/rooms/<room_id>", methods=["PATCH"])
@admin_required
def update_room(room_id: str):
    room = Room.query.get_or_404(room_id)
    data = request.get_json(silent=True) or {}

    if "name" in data and data["name"].strip():
        room.name = data["name"].strip()
    if "floor" in data:
        room.floor_raw = str(data["floor"]).strip() if data["floor"] is not None else None
    if "is_active" in data:
        room.is_active = 1 if bool(data["is_active"]) else 0

    room.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(room.to_dict(), "Room updated.")


@rooms_bp.route("/rooms/<room_id>", methods=["DELETE"])
@admin_required
def delete_room(room_id: str):
    room = Room.query.get_or_404(room_id)
    room.is_active = 0
    room.updated_at = datetime.utcnow()
    db.session.commit()
    return success_response(message="Room deactivated.")

