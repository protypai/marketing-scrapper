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
            {"name": "Kakinada", "state": "Andhra Pradesh", "keywords": ["Kakinada business"]}
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
                "Kakinada": ["#petrolpump", "#petrolpumpowner", "#fuelstation"]
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
                "Kakinada": ["#medicalstore", "#pharmacist", "#chemist"]
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
        print("[Seed] Configuration seeding completed. (0 hardcoded leads added)")

    except Exception as e:
        db.rollback()
        print(f"[Seed] Error seeding database: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    seed_database()
