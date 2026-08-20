# People Frontend

Mobile-first React app for People HR, face attendance, and payroll.

The UI calls `/api` and `/uploads` on the **same origin**. Vite proxies those paths in development. In Docker/production, nginx in this image proxies them to the API container.

## Local development

```bash
npm install
npm run dev
```

Requires the API on port 4100 (`people_backend`). Open the URL Vite prints (usually `http://localhost:5173`).

Seed logins (API creates them on first start):

| Role | Login | Password |
| --- | --- | --- |
| HR | `hr@people.local` | `Hr@123` |
| Employee | `employee@people.local` | `Employee@123` |
| Kiosk device | `Lobby Kiosk` | `Device@123` |

## Themes

Atlas, Noir, and Sage — switch in Settings.

## Device kiosk

`/device` then `/kiosk`. Seed device: `Lobby Kiosk` / `Device@123`.

---

## Docker (UI image)

This image is nginx serving the Vite `dist` build. It expects the API at `API_UPSTREAM` (Compose default: `http://api:4100`).

Build only:

```bash
docker build -t people-web:local .
```

The UI container is not useful without the API. Use Compose so both start on one Docker network (see below).

---

## Deploy on AWS EC2

Clone **both** repos as siblings:

```text
/opt/people/
  people_backend/
  people_frontend/
```

### 1. EC2 instance

- Ubuntu 22.04 or 24.04, 1 vCPU / 2 GB RAM is enough.
- Security group inbound: **22** (your IP), **80** (0.0.0.0/0). Add **443** later for TLS.
- Elastic IP if you want a stable address.

### 2. Install Docker

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo $VERSION_CODENAME) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker ubuntu
# log out and back in so the docker group applies
```

### 3. Clone and configure

```bash
sudo mkdir -p /opt/people
sudo chown "$USER:$USER" /opt/people
cd /opt/people
git clone git@github.com:sakthi-selvan/people_backend.git
git clone git@github.com:sakthi-selvan/people_frontend.git

cd people_frontend
cp deploy.env.example .env
# edit .env:
#   JWT_SECRET=$(openssl rand -hex 32)
#   CORS_ORIGIN=http://YOUR_EC2_PUBLIC_IP
#   HTTP_PORT=80
```

`.env` next to Compose is interpolated into **both** services (the API reads `JWT_SECRET` / SMTP; the UI only needs `HTTP_PORT` and the shared network).

### 4. Start

```bash
cd /opt/people/people_frontend
docker compose up -d --build
docker compose ps
curl -sS http://127.0.0.1/health
curl -sS http://127.0.0.1/ | head
```

Open `http://YOUR_EC2_PUBLIC_IP` and sign in.

You can run the same file from `people_backend` instead; both Compose files expect the other repo as a sibling.

### 5. Operate

```bash
docker compose logs -f api web
docker compose restart
docker compose down          # named volume people-data is kept
```

Back up API data (attendance, faces, payroll):

```bash
docker run --rm -v people_people-data:/data -v "$PWD":/backup alpine \
  tar czf /backup/people-data-$(date +%F).tar.gz -C /data .
```

### HTTPS (optional)

Terminate TLS on the host (Caddy/nginx) and proxy to the published UI port. Set `CORS_ORIGIN=https://your.domain`.
