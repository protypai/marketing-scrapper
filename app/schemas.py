from typing import List, Optional, Any
from datetime import datetime
from pydantic import BaseModel, EmailStr

# Auth Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    email: Optional[str] = None
    role: Optional[str] = None

class UserLogin(BaseModel):
    email: str
    password: str

class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str = "team"  # "admin" or "team"

class UserOut(BaseModel):
    id: int
    email: str
    full_name: str
    role: str
    created_at: datetime

    class Config:
        from_attributes = True

# Project & City Schemas
class CityOut(BaseModel):
    id: int
    name: str
    state: str

    class Config:
        from_attributes = True

class ProjectOut(BaseModel):
    id: int
    slug: str
    name: str
    description: Optional[str] = None

    class Config:
        from_attributes = True

class ProjectCityHashtagOut(BaseModel):
    id: int
    project_id: int
    city_id: int
    hashtags: List[str]

    class Config:
        from_attributes = True

class DiscoverySourceOut(BaseModel):
    id: int
    project_id: int
    city_id: int
    category: str
    source_type: str
    value: str

    class Config:
        from_attributes = True

# Lead & Note Schemas
class LeadNoteCreate(BaseModel):
    note_content: str

class LeadNoteOut(BaseModel):
    id: int
    lead_id: int
    author_id: int
    author_name: str
    note_content: str
    created_at: datetime

    class Config:
        from_attributes = True

class LeadStatusUpdate(BaseModel):
    status: str  # "New", "Contacted", "In Talks", "Onboarded", "Rejected"

class LeadReviewUpdate(BaseModel):
    review_state: str  # "KEEP", "REJECT", "REVIEW_LATER", "UNREVIEWED"
    lead_classification: Optional[str] = None

class InfluencerLeadOut(BaseModel):
    id: int
    project_id: int
    city_id: int
    city_name: str
    instagram_id: Optional[str] = None
    username: str
    full_name: Optional[str] = None
    follower_count: int
    following_count: int
    media_count: int
    profile_pic_url: Optional[str] = None
    bio_text: Optional[str] = None
    public_email: Optional[str] = None
    public_phone: Optional[str] = None
    whatsapp_link: Optional[str] = None
    external_url: Optional[str] = None
    engagement_rate: float
    discovery_score: int = 50
    discovery_signals: Optional[List[str]] = []
    review_state: str = "UNREVIEWED"
    lead_classification: Optional[str] = None
    status: str
    scraped_at: datetime
    notes_count: int = 0

    class Config:
        from_attributes = True

class ScrapeJobOut(BaseModel):
    id: int
    project_id: int
    city_id: int
    status: str
    error_message: Optional[str] = None
    leads_found: int
    created_at: datetime
    finished_at: Optional[datetime] = None

    class Config:
        from_attributes = True
