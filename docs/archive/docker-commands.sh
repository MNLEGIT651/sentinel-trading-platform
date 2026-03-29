#!/usr/bin/env bash
# Sentinel Docker Quick Reference Commands
# Copy and run these commands from project root

# ────────────────────────────────────────────────────────────────────────────
# SETUP
# ────────────────────────────────────────────────────────────────────────────

# Copy env template and fill with real values
cp .env.example .env
# Edit .env: NEXT_PUBLIC_SUPABASE_URL, API_KEYS, etc.

# ────────────────────────────────────────────────────────────────────────────
# START / STOP
# ────────────────────────────────────────────────────────────────────────────

# Build and start all services
docker compose up --build

# Start without rebuilding (if images already exist)
docker compose up

# Start in detached mode (background)
docker compose up -d

# Stop all services (preserves containers)
docker compose stop

# Stop and remove all containers and networks
docker compose down

# Stop, remove containers, and delete volumes
docker compose down -v

# ────────────────────────────────────────────────────────────────────────────
# DEVELOPMENT (HOT RELOAD)
# ────────────────────────────────────────────────────────────────────────────

# First: Uncomment volumes: sections in docker-compose.yml
# Then run watch mode for hot reload
docker compose watch

# Or watch specific service only
docker compose watch --no-up services/engine

# ────────────────────────────────────────────────────────────────────────────
# LOGS
# ────────────────────────────────────────────────────────────────────────────

# Stream all logs (Ctrl+C to stop)
docker compose logs -f

# Last 50 lines of all services
docker compose logs --tail=50

# Stream logs for specific service
docker compose logs -f engine
docker compose logs -f agents
docker compose logs -f web

# Last 100 lines for web service
docker compose logs --tail=100 web

# Logs since 10 minutes ago
docker compose logs --since 10m

# ────────────────────────────────────────────────────────────────────────────
# STATUS / HEALTH
# ────────────────────────────────────────────────────────────────────────────

# Show running containers and their status
docker compose ps

# Show all containers (including stopped)
docker compose ps -a

# Check health status in detail
docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Health}}"

# Get detailed health info for engine
docker inspect sentinel-engine | jq '.[0].State.Health'

# ────────────────────────────────────────────────────────────────────────────
# RESOURCE MONITORING
# ────────────────────────────────────────────────────────────────────────────

# Real-time resource usage (Ctrl+C to stop)
docker stats

# Resource usage snapshot (no stream)
docker stats --no-stream

# Resource usage for specific service
docker stats sentinel-engine

# ────────────────────────────────────────────────────────────────────────────
# BUILD (OPTIMIZED)
# ────────────────────────────────────────────────────────────────────────────

# Build with BuildKit caching (FASTEST)
DOCKER_BUILDKIT=1 docker compose build

# Rebuild without cache (clean build)
docker compose build --no-cache

# Rebuild specific service
docker compose build engine

# Build with progress output
docker compose build --progress=plain

# ────────────────────────────────────────────────────────────────────────────
# EXECUTE / SHELL ACCESS
# ────────────────────────────────────────────────────────────────────────────

# Open shell in running container
docker compose exec engine /bin/sh
docker compose exec agents sh
docker compose exec web sh

# Run command in container
docker compose exec engine curl http://localhost:8000/health
docker compose exec agents npm list

# Run command in service that's not running yet
docker compose run engine /bin/sh

# ────────────────────────────────────────────────────────────────────────────
# TESTING
# ────────────────────────────────────────────────────────────────────────────

# Run engine tests
docker compose exec engine python -m pytest tests/

# Run engine linting
docker compose exec engine python -m ruff check src/

# Run agents tests
docker compose exec agents npm test

# Run web tests
docker compose exec web npm test

# ────────────────────────────────────────────────────────────────────────────
# IMAGE MANAGEMENT
# ────────────────────────────────────────────────────────────────────────────

# List built images
docker image ls | grep sentinel

# Tag image for registry
docker tag sentinel-engine:latest myregistry/sentinel-engine:1.0.0

# Push to registry
docker push myregistry/sentinel-engine:1.0.0

# Remove image
docker image rm sentinel-engine:latest

# Remove unused images
docker image prune

# ────────────────────────────────────────────────────────────────────────────
# CLEANUP
# ────────────────────────────────────────────────────────────────────────────

# Remove stopped containers
docker container prune

# Remove unused volumes
docker volume prune

# Remove unused networks
docker network prune

# Remove unused images
docker image prune

# Complete cleanup (containers, volumes, images, networks)
docker system prune -a

# Check disk usage of Docker
docker system df

# ────────────────────────────────────────────────────────────────────────────
# DEBUGGING
# ────────────────────────────────────────────────────────────────────────────

# Inspect container config and networking
docker inspect sentinel-engine

# View container events in real-time
docker events --filter type=container

# Check network connectivity
docker compose exec engine curl http://agents:3001/health
docker compose exec agents curl http://engine:8000/health

# View network details
docker network inspect sentinel

# Check DNS resolution from container
docker compose exec engine nslookup agents

# ────────────────────────────────────────────────────────────────────────────
# PRODUCTION DEPLOYMENT
# ────────────────────────────────────────────────────────────────────────────

# Build with specific version tags
docker compose build
docker tag sentinel-engine:latest sentinel-engine:1.0.0
docker tag sentinel-agents:latest sentinel-agents:1.0.0
docker tag sentinel-web:latest sentinel-web:1.0.0

# Pull latest base images before building
docker compose up --pull always

# Export compose config for validation
docker compose config > docker-compose.output.yml

# Validate compose file syntax
docker compose config --quiet

# ────────────────────────────────────────────────────────────────────────────
# TROUBLESHOOTING
# ────────────────────────────────────────────────────────────────────────────

# Check why a service is failing
docker compose logs engine

# Restart unhealthy service
docker compose restart engine

# Force rebuild and restart
docker compose up --build --force-recreate

# Remove everything and start fresh
docker compose down -v && docker compose up --build

# Test health check manually
curl http://localhost:8000/health
curl http://localhost:3001/health
curl http://localhost:3000

# Check memory usage (potential OOM issues)
docker compose exec engine free -h
docker stats --no-stream | grep engine

# ────────────────────────────────────────────────────────────────────────────
# NOTES
# ────────────────────────────────────────────────────────────────────────────

# • All commands run from project root directory
# • Services communicate via: http://service-name:port
# • Logs are automatically rotated (10MB per file, max 3 files)
# • Health checks run every 30 seconds
# • Resource limits prevent runaway containers
# • BuildKit caching requires Docker Desktop 4.11+ or buildx

# Set BuildKit globally (one-time setup):
# macOS/Linux:   echo '{"features": {"buildkit": true}}' | docker buildx du config
# Windows:       (Edit Docker Desktop settings → Docker Engine)

# View Docker daemon logs:
# macOS:   tail -f ~/Library/Containers/com.docker.docker/Data/log/vm/dockerd.log
# Linux:   journalctl -xu docker.service
# Windows: %LOCALAPPDATA%\Docker\log\vm\dockerd.log
