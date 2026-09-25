# LeadHub - Instagram Influencer Scraper & Outreach Platform

LeadHub is an enterprise marketing lead-generation web application built by **ProtypAI** for **PumpPilot** (Fuel Operations ERP) and **PharmaFlow** (Pharmacy ERP). It uses **Apify** for ban-resistant Instagram scraping and provides an interactive Shadcn UI dashboard for marketing teams to discover, filter, and track influencer outreach.

---

## Key Features

- **Multi-Project Support:** Switch between **PumpPilot** and **PharmaFlow** seamlessly from the header.
- **Dynamic City & Hashtag Scraping:** AP & Telangana target cities (Hyderabad, Visakhapatnam, Vijayawada, Guntur, Warangal, Tirupati, Karimnagar, Nizamabad, Rajahmundry, Kakinada).
- **Apify 2-Step Scraping Pipeline:** Combines hashtag post scraping (`apify/instagram-hashtag-scraper`) with profile enrichment (`apify/instagram-profile-scraper`) using Apify residential proxies without IP bans.
- **Same-Origin Profile Picture Proxy:** Server-side proxying for Instagram CDN images (`/api/leads/proxy-image?url=...`) to avoid browser COEP/CORS blocks.
- **Lead Contact Extraction:** Automatically extracts email, mobile phone numbers (`+91`), and WhatsApp `wa.me` chat links from bios.
- **Dynamic Data Only:** 0 hardcoded/seeded leads—live data generated strictly through Apify scraping.
- **Tabs & Status Workflow:** Track leads across `UNREVIEWED`, `KEEP`, `REVIEW_LATER`, `REJECT` tabs with side drawer note logging.
- **Admin Management & Auto-Seeding:** Auto-seeds initial admin credentials securely on boot.
- **Exporting:** Download filtered leads directly to **CSV** or **Excel (.xlsx)**.
- **Coolify & Docker Ready:** Containerized setup with Dockerfile & Docker Compose support for SQLite or PostgreSQL.

---

## Environment Configuration (`.env`)

```env
# Application Security
SECRET_KEY=super-secret-key-change-in-production-2026

# Database Connection (SQLite or PostgreSQL)
DATABASE_URL=sqlite:///./data/leadhub.db
# For PostgreSQL in production/Coolify:
# DATABASE_URL=postgresql://postgres:yourpassword@leadhub_postgres:5432/leadhub

# Apify API Token
APIFY_API_TOKEN=apify_api_your_token_here

# Initial Admin Credentials
ADMIN_EMAIL=admin@protypai.com
ADMIN_PASSWORD=Admin@PumpPharma2026
ADMIN_NAME=Admin User
```

---

## Deployment on Coolify (`https://coolify.protypai.online/`)

### Step 1: Create PostgreSQL Database Resource (Optional but Recommended)
1. Go to **Coolify** -> **Projects** -> Select your Project / Environment.
2. Click **+ Add Resource** -> **Database** -> **PostgreSQL**.
3. Name: `marketing-scrapper-db`
4. Set Database Name: `leadhub`, User: `postgres`, Password: `<secure-password>`.

### Step 2: Add GitHub Repository Application
1. Click **+ Add Resource** -> **Public/Private Repository** (or **GitHub App**).
2. Enter Repository URL: `https://github.com/protypai/marketing-scrapper.git`
3. Branch: `main`
4. Build Pack: **Dockerfile** (or **Docker Compose**)
5. Port mapping / Exposed Port: `8000`

### Step 3: Configure Domain & Environment Variables in Coolify
1. Under **Domains / FQDN**:
   Set `https://marketingscrapper.protypai.online`
2. Under **Environment Variables**, add:
   - `SECRET_KEY`: `<your-random-secure-secret>`
   - `APIFY_API_TOKEN`: `<your-apify-token>`
   - `DATABASE_URL`: `postgresql://postgres:<password>@<db-host>:5432/leadhub` (or SQLite `sqlite:///./data/leadhub.db`)
   - `ADMIN_EMAIL`: `admin@protypai.com`
   - `ADMIN_PASSWORD`: `<your-secure-admin-password>`
3. Click **Deploy**. Coolify will automatically provision SSL certificates via Let's Encrypt for `marketingscrapper.protypai.online`.

---

## Local Development

```bash
# 1. Install Dependencies
pip install -r requirements.txt

# 2. Run App
python -m uvicorn app.main:app --reload --port 8000
```
Open `http://localhost:8000` in your browser.
