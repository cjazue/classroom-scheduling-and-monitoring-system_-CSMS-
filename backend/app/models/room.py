from __future__ import annotations

import re
from datetime import datetime, date, time

from app.extensions import db


def _to_title(s: str | None) -> str | None:
    if not s:
        return None
    # Keep acronyms stable-ish (CPAG) while still title-casing normal words.
    t = " ".join(w.capitalize() for w in str(s).strip().split())
    return t.replace("Cpag", "CPAG").replace("Plv", "PLV")


def _campus_code_key(name: str | None) -> str:
    n = (name or "").strip().lower()
    if "annex" in n:
        return "ANNEX"
    if "cpag" in n:
        return "CPAG"
    # Maysan campus is the "main" campus in the frontend UI.
    return "MAIN"


def _parse_floor_number(value: str | None) -> int | None:
    if not value:
        return None
    m = re.search(r"(\d+)", str(value))
    return int(m.group(1)) if m else None


ROOM_TYPES = ("lecture", "laboratory", "conference", "office", "other")


class Campus(db.Model):
    __tablename__ = "Campus"

    id = db.Column(db.String(32), primary_key=True)
    name = db.Column(db.String(150), nullable=True)
    campus_code = db.Column("campus_code", db.String(50), nullable=True)
    address = db.Column(db.String(255), nullable=True)
    created_at = db.Column(db.DateTime, nullable=True)

    buildings = db.relationship(
        "Building",
        backref="campus",
        lazy="dynamic",
        foreign_keys="Building.campus_id",
    )

    @property
    def code(self) -> str:
        return _campus_code_key(self.name)

    @property
    def display_name(self) -> str:
        return _to_title(self.name) or "Campus"

    def to_dict(self, include_buildings: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.display_name,
            "code": self.code,
            "address": self.address,
        }
        if include_buildings:
            data["buildings"] = [b.to_dict(include_rooms=False) for b in self.buildings.order_by(Building.name).all()]
        return data

    def __repr__(self) -> str:
        return f"<Campus {self.id} {self.code}>"


class Building(db.Model):
    __tablename__ = "Buildings"

    id = db.Column(db.String(32), primary_key=True)
    name = db.Column(db.String(150), nullable=True)
    code = db.Column("bldg_code", db.String(30), nullable=True)
    campus_id = db.Column(db.String(32), db.ForeignKey("Campus.id"), nullable=True, index=True)
    description = db.Column(db.Text, nullable=True)
    created_at = db.Column(db.DateTime, nullable=True)

    rooms = db.relationship(
        "Room",
        backref="building",
        lazy="dynamic",
        foreign_keys="Room.building_id",
    )

    @property
    def display_name(self) -> str:
        return _to_title(self.name) or "Building"

    def to_dict(self, include_rooms: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": self.display_name,
            "code": (self.code or "").strip().upper() or None,
            "campus_id": self.campus_id,
            "campus": self.campus.display_name if self.campus else None,
            "campus_code": self.campus.code if self.campus else None,
            "description": self.description,
        }
        if include_rooms:
            data["rooms"] = [r.to_dict(include_occupancy=False) for r in self.rooms.order_by(Room.code).all()]
        return data

    def __repr__(self) -> str:
        return f"<Building {self.id} {self.code}>"


class Room(db.Model):
    __tablename__ = "Room"

    id = db.Column(db.String(32), primary_key=True)
    name = db.Column(db.String(150), nullable=True)
    code = db.Column("room_code", db.String(50), nullable=True, index=True)
    building_id = db.Column("bldg_id", db.String(32), db.ForeignKey("Buildings.id"), nullable=True, index=True)
    floor_raw = db.Column("floor", db.String(20), nullable=True)
    floor_type = db.Column(db.String(50), nullable=True)
    created_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True)
    is_active = db.Column("active_flag", db.Integer, default=1, nullable=False)

    reservations = db.relationship(
        "Reservation",
        backref="room",
        lazy="dynamic",
        foreign_keys="Reservation.room_id",
    )

    @property
    def floor(self) -> int | None:
        return _parse_floor_number(self.floor_raw)

    def is_occupied_at(self, check_date: date, check_time: time) -> bool:
        from app.models.reservation import Reservation, ReservationStatus

        hhmm = check_time.strftime("%H:%M")
        approved = Reservation.db_status(ReservationStatus.APPROVED)
        return (
            self.reservations.filter(
                Reservation.status == approved,
                Reservation.date == check_date,
                Reservation.start_time <= hhmm,
                Reservation.end_time > hhmm,
            ).count()
            > 0
        )

    def current_reservation(self):
        from app.models.reservation import Reservation, ReservationStatus

        now = datetime.utcnow()
        today = now.date()
        hhmm = now.strftime("%H:%M")
        approved = Reservation.db_status(ReservationStatus.APPROVED)
        return (
            self.reservations.filter(
                Reservation.status == approved,
                Reservation.date == today,
                Reservation.start_time <= hhmm,
                Reservation.end_time > hhmm,
            )
            .order_by(Reservation.start_time.asc())
            .first()
        )

    def to_dict(self, include_occupancy: bool = False) -> dict:
        data = {
            "id": self.id,
            "name": _to_title(self.name) or (self.code or "Room"),
            "code": (self.code or "").strip().upper() or None,
            "building_id": self.building_id,
            "building": self.building.display_name if self.building else None,
            "building_code": (self.building.code or "").strip().upper() if self.building and self.building.code else None,
            "campus": self.building.campus.display_name if self.building and self.building.campus else None,
            "campus_code": self.building.campus.code if self.building and self.building.campus else None,
            "floor": self.floor,
            "room_type": "lecture",
            "is_active": bool(self.is_active),
            "notes": None,
        }
        if include_occupancy:
            current = self.current_reservation()
            data["is_occupied"] = current is not None
            data["current_reservation"] = current.to_dict(include_room=False) if current else None
        return data

    def __repr__(self) -> str:
        return f"<Room {self.id} {self.code}>"
