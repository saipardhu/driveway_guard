param(
    [string]$Username = "drivewayadmin",
    [string]$Password = "change-me-now"
)

$ErrorActionPreference = "Stop"

Write-Host "[1/4] Checking Docker..."
docker --version | Out-Null
docker compose version | Out-Null

Write-Host "[2/4] Creating local htpasswd file..."
$htpasswdPath = "deploy/local/.htpasswd-driveway-guard"
$escapedPassword = $Password.Replace("$", "`$")
$cmd = "docker run --rm httpd:2.4-alpine htpasswd -nbB $Username $escapedPassword"
$hashLine = Invoke-Expression $cmd
$hashLine | Out-File -FilePath $htpasswdPath -Encoding ascii -NoNewline

Write-Host "[3/4] Starting local nginx..."
docker compose -f deploy/local/docker-compose.yml up -d

Write-Host "[4/4] Done."
Write-Host "Open: http://localhost:8080"
Write-Host "Login with username '$Username'."
