# TactiComm — Multi-Domain Decision-Making Trainer (SIH26248)

A browser-based low-poly 3D trainer that deliberately degrades communications and intelligence, forces time-critical decisions under uncertainty, records the trainee's decision process, and produces an explainable After Action Review (AAR).

- **Frontend:** React 19 + Vite + React Three Fiber (`frontend/`)
- **Backend:** FastAPI scenario engine, scoring and AAR (`backend/`)

## Run it (Windows PowerShell or CMD)

You need Python 3.10+ and Node.js 20+. Use two terminals.

**Terminal 1: backend**

```powershell
cd militaryyy_game\backend
pip install -r requirements.txt
python -m uvicorn main:app --port 8000
```

**Terminal 2: frontend**

```powershell
cd militaryyy_game\frontend
npm install
npm run dev
```

Open http://localhost:5173. API docs are at http://localhost:8000/docs.

If the API runs somewhere else, start the frontend with `VITE_API_BASE=http://host:8000`.

## Demo flow: "Urban Comms Failure"

1. **Briefing → Normal:** 3 friendly units and a command post, with all links green.
2. **Degradation:** BRAVO is delayed (dashed yellow link) and CHARLIE is lost (dotted red link).
3. **Conflicting reports:** contacts disagree on location and type. Each report has a source, observation time, delay and confidence.
4. **Decision:** OBSERVE / MOVE / INTERCEPT / HOLD / WITHDRAW / REQUEST RECON, under a countdown.
5. **Consequence:** the decision moves units, changes what intel arrives next and changes the threat. For example, an intercept on bad intel finds nothing and exposes the units, and recon relinks lost units.
6. Steps 2–5 repeat for each decision point (3 by default), with fresh reports generated from the moving ground truth.
7. **Reveal → AAR:**
   - The score, with a breakdown per decision.
   - A 3D replay.
   - Knowledge vs ground truth at every decision point.
   - The full timeline and explainable feedback.
   - Export to JSON or PDF.

**Instructor mode** has:
- Easy / Medium / Hard presets.
- Comm reliability, dropout and conflicting-report sliders.
- Threat difficulty, scenario duration, number of units, decision points and recon assets.
- Live monitoring, including the hidden ground truth and a running score.
- Pause, resume and stop.

The instructor can run on a second screen, because both views poll the same backend.

## What makes it different

Most trainers score *what you clicked*. TactiComm also measures *how you thought*.

- **Commander's Assessment:** before every order, the trainee pins on the 3D map where they believe the main threat is and states a confidence. The pin's ring widens as confidence drops. Orders can't be executed until the belief is on record.
- **Belief calibration:** a Brier-based score compares stated confidence with actual accuracy. It labels the commander *Overconfident*, *Underconfident* or *Well calibrated*. The AAR replay shows three pins side by side: **your estimate** (cyan), **what the evidence supported** (purple, a confidence-weighted reading of the reports) and **the truth** (red).
- **Cognitive bias detection:** eight rule-based, explainable detectors, each citing the decision and the evidence, with a coaching tip:
  - Anchoring
  - Stale-source trust
  - Recency bias
  - Overconfidence under conflict
  - Hesitation despite confidence
  - Rash commitment despite doubt
  - Analysis paralysis
  - Escalation of commitment
- **What-If Explorer (counterfactuals):** at every decision the engine clones the simulation and plays out all six actions from the exact same moment. For each one the AAR shows the in-context score and what would really have happened (strength lost, enemy halted, contact made). It also reports **decision regret**, meaning points left on the table, and the number of best-available calls.
- **Commander profile:** an archetype drawn from the decision pattern, such as *Adaptive Commander*, *Methodical Analyst*, *Hesitant Analyst*, *Bold Striker*, *Aggressive Gambler* or *Cautious Guardian*.
- **Live radio traffic:** incoming reports are spoken with radio procedure ("Overlord, this is Bravo… grid Echo seven… Over"), with squelch and static. On degraded links words are physically lost: static replaces them in the audio and `▒▒▒` replaces them in the text. Toggle it with **📻 RADIO** in the top bar.

## How it works

- **Hidden ground truth:** enemy positions live only on the server. The trainee's API responses omit them (and each report's accuracy flag) until the reveal.
- **Fog of war:** every round, each connected unit reports the enemy nearest to it, with position noise. The noise is scaled by link quality and difficulty. Delayed links mark reports late, dropout silently loses reports, and injected reports contradict location and type. Randomness is seeded per scenario, so a run is reproducible.
- **Context-aware scoring:** each decision is scored on a snapshot of what the trainee knew at that moment, never on the hidden truth. The categories are decision quality (30%), response time (20%), uncertainty handling (20%), comms handling (15%) and resource management (15%). The final score averages all decisions.
- **Explainable feedback:** each decision gets a verdict and the evidence behind it. A separate, unscored note compares it with what was actually true. For example, if the intel was wrong but the decision was sound, the note says so and the decision is not penalised.

## API

| Method | Path | Purpose |
|---|---|---|
| POST | `/scenario/create` | Start a scenario (config body optional) |
| GET | `/scenario/state` | Trainee view (`null` when idle) |
| POST | `/scenario/advance` | Next phase (blocked while a decision is pending or paused) |
| POST | `/scenario/decide` | `{decision_type, reasoning}` |
| POST | `/scenario/pause` | `{paused: true/false}` (instructor) |
| POST | `/scenario/stop` | End now → reveal and AAR (instructor) |
| POST | `/scenario/reset` | Clear the scenario |
| GET | `/aar/score`, `/aar/comparison`, `/aar/timeline`, `/aar/replay`, `/aar/report` | AAR data (after the reveal only) |
| GET | `/instructor/status` | Live monitoring, including ground truth |
