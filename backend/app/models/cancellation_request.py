from __future__ import annotations

import enum
from datetime import datetime

from app.extensions import db


STATUS_DB_TO_API = {
    "Pending": "pending",
    "Approved": "approved",
    "Rejected": "rejected",
}
STATUS_API_TO_DB = {v: k for k, v in STATUS_DB_TO_API.items()}


class CancellationStatus(str, enum.Enum):
    PENDING = "pending"
    APPROVED = "approved"
    REJECTED = "rejected"


class CancellationRequest(db.Model):
    """Reservation cancellation requests (admin-reviewed).

    This table is SQLAlchemy-managed (created at app startup if missing),
    to avoid altering the legacy SQLite bootstrap schema.
    """

    __tablename__ = "ReservationCancellationRequests"

    id = db.Column(db.String(48), primary_key=True)

    reservation_id = db.Column(
        db.String(48),
        db.ForeignKey("Reservations.id"),
        nullable=False,
        index=True,
    )

    requested_by = db.Column(
        db.String(64),
        db.ForeignKey("users.id"),
        nullable=False,
        index=True,
    )
    requested_at = db.Column(db.DateTime, nullable=False, default=datetime.utcnow)

    # Raw DB value: Pending | Approved | Rejected
    status = db.Column(db.String(20), nullable=False, default="Pending", index=True)

    reviewed_by = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    reviewed_at = db.Column(db.DateTime, nullable=True)
    review_note = db.Column(db.Text, nullable=True)

    created_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)
    updated_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

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
            raise ValueError(f"Invalid cancellation status: {status_key}")
        self.status = STATUS_API_TO_DB[status_key]

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "reservation_id": self.reservation_id,
            "status": self.status_key,
            "requested_by": self.requested_by,
            "requested_at": self.requested_at.isoformat() if self.requested_at else None,
            "reviewed_by": self.reviewed_by,
            "reviewed_at": self.reviewed_at.isoformat() if self.reviewed_at else None,
            "review_note": self.review_note,
        }

