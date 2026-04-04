# Roleplay Service — Technical Overview

> **Module Owner:** AI/ML Team  
> **Service Port:** 10005 (Node.js) + 5009 (Python Dual-Model Audit Engine)  
> **Last Updated:** April 4, 2026  
> **Jurisdiction:** Sri Lankan Law

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Director–Actor Pipeline](#2-directoractor-pipeline)
3. [Dual-Model Audit Engine (Port 5009)](#3-dual-model-audit-engine-port-5009)
4. [Reward-Model Guided Dialogue Optimization](#4-reward-model-guided-dialogue-optimization)
5. [Courtroom Heartbeat Engine](#5-courtroom-heartbeat-engine)
6. [Data Model & Persistence](#6-data-model--persistence)
7. [API Surface](#7-api-surface)

---

## 1. Architecture Overview

The Roleplay Service is a real-time, AI-powered courtroom simulation for Sri Lankan law students. It uses a **Director–Actor architecture** orchestrated by Google Gemini, with a **Python-based Dual-Model Audit Engine** serving as both a quality gate and a reward model for reinforcement learning.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ROLEPLAY SERVICE (Port 10005)                       │
│                                                                             │
│  ┌──────────┐     ┌──────────┐     ┌────────────┐     ┌──────────────────┐ │
│  │ DIRECTOR │────▶│  ACTOR   │────▶│ RL REWARD  │────▶│ SELECTED OUTPUT  │ │
│  │ (Router) │     │(Dialogue)│     │   ENGINE   │     │ (Best-of-3)      │ │
│  └──────────┘     └──────────┘     └─────┬──────┘     └──────────────────┘ │
│       │                                  │                                  │
│       │            ┌─────────────────────▼────────────────────┐             │
│       │            │  DUAL-MODEL AUDIT ENGINE (Port 5009)     │             │
│       │            │  ┌──────────────┐  ┌──────────────────┐  │             │
│       │            │  │ Model A      │  │ Model B          │  │             │
│       │            │  │ (Evidence    │  │ (Statutory Law   │  │             │
│       │            │  │  Strength)   │  │  Expert)         │  │             │
│       │            │  └──────────────┘  └──────────────────┘  │             │
│       │            └──────────────────────────────────────────┘             │
│       │                                                                     │
│  ┌────▼───────────────────────────────────────────────────────────────────┐ │
│  │        HEARTBEAT ENGINE (Autonomous AI-to-AI Dialogue)                │ │
│  │        Every 30s of user silence → Director → Actor → RL → Emit      │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  Socket.IO (ws://localhost:10005/roleplay-socket)                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Technology Stack

| Component | Technology | Purpose |
|-----------|-----------|---------|
| Node.js Service | Express.js + Socket.IO | REST API + Real-time WebSocket |
| AI Generation | Google Gemini (`gemini-flash-latest`) | Director routing + Actor dialogue |
| Audit Model A | Fine-tuned BERT (`LAWNOVA_MODEL_A`) | Evidence strength classification |
| Audit Model B | Fine-tuned BERT (`LAWNOVA_MODEL_B_35K`) | Statutory law vs. factual assertion classification |
| Gemini Reasoner | `gemini-2.5-flash-lite` | Audit comment generation |
| Database | MongoDB (Mongoose) | Session persistence + reward logs |

---

## 2. Director–Actor Pipeline

Every user message (and every autonomous heartbeat tick) flows through a two-stage pipeline:

### Stage 1: The Director (Temperature 0.2)

**File:** `src/utils/aiOrchestrator.js` → `directCourtroomScene()`

The Director determines **who speaks next** using a combination of hard-coded rules and AI reasoning:

| Priority | Rule | Trigger | Result |
|----------|------|---------|--------|
| 1 | Objection Detection | User says "object" | → Judge rules (Sustained/Overruled) |
| 2 | Witness Call | User says "call [witness]" | → Clerk swears in witness |
| 3 | Swearing-In Handover | Clerk just administered oath | → Witness responds |
| 4 | Judge Repeat Prevention | Judge spoke last (user mode) | → Opponent or Witness |
| 5 | "Your Honor" Address | User addresses Judge | → Judge responds |
| 6 | AI Director | Complex/ambiguous situation | → Gemini decides |

**Critical Constraint:** The Director will **never** return the user's own role as the next speaker.

### Stage 2: The Actor (Temperature 0.7)

**File:** `src/utils/aiOrchestrator.js` → `generateActorDialogue()`

The Actor generates in-character dialogue for the selected speaker. The prompt is constructed with:

1. **Role personality** — Unique system prompt per character (Judge Dissanayake, Prosecutor Ratnayake, Defense Fernando, Witnesses)
2. **Sri Lankan law context** — Injected from `src/data/sriLankaLaws.js` (Penal Code, Evidence Ordinance)
3. **Case dossier** — Facts, evidence, witnesses from the generated case
4. **Conversation history** — Last 5 messages for continuity
5. **Performance feedback** — Dynamic prompt adjustment from the RL reward loop (see §4)

---

## 3. Dual-Model Audit Engine (Port 5009)

**File:** `python_backend/audit_engine.py`

The audit engine is a Flask microservice running two fine-tuned BERT models in parallel:

### Model A — Evidence Strength Expert
- **Checkpoint:** `ML MODELS/LAWNOVA_MODEL_A`
- **Output:** `evidence_density` (0.0 – 1.0) — how strong the evidentiary weight of an argument is
- **Labels:** Weak (0) ↔ Strong (1)

### Model B — Statutory Law Expert
- **Checkpoint:** `ML MODELS/LAWNOVA_MODEL_B_35K`
- **Output:** `legal_grounding` (0.0 – 1.0) — degree of statutory citation
- **Labels:** Fact (0) ↔ Law (1)

### Heuristic Logic Gate
A post-inference rule: if Model B classifies an argument as "Law" but testimonial verbs (e.g., *stated*, *testified*, *saw*) are detected, the classification is overridden to "Fact." This prevents misclassification of witness testimony as statutory argument.

### API

```
POST http://127.0.0.1:5009/api/audit-transcript
Content-Type: application/json

{
  "history": [
    { "role": "user", "content": "Under Section 366 of the Penal Code..." }
  ]
}

Response:
{
  "status": "success",
  "results": [
    {
      "argument": "Under Section 366...",
      "evidence_density": 0.8234,
      "legal_grounding": 0.7891,
      "classification": "Law",
      "auditor_comment": "Strong statutory citation with high logical density."
    }
  ]
}
```

---

## 4. Reward-Model Guided Dialogue Optimization

> **This section documents the Reinforcement Learning (RL) reward loop that uses the Dual-Model Audit Engine as a reward model to optimize courtroom agent dialogue quality at inference time.**

### 4.1 Motivation

LLMs generating legal arguments can produce responses that are fluent but substantively weak — containing filler language, vague assertions, or missing statutory citations. Rather than relying solely on prompt engineering, the system employs a **Best-of-N sampling policy with a learned reward function** to select the highest-quality candidate response before it reaches the user.

This is an inference-time optimization strategy. The LLM weights are not updated; instead, the system:
1. Generates **multiple candidate responses** in parallel
2. **Scores** each using the Dual-Model Audit Engine as a reward model
3. **Selects** the candidate with the highest composite score
4. **Logs** the reward signal and uses it to **dynamically adjust** the agent's system prompt

### 4.2 Architecture

```
                    ┌─────────────────────────────────────────────┐
                    │      ACTOR (Gemini Flash)                   │
                    │                                             │
User Message ──────▶│  Generate 3 Candidates in Parallel          │
                    │  ┌────────┐ ┌────────┐ ┌────────┐          │
                    │  │ Cand 1 │ │ Cand 2 │ │ Cand 3 │          │
                    │  └───┬────┘ └───┬────┘ └───┬────┘          │
                    └──────┼──────────┼──────────┼───────────────┘
                           │          │          │
                    ┌──────▼──────────▼──────────▼───────────────┐
                    │   DUAL-MODEL AUDIT ENGINE (Port 5009)      │
                    │                                             │
                    │  Score each candidate:                      │
                    │  - Model A: Evidence Density (0.0 – 1.0)   │
                    │  - Model B: Legal Grounding (0.0 – 1.0)    │
                    │                                             │
                    │  Composite Score = 0.6×ED + 0.4×LG         │
                    └──────┬──────────┬──────────┬───────────────┘
                           │          │          │
                    ┌──────▼──────────▼──────────▼───────────────┐
                    │   POLICY SELECTION                          │
                    │                                             │
                    │  Sort by Composite Score (descending)       │
                    │  Select Candidate with MAX score            │
                    │  Log reward: +1 (>0.7), 0, -1 (<0.4)      │
                    └──────┬─────────────────────────────────────┘
                           │
                    ┌──────▼─────────────────────────────────────┐
                    │   FEEDBACK LOOP                             │
                    │                                             │
                    │  Inject performance history into next       │
                    │  Actor prompt:                              │
                    │  "Your last 3 arguments were Weak;          │
                    │   increase Section-based citations"         │
                    └────────────────────────────────────────────┘
```

### 4.3 Eligible Roles

The RL reward loop is only activated for roles that generate **substantive legal arguments**:

| Role | RL Enabled | Rationale |
|------|-----------|-----------|
| **Prosecutor** | ✅ Yes | Generates adversarial legal arguments |
| **DefenseAttorney** | ✅ Yes | Generates defensive legal arguments |
| Judge | ❌ No | Procedural/ruling role — quality is less variable |
| Witness | ❌ No | Narrative testimony — not scored on legal density |
| Clerk | ❌ No | Procedural announcements only |

### 4.4 Composite Substantive Density Score

The reward signal is derived from a **weighted composite** of the two BERT models:

```
Substantive Density Score = 0.6 × Evidence Density (Model A)
                          + 0.4 × Legal Grounding (Model B)
```

**Rationale:** Evidence strength (factual probative value) is weighted higher because in Sri Lankan criminal proceedings, the standard of proof is "beyond reasonable doubt" — making evidentiary density more impactful than pure statutory citation.

### 4.5 Discrete Reward Signal

The continuous composite score is mapped to a discrete RL reward:

| Score Range | Reward | Label |
|-------------|--------|-------|
| ≥ 0.70 | **+1** | Strong |
| 0.41 – 0.69 | **0** | Moderate |
| ≤ 0.40 | **-1** | Weak |

### 4.6 Dynamic Prompt Adjustment (Feedback Loop)

**File:** `src/utils/rewardEngine.js` → `generatePromptAdjustment()`

After each RL-eligible turn, the system analyzes the **last 5 reward entries** for that speaker and generates a prompt fragment that is injected into the Actor's system prompt on the next turn. Examples:

**When recent arguments are weak (≥2 weak in last 5):**
```
⚠️ WARNING: Your last 3 arguments were rated WEAK by the Legal Audit Engine.
ACTION REQUIRED: Increase usage of Section-based citations from the Sri Lankan Penal Code.
Use IRAC structure (Issue → Rule → Application → Conclusion) in every response.
Reference specific case facts, dates, and witness names to boost evidentiary density.
```

**When arguments lean too factual:**
```
📊 Your arguments lean heavily toward FACTUAL assertions. Balance with statutory citations (Section references).
```

**When arguments are consistently strong:**
```
✅ EXCELLENT: Your argument strategy is highly effective. Maintain the current citation density.
```

### 4.7 Implementation Files

| File | Function | Role |
|------|----------|------|
| `src/utils/rewardEngine.js` | `bestOfNSelection()` | Core RL loop — generates N, scores, selects |
| `src/utils/rewardEngine.js` | `scoreCandidate()` | Calls Port 5009, computes composite score |
| `src/utils/rewardEngine.js` | `computeReward()` | Maps continuous score → discrete {-1, 0, +1} |
| `src/utils/rewardEngine.js` | `generatePromptAdjustment()` | Builds dynamic feedback prompt fragment |
| `src/utils/aiOrchestrator.js` | `generateActorDialogueWithRL()` | Wraps Actor with RL eligibility check |
| `src/controllers/chatController.js` | `processUserMessage()` | Calls RL Actor, logs reward, returns metadata |
| `src/engines/courtroomHeartbeat.js` | `generateAutonomousTurn()` | Uses RL Actor for autonomous dialogue |
| `python_backend/audit_engine.py` | `/api/audit-transcript` | Dual-model inference endpoint |

### 4.8 Data Flow Example

```
Turn 7: Prosecutor speaks

1. Actor generates 3 candidates in parallel (Gemini Flash)
2. Each candidate is sent to Port 5009:
   - Candidate 1: ED=0.42, LG=0.81 → Composite=0.576
   - Candidate 2: ED=0.89, LG=0.73 → Composite=0.826 ← SELECTED
   - Candidate 3: ED=0.31, LG=0.55 → Composite=0.406

3. Policy selects Candidate 2 (highest composite: 0.826)
4. Reward = +1 (score ≥ 0.70)
5. Reward logged: { turn: 7, speaker: "Prosecutor", score: 0.826, reward: +1 }
6. Next turn: Prompt adjusted based on recent reward history
```

### 4.9 Persistence

Reward logs are persisted to MongoDB in the `RoleplaySession.rewardLog` field (Mixed schema type). This ensures reward history survives server restarts and can be analyzed post-session for thesis evaluation. Each entry includes:

- `turn` — Turn number
- `speakerRole` — Prosecutor or DefenseAttorney
- `candidateCount` — Number of valid candidates generated
- `allScores` — Array of all candidate scores, labels, reasons, and raw dual-model scores
- `selectedScore` — Composite score of the chosen candidate
- `selectedReason` — Audit engine's reasoning for the selected candidate
- `selectedRaw` — Raw `{ evidenceDensity, legalGrounding }` from both BERT models
- `reward` — Discrete signal: +1, 0, or -1
- `scoreDelta` — Gap between selected and runner-up candidate scores
- `timestamp` — ISO timestamp

---

## 5. Courtroom Heartbeat Engine

**File:** `src/engines/courtroomHeartbeat.js`

The autonomous simulation engine that drives AI-to-AI dialogue when the user is silent:

- **Idle Detection:** Every 30 seconds of user silence triggers an autonomous turn
- **Cooldown:** 10-second cooldown after user interaction before resuming
- **Max Consecutive:** 25 autonomous turns before pausing (prevents infinite loops)
- **RL Integration:** Autonomous turns use the same `generateActorDialogueWithRL()` pipeline, so the reward loop applies to both user-triggered and autonomous dialogue
- **Objection Handling:** User objections pause the heartbeat and generate an immediate Judge ruling

### WebSocket Events

| Event | Direction | Purpose |
|-------|-----------|---------|
| `join-session` | Client → Server | Join session room, start heartbeat |
| `user-active` | Client → Server | Reset idle timer |
| `objection` | Client → Server | Raise objection (pauses heartbeat) |
| `ai-dialogue` | Server → Client | Autonomous dialogue output |
| `objection-ruling` | Server → Client | Judge's ruling on objection |

---

## 6. Data Model & Persistence

**File:** `src/models/RoleplaySession.js`

### Key Schema Fields

| Field | Type | Purpose |
|-------|------|---------|
| `sessionId` | String (unique) | Session identifier (`rp_<timestamp>_<random>`) |
| `caseDetails` | Embedded Document | Full case dossier (title, facts, evidence, witnesses) |
| `history` | Array<HistoryEntry> | Full conversation transcript with speaker metadata |
| `rewardLog` | Array<Mixed> | RL reward entries from Best-of-N selection |
| `currentDay` | Number (1–3) | Multi-day trial progression |
| `gameMode` | Enum | TimeBased (default), TurnBased, Freeform |
| `verdict` | Embedded | Final verdict with formal judgment text |
| `auditReport` | Array | End-of-trial user argument audit results |

---

## 7. API Surface

### REST Endpoints (Port 10005)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/trials/init-trial` | Generate case + create session |
| `POST` | `/api/trials/:sessionId/message` | Send user message → Director → Actor → RL |
| `POST` | `/api/trials/:sessionId/advance-day` | Advance to next trial day |
| `POST` | `/api/trials/:sessionId/complete` | End trial → Audit + Verdict |
| `GET`  | `/api/trials/:sessionId` | Get session state |
| `GET`  | `/api/trials/user/:userId` | Get user's trial history |
| `GET`  | `/api/trials/user/:userId/stats` | Get user performance stats |
| `POST` | `/api/roleplay/chat` | Legacy: Simple AI legal consultant |
| `GET`  | `/health` | Service health + heartbeat stats |

### RL Metadata in API Response

When the RL reward loop is activated, the response from `/api/trials/:sessionId/message` includes:

```json
{
  "data": {
    "ai_reply": "Your Honor, under Section 366...",
    "speaker": "Prosecutor Mr. Ratnayake",
    "speakerRole": "Prosecutor",
    "rl_reward": {
      "reward": 1,
      "score": 0.8234,
      "label": "Law",
      "reason": "Strong statutory citation with high logical density.",
      "rawScores": { "evidenceDensity": 0.89, "legalGrounding": 0.73 },
      "candidatesEvaluated": 3,
      "scoreDelta": 0.25
    },
    "rl_stats": {
      "totalTurns": 7,
      "avgScore": "0.7142",
      "totalReward": 4,
      "strongCount": 4,
      "weakCount": 1,
      "neutralCount": 2,
      "recentTrend": [1, 0, 1, 1, -1]
    }
  }
}
```
