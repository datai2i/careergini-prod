# CareerGini Production Deployment & Migration Guide

Welcome to the **CareerGini Live Production** repository. This repository contains the fully dockerized, thoroughly tested, and optimized stack for the CareerGini platform, designed for seamless deployment, easy scalability, and risk-free server migration.

## 🚀 1. Initial Server Setup & Deployment

Deploying CareerGini on a new Ubuntu Linux server is designed to be a one-command process once dependencies are installed.

### Prerequisites (On a fresh Ubuntu Server)
Ensure the server has Docker and Docker Compose installed:
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo systemctl enable --now docker
sudo usermod -aG docker $USER
newgrp docker
```

### Deployment Steps
1. **Clone the repository** to your desired location (e.g., `/opt/careergini-live` or `/home/ubuntu/careergini-live`):
   ```bash
   git clone <repository_url> careergini-live
   cd careergini-live
   ```

2. **Configure Environment Variables**:
   Copy the example environment file and fill in your production secrets (DB passwords, API keys, etc.).
   ```bash
   cp .env.example .env
   nano .env
   ```
   *Make sure `VITE_API_URL` reflects your actual domain name.*

3. **Deploy (One-Command)**:
   Run the deployment script, which will pull the latest code, build the optimized containers, apply schema migrations, and spin up the infrastructure securely.
   ```bash
   ./deploy.sh --build --migrate
   ```

4. **Verify Health**:
   The script automatically runs health checks. You can manually inspect the stack via:
   ```bash
   docker compose ps
   ```
   
   Services will be healthy and available at:
   - **Frontend**: http://your-domain.com
   - **API Gateway**: http://your-domain.com/api (Internal port: 3000)
   - **AI/Resume Service**: Internal port 8000

---

## 🔄 2. Server Migration & Zero Data Loss Guide

When scaling up to a larger server instance or moving cloud providers, follow these instructions to safely migrate without incurring data loss or connection breakages.

### Step 2.1: Backup the Existing Target Data (On Old Server)
All persistent data across the stack is safely mapped to localized Docker named volumes or folders.

1. **Stop the Application** gracefully to ensure no active writes:
   ```bash
   docker compose down
   ```

2. **Backup Docker Volumes**:
   Since Docker named volumes exist under `/var/lib/docker/volumes`, package them securely:
   ```bash
   sudo tar -czvf /tmp/careergini_data_backup.tar.gz \
     /var/lib/docker/volumes/careergini_postgres_data/ \
     /var/lib/docker/volumes/careergini_redis_data/ \
     /var/lib/docker/volumes/careergini_ollama_data/
   ```

3. **Backup Uploads (Resumes/PDFs)**:
   Package the persistent user uploads directory (if stored locally):
   ```bash
   tar -czvf /tmp/careergini_uploads_backup.tar.gz ./uploads
   ```

4. **Transfer Archives** to the new server via `scp` or `rsync`:
   ```bash
   scp /tmp/careergini_*_backup.tar.gz user@new-server-ip:/tmp/
   ```

### Step 2.2: Restore and Deploy (On New Server)
1. Perform the **Initial Server Setup** prerequisites listed in Section 1 on the new server.
2. Clone this repository into the same directory path (e.g., `/home/ubuntu/careergini-live`).
3. Restore the configuration file: copy your `.env` from the old server to the new server's directory.
4. **Restore Volumes**:
   ```bash
   sudo tar -xzvf /tmp/careergini_data_backup.tar.gz -C /
   ```
   *Note: Ensure the extraction path matches the Docker volume structure exactly.*
5. **Restore Uploads**:
   ```bash
   tar -xzvf /tmp/careergini_uploads_backup.tar.gz -C /home/ubuntu/careergini-live/
   ```
6. **Launch the Stack**:
   Since the data already exists, you don't need `--migrate`. Simply build and spin up:
   ```bash
   ./deploy.sh --build
   ```

### Step 2.3: DNS Switch (Zero Downtime Strategy)
- Update your DNS A/CNAME records to point `www.careergini.com` (and API subdomains) to the **New Server IP**.
- Leave the old server running until DNS fully propagates globally (usually 1-24 hours).
- The old server will slowly stop receiving traffic organically.

---

## ⚙️ 3. Maintenance, Scaling & Routing Adjustments

### Upgrading the Application
To push an update to your AI or Profile services:
1. Pull the latest code (`git pull`).
2. Run `./deploy.sh --build` to safely rebuild only the changed images and reboot them gracefully without dropping database connections.

### Editing Routes / APIs on a New Domain/Server
If moving to a new domain or if services need to point to different external URLs:
- **Frontend API Target**: Update `VITE_API_URL` within `.env`. This requires a rebuild of the React container to bake the new URL into the Vite production bundle:
  ```bash
  docker compose build frontend && docker compose up -d frontend
  ```
- **Internal Microservice Routing**: The API Gateway (`haystack-api-gateway/index.js`) auto-resolves internal IPs using Docker's internal DNS (`http://ai-service:8000`, `http://profile-service:3001`). **You do not need to change these** when changing servers, as Docker isolates and provisions them automatically.

### Scaling Services Individually
If the AI processing comes under heavy load, scale the AI Service up seamlessly:
```bash
docker compose up -d --scale ai-service=3
```
*Docker Compose will automatically round-robin load balance traffic from the API Gateway to all replica containers.*

---
**Maintained by the CareerGini Dev Team.**
