# =============================================================================
# Stage 1: Build React Vite SPA Frontend (Shadcn UI + Lucide Icons)
# =============================================================================
FROM node:18-alpine AS frontend-builder
WORKDIR /build
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# =============================================================================
# Stage 2: Build & Run FastAPI Production Backend
# =============================================================================
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy FastAPI backend source
COPY app/ ./app/

# Copy built React Vite SPA assets into app/frontend_dist
COPY --from=frontend-builder /build/dist ./app/frontend_dist

# Create persistent data directory
RUN mkdir -p /app/data

EXPOSE 8000

# Start FastAPI application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
