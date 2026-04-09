param(
    [string]$Username = "drivewayadmin",
    [string]$Password = "change-me-now",
    [string]$AnthropicApiKey = ""
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

Write-Host "[3/4] Writing local API key include..."
if ([string]::IsNullOrWhiteSpace($AnthropicApiKey)) {
    throw "AnthropicApiKey is required. Pass -AnthropicApiKey `<your_key>`."
}
$keyConfigPath = "deploy/local/anthropic-key.conf"
$safeKey = $AnthropicApiKey.Replace("\", "\\").Replace("`"", "\"")
"set `$anthropic_api_key `"$safeKey`";" | Out-File -FilePath $keyConfigPath -Encoding ascii -NoNewline

Write-Host "[4/4] Starting local nginx..."
docker compose -f deploy/local/docker-compose.yml up -d

Write-Host "[5/5] Done."
Write-Host "Open: http://localhost:8080"
Write-Host "Login with username '$Username'."
