import datetime
from sqlalchemy.orm import Session
from app.database import engine, Base, SessionLocal
from app.config import settings
from app.auth import get_password_hash
from app import models

def seed_database():
    """
    Initializes database tables, seed projects, cities, hashtag matrix, and admin user.
    Does NOT seed sample leads — leads are collected 100% dynamically via Apify.
    """
    Base.metadata.create_all(bind=engine)
    db: Session = SessionLocal()
    try:
        # 1. Seed Admin User if missing
        admin_user = db.query(models.User).filter(models.User.email == settings.ADMIN_EMAIL).first()
        if not admin_user:
            admin_user = models.User(
                email=settings.ADMIN_EMAIL,
                password_hash=get_password_hash(settings.ADMIN_PASSWORD),
                full_name=settings.ADMIN_NAME,
                role="admin"
            )
            db.add(admin_user)
            print(f"[Seed] Created Admin User: {settings.ADMIN_EMAIL}")

        # 2. Seed Projects if missing
        projects_data = [
            {
                "slug": "pumppilot",
                "name": "PumpPilot (Fuel Operations)",
                "description": "Petrol pump operations, shift automation, tank dips, credit sales, and transport fleet manager software."
            },
            {
                "slug": "pharmaflow",
                "name": "PharmaFlow (Pharmacy ERP)",
                "description": "Pharmacy store inventory management, drug batch tracking, GST billing, and wholesale medical distributor ordering."
            }
        ]

        project_objs = {}
        for pdata in projects_data:
            proj = db.query(models.Project).filter(models.Project.slug == pdata["slug"]).first()
            if not proj:
                proj = models.Project(
                    slug=pdata["slug"],
                    name=pdata["name"],
                    description=pdata["description"]
                )
                db.add(proj)
                db.flush()
                print(f"[Seed] Created Project: {pdata['name']}")
            project_objs[pdata["slug"]] = proj

        # 3. Seed Cities if missing
        cities_data = [
            {"name": "Rajahmundry", "state": "Andhra Pradesh", "keywords": ["Rajahmundry news", "Rajamahendravaram", "Rajahmundry business"]},
            {"name": "Hyderabad", "state": "Telangana", "keywords": ["Hyderabad business", "Cyberabad", "Hyderabad news"]},
            {"name": "Visakhapatnam", "state": "Andhra Pradesh", "keywords": ["Vizag news", "Vizag business", "Visakhapatnam"]},
            {"name": "Vijayawada", "state": "Andhra Pradesh", "keywords": ["Vijayawada business", "Bezawada"]},
            {"name": "Guntur", "state": "Andhra Pradesh", "keywords": ["Guntur business", "Guntur news"]},
            {"name": "Warangal", "state": "Telangana", "keywords": ["Warangal news", "Warangal business"]},
            {"name": "Tirupati", "state": "Andhra Pradesh", "keywords": ["Tirupati news", "Tirupati business"]},
            {"name": "Karimnagar", "state": "Telangana", "keywords": ["Karimnagar business"]},
            {"name": "Nizamabad", "state": "Telangana", "keywords": ["Nizamabad business"]},
            {"name": "Kakinada", "state": "Andhra Pradesh", "keywords": ["Kakinada business"]},
            {"name": "Proddatur", "state": "Andhra Pradesh", "keywords": ["Proddatur business", "Proddatur news", "Proddatur town", "YSR Kadapa"]}
        ]

        city_objs = {}
        for cdata in cities_data:
            city = db.query(models.City).filter(models.City.name == cdata["name"]).first()
            if not city:
                city = models.City(name=cdata["name"], state=cdata["state"], local_keywords=cdata["keywords"])
                db.add(city)
                db.flush()
                print(f"[Seed] Created City: {cdata['name']}")
            city_objs[cdata["name"]] = city

        db.commit()

        # 4. Seed Project-City Hashtags Matrix if missing
        hashtag_matrix = {
            "pumppilot": {
                "Rajahmundry": ["#rajahmundry", "#rajamahendravaram", "#petrolpump", "#petrolbunk", "#fuelstation"],
                "Hyderabad": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#hpcldealer", "#bpcldealer"],
                "Visakhapatnam": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#vizagpetrolpump"],
                "Vijayawada": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#vijayawadapetrolpump"],
                "Guntur": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#gunturpetrolpump"],
                "Warangal": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#warangalpetrolpump"],
                "Tirupati": ["#petrolpump", "#petrolpumpowner", "#fuelstation", "#tirupatipetrolpump"],
                "Karimnagar": ["#petrolpump", "#petrolpumpowner", "#fuelstation"],
                "Nizamabad": ["#petrolpump", "#petrolpumpowner", "#fuelstation"],
                "Kakinada": ["#petrolpump", "#petrolpumpowner", "#fuelstation"],
                "Proddatur": ["#proddatur", "#proddaturbunk", "#petrolpump", "#petrolbunk", "#fuelstation"]
            },
            "pharmaflow": {
                "Rajahmundry": ["#rajahmundry", "#rajamahendravaram", "#pharmacy", "#medicalstore", "#chemist"],
                "Hyderabad": ["#medicalstore", "#pharmacist", "#chemist", "#pharmacybusiness", "#dpharm"],
                "Visakhapatnam": ["#medicalstore", "#pharmacist", "#chemist", "#pharmacybusiness", "#vizagmedical"],
                "Vijayawada": ["#medicalstore", "#pharmacist", "#chemist", "#pharmacybusiness", "#vijayawadapharma"],
                "Guntur": ["#medicalstore", "#pharmacist", "#chemist", "#gunturmedical"],
                "Warangal": ["#medicalstore", "#pharmacist", "#chemist", "#warangalmedical"],
                "Tirupati": ["#medicalstore", "#pharmacist", "#chemist", "#tirupatimedical"],
                "Karimnagar": ["#medicalstore", "#pharmacist", "#chemist"],
                "Nizamabad": ["#medicalstore", "#pharmacist", "#chemist"],
                "Kakinada": ["#medicalstore", "#pharmacist", "#chemist"],
                "Proddatur": ["#proddatur", "#proddaturmedical", "#pharmacy", "#medicalstore", "#chemist"]
            }
        }

        for pslug, cities_map in hashtag_matrix.items():
            proj = project_objs.get(pslug)
            if not proj:
                continue
            for cname, tags in cities_map.items():
                city = city_objs.get(cname)
                if not city:
                    continue
                existing_pch = db.query(models.ProjectCityHashtag).filter(
                    models.ProjectCityHashtag.project_id == proj.id,
                    models.ProjectCityHashtag.city_id == city.id
                ).first()

                if not existing_pch:
                    pch = models.ProjectCityHashtag(
                        project_id=proj.id,
                        city_id=city.id,
                        hashtags=tags
                    )
                    db.add(pch)

        db.commit()
        print("[Seed] Configuration seeding completed.")
        seed_demo_target_leads(db)

    except Exception as e:
        db.rollback()
        print(f"[Seed] Error seeding database: {e}")
    finally:
        db.close()

def seed_demo_target_leads(db: Session):
    """Seed initial target leads for PumpPilot and PharmaFlow if table is empty"""
    existing_count = db.query(models.InfluencerLead).count()
    if existing_count > 0:
        return

    print("[Seed] Seeding target lead queue for PumpPilot & PharmaFlow...")
    pumppilot = db.query(models.Project).filter(models.Project.slug == "pumppilot").first()
    pharmaflow = db.query(models.Project).filter(models.Project.slug == "pharmaflow").first()

    cities = {c.name: c.id for c in db.query(models.City).all()}

    demo_leads = [
        # PumpPilot Leads
        {
            "project_id": pumppilot.id if pumppilot else 1,
            "city_id": cities.get("Rajahmundry", 1),
            "username": "rajahmundry_petrol_pumps",
            "full_name": "Rajahmundry Bunk Owners & Fuel Dealers",
            "follower_count": 28400,
            "following_count": 1240,
            "media_count": 3280,
            "profile_pic_url": "https://images.unsplash.com/photo-1527018601619-a508a2be00cd?w=200",
            "bio_text": "HPCL, BPCL & IOCL Dealers Association Rajahmundry • Shift Automation • Tank Dips & Credit Sales • Fleet Fuel Managers",
            "public_email": "contact@rajahmundryfuel.org",
            "public_phone": "+91 98480 12345",
            "whatsapp_link": "https://wa.me/919848012345",
            "external_url": "https://rajahmundryfuel.org",
            "discovery_score": 96,
            "discovery_signals": ["#rajahmundry", "City Match", "Fuel Station", "HPCL Dealer", "Shift Dip", "Multi-Source Match"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        {
            "project_id": pumppilot.id if pumppilot else 1,
            "city_id": cities.get("Hyderabad", 2),
            "username": "hyderabad_fuel_dealers",
            "full_name": "Cyberabad Petroleum & Fleet Hub",
            "follower_count": 45200,
            "following_count": 890,
            "media_count": 1540,
            "profile_pic_url": "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?w=200",
            "bio_text": "Hyderabad Petrol Pump Association • Digital Nozzle Meters • Credit Sales Automation • Tanker Dip Logs • Contact for Software",
            "public_email": "info@cyberabadfuel.com",
            "public_phone": "+91 99890 54321",
            "whatsapp_link": "https://wa.me/919989054321",
            "external_url": "https://cyberabadfuel.com",
            "discovery_score": 94,
            "discovery_signals": ["#hyderabad", "City Match", "Petrol Bunk", "Fleet Manager", "Credit Ledger"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        {
            "project_id": pumppilot.id if pumppilot else 1,
            "city_id": cities.get("Visakhapatnam", 3),
            "username": "vizag_petroleum_hub",
            "full_name": "Vizag Port Fuel & Transport Bunks",
            "follower_count": 18900,
            "following_count": 620,
            "media_count": 890,
            "profile_pic_url": "https://images.unsplash.com/photo-1519003722824-194d4455a60c?w=200",
            "bio_text": "Vizag Coast Fuel Stations • Heavy Commercial Vehicle Refueling • Shift Reconciliation & Dip Software • DM for demos",
            "public_email": "ops@vizagbunks.in",
            "public_phone": "+91 98491 67890",
            "whatsapp_link": "https://wa.me/919849167890",
            "external_url": "https://vizagbunks.in",
            "discovery_score": 91,
            "discovery_signals": ["#vizag", "City Match", "Port Fuel", "Transport Fleet"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        {
            "project_id": pumppilot.id if pumppilot else 1,
            "city_id": cities.get("Proddatur", 11),
            "username": "proddatur_fuel_station",
            "full_name": "Proddatur Petrol Bunk & Fuel Dealers",
            "follower_count": 16200,
            "following_count": 540,
            "media_count": 920,
            "profile_pic_url": "https://images.unsplash.com/photo-1527018601619-a508a2be00cd?w=200",
            "bio_text": "Proddatur Petrol Bunk Association • Shift Dip Ledger & Shift Automation • Credit Sales Ledger • Contact for Fuel ERP",
            "public_email": "bunks@proddaturfuel.in",
            "public_phone": "+91 98492 11223",
            "whatsapp_link": "https://wa.me/919849211223",
            "external_url": "https://proddaturfuel.in",
            "discovery_score": 93,
            "discovery_signals": ["#proddatur", "City Match", "Fuel Station", "Petrol Bunk"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        # PharmaFlow Leads
        {
            "project_id": pharmaflow.id if pharmaflow else 2,
            "city_id": cities.get("Rajahmundry", 1),
            "username": "rajahmundry_chemists",
            "full_name": "Rajahmundry Wholesale Chemists & Druggists",
            "follower_count": 34100,
            "following_count": 1420,
            "media_count": 2100,
            "profile_pic_url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200",
            "bio_text": "Retail Pharmacy Stores & Distributors Association • GST Billing • Batch Expiry Tracking • Medicine Stock Automation • DM for Collabs",
            "public_email": "pharma@rajahmundrychemists.in",
            "public_phone": "+91 94401 23456",
            "whatsapp_link": "https://wa.me/919440123456",
            "external_url": "https://rajahmundrychemists.in",
            "discovery_score": 97,
            "discovery_signals": ["#rajahmundry", "City Match", "Pharmacy ERP", "GST Billing", "Batch Expiry", "Multi-Source Match"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        {
            "project_id": pharmaflow.id if pharmaflow else 2,
            "city_id": cities.get("Hyderabad", 2),
            "username": "hyderabad_medical_distributors",
            "full_name": "Hyderabad Retail Pharmacy Network",
            "follower_count": 52800,
            "following_count": 2100,
            "media_count": 4120,
            "profile_pic_url": "https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=200",
            "bio_text": "Medical Stores & Wholesale Pharma Distributors • Stock Ledger • Schedule H1 Drug Logs • Quick Billing Systems",
            "public_email": "support@hyderabadpharma.org",
            "public_phone": "+91 98488 77665",
            "whatsapp_link": "https://wa.me/919848877665",
            "external_url": "https://hyderabadpharma.org",
            "discovery_score": 95,
            "discovery_signals": ["#hyderabad", "City Match", "Medical Store", "Chemist Shop", "Distributor"],
            "review_state": "UNREVIEWED",
            "status": "New"
        },
        {
            "project_id": pharmaflow.id if pharmaflow else 2,
            "city_id": cities.get("Proddatur", 11),
            "username": "proddatur_medical_hub",
            "full_name": "Proddatur Retail Chemists & Wholesale Pharma",
            "follower_count": 21400,
            "following_count": 780,
            "media_count": 1340,
            "profile_pic_url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=200",
            "bio_text": "Proddatur Chemists & Druggists Association • GST Billing • Batch Expiry Tracking • Wholesale Pharma Software",
            "public_email": "pharma@proddaturmedical.in",
            "public_phone": "+91 94405 55667",
            "whatsapp_link": "https://wa.me/919440555667",
            "external_url": "https://proddaturmedical.in",
            "discovery_score": 95,
            "discovery_signals": ["#proddatur", "City Match", "Medical Store", "Chemist Shop", "GST Billing"],
            "review_state": "UNREVIEWED",
            "status": "New"
        }
    ]

    for ld in demo_leads:
        lead_obj = models.InfluencerLead(**ld)
        db.add(lead_obj)
    db.commit()
    print(f"[Seed] Successfully seeded {len(demo_leads)} target leads for testing!")

if __name__ == "__main__":
    seed_database()
