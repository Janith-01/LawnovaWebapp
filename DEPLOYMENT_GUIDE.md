# LawNova Docker Deployment Guide

This guide reflects the current repository structure in `d:\RE\LawnovaWebapp` and deploys through GitHub Actions:
1. Build and push Docker images to Docker Hub.
2. SSH into AWS EC2 and pull/run the latest images.

## 1) Services Included in CI/CD

The pipeline currently builds and deploys these services:
- `web-client`
- `api-gateway`
- `user-service`
- `ai-service`
- `argument-audit-service` (from `services/roleplay-service/python_backend`)
- `mocktrial-service`
- `roleplay-service`
- `judgment-prediction-service`

`drafting-assistant-service` is not included because that folder currently has no runnable app code (only a Dockerfile).

## 2) File Layout (Relevant)

- `.github/workflows/deploy.yml`
- `docker-compose.yml`
- `.env` (local and EC2 runtime env)
- `.env.example`
- Service Dockerfiles:
  - `web-client/Dockerfile`
  - `api-gateway/Dockerfile`
  - `services/user-service/Dockerfile`
  - `services/ai-service/Dockerfile`
  - `services/mocktrial-service/Dockerfile`
  - `services/roleplay-service/Dockerfile`
  - `services/roleplay-service/python_backend/Dockerfile`
  - `services/judgment-prediction-service/Dockerfile`

## 3) GitHub Secrets Required

Add these repository secrets in GitHub:
- `DOCKERHUB_USERNAME`
- `DOCKERHUB_TOKEN`
- `EC2_HOST`
- `EC2_USER` (usually `ubuntu`)
- `EC2_SSH_PRIVATE_KEY` (full `.pem` key contents)

## 4) EC2 One-Time Setup

Use Ubuntu 22.04+ and install Docker + Compose plugin:

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker ubuntu
```

Create app directory:

```bash
mkdir -p /home/ubuntu/lawnova
```

Copy these files once from your machine to EC2:
- `docker-compose.yml` -> `/home/ubuntu/lawnova/docker-compose.yml`
- production `.env` -> `/home/ubuntu/lawnova/.env`

For judgment-prediction models, create:

```bash
mkdir -p /home/ubuntu/lawnova/ml-models/MODEL_A
mkdir -p /home/ubuntu/lawnova/ml-models/MODEL_B_35K
```

Upload model files into those folders.

## 5) Required Runtime Variables in EC2 `.env`

At minimum include:
- `DOCKERHUB_USERNAME`
- `JWT_SECRET`
- `MONGODB_URI`
- `GEMINI_API_KEY`
- `PINECONE_API_KEY`
- `PINECONE_INDEX`
- `DAILY_API_KEY`

`docker-compose.yml` uses `${DOCKERHUB_USERNAME}` in image names.

## 6) GitHub Actions Deployment Flow

Workflow: `.github/workflows/deploy.yml`

- Trigger: push to `main` or manual `workflow_dispatch`
- Job 1: Build and push all listed service images to Docker Hub (`:latest` tags)
- Job 2: SSH into EC2 and run:
  - Docker Hub login
  - `docker compose --env-file .env pull`
  - `docker compose --env-file .env up -d --remove-orphans`
  - cleanup old images

## 7) Ports / Security Group

Open inbound:
- `22` (SSH)
- `80` (HTTP)

Keep internal service ports closed publicly. Containers communicate over Docker network.

## 8) First Deployment Checklist

1. Commit and push repo changes to `main`.
2. Ensure all required GitHub secrets exist.
3. Ensure EC2 has `/home/ubuntu/lawnova/docker-compose.yml` and `/home/ubuntu/lawnova/.env`.
4. Ensure models are uploaded to `/home/ubuntu/lawnova/ml-models/...`.
5. Run workflow manually once (or push to `main`).
6. Verify on EC2:

```bash
cd /home/ubuntu/lawnova
docker compose ps
docker compose logs -f --tail=100
```

## 9) Common Troubleshooting

- `invalid reference format` during `docker compose pull`:
  - `DOCKERHUB_USERNAME` missing in `/home/ubuntu/lawnova/.env`.
- Image builds fail for a service:
  - verify that service has required source and lockfiles.
- Judgment service fails to start:
  - confirm model mounts exist and files are present.
- API cannot reach a service:
  - verify service name and port in `docker-compose.yml` and gateway env mapping.
