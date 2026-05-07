from __future__ import annotations

import enum
from datetime import datetime, date

from app.extensions import db
from app.models.user import User


STATUS_DB_TO_API = {
    "Pending": "pending",
    "Approved": "approved",
    "Rejected": "rejected",
    "Cancelled": "cancelled",
}
STATUS_API_TO_DB = {v: k for k, v in STATUS_DB_TO_API.items()}


class ReservationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"
    CANCELLED = "cancelled"


class Reservation(db.Model):
    __tablename__ = "Reservations"

    id = db.Column(db.String(48), primary_key=True)

    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True, index=True)
    room_id = db.Column(db.String(32), db.ForeignKey("Room.id"), nullable=True, index=True)

    requestor_name = db.Column(db.String(150), nullable=True)
    course = db.Column(db.String(50), nullable=True)
    section = db.Column(db.String(20), nullable=True)
    role = db.Column(db.String(32), nullable=True)

    purpose = db.Column(db.Text, nullable=True)

    # Stored as DATE / ISO string by SQLite; SQLAlchemy handles ISO serialization.
    date = db.Column("req_dat", db.Date, nullable=True, index=True)

    # Stored as TEXT, expected "HH:MM" for new writes.
    start_time = db.Column(db.String(16), nullable=True)
    end_time = db.Column(db.String(16), nullable=True)

    # Raw DB value: Pending | Approved | Rejected | Cancelled
    status = db.Column(db.String(20), nullable=True, index=True)

    reviewed_by = db.Column(db.String(64), nullable=True)
    review_note = db.Column(db.Text, nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)

    created_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True)

    @property
    def status_key(self) -> str:
        return STATUS_DB_TO_API.get(self.status, (self.status or "").strip().lower())

    @classmethod
    def db_status(cls, status_key: str) -> str:
        status_key = (status_key or "").strip().lower()
        return STATUS_API_TO_DB.get(status_key, status_key)

    def set_status(self, status_key: str) -> None:
        status_key = (status_key or "").strip().lower()
        if status_key not in STATUS_API_TO_DB:
            raise ValueError(f"Invalid status: {status_key}")
        self.status = STATUS_API_TO_DB[status_key]

    @property
    def course_section(self) -> str | None:
        if self.course and self.section:
            return f"{self.course} {self.section}"
        if self.course and not self.section:
            return str(self.course)
        if self.section and not self.course:
            return str(self.section)
        return None

    @course_section.setter
    def course_section(self, value: str | None) -> None:
        value = (value or "").strip()
        if not value:
            self.course = None
            self.section = None
            return

        parts = value.split()
        if len(parts) == 1:
            token = parts[0].strip()
            if "-" in token and any(ch.isdigit() for ch in token):
                self.course = None
                self.section = token
            else:
                self.course = token
                self.section = None
            return

        self.course = parts[0].strip()
        self.section = " ".join(parts[1:]).strip()

    @staticmethod
    def has_conflict(room_id: str, date_value: date, start_hhmm: str, end_hhmm: str, exclude_id: str | None = None) -> bool:
        query = Reservation.query.filter(
            Reservation.room_id == room_id,
            Reservation.date == date_value,
            Reservation.status.in_([Reservation.db_status(ReservationStatus.APPROVED), Reservation.db_status(ReservationStatus.PENDING)]),
            Reservation.start_time < end_hhmm,
            Reservation.end_time > start_hhmm,
        )
        if exclude_id:
            query = query.filter(Reservation.id != exclude_id)
        return query.count() > 0

    def to_dict(self, include_room: bool = True) -> dict:
        data = {
            "id": self.id,
            "user_id": self.user_id,
            "requestor_name": self.requestor_name,
            "course_section": self.course_section,
            "purpose": self.purpose,
            "date": self.date.isoformat() if self.date else None,
            "start_time": self.start_time,
            "end_time": self.end_time,
            "status": self.status_key,
            "review_note": self.review_note,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_room and getattr(self, "room", None):
            data["room"] = self.room.to_dict(include_occupancy=False)
        else:
            data["room_id"] = self.room_id
        return data

    def __repr__(self) -> str:
        return f"<Reservation {self.id} room={self.room_id} {self.date} {self.start_time}-{self.end_time} [{self.status_key}]>"

