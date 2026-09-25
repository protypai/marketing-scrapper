# LeadHub - Instagram Influencer Scraper & Outreach Platform

LeadHub is an enterprise marketing lead-generation web application built by **ProtypAI** for **PumpPilot** (Fuel Operations ERP) and **PharmaFlow** (Pharmacy ERP). It uses **Apify** for ban-resistant Instagram scraping and provides an interactive Shadcn UI dashboard for marketing teams to discover, filter, and track influencer outreach.

---

## Architecture (PumpPilot Standard)

This application uses a containerized **PostgreSQL** architecture managed entirely via Docker / Docker Compose.

- **Frontend & API:** FastAPI SPA serving Tailwind + Shadcn UI.
- **Database:** PostgreSQL 15 container (`scrapper_postgres`) with healthchecks and persistent volume (`postgres_data`).
- **Scraper Engine:** Integrated `apify-client` using Apify residential proxies.
- **Image Proxy:** Server-side proxying for Instagram CDN images (`/api/leads/proxy-image?url=...`).

---

## Key Features

- **Multi-Project Support:** Switch between **PumpPilot** and **PharmaFlow** seamlessly from the header.
- **Dynamic City & Hashtag Scraping:** AP & Telangana target cities (Hyderabad, Visakhapatnam, Vijayawada, Guntur, Warangal, Tirupati, Karimnagar, Nizamabad, Rajahmundry, Kakinada).
- **Apify 2-Step Scraping Pipeline:** Combines hashtag post scraping (`apify/instagram-hashtag-scraper`) with profile enrichment (`apify/instagram-profile-scraper`).
- **Same-Origin Profile Picture Proxy:** Prevents browser COEP/CORS blocks.
- **Lead Contact Extraction:** Automatically extracts email, mobile phone numbers (`+91`), and WhatsApp `wa.me` chat links from bios.
- **Dynamic Data Only:** 0 hardcoded/seeded leads—live data generated strictly through Apify scraping.
- **Tabs & Status Workflow:** Track leads across `UNREVIEWED`, `KEEP`, `REVIEW_LATER`, `REJECT` tabs with side drawer note logging.
- **Admin Management & Auto-Seeding:** Auto-seeds initial admin credentials securely on boot (`admin@protypai.com`).
- **Exporting:** Download filtered leads directly to **CSV** or **Excel (.xlsx)**.

---

## Environment Configuration (`.env`)

```env
# Security Key for JWT Session Tokens
SECRET_KEY=super-secret-key-change-in-production-2026

# PostgreSQL Configuration
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres_password_2026
POSTGRES_DB=leadhub
DATABASE_URL=postgresql://postgres:postgres_password_2026@postgres:5432/leadhub

# Apify API Token
APIFY_API_TOKEN=apify_api_your_token_here

# Initial Admin Credentials
ADMIN_EMAIL=admin@protypai.com
ADMIN_PASSWORD=Admin@PumpPharma2026
ADMIN_NAME=Admin User
```

---

## Coolify Deployment (`https://coolify.protypai.online/`)

Following the **PumpPilot** deployment standard, the application and PostgreSQL database are created directly via **Docker Compose**:

1. Log into **Coolify**: `https://coolify.protypai.online/`
2. Click **+ Add Resource** -> **Docker Compose** (or **GitHub Repository**).
3. Connect repo: `https://github.com/protypai/marketing-scrapper.git` (Branch: `main`).
4. Under **Domains / FQDN**, set:
   ```text
   https://marketingscrapper.protypai.online
   ```
5. Add your Environment Variables in Coolify (`SECRET_KEY`, `APIFY_API_TOKEN`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`).
6. Click **Deploy**. Coolify will spin up both `app` and `postgres` services, attach persistent volume storage, and automatically issue SSL certificates for `marketingscrapper.protypai.online`.

---

## Running Locally via Docker Compose

```bash
docker-compose up -d --build
```
Access the application at `http://localhost:8000`.
