import os
from sqlalchemy import create_engine, text

from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing.")

engine = create_engine(DATABASE_URL)

tables = ["payments", "customers", "recovery_predictions", "recovery_attempts"]

with engine.connect() as conn:
    for table in tables:
        count = conn.execute(text(f"SELECT COUNT(*) FROM {table}")).scalar()
        print(f"Table: {table}, Count: {count}")
        print("Latest records:")
        # try to order by created_at if it exists, else id, else payment_id
        try:
            res = conn.execute(text(f"SELECT * FROM {table} ORDER BY created_at DESC LIMIT 5")).fetchall()
        except Exception:
            try:
                res = conn.execute(text(f"SELECT * FROM {table} ORDER BY id DESC LIMIT 5")).fetchall()
            except Exception:
                res = conn.execute(text(f"SELECT * FROM {table} LIMIT 5")).fetchall()
        for r in res:
            print("  ", dict(r._mapping))
        print("-" * 40)
