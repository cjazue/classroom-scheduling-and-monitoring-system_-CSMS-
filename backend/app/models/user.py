from datetime import datetime

import bcrypt

from app.extensions import db

ROLE_DB_TO_API = {
    "Super_Admin": "superadmin",
    "Admin": "admin",
    "Authorized_User": "authorized_user",
    "Student": "student",
}
ROLE_API_TO_DB = {v: k for k, v in ROLE_DB_TO_API.items()}


class User(db.Model):
    __tablename__ = "users"


    id = db.Column(db.String(64), primary_key=True)
    name = db.Column(db.String(150), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)

    # bcrypt hash stored in column `password`
    password_hash = db.Column("password", db.String(256), nullable=False)

    # Raw DB value (constraint in schema): Super_Admin | Admin | Authorized_User | Student
    role = db.Column(db.String(32), nullable=False, default="Student")

    # Seeded schema uses student_number/course/section columns
    student_id = db.Column("student_number", db.String(20), unique=True, nullable=True, index=True)
    course = db.Column(db.String(50), nullable=True)
    section = db.Column(db.String(20), nullable=True)

    # Schema uses active_flag/created_at/updated_at
    is_active = db.Column("active_flag", db.Integer, default=1, nullable=False)
    failed_attempts = db.Column(db.Integer, default=0, nullable=False)
    locked_until = db.Column(db.DateTime, nullable=True)
    last_login = db.Column(db.DateTime, nullable=True)

    created_by = db.Column("created_by", db.String(64), db.ForeignKey("users.id"), nullable=True)
    updated_by = db.Column("updated_by", db.String(64), nullable=True)
    created_at = db.Column(db.DateTime, nullable=True)
    updated_at = db.Column(db.DateTime, nullable=True)
    deleted_at = db.Column(db.DateTime, nullable=True)


    reservations = db.relationship(
        "Reservation", backref="requester", lazy="dynamic",
        foreign_keys="Reservation.user_id",
    )
    created_users = db.relationship(
        "User", backref=db.backref("creator", remote_side=[id]),
        lazy="dynamic",
    )

    @property
    def role_key(self) -> str:
        """Return normalized role used by API + frontend (lowercase keys)."""
        return ROLE_DB_TO_API.get(self.role, (self.role or "").strip().lower())

    @classmethod
    def db_role(cls, role_key: str) -> str:
        """Map a normalized role key to the DB constraint value."""
        role_key = (role_key or "").strip().lower()
        return ROLE_API_TO_DB.get(role_key, role_key)

    def set_role(self, role_key: str) -> None:
        """Set role from normalized role key (student/admin/superadmin/authorized_user)."""
        role_key = (role_key or "").strip().lower()
        if role_key not in ROLE_API_TO_DB:
            raise ValueError(f"Invalid role: {role_key}")
        self.role = ROLE_API_TO_DB[role_key]

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

        # Accept formats:
        #   - "BSIT 1-1"
        #   - "BSIT" (course only)
        #   - "1-1"  (section only)
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

    def set_password(self, password: str) -> None:
        """Hash using bcrypt (used by registration/profile update).

        Note: seeded DB already contains bcrypt hashes; login uses checkpw.
        """
        hashed = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt())
        self.password_hash = hashed.decode("utf-8")

    def check_password(self, password: str) -> bool:
        if not self.password_hash:
            return False
        try:
            return bcrypt.checkpw(
                password.encode("utf-8"),
                self.password_hash.encode("utf-8"),
            )
        except ValueError:
            # If the stored hash is in an unexpected format, fail safely.
            return False


    def to_dict(self, include_sensitive: bool = False) -> dict:
        # Be defensive: some seed rows may have NULL timestamps depending on how SQLite was loaded.
        created_at = self.created_at.isoformat() if self.created_at else None
        updated_at = self.updated_at.isoformat() if getattr(self, "updated_at", None) else None

        data = {
            "id":             self.id,
            "name":           self.name,
            "email":          self.email,
            "role":           self.role_key,
            "student_id":     self.student_id,
            "course_section": self.course_section,
            "is_active":      self.is_active,
            "created_at":     created_at,
            "updated_at":     updated_at,
        }

        if include_sensitive:
            data["created_by"] = self.created_by
        return data

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role_key})>"
