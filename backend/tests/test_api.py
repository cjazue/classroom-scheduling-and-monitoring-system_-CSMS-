
import pytest
import json
from datetime import date, timedelta
from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.room import Campus, Building, Room

# Fixtures

@pytest.fixture(scope="function")
def app():
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
        # Superadmin
        sa = User(name="Super Admin", email="sa@plv.edu.ph", role="superadmin")
        sa.set_password("Admin@1234")
        db.session.add(sa)

        # Admin
        admin = User(name="Test Admin", email="admin@plv.edu.ph", role="admin", course_section="BSIT 1-1")
        admin.set_password("Admin@1234")
        db.session.add(admin)

        # Student
        student = User(name="Test Student", email="student@plv.edu.ph", role="student",
                       student_id="21-0001", course_section="BSIT 1-1")
        student.set_password("Student@1234")
        db.session.add(student)

        # Campus > Building > Room
        campus = Campus(name="Main Campus", code="MAIN")
        db.session.add(campus)
        db.session.flush()

        building = Building(name="CEIT Building", code="CEIT", campus_id=campus.id)
        db.session.add(building)
        db.session.flush()

        room = Room(name="Room 101", code="CEIT-101", building_id=building.id,
                    floor=1, room_type="lecture")
        db.session.add(room)
        db.session.commit()

        return {
            "sa_id": sa.id,
            "admin_id": admin.id,
            "student_id": student.id,
            "campus_id": campus.id,
            "building_id": building.id,
            "room_id": room.id,
        }


def login(client, email, password):
    resp = client.post("/api/auth/login",
                       data=json.dumps({"email": email, "password": password}),
                       content_type="application/json")
    return resp.get_json()["data"]["access_token"]


class TestAuth:

    def test_student_register(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "New Student",
                               "email": "new@plv.edu.ph",
                               "student_id": "21-0002",
                               "course_section": "BSIT 1-1",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 201
        data = resp.get_json()
        assert data["success"] is True
        assert data["data"]["role"] == "student"
        assert data["data"]["student_id"] == "21-0002"

    def test_register_duplicate_email(self, client, seed_data):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Dup",
                               "email": "student@plv.edu.ph",
                               "student_id": "21-0099",
                               "course_section": "BSIT 1-1",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 409

    def test_register_duplicate_student_id(self, client, seed_data):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Dup ID",
                               "email": "other@plv.edu.ph",
                               "student_id": "21-0001",
                               "course_section": "BSIT 1-1",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 409

    def test_register_missing_fields(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Incomplete",
                               "email": "incomplete@plv.edu.ph",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 422
        errors = resp.get_json()["errors"]
        assert "student_id" in errors
        assert "course_section" in errors
    def test_register_weak_password(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Weak",
                               "email": "weak@plv.edu.ph",
                               "student_id": "21-0003",
                               "course_section": "BSIT 1-1",
                               "password": "short",
                           }),
                           content_type="application/json")
        assert resp.status_code == 422

    def test_login_success(self, client, seed_data):
        resp = client.post("/api/auth/login",
                           data=json.dumps({"email": "student@plv.edu.ph", "password": "Student@1234"}),
                           content_type="application/json")
        assert resp.status_code == 200
        data = resp.get_json()
        assert "access_token" in data["data"]

    def test_login_wrong_password(self, client, seed_data):
        resp = client.post("/api/auth/login",
                           data=json.dumps({"email": "student@plv.edu.ph", "password": "wrongpass"}),
                           content_type="application/json")
        assert resp.status_code == 401

    def test_me_endpoint(self, client, seed_data):
        token = login(client, "student@plv.edu.ph", "Student@1234")
        resp = client.get("/api/auth/me",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["email"] == "student@plv.edu.ph"

    def test_me_requires_auth(self, client):
        resp = client.get("/api/auth/me")
        assert resp.status_code == 401


    def test_register_invalid_student_id(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Bad ID",
                               "email": "badid@plv.edu.ph",
                               "student_id": "2021-00001",
                               "course_section": "BSIT 1-1",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 422
        assert "student_id" in resp.get_json()["errors"]

    def test_register_invalid_course_section(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Bad CS",
                               "email": "badcs@plv.edu.ph",
                               "student_id": "21-0001",
                               "course_section": "BSIT-3A",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 422
        assert "course_section" in resp.get_json()["errors"]

    def test_register_non_plv_email(self, client):
        resp = client.post("/api/auth/register",
                           data=json.dumps({
                               "name": "Outside",
                               "email": "student@gmail.com",
                               "student_id": "21-0002",
                               "course_section": "BSIT 1-1",
                               "password": "Password1",
                           }),
                           content_type="application/json")
        assert resp.status_code == 422
        assert "email" in resp.get_json()["errors"]

class TestSuperadmin:

    def test_create_admin(self, client, seed_data):
        token = login(client, "sa@plv.edu.ph", "Admin@1234")
        resp = client.post("/api/superadmin/admins",
                           data=json.dumps({
                               "name": "New Admin",
                               "email": "newadmin@plv.edu.ph",
                               "password": "Admin@5678",
                               "course_section": "BSIT 1-1",
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 201
        assert resp.get_json()["data"]["role"] == "admin"

    def test_create_admin_forbidden_for_student(self, client, seed_data):
        token = login(client, "student@plv.edu.ph", "Student@1234")
        resp = client.post("/api/superadmin/admins",
                           data=json.dumps({
                               "name": "X",
                               "email": "xtest@plv.edu.ph",
                               "password": "Admin@5678",
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_list_admins(self, client, seed_data):
        token = login(client, "sa@plv.edu.ph", "Admin@1234")
        resp = client.get("/api/superadmin/admins",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["pagination"]["total"] >= 1


class TestRooms:

    def test_list_rooms(self, client, seed_data):
        token = login(client, "student@plv.edu.ph", "Student@1234")
        resp = client.get("/api/rooms",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        items = resp.get_json()["data"]["items"]
        assert len(items) >= 1
        assert "is_occupied" in items[0]

    def test_get_room(self, client, seed_data):
        token = login(client, "student@plv.edu.ph", "Student@1234")
        room_id = seed_data["room_id"]
        resp = client.get(f"/api/rooms/{room_id}",
                          headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["code"] == "CEIT-101"

    def test_create_room_by_superadmin(self, client, seed_data):
        token = login(client, "sa@plv.edu.ph", "Admin@1234")
        resp = client.post("/api/rooms",
                           data=json.dumps({
                               "name": "Room 201",
                               "code": "CEIT-201",
                               "building_id": seed_data["building_id"],
                               "floor": 2,
                               "capacity": 45,
                               "room_type": "lecture",
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 201

    def test_create_room_forbidden_for_admin(self, client, seed_data):
        token = login(client, "admin@plv.edu.ph", "Admin@1234")
        resp = client.post("/api/rooms",
                           data=json.dumps({
                               "name": "Unauthorized Room",
                               "code": "X-001",
                               "building_id": seed_data["building_id"],
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403


class TestReservations:

    def _future_date(self):
        return (date.today() + timedelta(days=1)).isoformat()

    def test_admin_can_submit_reservation(self, client, seed_data):
        token = login(client, "admin@plv.edu.ph", "Admin@1234")
        resp = client.post("/api/reservations",
                           data=json.dumps({
                               "room_id": seed_data["room_id"],
                               "requestor_name": "Prof. Santos",
                               "course_section": "BSIT 3-1",
                               "date": self._future_date(),
                               "start_time": "09:00",
                               "end_time": "11:00",
                               "purpose": "Make-up class",
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 201
        data = resp.get_json()["data"]
        assert data["status"] == "pending"

    def test_student_cannot_submit_reservation(self, client, seed_data):
        token = login(client, "student@plv.edu.ph", "Student@1234")
        resp = client.post("/api/reservations",
                           data=json.dumps({
                               "room_id": seed_data["room_id"],
                               "requestor_name": "Student",
                               "course_section": "BSIT 1-1",
                               "date": self._future_date(),
                               "start_time": "09:00",
                               "end_time": "11:00",
                           }),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {token}"})
        assert resp.status_code == 403

    def test_superadmin_can_approve(self, client, seed_data):
        admin_token = login(client, "admin@plv.edu.ph", "Admin@1234")
        r = client.post("/api/reservations",
                        data=json.dumps({
                            "room_id": seed_data["room_id"],
                            "requestor_name": "Prof. Santos",
                            "course_section": "BSIT 3-1",
                            "date": self._future_date(),
                            "start_time": "13:00",
                            "end_time": "15:00",
                        }),
                        content_type="application/json",
                        headers={"Authorization": f"Bearer {admin_token}"})
        res_id = r.get_json()["data"]["id"]

        sa_token = login(client, "sa@plv.edu.ph", "Admin@1234")
        resp = client.patch(f"/api/reservations/{res_id}/approve",
                            headers={"Authorization": f"Bearer {sa_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["status"] == "approved"

    def test_conflict_detection(self, client, seed_data):
        """Two reservations for the same slot should conflict."""
        admin_token = login(client, "admin@plv.edu.ph", "Admin@1234")
        payload = {
            "room_id": seed_data["room_id"],
            "requestor_name": "Prof. Santos",
            "course_section": "BSIT 3-1",
            "date": self._future_date(),
            "start_time": "08:00",
            "end_time": "10:00",
        }
        client.post("/api/reservations",
                    data=json.dumps(payload),
                    content_type="application/json",
                    headers={"Authorization": f"Bearer {admin_token}"})

        resp = client.post("/api/reservations",
                           data=json.dumps(payload),
                           content_type="application/json",
                           headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 409

    def test_student_sees_only_approved(self, client, seed_data):
        # Submit (pending) 
        admin_token = login(client, "admin@plv.edu.ph", "Admin@1234")
        client.post("/api/reservations",
                    data=json.dumps({
                        "room_id": seed_data["room_id"],
                        "requestor_name": "Prof. Santos",
                        "course_section": "BSIT 3-1",
                        "date": self._future_date(),
                        "start_time": "14:00",
                        "end_time": "16:00",
                    }),
                    content_type="application/json",
                    headers={"Authorization": f"Bearer {admin_token}"})

        # 0
        student_token = login(client, "student@plv.edu.ph", "Student@1234")
        resp = client.get("/api/reservations",
                          headers={"Authorization": f"Bearer {student_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["pagination"]["total"] == 0

    def test_admin_can_cancel_own(self, client, seed_data):
        admin_token = login(client, "admin@plv.edu.ph", "Admin@1234")
        r = client.post("/api/reservations",
                        data=json.dumps({
                            "room_id": seed_data["room_id"],
                            "requestor_name": "Prof. Santos",
                            "course_section": "BSIT 3-1",
                            "date": self._future_date(),
                            "start_time": "07:00",
                            "end_time": "09:00",
                        }),
                        content_type="application/json",
                        headers={"Authorization": f"Bearer {admin_token}"})
        res_id = r.get_json()["data"]["id"]

        resp = client.patch(f"/api/reservations/{res_id}/cancel",
                            headers={"Authorization": f"Bearer {admin_token}"})
        assert resp.status_code == 200
        assert resp.get_json()["data"]["status"] == "cancelled"