# DrivewayGuard Local Hosting (Req2 Starter)

This is the recommended starting point for Requirement 2: host locally first, validate login flow, then move to VPS/public DNS.

## What this setup provides

- Local web server using Nginx (Docker)
- Login prompt using HTTP Basic Auth
- Static serving of `index.html` and `assets/`
- Fast mobile testing on your own machine

## Prerequisites

- Docker Desktop installed and running
- PowerShell terminal

## Start local hosting

Start local hosting (API key is injected into a gitignored file):

From repository root (`d:\\projects\\driveway_guard`):

```powershell
.\deploy\scripts\start-local.ps1 -Username drivewayadmin -Password "your-strong-password" -AnthropicApiKey "your-real-anthropic-key"
```

Then open:

- [http://localhost:8080](http://localhost:8080)

You should get a username/password prompt before the app loads.
Scans will use the local Nginx proxy endpoint (`/api/anthropic/messages`).

### Secret file behavior

- Script generates `deploy/local/anthropic-key.conf` automatically.
- `deploy/local/anthropic-key.conf` is gitignored and must never be committed.
- Example template is tracked at `deploy/local/anthropic-key.conf.example`.

## Stop local hosting

```powershell
.\deploy\scripts\stop-local.ps1
```

## Mobile testing on same Wi-Fi

1. Find your PC LAN IP (`ipconfig`) (example: `192.168.1.15`).
2. Open Windows firewall for inbound TCP `8080` (Private network).
3. On mobile (same Wi-Fi), open:
   - `http://192.168.1.15:8080`

## Validation checklist (Req2 local)

- Browser prompts for login at `http://localhost:8080`.
- Wrong password fails, correct password works.
- App loads after login.
- Camera permissions can be granted.
- Mobile phone on same Wi-Fi can access LAN URL and log in.

## Troubleshooting

- If Docker image pull fails: retry after internet/VPN check.
- If port is busy: change host mapping in `deploy/local/docker-compose.yml` from `8080:80` to another port.
- If mobile cannot reach LAN URL: check firewall and ensure both devices are on same subnet.

## Next step after local success

Use the VPS guide in `docs/deployment-vps-nginx.md` to move from local-only to public domain + HTTPS.
