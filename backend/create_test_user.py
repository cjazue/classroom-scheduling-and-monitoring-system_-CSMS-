import sys
sys.path.insert(0, '.')
from app import create_app
from app.extensions import db
from app.models.user import User

app = create_app()

with app.app_context():
    # Check existing users
    users = User.query.limit(5).all()
    print("=== Existing users ===")
    for user in users:
        print(f"ID: {user.id}, Email: {user.email}, Name: {user.name}")
    
    # Create a test user with a known password
    test_user = User(
        id="TEST001",
        name="Test User",
        email="test@example.com",
        role="Student"
    )
    test_user.set_password("testpass123")
    
    db.session.add(test_user)
    db.session.commit()
    
    print("\n=== Test user created ===")
    print(f"Email: test@example.com")
    print(f"Password: testpass123")
