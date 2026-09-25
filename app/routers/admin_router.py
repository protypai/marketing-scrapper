from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_admin_user, get_password_hash
from app import models, schemas

router = APIRouter(prefix="/api/admin", tags=["Admin"])

@router.post("/users", response_model=schemas.UserOut)
def create_team_user(
    user_in: schemas.UserCreate,
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user)
):
    existing = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="User email already exists")

    new_user = models.User(
        email=user_in.email,
        password_hash=get_password_hash(user_in.password),
        full_name=user_in.full_name,
        role=user_in.role
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user

@router.get("/users", response_model=List[schemas.UserOut])
def get_all_users(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user)
):
    return db.query(models.User).order_by(models.User.created_at.desc()).all()

@router.get("/jobs", response_model=List[schemas.ScrapeJobOut])
def get_scrape_jobs(
    db: Session = Depends(get_db),
    admin_user: models.User = Depends(get_current_admin_user)
):
    return db.query(models.ScrapeJob).order_by(models.ScrapeJob.created_at.desc()).limit(50).all()
