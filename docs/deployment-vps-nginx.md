# DrivewayGuard VPS Deployment (Nginx + Basic Auth)

This guide deploys the static web app on a low-cost VPS with:
- Nginx static hosting
- HTTPS via Let's Encrypt
- Login gate via HTTP Basic Auth

## 1) Low-cost provider recommendation

For lowest monthly cost, start with:
- Hetzner CX11 (or equivalent shared vCPU VPS)
- 1 vCPU, 2 GB RAM, 20+ GB disk is enough for this static app

Any Ubuntu 22.04 LTS VPS works with this runbook.

## 2) Buy domain and configure DNS

1. Buy a domain from the cheapest registrar you prefer.
2. In DNS settings, create:
   - `A` record for `@` -> `<VPS_PUBLIC_IP>`
   - `A` record for `www` -> `<VPS_PUBLIC_IP>`
3. Wait for propagation (usually minutes, can be longer).

## 3) Upload repository to the VPS

On your local machine:

```bash
scp -r driveway_guard user@your-vps-ip:/home/user/driveway_guard
```

On the VPS:

```bash
cd /home/user/driveway_guard
chmod +x deploy/scripts/bootstrap-vps.sh deploy/scripts/deploy-static.sh
```

## 4) Bootstrap Nginx + HTTPS

From repository root on the VPS:

```bash
./deploy/scripts/bootstrap-vps.sh your-domain.com your-email@example.com
```

This script installs packages, enables Nginx, requests TLS certificates, writes final site config, and validates renewals.

## 5) Create login user (Basic Auth)

```bash
sudo htpasswd -c /etc/nginx/.htpasswd-driveway-guard drivewayadmin
sudo nginx -t && sudo systemctl reload nginx
```

Use a strong password.

## 6) Deploy static files

From local repository root:

```bash
./deploy/scripts/deploy-static.sh user@your-vps-ip
```

If your local shell is PowerShell and bash is unavailable, use WSL/Git Bash or manually copy `index.html` and `assets/` to `/var/www/driveway_guard`.

## 7) Firewall and hardening checklist

- Open ports `80` and `443` on the VPS firewall/security group.
- Keep SSH restricted to known IPs if possible.
- Disable password SSH login and use keys.
- Keep OS packages updated regularly.

## 8) Validation checklist

Run these checks after every deploy:

1. `https://your-domain.com` loads with a valid lock icon.
2. Browser prompts for username/password.
3. Wrong credentials fail; correct credentials allow access.
4. App UI loads and camera permissions can be granted.
5. `sudo nginx -t` returns success.
6. `sudo certbot renew --dry-run` returns success.

## 9) Rollback procedure

If latest deploy is broken:

1. Re-copy last known good `index.html` and `assets/` into `/var/www/driveway_guard`.
2. Verify ownership:
   ```bash
   sudo chown -R www-data:www-data /var/www/driveway_guard
   ```
3. Reload Nginx:
   ```bash
   sudo nginx -t && sudo systemctl reload nginx
   ```
4. Re-test login and app load from mobile + desktop.

## 10) Notes

- This is intentionally simple auth for Req2. It protects site access but is not a full multi-user account system.
- Real user login/session management should be implemented in Req3+ with a backend.
