<#
.SYNOPSIS
  Shopi C2C Marketplace - Deterministic Layered Container Startup Orchestrator (Windows PowerShell)

.DESCRIPTION
  Builds multi-stage Docker images and starts containers in a strict 4-Tier dependency hierarchy:
    Tier 1: Data & Cache (PostgreSQL databases & Redis) -> wait until HEALTHY
    Tier 2: gRPC Microservices Mesh (identity, catalog, order-payment) -> wait until HEALTHY
    Tier 3: Edge API Gateway (REST-to-gRPC router) -> wait until HEALTHY
    Tier 4: Ingress, Frontend & Tooling (Next.js 15, Nginx, Prometheus, Grafana, pgAdmin, Redis-Commander)

.PARAMETER SkipBuild
  Skips the `docker compose build` step if images are already built.

.EXAMPLE
  .\scripts\start-ordered.ps1
  .\scripts\start-ordered.ps1 -SkipBuild
#>

[CmdletBinding()]
param(
    [switch]$SkipBuild
)

$ErrorActionPreference = "Stop"

function Write-StepHeader($stepNum, $title) {
    Write-Host ""
    Write-Host "========================================================================" -ForegroundColor Cyan
    Write-Host " STEP $stepNum : $title" -ForegroundColor Cyan
    Write-Host "========================================================================" -ForegroundColor Cyan
}

function Wait-ContainerHealthy($containerName, [int]$maxTimeoutSeconds = 90) {
    Write-Host "--> Waiting for container [$containerName] to become healthy (timeout: ${maxTimeoutSeconds}s)..." -NoNewline
    $elapsed = 0
    $sleepSec = 2

    while ($elapsed -lt $maxTimeoutSeconds) {
        $status = ""
        try {
            $status = (docker inspect --format '{{if .State.Health}}{{.State.Health.Status}}{{else}}{{.State.Status}}{{end}}' $containerName 2>$null).Trim()
        } catch {
            $status = "unknown"
        }

        if ($status -eq "healthy") {
            Write-Host " [HEALTHY]" -ForegroundColor Green
            return $true
        }

        if ($status -eq "unhealthy") {
            Write-Host " [UNHEALTHY]" -ForegroundColor Red
            Write-Host "Container [$containerName] reported unhealthy state!" -ForegroundColor Red
            docker logs --tail 30 $containerName
            throw "Container [$containerName] failed health check."
        }

        Start-Sleep -Seconds $sleepSec
        $elapsed += $sleepSec
        Write-Host "." -NoNewline
    }

    Write-Host " [TIMEOUT]" -ForegroundColor Red
    Write-Host "Timed out waiting for [$containerName] after ${maxTimeoutSeconds}s." -ForegroundColor Red
    docker logs --tail 30 $containerName
    throw "Timeout waiting for container [$containerName]."
}

# ==============================================================================
# Banner
# ==============================================================================
Clear-Host
Write-Host "########################################################################" -ForegroundColor Yellow
Write-Host "#                                                                      #" -ForegroundColor Yellow
Write-Host "#         SHOPI C2C USED-GOODS MARKETPLACE - ORDERED STARTUP           #" -ForegroundColor Yellow
Write-Host "#                                                                      #" -ForegroundColor Yellow
Write-Host "########################################################################" -ForegroundColor Yellow

# ==============================================================================
# Step 1: Image Building
# ==============================================================================
if (-not $SkipBuild) {
    Write-StepHeader "1" "Building Multi-Stage Docker Images (Parallel)"
    Write-Host "Running: docker compose build ..." -ForegroundColor Yellow
    docker compose build
    if ($LASTEXITCODE -ne 0) {
        throw "Docker compose build failed with exit code $LASTEXITCODE"
    }
    Write-Host "[✓] All application images built successfully." -ForegroundColor Green
} else {
    Write-Host "--> Skipping image build step (-SkipBuild specified)." -ForegroundColor DarkGray
}

# ==============================================================================
# Step 2: Tier 1 - Data & Cache Layer
# ==============================================================================
Write-StepHeader "2" "Deploying Tier 1: Databases & Multi-Level Cache"
Write-Host "Starting: postgres-identity-db, postgres-catalog-db, postgres-order-db, redis ..." -ForegroundColor Yellow
docker compose up -d postgres-identity-db postgres-catalog-db postgres-order-db redis

Wait-ContainerHealthy "shopi-postgres-identity-db" 45
Wait-ContainerHealthy "shopi-postgres-catalog-db" 45
Wait-ContainerHealthy "shopi-postgres-order-db" 45
Wait-ContainerHealthy "shopi-redis" 30

Write-Host "[✓] TIER 1 READY: All 3 PostgreSQL instances & Redis cache are HEALTHY." -ForegroundColor Green

# ==============================================================================
# Step 3: Tier 2 - Core gRPC Microservices Mesh
# ==============================================================================
Write-StepHeader "3" "Deploying Tier 2: gRPC Domain Microservices"
Write-Host "Starting: identity-service, shop-catalog-service, order-payment-service ..." -ForegroundColor Yellow
docker compose up -d identity-service shop-catalog-service order-payment-service

Wait-ContainerHealthy "shopi-identity-service" 90
Wait-ContainerHealthy "shopi-catalog-service" 90
Wait-ContainerHealthy "shopi-order-payment-service" 90

Write-Host "[✓] TIER 2 READY: All 3 Spring Boot gRPC microservices are HEALTHY." -ForegroundColor Green

# ==============================================================================
# Step 4: Tier 3 - Edge API Gateway
# ==============================================================================
Write-StepHeader "4" "Deploying Tier 3: Edge API Gateway (REST <-> gRPC Router)"
Write-Host "Starting: api-gateway ..." -ForegroundColor Yellow
docker compose up -d api-gateway

Wait-ContainerHealthy "shopi-api-gateway" 90

Write-Host "[✓] TIER 3 READY: Edge API Gateway is fully initialized and HEALTHY." -ForegroundColor Green

# ==============================================================================
# Step 5: Tier 4 - Ingress, Frontend UI & Observability
# ==============================================================================
Write-StepHeader "5" "Deploying Tier 4: Ingress, Next.js UI & Observability Tooling"
Write-Host "Starting: nextjs-frontend, nginx, prometheus, grafana, redis-commander, pgadmin ..." -ForegroundColor Yellow
docker compose up -d nextjs-frontend nginx prometheus grafana redis-commander pgadmin

Wait-ContainerHealthy "shopi-nextjs-frontend" 90
Wait-ContainerHealthy "shopi-nginx" 45

Write-Host "[✓] TIER 4 READY: Ingress, Next.js UI & Tooling are UP." -ForegroundColor Green

# ==============================================================================
# Final Service Dashboard
# ==============================================================================
Write-Host ""
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host " SHOPI C2C MARKETPLACE - DEPLOYMENT COMPLETED SUCCESSFULLY" -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "  Storefront Application:    http://localhost:3000   (or http://localhost)" -ForegroundColor White
Write-Host "  Edge API Gateway:          http://localhost:8080/api" -ForegroundColor White
Write-Host "  pgAdmin 4 (PostgreSQL):    http://localhost:5050   (admin@shopi.vn / AdminShopiSecurePass2026!)" -ForegroundColor White
Write-Host "  Redis Commander:           http://localhost:8085" -ForegroundColor White
Write-Host "  Grafana Dashboard:         http://localhost:3001   (admin / ShopiGrafanaAdminPass2026!)" -ForegroundColor White
Write-Host "  Prometheus Metrics:        http://localhost:9090" -ForegroundColor White
Write-Host ""
Write-Host "  Spring Boot Health Endpoints:" -ForegroundColor DarkGray
Write-Host "    - API Gateway:           http://localhost:8080/actuator/health" -ForegroundColor DarkGray
Write-Host "    - Catalog Service:       http://localhost:8081/actuator/health" -ForegroundColor DarkGray
Write-Host "    - Order Service:         http://localhost:8082/actuator/health" -ForegroundColor DarkGray
Write-Host "    - Identity Service:      http://localhost:8083/actuator/health" -ForegroundColor DarkGray
Write-Host ""
Write-Host "All containers running in deterministic sequence with zero port conflicts." -ForegroundColor Green
Write-Host "========================================================================" -ForegroundColor Cyan
