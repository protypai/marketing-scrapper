import io
import datetime
from typing import List, Optional
import pandas as pd
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks, Query, Response
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

import urllib.request
from app.database import get_db
from app.auth import get_current_user
from app import models, schemas
from app.services.apify_service import run_apify_scrape_job
from app.services.discovery_engine import generate_discovery_queries

router = APIRouter(prefix="/api/leads", tags=["Leads & Human Review"])

@router.get("/proxy-image")
def proxy_image(url: str):
    if not url or not url.startswith("http"):
        raise HTTPException(status_code=400, detail="Invalid image URL")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"})
        with urllib.request.urlopen(req, timeout=6) as resp:
            content = resp.read()
            content_type = resp.headers.get("Content-Type", "image/jpeg")
            return Response(content=content, media_type=content_type, headers={"Cache-Control": "public, max-age=86400"})
    except Exception:
        raise HTTPException(status_code=404, detail="Image not available")

@router.get("", response_model=List[schemas.InfluencerLeadOut])
def get_leads(
    project_id: int,
    city_id: Optional[int] = None,
    min_followers: int = 0,
    search: Optional[str] = None,
    status: Optional[str] = None,
    review_state: Optional[str] = None,  # "UNREVIEWED", "KEEP", "REJECT", "REVIEW_LATER"
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.InfluencerLead).filter(
        models.InfluencerLead.project_id == project_id,
        models.InfluencerLead.follower_count >= min_followers
    )

    if city_id:
        query = query.filter(models.InfluencerLead.city_id == city_id)

    if status:
        query = query.filter(models.InfluencerLead.status == status)

    if review_state:
        query = query.filter(models.InfluencerLead.review_state == review_state)

    if search:
        search_pattern = f"%{search}%"
        query = query.filter(
            (models.InfluencerLead.username.ilike(search_pattern)) |
            (models.InfluencerLead.full_name.ilike(search_pattern)) |
            (models.InfluencerLead.bio_text.ilike(search_pattern)) |
            (models.InfluencerLead.public_phone.ilike(search_pattern)) |
            (models.InfluencerLead.public_email.ilike(search_pattern))
        )

    # Order by Discovery Score desc first, then follower count
    leads = query.order_by(
        models.InfluencerLead.discovery_score.desc(),
        models.InfluencerLead.follower_count.desc()
    ).all()

    result = []
    for lead in leads:
        lead_dict = schemas.InfluencerLeadOut(
            id=lead.id,
            project_id=lead.project_id,
            city_id=lead.city_id,
            city_name=lead.city.name if lead.city else "",
            instagram_id=lead.instagram_id,
            username=lead.username,
            full_name=lead.full_name,
            follower_count=lead.follower_count,
            following_count=lead.following_count,
            media_count=lead.media_count,
            profile_pic_url=lead.profile_pic_url,
            bio_text=lead.bio_text,
            public_email=lead.public_email,
            public_phone=lead.public_phone,
            whatsapp_link=lead.whatsapp_link,
            external_url=lead.external_url,
            engagement_rate=lead.engagement_rate,
            discovery_score=lead.discovery_score or 50,
            discovery_signals=lead.discovery_signals or [],
            review_state=lead.review_state or "UNREVIEWED",
            lead_classification=lead.lead_classification,
            status=lead.status,
            scraped_at=lead.scraped_at,
            notes_count=len(lead.notes)
        )
        result.append(lead_dict)

    return result

@router.put("/{lead_id}/review", response_model=schemas.InfluencerLeadOut)
def review_lead(
    lead_id: int,
    review_in: schemas.LeadReviewUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.InfluencerLead).filter(models.InfluencerLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.review_state = review_in.review_state
    if review_in.lead_classification is not None:
        lead.lead_classification = review_in.lead_classification

    db.commit()
    db.refresh(lead)

    return schemas.InfluencerLeadOut(
        id=lead.id,
        project_id=lead.project_id,
        city_id=lead.city_id,
        city_name=lead.city.name if lead.city else "",
        instagram_id=lead.instagram_id,
        username=lead.username,
        full_name=lead.full_name,
        follower_count=lead.follower_count,
        following_count=lead.following_count,
        media_count=lead.media_count,
        profile_pic_url=lead.profile_pic_url,
        bio_text=lead.bio_text,
        public_email=lead.public_email,
        public_phone=lead.public_phone,
        whatsapp_link=lead.whatsapp_link,
        external_url=lead.external_url,
        engagement_rate=lead.engagement_rate,
        discovery_score=lead.discovery_score or 50,
        discovery_signals=lead.discovery_signals or [],
        review_state=lead.review_state or "UNREVIEWED",
        lead_classification=lead.lead_classification,
        status=lead.status,
        scraped_at=lead.scraped_at,
        notes_count=len(lead.notes)
    )

@router.put("/{lead_id}/status", response_model=schemas.InfluencerLeadOut)
def update_lead_status(
    lead_id: int,
    status_update: schemas.LeadStatusUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.InfluencerLead).filter(models.InfluencerLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    lead.status = status_update.status
    db.commit()
    db.refresh(lead)

    return schemas.InfluencerLeadOut(
        id=lead.id,
        project_id=lead.project_id,
        city_id=lead.city_id,
        city_name=lead.city.name if lead.city else "",
        instagram_id=lead.instagram_id,
        username=lead.username,
        full_name=lead.full_name,
        follower_count=lead.follower_count,
        following_count=lead.following_count,
        media_count=lead.media_count,
        profile_pic_url=lead.profile_pic_url,
        bio_text=lead.bio_text,
        public_email=lead.public_email,
        public_phone=lead.public_phone,
        whatsapp_link=lead.whatsapp_link,
        external_url=lead.external_url,
        engagement_rate=lead.engagement_rate,
        discovery_score=lead.discovery_score or 50,
        discovery_signals=lead.discovery_signals or [],
        review_state=lead.review_state or "UNREVIEWED",
        lead_classification=lead.lead_classification,
        status=lead.status,
        scraped_at=lead.scraped_at,
        notes_count=len(lead.notes)
    )

@router.get("/{lead_id}/notes", response_model=List[schemas.LeadNoteOut])
def get_lead_notes(
    lead_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    notes = db.query(models.LeadNote).filter(models.LeadNote.lead_id == lead_id).order_by(models.LeadNote.created_at.desc()).all()
    result = []
    for n in notes:
        result.append(schemas.LeadNoteOut(
            id=n.id,
            lead_id=n.lead_id,
            author_id=n.author_id,
            author_name=n.author.full_name if n.author else "Team Member",
            note_content=n.note_content,
            created_at=n.created_at
        ))
    return result

@router.post("/{lead_id}/notes", response_model=schemas.LeadNoteOut)
def add_lead_note(
    lead_id: int,
    note_in: schemas.LeadNoteCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    lead = db.query(models.InfluencerLead).filter(models.InfluencerLead.id == lead_id).first()
    if not lead:
        raise HTTPException(status_code=404, detail="Lead not found")

    note = models.LeadNote(
        lead_id=lead_id,
        author_id=current_user.id,
        note_content=note_in.note_content
    )
    db.add(note)
    db.commit()
    db.refresh(note)

    return schemas.LeadNoteOut(
        id=note.id,
        lead_id=note.lead_id,
        author_id=note.author_id,
        author_name=current_user.full_name,
        note_content=note.note_content,
        created_at=note.created_at
    )

@router.post("/rescrape", response_model=schemas.ScrapeJobOut)
def rescrape_leads(
    project_id: int,
    city_id: int,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = models.ScrapeJob(
        project_id=project_id,
        city_id=city_id,
        status="pending",
        created_at=datetime.datetime.utcnow()
    )
    db.add(job)
    db.commit()
    db.refresh(job)

    background_tasks.add_task(run_apify_scrape_job, job.id)

    return schemas.ScrapeJobOut(
        id=job.id,
        project_id=job.project_id,
        city_id=job.city_id,
        status=job.status,
        error_message=job.error_message,
        leads_found=job.leads_found,
        created_at=job.created_at,
        finished_at=job.finished_at
    )

@router.get("/jobs/{job_id}", response_model=schemas.ScrapeJobOut)
def get_job_status(
    job_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    job = db.query(models.ScrapeJob).filter(models.ScrapeJob.id == job_id).first()
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    return schemas.ScrapeJobOut(
        id=job.id,
        project_id=job.project_id,
        city_id=job.city_id,
        status=job.status,
        error_message=job.error_message,
        leads_found=job.leads_found,
        created_at=job.created_at,
        finished_at=job.finished_at
    )

@router.post("/seed-demo")
def trigger_seed_demo(
    db: Session = Depends(get_db)
):
    from app.seed import seed_demo_target_leads
    # Force seed sample target leads for testing
    db.query(models.InfluencerLead).delete()
    db.commit()
    seed_demo_target_leads(db)
    return {"status": "ok", "message": "Demo target leads populated successfully"}

@router.get("/discovery-queries")
def get_discovery_queries(
    project_id: int,
    city_id: int,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    project = db.query(models.Project).filter(models.Project.id == project_id).first()
    city = db.query(models.City).filter(models.City.id == city_id).first()

    if not project or not city:
        raise HTTPException(status_code=404, detail="Project or city not found")

    return generate_discovery_queries(project.slug, city.name)

@router.get("/export")
def export_leads(
    project_id: int,
    city_id: Optional[int] = None,
    review_state: Optional[str] = None,
    format: str = "csv",
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user)
):
    query = db.query(models.InfluencerLead).filter(models.InfluencerLead.project_id == project_id)
    if city_id:
        query = query.filter(models.InfluencerLead.city_id == city_id)
    if review_state:
        query = query.filter(models.InfluencerLead.review_state == review_state)

    leads = query.all()
    data = []
    for l in leads:
        data.append({
            "ID": l.id,
            "Username": l.username,
            "Full Name": l.full_name,
            "City": l.city.name if l.city else "",
            "Followers": l.follower_count,
            "Discovery Score": l.discovery_score or 50,
            "Review State": l.review_state or "UNREVIEWED",
            "Classification": l.lead_classification or "",
            "Public Phone": l.public_phone or "",
            "Public Email": l.public_email or "",
            "WhatsApp Link": l.whatsapp_link or "",
            "Instagram Link": f"https://instagram.com/{l.username}",
            "Status": l.status,
            "Bio": l.bio_text or ""
        })

    df = pd.DataFrame(data)

    if format == "xlsx":
        output = io.BytesIO()
        with pd.ExcelWriter(output, engine='openpyxl') as writer:
            df.to_excel(writer, index=False, sheet_name="Leads")
        output.seek(0)
        headers = {'Content-Disposition': 'attachment; filename="influencer_leads.xlsx"'}
        return Response(content=output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", headers=headers)
    else:
        stream = io.StringIO()
        df.to_csv(stream, index=False)
        headers = {'Content-Disposition': 'attachment; filename="influencer_leads.csv"'}
        return Response(content=stream.getvalue(), media_type="text/csv", headers=headers)
