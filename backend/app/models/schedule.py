from __future__ import annotations

import re
from datetime import date

from app.extensions import db


_TIME_12H_RE = re.compile(r"^\s*(\d{1,2})\s*:\s*(\d{2})\s*([AaPp][Mm])\s*$")


def normalize_room_token(value: str | None) -> str:
    """Normalize room identifiers/codes so Schedule.room_id can match Room.id or Room.room_code.

    Examples:
      - "CAS-CL3"  -> "CASCL3"
      - "CAS CL-3" -> "CASCL3"
      - "RM208"    -> "RM208"
      - "CAS208"   -> "CAS208"
    """
    return re.sub(r"[^A-Z0-9]", "", (value or "").strip().upper())


def parse_12h_time_to_minutes(value: str | None) -> int | None:
    """Parse '5:30PM' / '10:00AM' into minutes since midnight."""
    if not value:
        return None
    m = _TIME_12H_RE.match(str(value))
    if not m:
        return None

    hour = int(m.group(1))
    minute = int(m.group(2))
    ap = m.group(3).lower()

    if hour < 1 or hour > 12 or minute < 0 or minute > 59:
        return None

    if ap == "am":
        hour = 0 if hour == 12 else hour
    else:
        hour = 12 if hour == 12 else hour + 12

    return hour * 60 + minute


def minutes_to_hhmm(minutes: int | None) -> str | None:
    if minutes is None:
        return None
    h = minutes // 60
    m = minutes % 60
    if h < 0 or h > 23 or m < 0 or m > 59:
        return None
    return f"{h:02d}:{m:02d}"


def weekday_name(d: date) -> str:
    return d.strftime("%A")


class Schedule(db.Model):
    __tablename__ = "Schedules"

    id = db.Column(db.String(32), primary_key=True)

    section = db.Column(db.String(80), nullable=True)
    subject = db.Column(db.String(150), nullable=True)
    subject_code = db.Column(db.String(50), nullable=True)
    day = db.Column(db.String(16), nullable=True, index=True)

    # Seed data stores campus/building codes here (not always FK ids).
    campus_id = db.Column(db.String(32), nullable=True)
    building_id = db.Column("bldg_id", db.String(32), nullable=True)

    # Seed data stores room_code here (not Room.id).
    room_key = db.Column("room_id", db.String(64), nullable=True, index=True)

    start_time_raw = db.Column("start_time", db.String(16), nullable=True)
    end_time_raw = db.Column("end_time", db.String(16), nullable=True)

    @property
    def room_token(self) -> str:
        return normalize_room_token(self.room_key)

    @property
    def start_minutes(self) -> int | None:
        return parse_12h_time_to_minutes(self.start_time_raw)

    @property
    def end_minutes(self) -> int | None:
        return parse_12h_time_to_minutes(self.end_time_raw)

    @property
    def start_hhmm(self) -> str | None:
        return minutes_to_hhmm(self.start_minutes)

    @property
    def end_hhmm(self) -> str | None:
        return minutes_to_hhmm(self.end_minutes)

    def overlaps(self, start_min: int, end_min: int) -> bool:
        s = self.start_minutes
        e = self.end_minutes
        if s is None or e is None:
            return False
        return s < end_min and e > start_min

    def to_dict(self, include_room_key: bool = True) -> dict:
        data = {
            "id": self.id,
            "section": self.section,
            "subject": self.subject,
            "subject_code": self.subject_code,
            "day": self.day,
            "start_time": self.start_hhmm,
            "end_time": self.end_hhmm,
        }
        if include_room_key:
            data["room_key"] = self.room_key
        return data

    def __repr__(self) -> str:
        return f"<Schedule {self.id} {self.day} {self.room_key} {self.start_time_raw}-{self.end_time_raw}>"

