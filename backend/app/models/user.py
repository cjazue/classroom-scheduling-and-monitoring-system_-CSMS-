from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash
from app.extensions import db

ROLES = ("superadmin", "admin", "authorized_user", "student")


class User(db.Model):
    __tablename__ = "users"

    id            = db.Column(db.Integer, primary_key=True)
    name          = db.Column(db.String(150), nullable=False)
    email         = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(256), nullable=False)

    # 'superadmin' | 'admin' | 'authorized_user' | 'student'
    role           = db.Column(db.String(20), nullable=False, default="student")

    student_id     = db.Column(db.String(20), unique=True, nullable=True, index=True)
    course_section = db.Column(db.String(100), nullable=True)

    is_active  = db.Column(db.Boolean, default=True, nullable=False)
    created_at = db.Column(db.DateTime, default=datetime.utcnow, nullable=False)
    updated_at = db.Column(db.DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Who created this account
    created_by = db.Column(db.Integer, db.ForeignKey("users.id"), nullable=True)

    reservations = db.relationship(
        "Reservation", backref="requester", lazy="dynamic",
        foreign_keys="Reservation.user_id",
    )
    created_users = db.relationship(
        "User", backref=db.backref("creator", remote_side=[id]),
        lazy="dynamic", foreign_keys=[created_by],
    )

    def set_password(self, password: str) -> None:
        self.password_hash = generate_password_hash(password)

    def check_password(self, password: str) -> bool:
        return check_password_hash(self.password_hash, password)

    def to_dict(self, include_sensitive: bool = False) -> dict:
        data = {
            "id":             self.id,
            "name":           self.name,
            "email":          self.email,
            "role":           self.role,
            "student_id":     self.student_id,
            "course_section": self.course_section,
            "is_active":      self.is_active,
            "created_at":     self.created_at.isoformat(),
            "updated_at":     self.updated_at.isoformat() if self.updated_at else None,
        }
        if include_sensitive:
            data["created_by"] = self.created_by
        return data

    def __repr__(self) -> str:
        return f"<User {self.email} ({self.role})>"