from app.db.session import SessionLocal
from app.models.user import User
from app.models.customer import Customer

def fix_link():
    db = SessionLocal()
    # Find Ahmet Yilmaz (the intended demo customer)
    ahmet = db.query(Customer).filter(Customer.email == "ahmet@example.com").first()
    if not ahmet:
        print("❌ Ahmet Yilmaz not found!")
        db.close()
        return

    # Find the demo user
    demo_user = db.query(User).filter(User.email == "demo@mobilya.com").first()
    if not demo_user:
        print("❌ Demo user not found!")
        db.close()
        return

    print(f"🔗 Linking demo user ({demo_user.email}) to Customer ID {ahmet.id} ({ahmet.name})")
    demo_user.customer_id = ahmet.id
    db.commit()
    print("✅ Fixed!")
    db.close()

if __name__ == "__main__":
    fix_link()
