from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.auth import get_current_user
from app import models, schemas

router = APIRouter(prefix="/api/projects", tags=["Projects & Cities"])

@router.get("", response_model=List[schemas.ProjectOut])
def get_projects(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.Project).all()

@router.get("/cities", response_model=List[schemas.CityOut])
def get_cities(db: Session = Depends(get_db), current_user: models.User = Depends(get_current_user)):
    return db.query(models.City).all()

@router.get("/{project_id}/cities/{city_id}/hashtags", response_model=schemas.ProjectCityHashtagOut)
def get_city_hashtags(
    project_id: int,
    city_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    pch = db.query(models.ProjectCityHashtag).filter(
        models.ProjectCityHashtag.project_id == project_id,
        models.ProjectCityHashtag.city_id == city_id
    ).first()

    if not pch:
        return schemas.ProjectCityHashtagOut(
            id=0,
            project_id=project_id,
            city_id=city_id,
            hashtags=[]
        )
    return pch
