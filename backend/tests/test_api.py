import os
import json
from datetime import datetime, timedelta

import pytest

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.room import Campus, Building, Room


@pytest.fixture(scope="function")
def app():
    # Tests should use SQLAlchemy models, not the SQL bootstrap scripts.
    os.environ["CSMS_BOOTSTRAP_SQLITE"] = "false"
    application = create_app("testing")
    with application.app_context():
        db.create_all()
        yield application
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def seed_data(app):
    with app.app_context():
        now = datetime.utcnow()

        superadmin = User(id="SPD0001", name="Super Admin", email="sa@example.com", is_active=1, created_at=now)
        superadmin.set_role("superadmin")
        superadmin.set_password("Admin@1234")
        db.session.add(superadmin)

        admin = User(id="AD0001", name="Admin", email="admin@example.com", is_active=1, created_at=now)
        admin.set_role("admin")
        admin.set_password("Admin@1234")
        db.session.add(admin)

        auth_user = User(id="AUTH0001", name="Authorized User", email="auth@example.com", is_active=1, created_at=now)
        auth_user.set_role("authorized_user")
        auth_user.course_section = "BSIT 3-1"
        auth_user.set_password("Admin@1234")
        db.session.add(auth_user)

        student = User(
            id="STU0001",
            name="Student",
            email="student@example.com",
            student_id="21-0001",
            is_active=1,
            created_at=now,
        )
        student.set_role("student")
        student.course_section = "BSIT 1-1"
        student.set_password("Student@1234")
        db.session.add(student)

        campus = Campus(id="CAM_TEST", name="MAYSAN CAMPUS", campus_code="010M2018", address="Test", created_at=now)
        db.session.add(campus)

        building = Building(
            id="BLDG_TEST",
            name="CEIT Building",
            code="CEIT",
            campus_id=campus.id,
            description="Test",
            created_at=now,
        )
        db.session.add(building)

        room = Room(
            id="RM_TEST",
            name="Room 101",
            code="CEIT-101",
            building_id=building.id,
            floor_raw="1",
            floor_type="N/A",
            is_active=1,
            created_at=now,
            updated_at=now,
        )
        db.session.add(room)

        db.session.commit()

        return {
            "superadmin_email": superadmin.email,
            "admin_email": admin.email,
            "auth_email": auth_user.email,
            "student_email": student.email,
            "room_id": room.id,
        }


def login(client, email: str, password: str) -> str:
    resp = client.post(
        "/api/auth/login",
        data=json.dumps({"email": email, "password": password}),
        content_type="application/json",
    )
    assert resp.status_code == 200
    body = resp.get_json()
    return body["data"]["access_token"]


class TestAuth:
    def test_login_success(self, client, seed_data):
        token = login(client, seed_data["auth_email"], "Admin@1234")
        assert token

    def test_register_not_supported(self, client):
        resp = client.post("/api/auth/register", data="{}", content_type="application/json")
        assert resp.status_code in (404, 405)


class TestReservations:
    @staticmethod
    def _future_date(days: int = 1) -> str:
        return (datetime.utcnow().date() + timedelta(days=days)).isoformat()

    def test_authorized_user_can_create_and_admin_can_approve(self, client, seed_data):
        auth_token = login(client, seed_data["auth_email"], "Admin@1234")

        r = client.post(
            "/api/reservations",
            data=json.dumps(
                {
                    "room_id": seed_data["room_id"],
                    "requestor_name": "Prof. Santos",
                    "course_section": "BSIT 3-1",
                    "date": self._future_date(),
                    "start_time": "13:00",
                    "end_time": "15:00",
                    "purpose": "Test reservation",
                }
            ),
            content_type="application/json",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        assert r.status_code == 201
        res_id = r.get_json()["data"]["id"]
        assert isinstance(res_id, str)
        assert r.get_json()["data"]["status"] == "pending"

        admin_token = login(client, seed_data["admin_email"], "Admin@1234")
        resp = client.patch(
            f"/api/reservations/{res_id}/approve",
            headers={"Authorization": f"Bearer {admin_token}"},
        )
        assert resp.status_code == 200
        assert resp.get_json()["data"]["status"] == "approved"

    def test_student_sees_only_approved(self, client, seed_data):
        auth_token = login(client, seed_data["auth_email"], "Admin@1234")
        r = client.post(
            "/api/reservations",
            data=json.dumps(
                {
                    "room_id": seed_data["room_id"],
                    "requestor_name": "Prof. Santos",
                    "course_section": "BSIT 3-1",
                    "date": self._future_date(),
                    "start_time": "14:00",
                    "end_time": "15:00",
                }
            ),
            content_type="application/json",
            headers={"Authorization": f"Bearer {auth_token}"},
        )
        res_id = r.get_json()["data"]["id"]

        # Before approval, student should see none.
        student_token = login(client, seed_data["student_email"], "Student@1234")
        resp = client.get("/api/reservations", headers={"Authorization": f"Bearer {student_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["pagination"]["total"] == 0

        # Approve and student should see one.
        admin_token = login(client, seed_data["admin_email"], "Admin@1234")
        client.patch(f"/api/reservations/{res_id}/approve", headers={"Authorization": f"Bearer {admin_token}"})

        resp2 = client.get("/api/reservations", headers={"Authorization": f"Bearer {student_token}"})
        assert resp2.status_code == 200
        assert resp2.get_json()["data"]["pagination"]["total"] == 1

