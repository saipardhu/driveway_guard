$ErrorActionPreference = "Stop"

docker compose -f deploy/local/docker-compose.yml down
Write-Host "Local DrivewayGuard server stopped."
