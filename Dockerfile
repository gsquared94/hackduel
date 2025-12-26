# Stage 1: Build Frontend
FROM node:20-slim AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# Stage 2: Backend
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies if needed (e.g. for pandas/numpy compilation)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc python3-dev

# Copy backend requirements
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend code
COPY backend/ .

# Copy frontend build to backend static folder
# We defined 'static' in main.py
COPY --from=frontend-builder /app/frontend/dist ./static

# Expose port (Cloud Run uses 8080 by default)
ENV PORT=8080
EXPOSE 8080

# Run uvicorn
# Note: we bind to 0.0.0.0 for container access
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT}"]
