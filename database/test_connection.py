import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

# pyrefly: ignore [missing-import]
from database.connection import engine

try:
    with engine.connect() as connection:
        print("Database connection successful!")
except Exception as e:
        print("Database connection failed!")
        print(e)
