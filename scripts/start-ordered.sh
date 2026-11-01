#!/usr/bin/env bash
# ==============================================================================
# Shopi C2C Marketplace - Deterministic Layered Container Startup Orchestrator
# Compatible with Linux, macOS, and Git Bash on Windows.
# ==============================================================================

set -euo pipefail

# ANSI Colors
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
GRAY='\033[0;90m'
NC='\033[0m' # No Color

SKIP_BUILD=false
if [[ "${1:-}" == "--skip-build" || "${1:-}" == "-s" ]]; then
  SKIP_BUILD=true
fi

write_step_header() {
  local step_num="$1"
  local title="$2"
  echo ""
  echo -e "${CYAN}========================================================================${NC}"
  echo -e "${CYAN} STEP ${step_num} : ${title}${NC}"
  echo -e "${CYAN}========================================================================${NC}"
}

wait_container_healthy() {
  local container_name="$1"
  local max_timeout="${2:-90}"
  local elapsed=0
  local sleep_sec=2

  echo -n -e "--> Waiting for container [${container_name}] to become healthy (timeout: ${max_timeout}s)..."

  while [ $elapsed -lt "$max_timeout" ]; do
    status=$(docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' "$container_name" 2>/dev/null || echo "unknown")

    if [ "$status" = "healthy" ]; then
      echo -e " ${GREEN}[HEALTHY]${NC}"
      return 0
    fi

    if [ "$status" = "unhealthy" ]; then
      echo -e " ${RED}[UNHEALTHY]${NC}"
      echo -e "${RED}Container [${container_name}] failed health check! Showing recent logs:${NC}"
      docker logs --tail 30 "$container_name" || true
      exit 1
    fi

    sleep $sleep_sec
    elapsed=$((elapsed + sleep_sec))
    echo -n "."
  done

  echo -e " ${RED}[TIMEOUT]${NC}"
  echo -e "${RED}Timed out waiting for [${container_name}] after ${max_timeout}s. Showing recent logs:${NC}"
  docker logs --tail 30 "$container_name" || true
  exit 1
}

# ==============================================================================
# Banner
# ==============================================================================
echo -e "${YELLOW}########################################################################${NC}"
echo -e "${YELLOW}#                                                                      #${NC}"
echo -e "${YELLOW}#         SHOPI C2C USED-GOODS MARKETPLACE - ORDERED STARTUP           #${NC}"
echo -e "${YELLOW}#                                                                      #${NC}"
echo -e "${YELLOW}########################################################################${NC}"

# ==============================================================================
# Step 1: Image Building
# ==============================================================================
if [ "$SKIP_BUILD" = false ]; then
  write_step_header "1" "Building Multi-Stage Docker Images (Parallel)"
  echo -e "${YELLOW}Running: docker compose build ...${NC}"
  docker compose build
  echo -e "${GREEN}[✓] All application images built successfully.${NC}"
else
  echo -e "${GRAY}--> Skipping image build step (--skip-build specified).${NC}"
fi

# ==============================================================================
# Step 2: Tier 1 - Data & Cache Layer
# ==============================================================================
write_step_header "2" "Deploying Tier 1: Databases & Multi-Level Cache"
echo -e "${YELLOW}Starting: postgres-identity-db, postgres-catalog-db, postgres-order-db, redis ...${NC}"
docker compose up -d postgres-identity-db postgres-catalog-db postgres-order-db redis

wait_container_healthy "shopi-postgres-identity-db" 45
wait_container_healthy "shopi-postgres-catalog-db" 45
wait_container_healthy "shopi-postgres-order-db" 45
wait_container_healthy "shopi-redis" 30

echo -e "${GREEN}[✓] TIER 1 READY: All 3 PostgreSQL instances & Redis cache are HEALTHY.${NC}"

# ==============================================================================
# Step 3: Tier 2 - Core gRPC Microservices Mesh
# ==============================================================================
write_step_header "3" "Deploying Tier 2: gRPC Domain Microservices"
echo -e "${YELLOW}Starting: identity-service, shop-catalog-service, order-payment-service ...${NC}"
docker compose up -d identity-service shop-catalog-service order-payment-service

wait_container_healthy "shopi-identity-service" 90
wait_container_healthy "shopi-catalog-service" 90
wait_container_healthy "shopi-order-payment-service" 90

echo -e "${GREEN}[✓] TIER 2 READY: All 3 Spring Boot gRPC microservices are HEALTHY.${NC}"

# ==============================================================================
# Step 4: Tier 3 - Edge API Gateway
# ==============================================================================
write_step_header "4" "Deploying Tier 3: Edge API Gateway (REST <-> gRPC Router)"
echo -e "${YELLOW}Starting: api-gateway ...${NC}"
docker compose up -d api-gateway

wait_container_healthy "shopi-api-gateway" 90

echo -e "${GREEN}[✓] TIER 3 READY: Edge API Gateway is fully initialized and HEALTHY.${NC}"

# ==============================================================================
# Step 5: Tier 4 - Ingress, Frontend UI & Observability
# ==============================================================================
write_step_header "5" "Deploying Tier 4: Ingress, Next.js UI & Observability Tooling"
echo -e "${YELLOW}Starting: nextjs-frontend, nginx, prometheus, grafana, redis-commander, pgadmin ...${NC}"
docker compose up -d nextjs-frontend nginx prometheus grafana redis-commander pgadmin

wait_container_healthy "shopi-nextjs-frontend" 90
wait_container_healthy "shopi-nginx" 45

echo -e "${GREEN}[✓] TIER 4 READY: Ingress, Next.js UI & Tooling are UP.${NC}"

# ==============================================================================
# Final Service Dashboard
# ==============================================================================
echo ""
echo -e "${CYAN}========================================================================${NC}"
echo -e "${GREEN} SHOPI C2C MARKETPLACE - DEPLOYMENT COMPLETED SUCCESSFULLY${NC}"
echo -e "${CYAN}========================================================================${NC}"
echo ""
echo -e "  Storefront Application:    http://localhost:3000   (or http://localhost)"
echo -e "  Edge API Gateway:          http://localhost:8080/api"
echo -e "  pgAdmin 4 (PostgreSQL):    http://localhost:5050   (admin@shopi.vn / AdminShopiSecurePass2026!)"
echo -e "  Redis Commander:           http://localhost:8085"
echo -e "  Grafana Dashboard:         http://localhost:3001   (admin / ShopiGrafanaAdminPass2026!)"
echo -e "  Prometheus Metrics:        http://localhost:9090"
echo ""
echo -e "${GRAY}  Spring Boot Health Endpoints:${NC}"
echo -e "${GRAY}    - API Gateway:           http://localhost:8080/actuator/health${NC}"
echo -e "${GRAY}    - Catalog Service:       http://localhost:8081/actuator/health${NC}"
echo -e "${GRAY}    - Order Service:         http://localhost:8082/actuator/health${NC}"
echo -e "${GRAY}    - Identity Service:      http://localhost:8083/actuator/health${NC}"
echo ""
echo -e "${GREEN}All containers running in deterministic sequence with zero port conflicts.${NC}"
echo -e "${CYAN}========================================================================${NC}"
