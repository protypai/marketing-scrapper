import datetime
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, ForeignKey, Table, JSON
from sqlalchemy.orm import relationship
from app.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    password_hash = Column(String, nullable=False)
    full_name = Column(String, nullable=False)
    role = Column(String, default="team", nullable=False)  # "admin" or "team"
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    notes = relationship("LeadNote", back_populates="author")


class Project(Base):
    __tablename__ = "projects"

    id = Column(Integer, primary_key=True, index=True)
    slug = Column(String, unique=True, index=True, nullable=False)  # "pumppilot", "pharmaflow"
    name = Column(String, nullable=False)
    description = Column(Text, nullable=True)

    city_hashtags = relationship("ProjectCityHashtag", back_populates="project")
    discovery_sources = relationship("DiscoverySource", back_populates="project")
    leads = relationship("InfluencerLead", back_populates="project")


class City(Base):
    __tablename__ = "cities"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, unique=True, index=True, nullable=False)  # "Hyderabad", "Rajahmundry", etc.
    state = Column(String, nullable=False)  # "Telangana" or "Andhra Pradesh"
    local_keywords = Column(JSON, nullable=True)  # ["Rajahmundry news", "Rajamahendravaram"]

    city_hashtags = relationship("ProjectCityHashtag", back_populates="city")
    discovery_sources = relationship("DiscoverySource", back_populates="city")
    leads = relationship("InfluencerLead", back_populates="city")


class ProjectCityHashtag(Base):
    __tablename__ = "project_city_hashtags"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    hashtags = Column(JSON, nullable=False)

    project = relationship("Project", back_populates="city_hashtags")
    city = relationship("City", back_populates="city_hashtags")


class DiscoverySource(Base):
    __tablename__ = "discovery_sources"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    category = Column(String, nullable=False)  # "Industry", "Adjacent", "Business", "Local"
    source_type = Column(String, nullable=False)  # "keyword", "hashtag", "local_page"
    value = Column(String, nullable=False)

    project = relationship("Project", back_populates="discovery_sources")
    city = relationship("City", back_populates="discovery_sources")


class InfluencerLead(Base):
    __tablename__ = "influencer_leads"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    instagram_id = Column(String, nullable=True)
    username = Column(String, nullable=False, index=True)
    full_name = Column(String, nullable=True)
    follower_count = Column(Integer, default=0, index=True)
    following_count = Column(Integer, default=0)
    media_count = Column(Integer, default=0)
    profile_pic_url = Column(Text, nullable=True)
    bio_text = Column(Text, nullable=True)
    public_email = Column(String, nullable=True)
    public_phone = Column(String, nullable=True)
    whatsapp_link = Column(String, nullable=True)
    external_url = Column(String, nullable=True)
    engagement_rate = Column(Float, default=0.0)

    # Discovery & Human Review Engine fields
    discovery_score = Column(Integer, default=50, index=True)  # 0 to 100
    discovery_signals = Column(JSON, nullable=True)  # List of strings e.g. ["#petrolpump", "Rajahmundry Business", "Local Page"]
    review_state = Column(String, default="UNREVIEWED", index=True)  # "UNREVIEWED", "KEEP", "REJECT", "REVIEW_LATER"
    lead_classification = Column(String, nullable=True)  # "Petrol Pump Owner", "Pharmacist", "Local Business", etc.
    status = Column(String, default="New", nullable=False)  # "New", "Contacted", "In Talks", "Onboarded", "Rejected"
    scraped_at = Column(DateTime, default=datetime.datetime.utcnow)

    project = relationship("Project", back_populates="leads")
    city = relationship("City", back_populates="leads")
    notes = relationship("LeadNote", back_populates="lead", cascade="all, delete-orphan")


class LeadNote(Base):
    __tablename__ = "lead_notes"

    id = Column(Integer, primary_key=True, index=True)
    lead_id = Column(Integer, ForeignKey("influencer_leads.id"), nullable=False)
    author_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    note_content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    lead = relationship("InfluencerLead", back_populates="notes")
    author = relationship("User", back_populates="notes")


class ScrapeJob(Base):
    __tablename__ = "scrape_jobs"

    id = Column(Integer, primary_key=True, index=True)
    project_id = Column(Integer, ForeignKey("projects.id"), nullable=False)
    city_id = Column(Integer, ForeignKey("cities.id"), nullable=False)
    status = Column(String, default="pending")  # "pending", "running", "completed", "failed"
    error_message = Column(Text, nullable=True)
    leads_found = Column(Integer, default=0)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    finished_at = Column(DateTime, nullable=True)
