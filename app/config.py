import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "LeadHub - Instagram Influencer Scraper"
    SECRET_KEY: str = os.getenv("SECRET_KEY", "super-secret-key-change-in-production-2026")
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7  # 7 days

    # PostgreSQL Database Connection
    DATABASE_URL: str = os.getenv("DATABASE_URL", "postgresql+psycopg2://postgres:postgres_password_2026@postgres:5432/leadhub")

    # Apify Settings
    APIFY_API_TOKEN: str = os.getenv("APIFY_API_TOKEN", "")
    DEFAULT_MIN_FOLLOWERS: int = 5000

    # Seed Admin User
    ADMIN_EMAIL: str = os.getenv("ADMIN_EMAIL", "admin@protypai.com")
    ADMIN_PASSWORD: str = os.getenv("ADMIN_PASSWORD", "Admin@PumpPharma2026")
    ADMIN_NAME: str = os.getenv("ADMIN_NAME", "Admin User")

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
