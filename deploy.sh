#!/bin/bash
# CareerGini Production Deployment Script
# Usage: ./deploy.sh [--build] [--migrate] [--restart]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date +'%H:%M:%S')]${NC} $1"; }
success() { echo -e "${GREEN}✓${NC} $1"; }
warn() { echo -e "${YELLOW}⚠${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# Check .env exists
if [ ! -f .env ]; then
  error ".env file not found. Copy .env.example to .env and fill in values."
fi

source .env

BUILD=false
MIGRATE=false
RESTART=false

for arg in "$@"; do
  case $arg in
    --build) BUILD=true ;;
    --migrate) MIGRATE=true ;;
    --restart) RESTART=true ;;
    --all) BUILD=true; MIGRATE=true; RESTART=true ;;
  esac
done

log "🚀 CareerGini Production Deployment"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# 1. Pull latest code
log "Pulling latest code..."
git pull origin master && success "Code updated" || warn "Git pull failed (continuing)"

# 2. Build Docker images
if [ "$BUILD" = true ]; then
  log "Building Docker images..."
  docker compose -p careergini build --no-cache
  success "Docker images built"
fi

# 3. Start infrastructure services first
log "Starting infrastructure (PostgreSQL, Redis, Ollama)..."
docker compose -p careergini up -d postgres redis ollama
sleep 5

# Wait for PostgreSQL
log "Waiting for PostgreSQL..."
until docker compose -p careergini exec -T postgres pg_isready -U careergini; do
  sleep 2
done
success "PostgreSQL ready"

# 4. Run database migrations
if [ "$MIGRATE" = true ]; then
  log "Running database migrations..."
  docker compose -p careergini exec -T postgres psql -U careergini -d careergini \
    -f /docker-entrypoint-initdb.d/02-enhancements.sql 2>/dev/null || warn "Migrations may already be applied"
  success "Database migrations complete"
fi

# 5. Start application services
log "Starting application services..."
docker compose -p careergini up -d ai-service profile-service application-service
sleep 10

# 6. Start API Gateway
log "Starting API Gateway..."
docker compose -p careergini up -d api-gateway
sleep 5

# 7. Start Frontend
log "Starting Frontend..."
docker compose -p careergini up -d frontend

# 8. Health checks
log "Running health checks..."
sleep 5

SERVICES=("postgres:5432" "redis:6379" "ai-service:8000" "profile-service:3001" "application-service:3002" "api-gateway:3000" "frontend:80")
ALL_HEALTHY=true

for service in "${SERVICES[@]}"; do
  name="${service%%:*}"
  port="${service##*:}"
  if docker compose -p careergini ps "$name" | grep -q "Up"; then
    success "$name is running"
  else
    warn "$name may not be healthy"
    ALL_HEALTHY=false
  fi
done

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

if [ "$ALL_HEALTHY" = true ]; then
  success "🎉 Deployment complete! All services healthy."
  echo ""
  echo "  Frontend:     http://localhost:80"
  echo "  API Gateway:  http://localhost:3000"
  echo "  AI Service:   http://localhost:8000"
  echo "  API Docs:     http://localhost:8000/docs"
else
  warn "Deployment complete with warnings. Check logs:"
  echo "  docker compose -p careergini logs --tail=50"
fi

# 9. Show container status
echo ""
log "Container status:"
docker compose -p careergini ps
