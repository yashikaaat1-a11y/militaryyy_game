"""TactiComm Backend — FastAPI server for scenario management, scoring, and AAR."""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import Optional
import time

from models.schemas import (
    ScenarioState, ScenarioConfig, Decision, DecisionType,
    ScenarioPhase, ScoreBreakdown
)
from engine.scenario import (
    create_default_scenario, advance_phase, process_decision, compute_score
)

app = FastAPI(title="TactiComm API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state (single session for MVP)
current_state: Optional[ScenarioState] = None


class DecisionRequest(BaseModel):
    decision_type: str
    reasoning: Optional[str] = None


class ConfigRequest(BaseModel):
    name: str = "Urban Comms Failure"
    scenario_type: str = "URBAN"
    duration_seconds: int = 300
    comm_reliability: float = 0.8
    dropout_probability: float = 0.2
    conflicting_report_probability: float = 0.3
    threat_difficulty: str = "MEDIUM"


# ── Scenario Endpoints ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "TactiComm API Online", "version": "1.0.0"}


@app.post("/scenario/create")
def create_scenario(config: Optional[ConfigRequest] = None):
    global current_state
    cfg = None
    if config:
        cfg = ScenarioConfig(
            name=config.name,
            scenario_type=config.scenario_type,
            duration_seconds=config.duration_seconds,
            comm_reliability=config.comm_reliability,
            dropout_probability=config.dropout_probability,
            conflicting_report_probability=config.conflicting_report_probability,
            threat_difficulty=config.threat_difficulty,
        )
    current_state = create_default_scenario(cfg)
    return {"status": "created", "scenario_id": current_state.id, "state": current_state}


@app.get("/scenario/state")
def get_state():
    if not current_state:
        raise HTTPException(404, "No active scenario")
    return current_state


@app.post("/scenario/advance")
def advance():
    global current_state
    if not current_state:
        raise HTTPException(404, "No active scenario")
    if current_state.phase == ScenarioPhase.AAR:
        raise HTTPException(400, "Scenario is already complete")
    current_state = advance_phase(current_state)
    return {"status": "advanced", "phase": current_state.phase, "state": current_state}


@app.post("/scenario/decide")
def make_decision(req: DecisionRequest):
    global current_state
    if not current_state:
        raise HTTPException(404, "No active scenario")

    try:
        dt = DecisionType(req.decision_type)
    except ValueError:
        raise HTTPException(400, f"Invalid decision: {req.decision_type}")

    decision = Decision(
        decision_type=dt,
        reasoning=req.reasoning,
        timestamp=time.time(),
    )
    current_state = process_decision(current_state, decision)
    current_state = advance_phase(current_state)
    return {"status": "decided", "decision": decision, "state": current_state}


@app.post("/scenario/reset")
def reset():
    global current_state
    current_state = None
    return {"status": "reset"}


# ── AAR Endpoints ───────────────────────────────────────────────────

@app.get("/aar/score")
def get_score():
    if not current_state:
        raise HTTPException(404, "No active scenario")
    if not current_state.score:
        # Compute on demand
        current_state.score = compute_score(current_state)
    return current_state.score


@app.get("/aar/timeline")
def get_timeline():
    if not current_state:
        raise HTTPException(404, "No active scenario")
    return {
        "events": [e.model_dump() for e in current_state.events],
        "reports": [r.model_dump() for r in current_state.reports],
        "decisions": [d.model_dump() for d in current_state.decisions],
    }


@app.get("/aar/comparison")
def get_comparison():
    """Return trainee knowledge vs ground truth."""
    if not current_state:
        raise HTTPException(404, "No active scenario")

    trainee_knowledge = {
        "reports_received": len(current_state.reports),
        "reports": [
            {
                "source": r.source_unit,
                "content": r.content,
                "confidence": r.confidence,
                "position": r.reported_position.model_dump() if r.reported_position else None,
            }
            for r in current_state.reports
        ],
        "comm_status": {
            u.callsign: u.comm_status.value
            for u in current_state.units
        },
    }

    ground_truth = current_state.ground_truth

    return {
        "trainee_knowledge": trainee_knowledge,
        "ground_truth": ground_truth,
    }


# ── Instructor Endpoints ───────────────────────────────────────────

@app.get("/instructor/status")
def instructor_status():
    if not current_state:
        raise HTTPException(404, "No active scenario")
    return {
        "phase": current_state.phase,
        "elapsed": current_state.elapsed_time,
        "units": [u.model_dump() for u in current_state.units],
        "decisions_made": len(current_state.decisions),
        "reports_generated": len(current_state.reports),
        "is_running": current_state.is_running,
        "is_complete": current_state.is_complete,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
