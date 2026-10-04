# TactiComm Prototype Context Document

## Overview
This document provides complete contextual data for **TactiComm** — a Multi-Domain Decision-Making Trainer. It is designed for AI assistants or human developers to quickly understand the architecture, mechanics, and recent modifications to the prototype.

TactiComm is a browser-based, low-poly 3D trainer that simulates military tactical scenarios. It deliberately degrades communications and intelligence, forcing time-critical decisions under uncertainty. It records the trainee's decision process, assesses their cognitive biases and belief calibration, and produces a highly explainable After Action Review (AAR).

## Technology Stack
- **Frontend:** React 19, Vite, React Three Fiber (for 3D rendering), Zustand (state management). Located in `frontend/`.
- **Backend:** FastAPI (Python 3.10+), Pydantic (data validation), Uvicorn (ASGI server). Located in `backend/`.

## Core Features & Mechanics
1. **Scenario Flow (Single Decision Round)**
   * **Briefing → Normal:** 3 friendly units and a command post start with optimal comms.
   * **Degradation:** Comms are degraded (e.g., delayed or dropped links).
   * **Intel Feed:** Reports arrive with noise, delays, and contradictions.
   * **Commander's Assessment & Decision:** 
     - *Recent Update:* The prototype was recently modified to support **exactly 1 decision round** per scenario instead of the original 3. 
     - The trainee must place a "Belief Pin" on the 3D map indicating where they believe the primary threat is and state their confidence level.
     - They must choose one of the following orders: OBSERVE, MOVE, INTERCEPT, HOLD, WITHDRAW, or REQUEST RECON.
   * **Consequence & Reveal:** The engine processes the decision, moves units, and resolves the scenario.
   
2. **Cognitive & Behavioral Analysis**
   - **Belief Calibration:** Compares the trainee's stated confidence with actual accuracy, labeling them as *Overconfident*, *Underconfident*, or *Well calibrated*.
   - **Cognitive Bias Detection:** Detects and flags 8 specific biases, including Anchoring, Stale-source trust, Recency bias, Overconfidence under conflict, Hesitation, Rash commitment, Analysis paralysis, and Escalation of commitment.
   - **Commander Profile:** Profiles the trainee into archetypes like *Adaptive Commander*, *Hesitant Analyst*, *Bold Striker*, etc.

3. **What-If Explorer (Counterfactuals)**
   - The engine clones the simulation at the decision point and evaluates all 6 possible orders. The AAR displays what would have happened in each counterfactual scenario, computing a "decision regret" score based on optimal choices missed.

4. **Live Radio Traffic**
   - Incoming text reports are synthesized into audio with military radio procedures, static, and squelch. Degraded links physically drop words from both audio and text (shown as `▒▒▒`).

5. **Instructor Dashboard**
   - Runs on a separate screen (polling the backend).
   - Allows configuration of Threat Difficulty, Comm Reliability, Dropout/Conflicting probabilities.
   - **Note:** The "Decision Points" configuration has been hard-restricted to **1**.
   - Provides live monitoring of ground truth versus trainee perception.

## Architecture & API
- **Hidden Ground Truth:** Enemy positions live exclusively on the backend. The frontend only receives noisy reports until the AAR Reveal phase.
- **Context-Aware Scoring:** Decisions are scored based on the snapshot of what the trainee *knew at the time*, not the absolute ground truth.

### Key API Endpoints
| Method | Path | Purpose |
|---|---|---|
| POST | `/scenario/create` | Initializes a new scenario state |
| GET | `/scenario/state` | Fetches the current state (trainee perspective) |
| POST | `/scenario/advance` | Advances to the next phase |
| POST | `/scenario/decide` | Submits the chosen order and reasoning |
| GET | `/aar/...` | Fetches various AAR data (score, comparison, timeline, replay) |

## Recent Changes (Context for further development)
- **Single-Decision Constraint:** The `max_decisions` variable in both the backend `schemas.py` and `main.py` has been defaulted to 1.
- Frontend files (`DecisionControls.jsx`, `InstructorDashboard.jsx`, `AARPanel.jsx`) have been updated to enforce the 1-decision limit, replacing the previous 3-decision multi-round loops.
- The `InstructorDashboard` dropdown for Decision Points has been restricted to only output `[1]`.

---
*End of Context Document*
