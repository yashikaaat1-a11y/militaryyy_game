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
    create_default_scenario, advance_phase, process_decision, compute_score,
    stop_scenario, set_paused, decision_window, ScenarioError, _rel
)

app = FastAPI(title="TactiComm API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory state (single session for MVP)
current_state: Optional[ScenarioState] = None

REVEALED_PHASES = (ScenarioPhase.REVEAL, ScenarioPhase.AAR)


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
    num_friendly_units: int = 3
    max_decisions: int = 3
    recon_assets: int = 2
    seed: Optional[int] = None


class PauseRequest(BaseModel):
    paused: bool


def _require_state() -> ScenarioState:
    if not current_state:
        raise HTTPException(404, "No active scenario")
    return current_state


def _require_revealed(state: ScenarioState):
    if state.phase not in REVEALED_PHASES:
        raise HTTPException(403, "Ground truth is only available after the reveal")


def _require_running(state: ScenarioState):
    if state.is_paused:
        raise HTTPException(409, "Scenario paused by instructor")
    if state.phase == ScenarioPhase.AAR:
        raise HTTPException(400, "Scenario is already complete")


def public_state(state: ScenarioState) -> dict:
    """The trainee's view: hide ground truth until the reveal."""
    data = state.model_dump()
    data["decision_window_s"] = decision_window(state)
    data["elapsed_time"] = _rel(state, state.paused_at) - state.paused_total
    if state.phase in REVEALED_PHASES:
        return data
    data["ground_truth"] = {}
    data["snapshots"] = []
    for r in data["reports"]:
        r.pop("is_accurate", None)
    for d in data["decisions"]:
        d["context"].pop("truth", None)
    return data


# ── Scenario Endpoints ─────────────────────────────────────────────

@app.get("/")
def root():
    return {"status": "TactiComm API Online", "version": app.version}


@app.post("/scenario/create")
def create_scenario(config: Optional[ConfigRequest] = None):
    global current_state
    cfg = ScenarioConfig(**config.model_dump()) if config else None
    current_state = create_default_scenario(cfg)
    return {"status": "created", "scenario_id": current_state.id, "state": public_state(current_state)}


@app.get("/scenario/state")
def get_state():
    # null (not 404) when idle: the UI polls this continuously
    return public_state(current_state) if current_state else None


@app.post("/scenario/advance")
def advance():
    state = _require_state()
    _require_running(state)
    try:
        advance_phase(state)
    except ScenarioError as e:
        raise HTTPException(400, str(e))
    return {"status": "advanced", "phase": state.phase, "state": public_state(state)}


@app.post("/scenario/decide")
def make_decision(req: DecisionRequest):
    state = _require_state()
    _require_running(state)

    try:
        dt = DecisionType(req.decision_type)
    except ValueError:
        raise HTTPException(400, f"Invalid decision: {req.decision_type}")

    decision = Decision(
        decision_type=dt,
        reasoning=req.reasoning,
        timestamp=time.time(),
    )
    try:
        process_decision(state, decision)
    except ScenarioError as e:
        raise HTTPException(400, str(e))
    return {"status": "decided", "decision": decision.model_dump(exclude={"context"}), "state": public_state(state)}


@app.post("/scenario/pause")
def pause(req: PauseRequest):
    state = _require_state()
    if state.phase == ScenarioPhase.AAR:
        raise HTTPException(400, "Scenario is already complete")
    set_paused(state, req.paused)
    return {"status": "paused" if state.is_paused else "running", "state": public_state(state)}


@app.post("/scenario/stop")
def stop():
    state = _require_state()
    stop_scenario(state)
    return {"status": "stopped", "state": public_state(state)}


@app.post("/scenario/reset")
def reset():
    global current_state
    current_state = None
    return {"status": "reset"}


# ── AAR Endpoints ───────────────────────────────────────────────────

@app.get("/aar/score")
def get_score():
    state = _require_state()
    _require_revealed(state)
    if not state.score:
        state.score = compute_score(state)
    return state.score


@app.get("/aar/timeline")
def get_timeline():
    state = _require_state()
    _require_revealed(state)
    return {
        "started_at": state.started_at,
        "events": [e.model_dump() for e in state.events],
        "reports": [r.model_dump() for r in state.reports],
        "decisions": [d.model_dump() for d in state.decisions],
    }


@app.get("/aar/comparison")
def get_comparison():
    """Trainee knowledge vs ground truth, at each decision point and at the end."""
    state = _require_state()
    _require_revealed(state)
    reviews = {r["index"]: r for r in (state.score.decision_reviews if state.score else [])}

    decision_points = []
    for i, d in enumerate(state.decisions):
        c = d.context
        review = reviews.get(i + 1, {})
        decision_points.append({
            "index": i + 1,
            "round": c["round"],
            "t": c["t"],
            "decision_type": d.decision_type.value,
            "reasoning": d.reasoning,
            "knowledge": {k: c[k] for k in (
                "reports", "avg_confidence", "spread", "conflict", "type_conflict", "recon_fresh",
                "best_report", "lost_units", "delayed_units", "comm_status", "wait_s", "window_s")},
            "truth": c["truth"],
            "verdict": review.get("verdict"),
            "total": review.get("total"),
            "truth_note": review.get("truth_note"),
        })

    return {
        "decision_points": decision_points,
        "trainee_knowledge": {
            "reports_received": len(state.reports),
            "reports": [
                {"source": r.source_unit, "content": r.content, "confidence": r.confidence,
                 "category": r.category, "round": r.round, "accurate": r.is_accurate,
                 "position": r.reported_position.model_dump() if r.reported_position else None}
                for r in state.reports
            ],
            "comm_status": {u.callsign: u.comm_status.value for u in state.units},
        },
        "ground_truth": state.ground_truth,
    }


@app.get("/aar/replay")
def get_replay():
    state = _require_state()
    _require_revealed(state)
    return {"frames": state.snapshots}


@app.get("/aar/report")
def get_report():
    """Full exportable after-action report (JSON)."""
    state = _require_state()
    _require_revealed(state)
    if not state.score:
        state.score = compute_score(state)
    return {
        "scenario": {"id": state.id, "name": state.config.name, "config": state.config.model_dump(),
                     "started_at": state.started_at, "duration_s": _rel(state)},
        "score": state.score.model_dump(),
        "comparison": get_comparison(),
        "timeline": get_timeline(),
    }


# ── Instructor Endpoints ───────────────────────────────────────────

@app.get("/instructor/status")
def instructor_status():
    """Live monitoring for the instructor — includes ground truth."""
    state = current_state
    if not state:
        return None
    live_score = compute_score(state) if state.decisions else None
    return {
        "scenario_id": state.id,
        "name": state.config.name,
        "phase": state.phase,
        "round": state.round,
        "started_at": state.started_at,
        "elapsed": _rel(state, state.paused_at) - state.paused_total,
        "config": state.config.model_dump(),
        "units": [u.model_dump() for u in state.units],
        "decisions_made": len(state.decisions),
        "decisions": [
            {"index": i + 1, "round": d.round, "decision_type": d.decision_type.value,
             "reasoning": d.reasoning, "t": d.context.get("t"), "wait_s": d.context.get("wait_s")}
            for i, d in enumerate(state.decisions)
        ],
        "reports_generated": len(state.reports),
        "events_logged": len(state.events),
        "recent_events": [e.model_dump() for e in state.events[-8:]],
        "recon_remaining": state.recon_remaining,
        "ground_truth": state.ground_truth,
        "live_score": live_score.model_dump() if live_score else None,
        "is_running": state.is_running,
        "is_paused": state.is_paused,
        "is_complete": state.is_complete,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
