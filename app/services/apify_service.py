import re
import datetime
from typing import List, Dict, Any
from app.database import SessionLocal
from app.config import settings
from app import models
from app.services.discovery_engine import calculate_discovery_score

try:
    from apify_client import ApifyClient
except ImportError:
    ApifyClient = None

# Email & Phone Regex patterns for contact extraction
EMAIL_REGEX = r'[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}'
PHONE_REGEX = r'(?:\+91[\-\s]?)?[6-9]\d{9}'

def extract_contact_info(bio_text: str, public_email: str = None, public_phone: str = None) -> Dict[str, Any]:
    email = public_email if public_email else None
    phone = public_phone if public_phone else None

    # Search bio text if phone or email is missing
    if bio_text:
        if not email:
            emails = re.findall(EMAIL_REGEX, bio_text)
            if emails:
                email = emails[0]
        if not phone:
            phones = re.findall(PHONE_REGEX, bio_text)
            if phones:
                phone = phones[0]

    whatsapp = None
    if phone:
        clean_phone = re.sub(r'\D', '', phone)
        if len(clean_phone) == 10:
            whatsapp = f"https://wa.me/91{clean_phone}"
        elif len(clean_phone) == 12 and clean_phone.startswith("91"):
            whatsapp = f"https://wa.me/{clean_phone}"

    return {"email": email, "phone": phone, "whatsapp": whatsapp}

def run_apify_scrape_job(job_id: int):
    """
    Executes a 2-step Apify Discovery & Profile Enrichment pipeline:
    1. Discovers candidate usernames via hashtag/search scraper.
    2. Enriches profiles via apify/instagram-profile-scraper to fetch EXACT
       follower counts, biography, public emails, public phones, and calculate Discovery Scores.
    """
    db = SessionLocal()
    try:
        job = db.query(models.ScrapeJob).filter(models.ScrapeJob.id == job_id).first()
        if not job:
            return

        job.status = "running"
        db.commit()

        project = db.query(models.Project).filter(models.Project.id == job.project_id).first()
        city = db.query(models.City).filter(models.City.id == job.city_id).first()

        pch = db.query(models.ProjectCityHashtag).filter(
            models.ProjectCityHashtag.project_id == job.project_id,
            models.ProjectCityHashtag.city_id == job.city_id
        ).first()

        hashtags = pch.hashtags if (pch and pch.hashtags) else []
        clean_hashtags = [h.replace("#", "") for h in hashtags]

        token = settings.APIFY_API_TOKEN
        if not token or not ApifyClient:
            job.status = "failed"
            job.error_message = "APIFY_API_TOKEN or apify_client is not configured."
            job.finished_at = datetime.datetime.utcnow()
            db.commit()
            return

        client = ApifyClient(token)

        # Step 1: Discover candidate usernames from top hashtags
        target_tags = clean_hashtags[:3] if clean_hashtags else ["petrolpump", "pharmacy"]
        run_input = {
            "hashtags": target_tags,
            "resultsLimit": 30,
        }

        run = client.actor("apify/instagram-hashtag-scraper").call(run_input=run_input)
        dataset_id = getattr(run, "default_dataset_id", None) or getattr(run, "defaultDatasetId", None)
        if not dataset_id and isinstance(run, dict):
            dataset_id = run.get("defaultDatasetId") or run.get("default_dataset_id")

        if not dataset_id:
            raise ValueError("Could not extract dataset ID from Apify hashtag scraper.")

        items = client.dataset(dataset_id).list_items().items

        # Collect unique candidate usernames (ignoring generic news handles)
        candidate_usernames = set()
        for item in items:
            uname = item.get("ownerUsername") or item.get("username")
            if not uname and isinstance(item.get("owner"), dict):
                uname = item.get("owner", {}).get("username")

            if uname and not uname.startswith("tv9") and not uname.startswith("sunnews"):
                candidate_usernames.add(uname)

        usernames_list = list(candidate_usernames)[:20]  # Select top candidate profiles
        new_leads_count = 0

        # Step 2: Profile Enrichment via apify/instagram-profile-scraper
        if usernames_list:
            try:
                prof_input = {"usernames": usernames_list}
                prof_run = client.actor("apify/instagram-profile-scraper").call(run_input=prof_input)
                prof_dataset_id = getattr(prof_run, "default_dataset_id", None) or getattr(prof_run, "defaultDatasetId", None)
                if not prof_dataset_id and isinstance(prof_run, dict):
                    prof_dataset_id = prof_run.get("defaultDatasetId") or prof_run.get("default_dataset_id")

                if prof_dataset_id:
                    enriched_profiles = client.dataset(prof_dataset_id).list_items().items
                else:
                    enriched_profiles = []
            except Exception as e:
                print(f"[Apify Warning] Profile enrichment error: {e}")
                enriched_profiles = []

            # Process enriched profile items
            for p in enriched_profiles:
                username = p.get("username")
                if not username:
                    continue

                followers = p.get("followersCount") or p.get("followersCountExact") or p.get("followers") or 0

                # Filter out obvious bots/empty accounts with < 50 followers
                if followers < 50:
                    continue

                full_name = p.get("fullName") or p.get("name") or username
                bio = p.get("biography") or p.get("bio") or ""
                profile_pic = p.get("profilePicUrlHD") or p.get("profilePicUrl") or ""
                following = p.get("followsCount") or p.get("followingCount") or 0
                posts_count = p.get("postsCount") or p.get("mediaCount") or 0
                external_url = p.get("externalUrl") or None
                pub_email = p.get("publicEmail") or None
                pub_phone = p.get("publicPhoneNumber") or None

                contacts = extract_contact_info(bio, pub_email, pub_phone)

                signal_source = [f"Source: #{target_tags[0]}" if target_tags else "Source: Apify Discovery"]

                score, signal_tags = calculate_discovery_score(
                    bio_text=bio,
                    city_name=city.name if city else "",
                    project_slug=project.slug if project else "",
                    signals=signal_source
                )

                existing = db.query(models.InfluencerLead).filter(
                    models.InfluencerLead.project_id == job.project_id,
                    models.InfluencerLead.username == username
                ).first()

                if not existing:
                    lead = models.InfluencerLead(
                        project_id=job.project_id,
                        city_id=job.city_id,
                        instagram_id=str(p.get("id", "")),
                        username=username,
                        full_name=full_name,
                        follower_count=followers,
                        following_count=following,
                        media_count=posts_count,
                        profile_pic_url=profile_pic if profile_pic else "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150",
                        bio_text=bio,
                        public_email=contacts["email"],
                        public_phone=contacts["phone"],
                        whatsapp_link=contacts["whatsapp"],
                        external_url=external_url,
                        engagement_rate=3.8,
                        discovery_score=score,
                        discovery_signals=signal_tags,
                        review_state="UNREVIEWED",
                        status="New"
                    )
                    db.add(lead)
                    new_leads_count += 1
                else:
                    # Update existing record with refreshed profile data
                    existing.follower_count = followers
                    existing.bio_text = bio
                    existing.discovery_score = score
                    existing.discovery_signals = signal_tags
                    if contacts["email"]: existing.public_email = contacts["email"]
                    if contacts["phone"]: existing.public_phone = contacts["phone"]
                    if contacts["whatsapp"]: existing.whatsapp_link = contacts["whatsapp"]

        job.status = "completed"
        job.leads_found = new_leads_count
        job.finished_at = datetime.datetime.utcnow()
        db.commit()

    except Exception as e:
        db.rollback()
        if 'job' in locals() and job:
            job.status = "failed"
            job.error_message = str(e)
            job.finished_at = datetime.datetime.utcnow()
            db.commit()
        print(f"[Apify Job Error]: {e}")
    finally:
        db.close()
