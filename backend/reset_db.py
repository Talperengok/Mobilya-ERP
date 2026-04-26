from app.db.session import engine
from app.db.base import Base
import app.models

print("Dropping all tables...")
Base.metadata.drop_all(bind=engine)
print("Recreating tables...")
Base.metadata.create_all(bind=engine)
print("Done. Ready for seed_data.py")
