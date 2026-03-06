---
description: How to run the full LAWNOVA project (all services)
---

# Running the Full LAWNOVA Project

LAWNOVA is a **microservices-based** application. You need to start **6 services** in separate terminals, plus ensure **MongoDB** is connected (cloud-hosted on Atlas, so no local setup needed).

## Prerequisites

- **Node.js** (v18+) & **npm** installed
- **Python** (v3.10+) with pip installed
- MongoDB Atlas connection (already configured in `.env` files)
- API keys configured in `.env` files (Gemini, Pinecone, OpenAI, Daily)

## Startup Order (Important!)

Start services in this order to avoid dependency failures:

---

### Step 1: User Service (Port 5005)
// turbo
```bash
cd d:\RE\LawnovaWebapp\services\user-service && npm run dev
```
Handles: Authentication, user profiles, admin panel

---

### Step 2: AI Service - Node.js (Port 5008)
// turbo
```bash
cd d:\RE\LawnovaWebapp\services\ai-service && npm run dev
```
Handles: Study material generation, judgment prediction API routes

---

### Step 3: Argument Audit Service - Python/Flask (Port 5001)
// turbo
```bash
cd d:\RE\LawnovaWebapp\services\roleplay-service\python_backend && python app.py
```
Handles: ML-powered legal argument audit using InLegalBERT model.

---

### Step 4: MockTrial Service (Port 10004)
// turbo
```bash
cd d:\RE\LawnovaWebapp\services\mocktrial-service && npm run dev
```
Handles: Mock trial sessions, scheduling, calendar, video rooms, Socket.IO

---

### Step 5: Roleplay Service (Port 10005)
// turbo
```bash
cd d:\RE\LawnovaWebapp\services\roleplay-service && npm run dev
```
Handles: AI roleplay game, case generation, multi-day trials, chat/verdict pipeline

---

### Step 6: API Gateway (Port 5000)
// turbo
```bash
cd d:\RE\LawnovaWebapp\api-gateway && npm run dev
```
Handles: Routes all `/api/*` requests to the correct microservice. **Must start after** backend services.

---

### Step 7: Web Client / Frontend (Port 5173)
// turbo
```bash
cd d:\RE\LawnovaWebapp\web-client && npm run dev
```
Handles: React + Vite frontend. Open http://localhost:5173 in your browser.

---

## Service Architecture & Port Map

| # | Service               | Port  | Technology       | Entry Point              |
|---|-----------------------|-------|------------------|--------------------------|
| 1 | User Service          | 5005  | Node.js/Express  | `src/server.js`          |
| 2 | AI Service (Node)     | 5008  | Node.js/Express  | `src/server.js`          |
| 3 | Argument Audit (Py)   | 5001  | Python/Flask     | `app.py`                 |
| 4 | MockTrial Service     | 10004 | Node.js/Express  | `src/server.js`          |
| 5 | Roleplay Service      | 10005 | Node.js/Express  | `src/server.js`          |
| 6 | API Gateway           | 5000  | Node.js/Express  | `server.js`              |
| 7 | Web Client (Frontend) | 5173  | React + Vite     | `npm run dev`            |

## API Gateway Route Map

All frontend requests go through `http://localhost:5000`:

| Frontend Path         | Proxied To                    |
|-----------------------|-------------------------------|
| `/api/auth/*`         | user-service (5005)           |
| `/api/users/*`        | user-service (5005)           |
| `/api/admin/*`        | user-service (5005)           |
| `/api/ai/*`           | ai-service Node (5008)        |
| `/api/audit/*`        | argument-audit (5001)         |
| `/api/mock-trials/*`  | mocktrial-service (10004)     |
| `/api/sessions/*`     | mocktrial-service (10004)     |
| `/api/roleplay/*`     | roleplay-service (10005)      |
| `/socket.io/*`        | mocktrial-service WS (10004)  |

## Health Checks

Once running, verify all services:

- Gateway:   http://localhost:5000/health
- User:      http://localhost:5005/health
- AI Node:   http://localhost:5008/health
- Audit:     http://localhost:5001/health
- MockTrial: http://localhost:10004/health
- Roleplay:  http://localhost:10005/health
- Frontend:  http://localhost:5173

## Troubleshooting

- **"ECONNREFUSED"**: A dependent service hasn't started yet. Check the port map above.
- **"MongoDB connection error"**: Check that `MONGODB_URI` in `.env` is correct and your IP is whitelisted in Atlas.
- **"OPENAI_API_KEY not found"**: The ai-service Python needs `OPENAI_API_KEY` in `services/ai-service/.env` for LangChain roleplay agents.
- **Python dependencies**: Run `pip install -r services/ai-service/scripts/requirements.txt` if Flask/LangChain modules are missing.
- **Node dependencies**: Run `npm install` in each service directory if `node_modules` is missing.