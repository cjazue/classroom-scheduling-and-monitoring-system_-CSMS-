from __future__ import annotations

from datetime import datetime

from app.extensions import db


class ImportBatch(db.Model):
    __tablename__ = "ImportBatches"

    id = db.Column(db.String(32), primary_key=True)
    kind = db.Column(db.String(16), nullable=False, index=True)  # students | schedules
    filename = db.Column(db.String(255), nullable=True)

    # For schedule imports, an optional section label for grouping.
    section = db.Column(db.String(80), nullable=True, index=True)

    created_by = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=True)
    created_at = db.Column(db.DateTime, nullable=True, default=datetime.utcnow)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "kind": self.kind,
            "filename": self.filename,
            "section": self.section,
            "created_by": self.created_by,
            "created_at": self.created_at.isoformat() if self.created_at else None,
        }


class ScheduleImportItem(db.Model):
    __tablename__ = "ScheduleImportItems"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    batch_id = db.Column(db.String(32), db.ForeignKey("ImportBatches.id"), nullable=False, index=True)
    schedule_id = db.Column(db.String(32), db.ForeignKey("Schedules.id"), nullable=False, index=True)
    row_num = db.Column(db.Integer, nullable=True)


class StudentImportItem(db.Model):
    __tablename__ = "StudentImportItems"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    batch_id = db.Column(db.String(32), db.ForeignKey("ImportBatches.id"), nullable=False, index=True)
    user_id = db.Column(db.String(64), db.ForeignKey("users.id"), nullable=False, index=True)
    row_num = db.Column(db.Integer, nullable=True)

