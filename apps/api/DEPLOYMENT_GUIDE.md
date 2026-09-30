# Homenet API — Production Deployment Guide (VPS + Dockerized Nginx + CI/CD)

This document provides a complete, step-by-step guide to deploying the **Homenet API** backend to your VPS using **Docker**, **Dockerized Nginx** as a reverse proxy, **Let's Encrypt SSL**, and automated deployments via **GitHub Actions** and **Docker Hub** for the domain **`api.homenetbd.com`**.

---

## Architecture Overview

```
                      ┌──────────────────────────────────────┐
                      │            GitHub Repository         │
                      │  (Push to main / stable-vps branch)  │
                      └──────────────────┬───────────────────┘
                                         │ triggers
                                         ▼
                      ┌──────────────────────────────────────┐
                      │        GitHub Actions CI/CD          │
                      │  1. Build multi-stage Docker image   │
                      │  2. Push to Docker Hub               │
                      │  3. SSH into VPS                     │
                      └─────────────┬────────────────┬───────┘
                                    │                │
            Pushes Docker Image     │                │ Executes SSH Deployment Script
                                    ▼                ▼
┌────────────────────────┐      ┌────────────────────────────────────────────────────────┐
│       Docker Hub       │◄─────┤                       Ubuntu VPS                       │
│ (homenet-api:latest)   │Pulls │                                                        │
└────────────────────────┘      │  /var/www/homenet-api/                                 │
                                │    ├── .env                                            │
                                │    ├── nginx.conf                                      │
                                │    ├── certbot/                                        │
                                │    └── docker-compose.prod.yml                         │
                                │                                                        │
                                │  1. Pulls new image from Docker Hub                    │
                                │  2. Runs `npx prisma migrate deploy`                   │
                                │  3. Launches containers via Docker Compose             │
                                │                                                        │
                                │  ┌──────────────────────────────────────────────────┐  │
                                │  │ Docker Container: homenet-api                    │  │
                                │  │ Port: 3000 (Internal homenet-network only)       │  │
                                │  └────────────────────────▲─────────────────────────┘  │
                                │                           │ proxy_pass http://api:3000 │
                                │  ┌────────────────────────┴─────────────────────────┐  │
                                │  │ Docker Container: homenet-nginx (stable-alpine)  │  │
                                │  │ Ports: 80 (HTTP) & 443 (HTTPS)                   │  │
                                │  │ SSL: /etc/letsencrypt/live/api.homenetbd.com/    │  │
                                │  └────────────────────────▲─────────────────────────┘  │
                                └───────────────────────────┼────────────────────────────┘
                                                            │
                                                            │ Public HTTPS Traffic
                                                            │
                                             ┌──────────────┴──────────────┐
                                             │ Client (Web / Mobile Apps)  │
                                             │  https://api.homenetbd.com  │
                                             └─────────────────────────────┘
                                                            │
                                                            │ Database Queries
                                                            ▼
                                             ┌─────────────────────────────┐
                                             │ Managed PostgreSQL Database │
                                             │      (Neon / Supabase)      │
                                             └─────────────────────────────┘
```

---

## Step 1: Issue the First SSL Certificate on VPS (One-Time)

Since no service is running on port 80/443 right now, and `api.homenetbd.com` is already pointing to your VPS IP, we can issue your Let's Encrypt SSL certificate in **one command** using Certbot in Docker:

SSH into your VPS and run:

```bash
mkdir -p /var/www/homenet-api/certbot/conf /var/www/homenet-api/certbot/www
cd /var/www/homenet-api

# Run Certbot in standalone mode to fetch your SSL certificate
docker run --rm -p 80:80 \
  -v /var/www/homenet-api/certbot/conf:/etc/letsencrypt \
  -v /var/www/homenet-api/certbot/www:/var/www/certbot \
  certbot/certbot certonly --standalone \
  -d api.homenetbd.com \
  --agree-tos \
  --email your-email@gmail.com \
  --no-eff-email
```
*(Replace `your-email@gmail.com` with your real email).*

You should see:
```
Successfully received certificate.
Certificate is saved at: /etc/letsencrypt/live/api.homenetbd.com/fullchain.pem
Key is saved at:         /etc/letsencrypt/live/api.homenetbd.com/privkey.pem
```

---

## Step 2: Create `nginx.conf` on VPS

In `/var/www/homenet-api`, create `nginx.conf`:

```bash
nano /var/www/homenet-api/nginx.conf
```

Paste the following:

```nginx
# Upstream pointing to the NestJS container in the same Docker network
upstream homenet_backend {
    server api:3000;
    keepalive 32;
}

# ── HTTP: ACME Challenge for Certbot & HTTPS Redirect ─────────────────────────
server {
    listen 80;
    listen [::]:80;
    server_name api.homenetbd.com;

    # Certbot challenge location for renewal
    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    # Redirect all HTTP traffic to HTTPS
    location / {
        return 301 https://$host$request_uri;
    }
}

# ── HTTPS: Secure Reverse Proxy ───────────────────────────────────────────────
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    http2 on;
    server_name api.homenetbd.com;

    # Let's Encrypt SSL certificates mounted from host
    ssl_certificate /etc/letsencrypt/live/api.homenetbd.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/api.homenetbd.com/privkey.pem;

    # SSL protocols & ciphers
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_session_cache shared:SSL:10m;
    ssl_session_timeout 1d;

    # Max upload body size for image and video uploads (matches app limits)
    client_max_body_size 100M;

    # Gzip Compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_proxied expired no-cache no-store private auth;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    location / {
        proxy_pass http://homenet_backend;
        proxy_http_version 1.1;

        # WebSocket support
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";

        # Standard proxy headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for heavy file uploads / database transactions
        proxy_connect_timeout 60s;
        proxy_send_timeout 120s;
        proxy_read_timeout 120s;

        # Buffer settings
        proxy_buffering on;
        proxy_buffer_size 128k;
        proxy_buffers 4 256k;
        proxy_busy_buffers_size 256k;
    }
}
```

Save and exit (`Ctrl + O`, `Enter`, `Ctrl + X`).

---

## Step 3: Configure `.env` on VPS

Edit `/var/www/homenet-api/.env`:

```bash
nano /var/www/homenet-api/.env
```

Paste your real environment variables:

```env
# Database Connections (Neon / Supabase)
DATABASE_URL=postgresql://user:password@ep-pooler.your-region.neon.tech/neondb?sslmode=require
DATABASE_URL_UNPOOLED=postgresql://user:password@ep-direct.your-region.neon.tech/neondb?sslmode=require

PORT=3000
NODE_ENV=production
DISABLE_FILE_LOGS=false

JWT_SECRET=your-strong-production-jwt-secret-here
JWT_ACCESS_EXPIRY=15m

THROTTLE_TTL=60000
THROTTLE_LIMIT=10

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret

MAX_IMAGE_SIZE_MB=10
MAX_VIDEO_SIZE_MB=100
MAX_IMAGES_PER_PROPERTY=20
MAX_VIDEOS_PER_PROPERTY=3

BACKGROUND_VERIFICATION_DELAY_MS=3000
VERIFICATION_MODE=off
```

Secure `.env`:
```bash
chmod 600 /var/www/homenet-api/.env
```

---

## Step 4: Configure GitHub Secrets for Automatic Deployment

1. Go to your repository on GitHub: `https://github.com/Redwan-Ahmed241/Homenet`
2. Go to **Settings > Secrets and variables > Actions > New repository secret**.
3. Add the following secrets:

| Secret Name | Description / Value |
|---|---|
| `DOCKERHUB_USERNAME` | Your Docker Hub username |
| `DOCKERHUB_TOKEN` | Your Docker Hub Personal Access Token (PAT) |
| `VPS_HOST` | Your VPS IP address (or `api.homenetbd.com`) |
| `VPS_USERNAME` | `root` (or your sudo username) |
| `VPS_SSH_KEY` | Private SSH key that has access to your VPS |
| `VPS_PORT` | `22` |

> [!TIP]
> **Need an SSH key pair for GitHub Actions?**
> Run on your computer or VPS:
> ```bash
> ssh-keygen -t ed25519 -C "github-actions-deploy" -f ~/.ssh/homenet_deploy
> cat ~/.ssh/homenet_deploy.pub >> ~/.ssh/authorized_keys
> chmod 600 ~/.ssh/authorized_keys
> cat ~/.ssh/homenet_deploy
> ```
> Copy the output of `cat ~/.ssh/homenet_deploy` and paste it into `VPS_SSH_KEY`.

---

## Step 5: Deploy via Git Push

Push your changes:

```bash
git add .
git commit -m "feat: configure dockerized nginx, ssl, and vps ci/cd pipeline"
git push origin stable-vps
```

GitHub Actions will automatically:
1. Build the production Docker image.
2. Push it to Docker Hub as `<DOCKERHUB_USERNAME>/homenet-api:latest`.
3. SSH into your VPS.
4. Run `npx prisma migrate deploy` against your cloud database.
5. Launch `homenet-api` and `homenet-nginx` with Docker Compose.
6. Prune old images.

---

## Step 6: Verify Deployment

Open your browser and navigate to:
```
https://api.homenetbd.com/api/docs
```
You should see the Swagger API documentation served over HTTPS with a valid Let's Encrypt certificate!

---

## SSL Certificate Auto-Renewal Setup (One-Time)

Certificates are valid for 90 days. Set up a simple cron job on the VPS to automatically renew them:

```bash
crontab -e
```

Add this line to run renewal on the 1st of every month:
```bash
0 0 1 * * docker run --rm -v /var/www/homenet-api/certbot/conf:/etc/letsencrypt -v /var/www/homenet-api/certbot/www:/var/www/certbot certbot/certbot renew --webroot -w /var/www/certbot --quiet && docker exec homenet-nginx nginx -s reload
```
