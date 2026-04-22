# LawNova Web Application — Project Overview

> A comprehensive, AI-powered legal education platform built on a microservices architecture, specialised for **Sri Lankan law**.

---

## 1. What is LawNova?

**LawNova** is an innovative web-based platform that transforms the way law students and legal professionals learn, practise, and refine their courtroom skills. Instead of relying solely on textbooks and passive lectures, LawNova provides **interactive, AI-driven simulations** of real courtroom environments — from generating realistic legal scenarios to predicting case outcomes using machine learning.

### Core Goals

| Goal | Description |
| :--- | :--- |
| **Interactive Learning** | Provide hands-on courtroom practice through AI-powered mock trials and role-playing scenarios. |
| **Intelligent Assistance** | Offer real-time legal research, argument suggestions, and statute citations via an AI legal assistant. |
| **Predictive Analytics** | Predict likely legal outcomes based on case facts and historical precedents using trained ML models. |
| **Quality Assurance** | Validate the substantive quality of legal arguments in real-time using specialised NLP models (InLegalBERT). |
| **Document Automation** | Assist in drafting legal documents with AI-powered templates and content suggestions. |

### Target Audience

- Law students preparing for courtroom practice and examinations
- Legal professionals seeking continuous skill enhancement
- Academic institutions offering legal education programmes
- Legal aid organisations training volunteers

---

## 2. High-Level Architecture

LawNova follows a **microservices architecture** where each service is independently deployable and responsible for a single domain concern. All services communicate through a central **API Gateway**.

```
┌─────────────────────────────────────────────────────────────────┐
│                        WEB CLIENT (React + Vite)                │
│                         Port: 5173                              │
└──────────────────────────────┬──────────────────────────────────┘
                               │  HTTP / WebSocket
                               ▼
┌─────────────────────────────────────────────────────────────────┐
│                      API GATEWAY (Express.js)                   │
│                         Port: 5000                              │
│  • Central routing   • JWT auth middleware   • Rate limiting    │
└───┬──────┬──────┬──────┬──────┬──────┬──────┬──────────────────┘
    │      │      │      │      │      │      │
    ▼      ▼      ▼      ▼      ▼      ▼      ▼
┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐┌──────┐
│User  ││AI    ││Audit ││Mock  ││Role  ││Judg. ││Draft │
│Svc   ││Svc   ││Svc   ││Trial ││Play  ││Pred. ││Svc   │
│:5005 ││:5008 ││:5001 ││:10004││:10005││:5006 ││:5007 │
└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘└──────┘
    │      │      │      │      │      │      │
    └──────┴──────┴──────┴──────┴──────┴──────┘
                       │
                       ▼
              ┌─────────────────┐
              │  MongoDB Atlas   │
              │  (Cloud DB)      │
              └─────────────────┘
```

### API Gateway Route Map

| Frontend Path | Proxied To |
| :--- | :--- |
| `/api/auth/*` | User Service (5005) |
| `/api/users/*` | User Service (5005) |
| `/api/admin/*` | User Service (5005) |
| `/api/ai/*` | AI Service (5008) |
| `/api/audit/*` | Argument Audit Service (5001) |
| `/api/mock-trials/*` | MockTrial Service (10004) |
| `/api/sessions/*` | MockTrial Service (10004) |
| `/api/roleplay/*` | Roleplay Service (10005) |
| `/socket.io/*` | MockTrial Service WebSocket (10004) |

---

## 3. Technology Stack

### Frontend

| Technology | Purpose |
| :--- | :--- |
| **React 18** | UI component library |
| **Vite** | Fast build tool and dev server |
| **TailwindCSS** | Utility-first CSS framework |
| **React Router v6** | Client-side navigation |
| **Axios** | HTTP client for API communication |
| **React Hook Form + Zod** | Form handling and schema validation |
| **Lucide React** | Icon library |

### Backend (Node.js Services)

| Technology | Purpose |
| :--- | :--- |
| **Express.js** | REST API framework |
| **Mongoose** | MongoDB ODM |
| **Socket.IO** | Real-time bidirectional communication |
| **JWT (jsonwebtoken)** | Stateless authentication |
| **bcryptjs** | Password hashing |
| **Helmet** | HTTP security headers |
| **Winston** | Structured logging |

### Backend (Python Services)

| Technology | Purpose |
| :--- | :--- |
| **Flask** | Lightweight web framework for ML services |
| **PyTorch / Transformers** | Deep learning inference for BERT models |
| **InLegalBERT** | Domain-specific NLP model for legal text |

### External Services & AI

| Service | Purpose |
| :--- | :--- |
| **Google Gemini AI** | Advanced text generation, legal reasoning |
| **Pinecone / Vector Store** | Semantic search over legal documents |
| **VideoSDK** | Real-time video conferencing for mock trials |
| **MongoDB Atlas** | Cloud-hosted NoSQL database |

### Machine Learning Models

| Model | Location | Purpose |
| :--- | :--- | :--- |
| **LAWNOVA_MODEL_A** | `ML MODELS/LAWNOVA_MODEL_A/` | Legal logic classification / boosting |
| **LAWNOVA_MODEL_B_35K** | `ML MODELS/LAWNOVA_MODEL_B_35K/` | Large-scale judgment prediction (35K training samples) |

---

## 4. Service-by-Service Breakdown

Each service below is independently deployable and owns its own domain logic.

---

### 4.1 API Gateway

| Property | Value |
| :--- | :--- |
| **Port** | `5000` |
| **Technology** | Node.js / Express |
| **Entry Point** | `api-gateway/server.js` |

#### What It Does

The API Gateway is the **single entry point** for all frontend requests. It acts as a reverse proxy, routing each incoming request to the correct backend microservice based on the URL path.

#### Key Responsibilities

- **Request Routing** — Maps URL paths (e.g., `/api/auth/*`) to the correct internal service port.
- **Authentication Middleware** — Validates JWT tokens on protected routes before forwarding requests.
- **Rate Limiting** — Prevents abuse by throttling excessive requests.
- **Security Headers** — Applies HTTP security best practices via Helmet.
- **CORS Management** — Controls which origins can access the API.

#### Why It Matters

Without the gateway, the frontend would need to know the address of every microservice. The gateway abstracts this complexity, providing a unified `http://localhost:5000` endpoint.

---

### 4.2 User Service

| Property | Value |
| :--- | :--- |
| **Port** | `5005` |
| **Technology** | Node.js / Express |
| **Entry Point** | `services/user-service/src/server.js` |

#### What It Does

The User Service is the **identity and profile management** hub. It handles everything related to who a user is — from registration and login to profile updates and admin operations.

#### Key Responsibilities

- **Authentication** — User registration, login, and logout with JWT token generation.
- **Authorization** — Role-based access control (Student, Professional, Admin).
- **Profile Management** — CRUD operations on user profiles, preferences, and settings.
- **Admin Panel** — Administrative endpoints for user management and platform analytics.
- **Session Management** — Token refresh and invalidation.

#### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/auth/register` | Register a new user account |
| `POST` | `/auth/login` | Authenticate and receive JWT token |
| `POST` | `/auth/logout` | Invalidate user session |
| `GET` | `/auth/verify` | Verify a JWT token's validity |
| `GET` | `/users/profile` | Retrieve current user's profile |
| `PUT` | `/users/profile` | Update profile information |

---

### 4.3 AI Service

| Property | Value |
| :--- | :--- |
| **Port** | `5008` |
| **Technology** | Node.js / Express |
| **Entry Point** | `services/ai-service/src/server.js` |

#### What It Does

The AI Service is the platform's **knowledge engine**. It powers the AI Legal Assistant chatbot, generates study materials from trial transcripts, and provides semantic search capabilities over legal documents.

#### Key Responsibilities

- **AI Legal Assistant** — A context-aware chatbot that answers legal questions, suggests arguments, and cites relevant statutes using Google Gemini AI.
- **Streaming Responses (SSE)** — Delivers AI responses in real-time via Server-Sent Events for a smooth, interactive user experience.
- **Study Material Generation** — Automatically generates quizzes and learning content from mock trial sessions and legal texts.
- **Vector Embeddings** — Generates and queries vector embeddings for semantic search over legal case law and statutes.
- **Argument Suggestions** — Provides AI-generated counter-arguments and legal strategy recommendations based on case context.

#### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/ai/assistant/chat` | Chat with the AI legal assistant (SSE streaming) |
| `POST` | `/ai/embeddings` | Generate vector embeddings for a document |
| `POST` | `/ai/argument-suggestions` | Get AI-powered argument suggestions |

#### How It Works

1. User sends a legal question from the frontend.
2. The AI Service retrieves relevant context from the vector store (semantic search).
3. The context + question are sent to Google Gemini AI for generation.
4. The response is streamed back to the user token-by-token via SSE.

---

### 4.4 Argument Audit Service (Python)

| Property | Value |
| :--- | :--- |
| **Port** | `5001` |
| **Technology** | Python / Flask |
| **Entry Point** | `services/roleplay-service/python_backend/app.py` |

#### What It Does

The Argument Audit Service is a **specialised ML-powered quality control** engine. Unlike the general-purpose AI Service, this service focuses exclusively on **evaluating the legal merit** of arguments submitted by users during roleplay sessions.

#### Key Responsibilities

- **Argument Scoring** — Analyses a legal argument and returns a substantive density score (0.0 to 1.0).
- **Dual-Model Validation** — Uses a combination of **InLegalBERT** (domain-specific) and **Gemini AI** (general reasoning) for robust evaluation.
- **Real-Time Feedback** — Provides instant feedback during roleplay, telling users if their arguments are legally sound or weak.
- **Reinforcement Learning Loop** — Scores feed back into the Roleplay Service to reward or penalise AI agent strategies.

#### How It Works

1. During a roleplay session, the user submits a legal argument.
2. The Roleplay Service forwards the argument to the Audit Service.
3. **InLegalBERT** analyses the argument for legal terminology, structure, and relevance.
4. **Gemini AI** provides a secondary evaluation for logical coherence.
5. A composite score is returned, which influences the trial outcome and user performance analytics.

#### Research Significance

This service implements a novel **inference-time Reinforcement Learning reward loop** — the audit scores act as reward signals that guide the AI agents toward generating higher-quality legal arguments over the course of a trial.

---

### 4.5 MockTrial Service

| Property | Value |
| :--- | :--- |
| **Port** | `10004` |
| **Technology** | Node.js / Express / Socket.IO |
| **Entry Point** | `services/mocktrial-service/src/server.js` |

#### What It Does

The MockTrial Service manages **live virtual courtroom sessions** where multiple participants can join a video-based mock trial. It is the "collaboration layer" of the platform.

#### Key Responsibilities

- **Session Management** — Create, schedule, and manage mock trial sessions with configurable parameters (case type, duration, participant limits).
- **Video Conferencing** — Integrates with **VideoSDK** to provide real-time video/audio rooms for trial participants.
- **Role Assignment** — Assigns courtroom roles to participants: Judge, Prosecutor, Defence Counsel, Witness, Jury.
- **Real-Time Events** — Uses **Socket.IO** to broadcast live events: participant joins/leaves, role assignments, trial phase changes.
- **Session Recording** — Supports transcription and recording of trial proceedings for later review.
- **Calendar & Scheduling** — Provides a calendar interface for scheduling upcoming trial sessions.

#### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/mock-trials/sessions` | Create a new mock trial session |
| `GET` | `/mock-trials/sessions/:id` | Get session details |
| `POST` | `/mock-trials/sessions/:id/join` | Join an existing session |
| `POST` | `/mock-trials/sessions/:id/assign-role` | Assign a courtroom role |
| `GET` | `/mock-trials/sessions/:id/token` | Get a VideoSDK auth token |

#### WebSocket Events

| Event | Description |
| :--- | :--- |
| `participant-joined` | Fires when a new participant enters the courtroom |
| `participant-left` | Fires when a participant leaves |
| `role-assigned` | Fires when a role is assigned to someone |
| `trial-phase-changed` | Fires when the trial advances to a new phase |

---

### 4.6 Roleplay Service

| Property | Value |
| :--- | :--- |
| **Port** | `10005` |
| **Technology** | Node.js / Express |
| **Entry Point** | `services/roleplay-service/src/server.js` |

#### What It Does

The Roleplay Service is the **"Game Engine"** of LawNova. It orchestrates AI-powered legal scenarios where users practise courtroom skills against intelligent AI agents acting as opposing counsel, judges, and witnesses.

#### Key Responsibilities

- **Case Generation** — Creates realistic legal scenarios based on Sri Lankan law, complete with case facts, charges, and evidence.
- **Director-Actor Architecture** — Uses a "Director" AI that controls the trial flow (phases, turns, pacing) while "Actor" AIs simulate realistic courtroom participants.
- **Multi-Day Trial Progression** — Simulates multi-day trials where each day covers different trial phases (Opening Statements → Evidence → Cross-Examination → Closing → Verdict).
- **Dynamic AI Responses** — AI agents respond contextually to the user's arguments, adapting their strategy based on the strength of the user's submissions.
- **Cross-Examination Practice** — Allows users to practise questioning witnesses with AI-generated realistic responses.
- **Performance Analytics** — Tracks user performance across sessions and provides detailed feedback.

#### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/roleplay/init-trial` | Initialise a new AI-powered trial scenario |
| `POST` | `/roleplay/interact` | Submit an action and receive the AI's response |
| `POST` | `/roleplay/advance-day` | Advance the trial to the next day |

#### How a Trial Session Works

```
Day 1: Opening Statements
  └─ User presents their opening argument
  └─ AI (opposing counsel) responds
  └─ AI (judge) provides initial remarks

Day 2: Evidence & Examination
  └─ User presents evidence
  └─ AI generates witnesses for cross-examination
  └─ Argument Audit scores each submission

Day 3: Cross-Examination
  └─ User cross-examines AI witnesses
  └─ AI adapts responses based on user's strategy

Day 4: Closing Arguments & Verdict
  └─ User delivers closing argument
  └─ AI (judge) delivers verdict with reasoning
  └─ Performance report generated
```

#### Integration with Audit Service

Every argument the user submits is sent to the **Argument Audit Service** for real-time scoring. High-scoring arguments (> 0.8) earn positive reinforcement, while low-scoring arguments (< 0.4) receive negative feedback — creating a **Reinforcement Learning reward loop** that improves the AI agents' responses over time.

---

### 4.7 Judgment Prediction Service

| Property | Value |
| :--- | :--- |
| **Port** | `5006` |
| **Technology** | Python / Flask |
| **Entry Point** | `services/judgment-prediction-service/src/` |

#### What It Does

The Judgment Prediction Service uses **machine learning models** trained on historical legal data to predict the likely outcome of a legal case based on its facts.

#### Key Responsibilities

- **Outcome Prediction** — Analyses case facts and predicts whether the case is likely to result in conviction, acquittal, or a specific ruling.
- **Confidence Scoring** — Provides a confidence percentage with visual gauges to indicate how certain the prediction is.
- **Precedent Analysis** — Identifies similar historical cases that support the prediction.
- **Statute Identification** — Lists the relevant statutes and legal provisions applicable to the case.
- **Detailed Reasoning** — Generates an explanation of why the model reached its prediction.

#### Key Endpoints

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/prediction/predict-judgment` | Submit case facts and receive a prediction |

#### ML Models Used

- **MODEL_A (Legal Logic Boost)** — A smaller, faster model optimised for legal logic classification.
- **MODEL_B (35K Dataset)** — A larger model trained on ~35,000 legal cases for higher accuracy on complex cases.

---

### 4.8 Drafting Assistant Service

| Property | Value |
| :--- | :--- |
| **Port** | `5007` |
| **Technology** | Node.js / Express |
| **Entry Point** | `services/drafting-assistant-service/` |

#### What It Does

The Drafting Assistant Service helps users **create legal documents** efficiently by providing templates, AI-powered content suggestions, and compliance checks.

#### Key Responsibilities

- **Template Management** — Provides a library of legal document templates (pleadings, motions, notices, affidavits).
- **AI Content Generation** — Uses Gemini AI to suggest appropriate legal language and clauses based on the document type and context.
- **Legal Compliance Checking** — Validates that drafted documents meet formatting and procedural requirements.
- **Version Control** — Maintains revision history for drafted documents.

---

### 4.9 Web Client (Frontend)

| Property | Value |
| :--- | :--- |
| **Port** | `5173` |
| **Technology** | React + Vite + TailwindCSS |
| **Entry Point** | `web-client/src/App.jsx` |

#### What It Does

The Web Client is the **user-facing interface** — a modern single-page application that provides access to all of LawNova's features.

#### Key Pages

| Page | Description |
| :--- | :--- |
| **Login / Register** | Authentication screens with form validation |
| **Dashboard** | Central hub showing upcoming sessions, recent activity, and quick actions |
| **Courtroom Page** | Live mock trial interface with video conferencing and real-time chat |
| **Roleplay Arena** | AI-powered trial simulation with a chat-based interaction model |
| **Judgment Prediction** | Input case facts and view AI predictions with confidence gauges |
| **AI Legal Assistant** | Chat interface for legal research with streaming responses |
| **Study Materials** | Generated quizzes and learning content from past sessions |

---

## 5. Data Flow Diagram

```
┌──────────┐    question     ┌──────────┐   context query   ┌──────────────┐
│  User    │ ──────────────▶ │ AI Svc   │ ────────────────▶ │ Vector Store │
│ (Browser)│                 │ (:5008)  │ ◀──────────────── │ (Pinecone)   │
└──────────┘                 └────┬─────┘   relevant docs   └──────────────┘
     ▲                            │
     │  SSE stream                │  prompt + context
     │                            ▼
     │                       ┌──────────┐
     └────────────────────── │ Gemini   │
                             │ AI API   │
                             └──────────┘

┌──────────┐   argument      ┌──────────┐   audit request   ┌──────────────┐
│  User    │ ──────────────▶ │ Roleplay │ ────────────────▶ │ Audit Svc    │
│ (Browser)│                 │ (:10005) │ ◀──────────────── │ (:5001)      │
└──────────┘                 └────┬─────┘   score (0-1)     │ InLegalBERT  │
     ▲                            │                         └──────────────┘
     │  AI response               │  RL reward signal
     │                            ▼
     │                       ┌──────────┐
     └────────────────────── │ AI Agent │
                             │ (Director│
                             │ + Actors)│
                             └──────────┘
```

---

## 6. How to Run

Start services in the following order:

| Step | Service | Command | Port |
| :--- | :--- | :--- | :--- |
| 1 | User Service | `cd services/user-service && npm run dev` | 5005 |
| 2 | AI Service | `cd services/ai-service && npm run dev` | 5008 |
| 3 | Argument Audit | `cd services/roleplay-service/python_backend && python app.py` | 5001 |
| 4 | MockTrial Service | `cd services/mocktrial-service && npm run dev` | 10004 |
| 5 | Roleplay Service | `cd services/roleplay-service && npm run dev` | 10005 |
| 6 | API Gateway | `cd api-gateway && npm run dev` | 5000 |
| 7 | Web Client | `cd web-client && npm run dev` | 5173 |

### Health Checks

Once running, verify each service:

- **Gateway:** http://localhost:5000/health
- **User Service:** http://localhost:5005/health
- **AI Service:** http://localhost:5008/health
- **Audit Service:** http://localhost:5001/health
- **MockTrial:** http://localhost:10004/health
- **Roleplay:** http://localhost:10005/health
- **Frontend:** http://localhost:5173

---

## 7. Research & Innovation Highlights

| Innovation | Description |
| :--- | :--- |
| **Director-Actor Pipeline** | A novel orchestration pattern where a "Director" AI controls trial flow while "Actor" AIs simulate courtroom participants with distinct personalities. |
| **Dual-Model Audit Engine** | Combines domain-specific InLegalBERT with general-purpose Gemini AI for robust legal argument validation. |
| **Inference-Time RL Loop** | Audit scores serve as reward signals during inference, enabling AI agents to adaptively improve argument quality within a single trial session. |
| **Sri Lankan Law Focus** | One of the first platforms to provide AI-powered legal education tools specifically tailored to the Sri Lankan legal system. |

---

*Last Updated: April 2026*
