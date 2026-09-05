import os
import psycopg2
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    raise ValueError("DATABASE_URL environment variable is missing.")

try:
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname='razorpay_db'")
    exists = cur.fetchone()
    if not exists:
        cur.execute("CREATE DATABASE razorpay_db")
        print("Database 'razorpay_db' created successfully.")
    else:
        print("Database 'razorpay_db' already exists.")
    cur.close()
    conn.close()
except Exception as e:
    print("Error creating database:", e)
