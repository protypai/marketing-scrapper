import time
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

url = settings.DATABASE_URL
# Automatically normalize postgresql:// to postgresql+psycopg2:// if dialect driver is missing
if url.startswith("postgresql://"):
    url = url.replace("postgresql://", "postgresql+psycopg2://", 1)

# Retry loop for PostgreSQL connection in Docker / Production
engine = None
for attempt in range(10):
    try:
        engine = create_engine(
            url,
            pool_pre_ping=True,
            pool_size=10,
            max_overflow=20
        )
        # Verify connection
        with engine.connect() as conn:
            pass
        print(f"[Database] Successfully connected to PostgreSQL at {url}.")
        break
    except Exception as e:
        if attempt == 9:
            print(f"[Database Error] Could not connect to PostgreSQL at {url}: {e}")
            raise e
        print(f"[Database] Waiting for PostgreSQL database (attempt {attempt + 1}/10)...")
        time.sleep(2)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
