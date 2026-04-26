"""Drop users + shipments tables and enum type so they can be re-created with expanded roles."""
from app.db.session import engine
from sqlalchemy import text

with engine.connect() as conn:
    conn.execute(text("DROP TABLE IF EXISTS shipments CASCADE"))
    conn.execute(text("DROP TABLE IF EXISTS users CASCADE"))
    conn.execute(text("DROP TYPE IF EXISTS userrole CASCADE"))
    conn.commit()

print("Done: tables and enum type dropped")
