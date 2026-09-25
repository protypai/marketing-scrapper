import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# Handle database connection string
DATABASE_URL = settings.DATABASE_URL

if DATABASE_URL.startswith("sqlite"):
    db_path = DATABASE_URL.replace("sqlite:///", "")
    os.makedirs(os.path.dirname(os.path.abspath(db_path)), exist_ok=True)
    connect_args = {"check_same_thread": False}
else:
    connect_args = {}

# Retry loop for PostgreSQL connection in Docker
engine = None
for attempt in range(5):
    try:
        engine = create_engine(DATABASE_URL, connect_args=connect_args, pool_pre_ping=True)
        # Test connection
        with engine.connect() as conn:
            pass
        break
    except Exception as e:
        if attempt == 4:
            # Fallback if connection fails on last attempt
            print(f"[Database Error] Could not connect to {DATABASE_URL}: {e}")
            raise e
        print(f"[Database] Waiting for database connection (attempt {attempt + 1}/5)...")
        time.sleep(2)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
