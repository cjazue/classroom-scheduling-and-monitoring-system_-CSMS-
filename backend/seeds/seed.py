import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from dotenv import load_dotenv
load_dotenv()

from app import create_app
from app.extensions import db
from app.models.user import User
from app.models.room import Campus, Building, Room

app = create_app()


CAMPUSES = [
    {"name": "Main Campus", "code": "MAIN", "description": "PLV Main Campus, Maysan, Valenzuela City"},
    {"name": "Annex Campus", "code": "ANNEX", "description": "PLV Annex Campus"},
    {"name": "CPAG Campus", "code": "CPAG", "description": "College of Public Administration and Governance Campus"},
]

BUILDINGS = {
    "MAIN": [
        {"name": "CEIT Building", "code": "CEIT", "description": "College of Engineering and Information Technology"},
        {"name": "CABA Building", "code": "CABA", "description": "College of Accountancy, Business and Accountancy"},
        {"name": "COED Building", "code": "COED", "description": "College of Education"},
        {"name": "Student Admin Building", "code": "SA", "description": "Student Administration and Support Services"},
    ],
    "ANNEX": [
        {"name": "New Building", "code": "NB", "description": "Annex New Building"},
        {"name": "CAS Building", "code": "CAS", "description": "College of Arts and Sciences"},
    ],
    "CPAG": [
        {"name": "CPAG Building", "code": "CPAG-BLDG", "description": "College of Public Administration and Governance"},
    ],
}


ROOMS = {
    "CEIT": [
        ("Room 101", "CEIT-101", 1, "lecture"),
        ("Room 102", "CEIT-102", 1, "lecture"),
        ("Computer Lab 1", "CEIT-CL1", 1, "laboratory"),
        ("Computer Lab 2", "CEIT-CL2", 1, "laboratory"),
        ("Room 201", "CEIT-201", 2, "lecture"),
        ("Room 202", "CEIT-202", 2, "lecture"),
        ("Electronics Lab", "CEIT-EL1", 2, "laboratory"),
        ("Room 301", "CEIT-301", 3, "lecture"),
        ("Conference Room", "CEIT-CR1", 3, "conference"),
    ],
    "CABA": [
        ("Room 101", "CABA-101", 1, "lecture"),
        ("Room 102", "CABA-102", 1, "lecture"),
        ("Accounting Lab", "CABA-AL1", 1, "laboratory"),
        ("Room 201", "CABA-201", 2, "lecture"),
        ("Room 202", "CABA-202", 2, "lecture"),
        ("Room 301", "CABA-301", 3, "lecture"),
    ],
    "COED": [
        ("Room 101", "COED-101", 1, "lecture"),
        ("Room 102", "COED-102", 1, "lecture"),
        ("Demo Room 1", "COED-DR1", 1, "lecture"),
        ("Room 201", "COED-201", 2, "lecture"),
        ("Demo Room 2", "COED-DR2", 2, "lecture"),
    ],
    "SA": [
        ("Conference Room A", "SA-CRA", 1, "conference"),
        ("Conference Room B", "SA-CRB", 2, "conference"),
        ("Seminar Room", "SA-SR1", 1, "lecture"),
    ],
    "NB": [
        ("Room 101", "NB-101", 1, "lecture"),
        ("Room 102", "NB-102", 1, "lecture"),
        ("Room 201", "NB-201", 2, "lecture"),
        ("Room 202", "NB-202", 2, "lecture"),
        ("Computer Lab", "NB-CL1", 1, "laboratory"),
        ("Room 301", "NB-301", 3, "lecture"),
        ("Room 302", "NB-302", 3, "lecture"),
    ],
    "CAS": [
        ("Room 101", "CAS-101", 1, "lecture"),
        ("Room 102", "CAS-102", 1, "lecture"),
        ("Science Lab", "CAS-SL1", 1, "laboratory"),
        ("Room 201", "CAS-201", 2, "lecture"),
        ("Room 202", "CAS-202", 2, "lecture"),
    ],
    "CPAG-BLDG": [
        ("Room 101", "CPAG-101", 1, "lecture"),
        ("Room 102", "CPAG-102", 1, "lecture"),
        ("Room 201", "CPAG-201", 2, "lecture"),
        ("Conference Room", "CPAG-CR1", 1, "conference"),
        ("Seminar Hall", "CPAG-SH1", 2, "lecture"),
    ],
}


def seed():
    with app.app_context():
        print("Starting seed...")

        # Superadmin
        sa_email = os.environ.get("SUPERADMIN_EMAIL", "superadmin@plv.edu.ph")
        sa_name = os.environ.get("SUPERADMIN_NAME", "PLV Superadmin")
        sa_password = os.environ.get("SUPERADMIN_PASSWORD", "SuperAdmin@PLV2025")

        existing_sa = User.query.filter_by(email=sa_email).first()
        if not existing_sa:
            superadmin = User(name=sa_name, email=sa_email, role="superadmin")
            superadmin.set_password(sa_password)
            db.session.add(superadmin)
            db.session.flush()
            print(f"Superadmin created: {sa_email}")
        else:
            print(f"Superadmin already exists: {sa_email}")

        
        campus_map = {}
        for c_data in CAMPUSES:
            campus = Campus.query.filter_by(code=c_data["code"]).first()
            if not campus:
                campus = Campus(**c_data)
                db.session.add(campus)
                db.session.flush()
                print(f"Campus: {campus.name}")
            else:
                print(f"Campus exists: {campus.name}")
            campus_map[c_data["code"]] = campus

        
        building_map = {}
        for campus_code, buildings in BUILDINGS.items():
            campus = campus_map[campus_code]
            for b_data in buildings:
                building = Building.query.filter_by(code=b_data["code"], campus_id=campus.id).first()
                if not building:
                    building = Building(campus_id=campus.id, **b_data)
                    db.session.add(building)
                    db.session.flush()
                    print(f"Building: {building.code} ({campus.code})")
                else:
                    print(f"Building exists: {building.code}")
                building_map[b_data["code"]] = building

        # Rooms
        for building_code, rooms in ROOMS.items():
            building = building_map.get(building_code)
            if not building:
                continue
            for room_data in rooms:
                name, code, floor, room_type = room_data
                room = Room.query.filter_by(code=code, building_id=building.id).first()
                if not room:
                    room = Room(
                        name=name,
                        code=code,
                        building_id=building.id,
                        floor=floor,
                        room_type=room_type,
                    )
                    db.session.add(room)
                    print(f"Room: {code}")
                else:
                    print(f"Room exists: {code}")

        db.session.commit()
        print("\n Seed completed ")
        print(f"\n Superadmin credentials:")
        print(f"   Email:    {sa_email}")
        print(f"   Password: {sa_password}")


if __name__ == "__main__":
    seed()