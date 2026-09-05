import os
import sys

# Ensure root directory is in sys.path
sys.path.insert(
    0,
    os.path.abspath(
        os.path.join(os.path.dirname(__file__), "..")
    )
)

from database.base import Base
from database.connection import engine, SessionLocal, get_db

# Import models so SQLAlchemy registers their tables
from models.customer import Customer
from models.payment import Payment
from models.recovery import RecoveryPrediction
from models.recovery_attempt import RecoveryAttempt


def init_db():
    print("Creating database tables...")
    Base.metadata.create_all(bind=engine)
    print("Database tables created successfully!")


if __name__ == "__main__":
    init_db()


__all__ = [
    "Base",
    "engine",
    "SessionLocal",
    "get_db",
    "Customer",
    "Payment",
    "RecoveryPrediction",
    "RecoveryAttempt",
    "init_db",
]