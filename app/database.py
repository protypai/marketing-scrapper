import os
import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

url = settings.DATABASE_URL
# Automatically normalize postgresql:// to postgresql+psycopg2:// if dialect driver is missing
if url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

# If ENVIRONMENT is set to production (or in Docker with reachable PostgreSQL), use PostgreSQL.
# Otherwise, default to local SQLite for fast local development without hanging on unreachable DB hosts.
is_production = os.getenv("ENVIRONMENT") == "production" or os.getenv("COOLIFY_APP_ID") is not None
engine = None

if is_production and "postgresql" in url:
    try:
        engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
        print(f"[Database] Connected to Production PostgreSQL database.")
    except Exception as e:
        print(f"[Database Error] Could not connect to PostgreSQL: {e}")

if engine is None:
    local_db_file = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "leadhub_local.db")
    url = f"sqlite:///{local_db_file}"
    print(f"[Database] Initializing local SQLite database at {local_db_file}")
    engine = create_engine(url, connect_args={"check_same_thread": False})

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
