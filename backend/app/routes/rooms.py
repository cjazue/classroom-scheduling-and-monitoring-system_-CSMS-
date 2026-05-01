from datetime import datetime
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


@rooms_bp.route("/campuses", methods=["GET"])
@any_authenticated
def list_campuses():
    include_buildings = request.args.get("include_buildings", "false").lower() == "true"
    campuses = Campus.query.order_by(Campus.name).all()
    return success_response([c.to_dict(include_buildings=include_buildings) for c in campuses])


@rooms_bp.route("/campuses/<int:campus_id>", methods=["GET"])
@any_authenticated
def get_campus(campus_id):
    campus = Campus.query.get_or_404(campus_id)
    return success_response(campus.to_dict(include_buildings=True))


@rooms_bp.route("/campuses", methods=["POST"])
@admin_required
def create_campus():
    data        = request.get_json(silent=True) or {}
    name        = (data.get("name")        or "").strip()
    code        = (data.get("code")        or "").strip().upper()
    description = (data.get("description") or "").strip()

    if not name or not code:
        return error_response("Name and code are required.", 422)
    if Campus.query.filter_by(code=code).first():
        return error_response(f"Campus code '{code}' already exists.", 409)

    campus = Campus(name=name, code=code, description=description or None)
    db.session.add(campus)
    db.session.commit()
    return success_response(campus.to_dict(), "Campus created.", 201)


@rooms_bp.route("/campuses/<int:campus_id>", methods=["PATCH"])
@admin_required
def update_campus(campus_id):
    campus = Campus.query.get_or_404(campus_id)
    data   = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        campus.name = data["name"].strip()
    if "description" in data:
        campus.description = data["description"].strip() or None
    db.session.commit()
    return success_response(campus.to_dict(), "Campus updated.")


@rooms_bp.route("/campuses/<int:campus_id>", methods=["DELETE"])
@admin_required
def delete_campus(campus_id):
    campus = Campus.query.get_or_404(campus_id)
    db.session.delete(campus)
    db.session.commit()
    return success_response(message="Campus deleted.")


@rooms_bp.route("/buildings", methods=["GET"])
@any_authenticated
def list_buildings():
    campus_id    = request.args.get("campus_id", type=int)
    include_rooms = request.args.get("include_rooms", "false").lower() == "true"
    query        = Building.query.order_by(Building.name)
    if campus_id:
        query = query.filter_by(campus_id=campus_id)
    return success_response([b.to_dict(include_rooms=include_rooms) for b in query.all()])


@rooms_bp.route("/buildings/<int:building_id>", methods=["GET"])
@any_authenticated
def get_building(building_id):
    building = Building.query.get_or_404(building_id)
    return success_response(building.to_dict(include_rooms=True))


@rooms_bp.route("/buildings", methods=["POST"])
@admin_required
def create_building():
    data        = request.get_json(silent=True) or {}
    name        = (data.get("name")        or "").strip()
    code        = (data.get("code")        or "").strip().upper()
    campus_id   =  data.get("campus_id")
    description = (data.get("description") or "").strip()

    if not name or not code or not campus_id:
        return error_response("Name, code, and campus_id are required.", 422)
    if not Campus.query.get(campus_id):
        return error_response("Campus not found.", 404)
    if Building.query.filter_by(code=code, campus_id=campus_id).first():
        return error_response(f"Building code '{code}' already exists in this campus.", 409)

    building = Building(name=name, code=code, campus_id=campus_id, description=description or None)
    db.session.add(building)
    db.session.commit()
    return success_response(building.to_dict(), "Building created.", 201)

@rooms_bp.route("/buildings/<int:building_id>", methods=["PATCH"])
@admin_required
def update_building(building_id):
    building = Building.query.get_or_404(building_id)
    data     = request.get_json(silent=True) or {}
    if "name" in data and data["name"].strip():
        building.name = data["name"].strip()
    if "description" in data:
        building.description = data["description"].strip() or None
    db.session.commit()
    return success_response(building.to_dict(), "Building updated.")

@rooms_bp.route("/buildings/<int:building_id>", methods=["DELETE"])
@admin_required
def delete_building(building_id):
    building = Building.query.get_or_404(building_id)
    db.session.delete(building)
    db.session.commit()
    return success_response(message="Building deleted.")

@rooms_bp.route("/rooms", methods=["GET"])
@any_authenticated
def list_rooms():
    query = Room.query.join(Building).join(Campus)

    campus_id   = request.args.get("campus_id",   type=int)
    building_id = request.args.get("building_id", type=int)
    room_type   = request.args.get("room_type")
    is_active   = request.args.get("is_active")
    search      = request.args.get("search", "").strip()

    if campus_id:
        query = query.filter(Building.campus_id == campus_id)
    if building_id:
        query = query.filter(Room.building_id == building_id)
    if room_type and room_type in ROOM_TYPES:
        query = query.filter(Room.room_type == room_type)
    if is_active is not None:
        query = query.filter(Room.is_active == (is_active.lower() == "true"))
    if search:
        query = query.filter(
            db.or_(Room.name.ilike(f"%{search}%"), Room.code.ilike(f"%{search}%"))
        )

    avail_date  = parse_date(request.args.get("available_on",    ""))
    avail_from  = parse_time(request.args.get("available_from",  ""))
    avail_until = parse_time(request.args.get("available_until", ""))

    if avail_date and avail_from and avail_until:
        from app.models.reservation import Reservation, ReservationStatus
        conflicts = db.session.query(Reservation.room_id).filter(
            Reservation.status == ReservationStatus.APPROVED,
            Reservation.date == avail_date,
            Reservation.start_time < avail_until,
            Reservation.end_time   > avail_from,
        ).subquery()
        query = query.filter(Room.id.not_in(conflicts))

    data = paginate_query(query.order_by(Room.code), lambda r: r.to_dict(include_occupancy=True))
    return success_response(data)


@rooms_bp.route("/rooms/<int:room_id>", methods=["GET"])
@any_authenticated
def get_room(room_id):
    room = Room.query.get_or_404(room_id)
    return success_response(room.to_dict(include_occupancy=True))


@rooms_bp.route("/rooms/<int:room_id>/schedule", methods=["GET"])
@any_authenticated
def get_room_schedule(room_id):
    room        = Room.query.get_or_404(room_id)
    date_str    = request.args.get("date")
    target_date = parse_date(date_str) if date_str else datetime.utcnow().date()

    from app.models.reservation import Reservation, ReservationStatus
    reservations = (
        Reservation.query
        .filter(
            Reservation.room_id == room_id,
            Reservation.date    == target_date,
            Reservation.status  == ReservationStatus.APPROVED,
        )
        .order_by(Reservation.start_time)
        .all()
    )
    return success_response({
        "room":     room.to_dict(),
        "date":     target_date.isoformat(),
        "schedule": [r.to_dict(include_room=False) for r in reservations],
    })


@rooms_bp.route("/rooms", methods=["POST"])
@admin_required
def create_room():
    data        = request.get_json(silent=True) or {}
    name        = (data.get("name") or "").strip()
    code        = (data.get("code") or "").strip().upper()
    building_id =  data.get("building_id")

    errors = {}
    if not name:        errors["name"]        = "Room name is required."
    if not code:        errors["code"]        = "Room code is required."
    if not building_id: errors["building_id"] = "Building ID is required."
    if errors:
        return error_response("Validation failed.", 422, errors)

    if not Building.query.get(building_id):
        return error_response("Building not found.", 404)
    if Room.query.filter_by(code=code, building_id=building_id).first():
        return error_response(f"Room code '{code}' already exists in this building.", 409)

    room_type = data.get("room_type", "lecture")
    if room_type not in ROOM_TYPES:
        return error_response(f"Invalid room type. Allowed: {ROOM_TYPES}", 422)

    room = Room(
        name=name, code=code, building_id=building_id,
        floor=data.get("floor"), room_type=room_type,
        notes=(data.get("notes") or "").strip() or None,
    )
    db.session.add(room)
    db.session.commit()
    return success_response(room.to_dict(), "Room created.", 201)


@rooms_bp.route("/rooms/<int:room_id>", methods=["PATCH"])
@admin_required
def update_room(room_id):
    room = Room.query.get_or_404(room_id)
    data = request.get_json(silent=True) or {}

    if "name"      in data and data["name"].strip(): room.name      = data["name"].strip()
    if "floor"     in data: room.floor     = data["floor"]
    if "room_type" in data:
        if data["room_type"] not in ROOM_TYPES:
            return error_response("Invalid room type.", 422)
        room.room_type = data["room_type"]
    if "is_active" in data: room.is_active = bool(data["is_active"])
    if "notes"     in data: room.notes     = data["notes"].strip() or None

    db.session.commit()
    return success_response(room.to_dict(), "Room updated.")


@rooms_bp.route("/rooms/<int:room_id>", methods=["DELETE"])
@admin_required
def delete_room(room_id):
    room = Room.query.get_or_404(room_id)
    room.is_active = False
    db.session.commit()
    return success_response(message="Room deactivated.")