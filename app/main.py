import os
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from fastapi.responses import HTMLResponse, FileResponse

from app.config import settings
from app.seed import seed_database
from app.routers import auth_router, project_router, lead_router, admin_router

app = FastAPI(title=settings.PROJECT_NAME)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
static_dir = os.path.join(BASE_DIR, "static")
templates_dir = os.path.join(BASE_DIR, "templates")
frontend_dist_dir = os.path.join(BASE_DIR, "frontend_dist")

os.makedirs(static_dir, exist_ok=True)
os.makedirs(templates_dir, exist_ok=True)

app.mount("/static", StaticFiles(directory=static_dir), name="static")

# If compiled React Vite SPA dist exists, mount assets
if os.path.exists(frontend_dist_dir):
    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.exists(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

templates = Jinja2Templates(directory=templates_dir)

# Include Routers
app.include_router(auth_router.router)
app.include_router(project_router.router)
app.include_router(lead_router.router)
app.include_router(admin_router.router)

@app.on_event("startup")
def startup_event():
    print("[Startup] Auto-running database migrations and seed...")
    seed_database()

@app.get("/api/health")
def health_check():
    return {"status": "healthy", "service": "LeadHub Marketing Scrapper"}

@app.get("/", response_class=HTMLResponse)
def get_dashboard(request: Request):
    index_dist = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_dist):
        return FileResponse(index_dist)
    return templates.TemplateResponse(request=request, name="index.html", context={"project_name": settings.PROJECT_NAME})

@app.get("/login", response_class=HTMLResponse)
def get_login_page(request: Request):
    index_dist = os.path.join(frontend_dist_dir, "index.html")
    if os.path.exists(index_dist):
        return FileResponse(index_dist)
    return templates.TemplateResponse(request=request, name="login.html", context={"project_name": settings.PROJECT_NAME})
