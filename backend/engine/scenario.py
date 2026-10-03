"""Scenario engine — manages scenario lifecycle, communication degradation,
report generation, decision consequences, and scoring.

Everything the trainee sees is derived from a hidden ground truth and then
degraded (delayed, dropped, noisy or contradictory). Each decision is scored
against the information the trainee actually had at that moment, never
against the hidden truth.
"""

import time, random, math, itertools
from typing import Optional
from models.schemas import (
    ScenarioState, ScenarioConfig, Unit, UnitType, Faction, Position,
    CommStatus, IntelReport, Decision, DecisionType, ScenarioEvent,
    ScenarioPhase, ScoreBreakdown
)


# ── Default Scenario Setup ─────────────────────────────────────────

def create_default_scenario(config: Optional[ScenarioConfig] = None) -> ScenarioState:
    """Create the scenario based on config.scenario_type."""
    cfg = config or ScenarioConfig()
    if cfg.seed is None:
        cfg.seed = random.randint(1, 10**6)
    state = ScenarioState(config=cfg, recon_remaining=cfg.recon_assets)

    # Set up friendly units and ground truth based on scenario type
    if cfg.scenario_type == "MOUNTAIN":
        state.units = [
            Unit(name="Command Post", callsign="OVERLORD", unit_type=UnitType.COMMAND, faction=Faction.FRIENDLY, position=Position(x=0, y=0, z=-10)),
            Unit(name="Mountain Inf 1", callsign="ALPINE", unit_type=UnitType.INFANTRY, faction=Faction.FRIENDLY, position=Position(x=-4, y=0, z=5)),
            Unit(name="Mountain Inf 2", callsign="SNOW", unit_type=UnitType.INFANTRY, faction=Faction.FRIENDLY, position=Position(x=6, y=0, z=3)),
            Unit(name="Recon Drone", callsign="EAGLE", unit_type=UnitType.RECON, faction=Faction.FRIENDLY, position=Position(x=0, y=0, z=8)),
        ]
        state.ground_truth = {
            "hostile_units": [
                {"id": "hostile-1", "name": "Guerilla Camp", "position": {"x": 5, "y": 0, "z": 12}, "type": "INFANTRY", "strength": "COMPANY", "intent": "AMBUSH"},
                {"id": "hostile-2", "name": "Sniper Team", "position": {"x": -6, "y": 0, "z": 9}, "type": "RECON", "strength": "TEAM", "intent": "OBSERVE"},
            ],
            "actual_threat_level": "HIGH", "actual_enemy_count": 2,
        }
    elif cfg.scenario_type == "RIVER":
        state.units = [
            Unit(name="Command Boat", callsign="OVERLORD", unit_type=UnitType.COMMAND, faction=Faction.FRIENDLY, position=Position(x=-8, y=0, z=0)),
            Unit(name="Marine Squad", callsign="DELTA", unit_type=UnitType.INFANTRY, faction=Faction.FRIENDLY, position=Position(x=2, y=0, z=-4)),
            Unit(name="Patrol Boat", callsign="RIVER-1", unit_type=UnitType.ARMOR, faction=Faction.FRIENDLY, position=Position(x=4, y=0, z=6)),
            Unit(name="Scout Swimmer", callsign="FROG", unit_type=UnitType.RECON, faction=Faction.FRIENDLY, position=Position(x=8, y=0, z=2)),
        ]
        state.ground_truth = {
            "hostile_units": [
                {"id": "hostile-1", "name": "Enemy Fast Attack", "position": {"x": 10, "y": 0, "z": 10}, "type": "ARMOR", "strength": "SQUADRON", "intent": "INTERCEPT"},
            ],
            "actual_threat_level": "MODERATE", "actual_enemy_count": 1,
        }
    elif cfg.scenario_type == "DESERT":
        state.units = [
            Unit(name="Mobile HQ", callsign="OVERLORD", unit_type=UnitType.COMMAND, faction=Faction.FRIENDLY, position=Position(x=0, y=0, z=-12)),
            Unit(name="Tank Platoon", callsign="IRON", unit_type=UnitType.ARMOR, faction=Faction.FRIENDLY, position=Position(x=-5, y=0, z=0)),
            Unit(name="Mech Infantry", callsign="STEEL", unit_type=UnitType.ARMOR, faction=Faction.FRIENDLY, position=Position(x=5, y=0, z=0)),
            Unit(name="LRRP", callsign="GHOST", unit_type=UnitType.RECON, faction=Faction.FRIENDLY, position=Position(x=0, y=0, z=10)),
        ]
        state.ground_truth = {
            "hostile_units": [
                {"id": "hostile-1", "name": "Enemy Armor", "position": {"x": 0, "y": 0, "z": 15}, "type": "ARMOR", "strength": "BATTALION", "intent": "ASSAULT"},
            ],
            "actual_threat_level": "SEVERE", "actual_enemy_count": 1,
        }
    else:
        # Default URBAN
        state.units = [
            Unit(name="Command Post", callsign="OVERLORD", unit_type=UnitType.COMMAND, faction=Faction.FRIENDLY, position=Position(x=0, y=0, z=-8)),
            Unit(name="Alpha Platoon", callsign="ALPHA", unit_type=UnitType.INFANTRY, faction=Faction.FRIENDLY, position=Position(x=-6, y=0, z=2)),
            Unit(name="Bravo Platoon", callsign="BRAVO", unit_type=UnitType.ARMOR, faction=Faction.FRIENDLY, position=Position(x=5, y=0, z=0)),
            Unit(name="Charlie Recon", callsign="CHARLIE", unit_type=UnitType.RECON, faction=Faction.FRIENDLY, position=Position(x=2, y=0, z=6)),
        ]
        state.ground_truth = {
            "hostile_units": [
                {"id": "hostile-1", "name": "Enemy Mechanized", "position": {"x": 7, "y": 0, "z": 8}, "type": "ARMOR", "strength": "PLATOON", "intent": "ADVANCE_SOUTH"},
                {"id": "hostile-2", "name": "Enemy Recon", "position": {"x": -3, "y": 0, "z": 9}, "type": "RECON", "strength": "SQUAD", "intent": "OBSERVE"},
            ],
            "actual_threat_level": "MODERATE", "actual_enemy_count": 2,
        }

    # Instructor-selected number of subordinate units (command post always kept)
    command = [u for u in state.units if u.unit_type == UnitType.COMMAND]
    subs = [u for u in state.units if u.unit_type != UnitType.COMMAND]
    state.units = command + subs[:max(1, min(cfg.num_friendly_units, len(subs)))]

    for h in state.ground_truth["hostile_units"]:
        h["engaged"] = False
    state.ground_truth["dropped_reports"] = []

    state.events.append(ScenarioEvent(
        event_type="SCENARIO_CREATED",
        description=f"{cfg.name} ({cfg.scenario_type}) scenario initialized",
        data={"config": cfg.model_dump()}
    ))
    _snapshot(state, "Scenario created")

    return state


# ── Helpers ─────────────────────────────────────────────────────────

DIFFICULTY = {
    # advance: enemy movement per decision round; noise: report position error
    "LOW":    {"advance": 0.8, "noise": 1.0, "conf_shift": 0.08},
    "MEDIUM": {"advance": 1.5, "noise": 1.6, "conf_shift": 0.0},
    "HIGH":   {"advance": 2.2, "noise": 2.4, "conf_shift": -0.08},
}

INFO_CATEGORIES = ("CONTACT", "SIGINT", "RECON")
WEIGHTS = {
    "decision_quality": 0.30,
    "response_time": 0.20,
    "uncertainty_handling": 0.20,
    "communication_handling": 0.15,
    "resource_management": 0.15,
}


def _diff(state):
    return DIFFICULTY.get(state.config.threat_difficulty, DIFFICULTY["MEDIUM"])


def _rng(state, tag: str) -> random.Random:
    """Deterministic per-scenario, per-round randomness (reproducible demos)."""
    return random.Random(f"{state.config.seed}-{state.round}-{tag}")


def _xz(p):
    if isinstance(p, dict):
        return p["x"], p["z"]
    return p.x, p.z


def _dist(a, b) -> float:
    ax, az = _xz(a)
    bx, bz = _xz(b)
    return math.hypot(ax - bx, az - bz)


def _clamp(v, lo, hi):
    return max(lo, min(hi, v))


def grid(p) -> str:
    """Human-readable grid reference for a map position."""
    x, z = _xz(p)
    col = chr(ord("A") + int(_clamp((x + 15) // 3, 0, 9)))
    row = int(_clamp((z + 15) // 3, 0, 9))
    return f"{col}-{row}"


def _rel(state, t: Optional[float] = None) -> float:
    return round((t or time.time()) - state.started_at, 1)


def _subs(state) -> list[Unit]:
    return [u for u in state.units if u.faction == Faction.FRIENDLY and u.unit_type != UnitType.COMMAND]


def _hostiles(state) -> list[dict]:
    return state.ground_truth.get("hostile_units", [])


def _event(state, event_type: str, description: str, **data):
    state.events.append(ScenarioEvent(event_type=event_type, description=description, data=data))


def _snapshot(state, label: str):
    """Record a replay frame: friendly units, true hostiles and current-round contacts."""
    state.snapshots.append({
        "t": _rel(state),
        "phase": state.phase.value,
        "round": state.round,
        "label": label,
        "units": [
            {"id": u.id, "callsign": u.callsign, "name": u.name, "unit_type": u.unit_type.value,
             "faction": u.faction.value, "position": u.position.model_dump(),
             "comm_status": u.comm_status.value, "comm_delay_ms": u.comm_delay_ms, "health": u.health}
            for u in state.units
        ],
        "hostiles": [
            {"name": h["name"], "position": dict(h["position"]), "engaged": h.get("engaged", False)}
            for h in _hostiles(state)
        ],
        "contacts": [
            {"position": r.reported_position.model_dump(), "confidence": r.confidence,
             "source": r.source_unit, "category": r.category, "accurate": r.is_accurate}
            for r in state.reports
            if r.reported_position and r.category in INFO_CATEGORIES and r.round == state.round
        ],
    })


# ── Phase Progression ───────────────────────────────────────────────

PHASE_ORDER = [
    ScenarioPhase.BRIEFING,
    ScenarioPhase.NORMAL,
    ScenarioPhase.DEGRADATION,
    ScenarioPhase.CONFLICTING,
    ScenarioPhase.DECISION,
    ScenarioPhase.CONSEQUENCE,
    ScenarioPhase.REVEAL,
    ScenarioPhase.AAR,
]


class ScenarioError(ValueError):
    pass


def advance_phase(state: ScenarioState) -> ScenarioState:
    """Move to the next scenario phase and apply phase-specific effects."""
    if state.phase == ScenarioPhase.DECISION:
        raise ScenarioError("A decision is required before the scenario can continue")

    idx = PHASE_ORDER.index(state.phase)

    # Loop back for the next decision round
    if state.phase == ScenarioPhase.CONSEQUENCE and len(state.decisions) < state.config.max_decisions:
        new_phase = ScenarioPhase.DEGRADATION
        state.round += 1
        _event(state, "PHASE_CHANGE",
               f"Situation evolving — round {state.round}. Awaiting decision {len(state.decisions) + 1} of {state.config.max_decisions}",
               **{"from": state.phase.value, "to": new_phase.value, "round": state.round})
    elif idx < len(PHASE_ORDER) - 1:
        new_phase = PHASE_ORDER[idx + 1]
        _event(state, "PHASE_CHANGE", f"Phase changed to {new_phase.value}",
               **{"from": PHASE_ORDER[idx].value, "to": new_phase.value, "round": state.round})
    else:
        return state

    state.phase = new_phase
    _apply_phase_effects(state)
    if state.phase != ScenarioPhase.AAR:
        _snapshot(state, f"Round {state.round}: {state.phase.value.title()}")
    return state


def stop_scenario(state: ScenarioState) -> ScenarioState:
    """Instructor stop: end immediately, reveal truth and produce the AAR."""
    if state.phase == ScenarioPhase.AAR:
        return state
    _event(state, "INSTRUCTOR", "Scenario stopped by instructor")
    if state.is_paused:
        set_paused(state, False)
    state.phase = ScenarioPhase.REVEAL
    _apply_phase_effects(state)
    _snapshot(state, "Ground truth revealed")
    state.phase = ScenarioPhase.AAR
    _apply_phase_effects(state)
    return state


def set_paused(state: ScenarioState, paused: bool) -> ScenarioState:
    now = time.time()
    if paused and not state.is_paused:
        state.is_paused = True
        state.paused_at = now
        _event(state, "INSTRUCTOR", "Scenario paused by instructor")
    elif not paused and state.is_paused:
        state.paused_total += now - (state.paused_at or now)
        state.is_paused = False
        state.paused_at = None
        _event(state, "INSTRUCTOR", "Scenario resumed by instructor")
    return state


def _apply_phase_effects(state: ScenarioState):
    """Apply communication and information effects for the current phase."""
    phase = state.phase

    if phase == ScenarioPhase.NORMAL:
        state.is_running = True
        for u in state.units:
            if u.faction == Faction.FRIENDLY:
                u.comm_status = CommStatus.NORMAL
                u.comm_delay_ms = 0
        _generate_normal_reports(state)

    elif phase == ScenarioPhase.DEGRADATION:
        _update_comms(state)
        _generate_round_reports(state)

    elif phase == ScenarioPhase.CONFLICTING:
        _generate_conflicting_reports(state)

    elif phase == ScenarioPhase.DECISION:
        state.decision_opened_at = time.time()
        state.decision_opened_paused_total = state.paused_total
        _event(state, "DECISION_REQUIRED",
               f"Decision {len(state.decisions) + 1} of {state.config.max_decisions} required — act on the intelligence available",
               available_reports=len(state.reports), round=state.round,
               window_s=decision_window(state))

    elif phase == ScenarioPhase.REVEAL:
        gt = state.ground_truth
        summary = "; ".join(f"{h['name']} at grid {grid(h['position'])}" for h in _hostiles(state))
        dropped = len(gt.get("dropped_reports", []))
        _event(state, "GROUND_TRUTH_REVEALED",
               f"Actual enemy picture: {summary}. {dropped} report(s) were lost in transit and never reached you.",
               hostile_units=_hostiles(state), dropped_reports=dropped)

    elif phase == ScenarioPhase.AAR:
        state.is_running = False
        state.is_complete = True
        state.score = compute_score(state)
        _snapshot(state, "After action review")


def decision_window(state: ScenarioState) -> float:
    """Seconds the trainee has for each decision (scenario duration split evenly)."""
    return round(state.config.duration_seconds / max(state.config.max_decisions, 1), 1)


# ── Communication Degradation ───────────────────────────────────────

def _delay_ms(state, rng) -> int:
    lo, hi = state.config.delay_range_ms
    # Lower reliability pushes delays toward the top of the range
    bias = 1 - _clamp(state.config.comm_reliability, 0, 1)
    return int(lo + (hi - lo) * _clamp(rng.uniform(0.3, 0.8) + bias * 0.5, 0, 1))


def _update_comms(state: ScenarioState):
    rng = _rng(state, "comms")
    cfg = state.config
    subs = _subs(state)

    for i, u in enumerate(subs):
        old = u.comm_status
        if state.round == 1:
            # Scripted story: second unit delayed, third unit lost
            if i == 1:
                u.comm_status, u.comm_delay_ms = CommStatus.DELAYED, _delay_ms(state, rng)
            elif i == 2:
                u.comm_status, u.comm_delay_ms = CommStatus.LOST, 0
        else:
            roll = rng.random()
            if old == CommStatus.LOST:
                if roll < cfg.comm_reliability * 0.5:
                    u.comm_status, u.comm_delay_ms = CommStatus.DEGRADED, _delay_ms(state, rng)
            elif roll < cfg.dropout_probability * 0.6 and i > 0:
                u.comm_status, u.comm_delay_ms = CommStatus.LOST, 0
            elif roll < 1 - cfg.comm_reliability + 0.15:
                u.comm_status = rng.choice([CommStatus.DELAYED, CommStatus.DEGRADED])
                u.comm_delay_ms = _delay_ms(state, rng)
            else:
                u.comm_status, u.comm_delay_ms = CommStatus.NORMAL, 0

        if u.comm_status == CommStatus.LOST and u.last_known_position is None:
            u.last_known_position = u.position.model_copy()
        if u.comm_status != CommStatus.LOST:
            u.last_known_position = None

        if u.comm_status != old or state.round == 1 and u.comm_status != CommStatus.NORMAL:
            if u.comm_status == CommStatus.LOST:
                desc = f"{u.callsign} communications LOST — no contact"
            elif u.comm_status == CommStatus.NORMAL:
                desc = f"{u.callsign} communications restored"
            else:
                desc = f"{u.callsign} link {u.comm_status.value} — delays of {u.comm_delay_ms}ms"
            _event(state, "COMM_CHANGE", desc, unit=u.callsign, status=u.comm_status.value, delay=u.comm_delay_ms)


# ── Report Generation ───────────────────────────────────────────────

TYPE_WORDS = {"ARMOR": "armoured vehicles", "INFANTRY": "infantry", "RECON": "recon team"}


def _report(state, source, content, category, confidence, pos=None, accurate=True, delay_s=0.0):
    now = time.time()
    state.reports.append(IntelReport(
        timestamp=now - delay_s,  # when it was observed
        received_at=now,          # when the trainee sees it
        source_unit=source,
        content=content,
        reported_position=Position(**pos) if pos else None,
        confidence=round(_clamp(confidence, 0.05, 0.98), 2),
        is_accurate=accurate,
        category=category,
        round=state.round,
        delay_s=round(delay_s, 1),
    ))


def _generate_normal_reports(state: ScenarioState):
    rng = _rng(state, "normal")
    subs = _subs(state)
    for i, u in enumerate(subs):
        if u.unit_type == UnitType.RECON and _hostiles(state):
            h = _hostiles(state)[0]
            hx, hz = _xz(h["position"])
            pos = {"x": hx + rng.uniform(-2, 2), "y": 0, "z": hz + rng.uniform(-2, 2)}
            _report(state, u.callsign,
                    f"Recon patrol proceeding north. Fresh vehicle tracks near grid {grid(pos)}, heading south. Investigating.",
                    "CONTACT", 0.8, pos, accurate=True)
        else:
            _report(state, u.callsign,
                    f"Sector clear. No enemy contact. Holding at grid {grid(u.position)}.",
                    "SITREP", 0.95 - i * 0.03)


def _generate_round_reports(state: ScenarioState):
    """Each connected unit reports what it can sense of the (true) enemy, degraded by its link."""
    rng = _rng(state, "reports")
    d = _diff(state)
    mods = state.modifiers
    status_noise = {CommStatus.NORMAL: 1.0, CommStatus.DELAYED: 1.3, CommStatus.DEGRADED: 1.7}

    for u in _subs(state):
        if u.comm_status == CommStatus.LOST:
            lk = u.last_known_position or u.position
            _report(state, "OVERLORD",
                    f"No contact with {u.callsign}. Last known position grid {grid(lk)}. Attempting re-establishment.",
                    "COMM", 0.4)
            continue

        hostiles = sorted(_hostiles(state), key=lambda h: _dist(h["position"], u.position))
        if not hostiles or _dist(hostiles[0]["position"], u.position) > 16:
            _report(state, u.callsign, "No contact in sector. Continuing observation.", "SITREP", 0.85)
            continue

        h = hostiles[0]
        noise = d["noise"] * status_noise.get(u.comm_status, 1.0)
        if mods.get("vantage") == u.callsign:
            noise *= 0.5
        if mods.get("withdrawn"):
            noise *= 1.3
        hx, hz = _xz(h["position"])
        pos = {"x": _clamp(hx + rng.gauss(0, noise), -14, 14), "y": 0, "z": _clamp(hz + rng.gauss(0, noise), -14, 14)}
        error = _dist(pos, h["position"])
        conf = 0.88 - error * 0.07 + d["conf_shift"] + mods.get("observe_bonus", 0)
        if u.comm_status == CommStatus.DEGRADED:
            conf -= 0.1
        if mods.get("withdrawn"):
            conf -= 0.1

        delay_s = 0.0
        prefix = ""
        if u.comm_status in (CommStatus.DELAYED, CommStatus.DEGRADED):
            delay_s = u.comm_delay_ms / 1000 * rng.uniform(1.5, 3.0)
            prefix = f"[DELAYED {delay_s:.0f}s] "

        if h.get("engaged"):
            what = f"Engaged enemy {TYPE_WORDS.get(h['type'], 'element')}, holding"
        elif error < 2:
            what = f"Enemy {TYPE_WORDS.get(h['type'], 'element')} ({h['strength'].lower()}), moving south"
        else:
            what = f"Possible {TYPE_WORDS.get(h['type'], 'enemy element')}, unconfirmed"
        text = f"{prefix}CONTACT: {what} vicinity grid {grid(pos)}."

        # Dropout: the report is sent but never arrives
        if rng.random() < state.config.dropout_probability * 0.5:
            state.ground_truth["dropped_reports"].append({"round": state.round, "source": u.callsign, "content": text})
            continue

        _report(state, u.callsign, text, "CONTACT", conf, pos, accurate=error < 2.5, delay_s=delay_s)


def _generate_conflicting_reports(state: ScenarioState):
    """Inject plausible-but-wrong reports about the contact location/type."""
    rng = _rng(state, "conflict")
    hostiles = [h for h in _hostiles(state) if not h.get("engaged")] or _hostiles(state)
    sources = [u for u in _subs(state) if u.comm_status != CommStatus.LOST]
    if not hostiles:
        return

    n = max(1, math.ceil(state.config.conflicting_report_probability * 4))
    for i in range(n):
        h = hostiles[i % len(hostiles)]
        hx, hz = _xz(h["position"])
        ang = rng.uniform(0, 2 * math.pi)
        mag = rng.uniform(4, 7)
        pos = {"x": _clamp(hx + math.cos(ang) * mag, -14, 14), "y": 0, "z": _clamp(hz + math.sin(ang) * mag, -14, 14)}
        if h["type"] == "ARMOR":
            what = "Enemy infantry squad, est. 8-10 personnel. No vehicles observed"
        else:
            what = "Enemy mechanized element, 2-3 vehicles"
        if sources and rng.random() < 0.7:
            src = rng.choice(sources)
            delay_s = src.comm_delay_ms / 1000 * rng.uniform(1.5, 3.0) if src.comm_status != CommStatus.NORMAL else 0.0
            prefix = f"[DELAYED {delay_s:.0f}s] " if delay_s else ""
            _report(state, src.callsign, f"{prefix}CONTACT REPORT: {what} at grid {grid(pos)}.",
                    "CONTACT", rng.uniform(0.45, 0.72), pos, accurate=False, delay_s=delay_s)
        else:
            _report(state, "OVERLORD", f"SIGINT intercept: {what.lower()} transmitting near grid {grid(pos)}. Low confidence.",
                    "SIGINT", rng.uniform(0.3, 0.45), pos, accurate=False)

    # A genuine but weak signal about a second enemy element
    if state.round == 1 and len(_hostiles(state)) > 1:
        h2 = _hostiles(state)[1]
        hx, hz = _xz(h2["position"])
        pos = {"x": hx + rng.uniform(-1.5, 1.5), "y": 0, "z": hz + rng.uniform(-1.5, 1.5)}
        _report(state, "OVERLORD",
                f"SIGINT intercept suggests enemy recon element operating near grid {grid(pos)}, west of reported positions. Low confidence.",
                "SIGINT", 0.35, pos, accurate=True)


# ── Decision Processing ────────────────────────────────────────────

def process_decision(state: ScenarioState, decision: Decision) -> ScenarioState:
    """Process a trainee decision and apply consequences."""
    if state.phase != ScenarioPhase.DECISION:
        raise ScenarioError("Decisions can only be made during the DECISION phase")

    decision.round = state.round
    decision.available_info = [r.id for r in state.reports]
    decision.context = _knowledge_context(state, decision)
    state.decisions.append(decision)

    _event(state, "DECISION", f"Commander decided: {decision.decision_type.value}",
           decision=decision.model_dump(exclude={"context", "available_info"}), round=state.round)

    _apply_consequences(state, decision)

    state.phase = ScenarioPhase.CONSEQUENCE
    _event(state, "PHASE_CHANGE", "Phase changed to CONSEQUENCE",
           **{"from": "DECISION", "to": "CONSEQUENCE", "round": state.round})
    _snapshot(state, f"Round {state.round}: {decision.decision_type.value.replace('_', ' ').title()} — consequences")
    return state


def _type_conflict(reports) -> bool:
    texts = " ".join(r.content.lower() for r in reports)
    return "infantry" in texts and any(w in texts for w in ("vehicle", "mechanized", "armoured"))


def _knowledge_context(state: ScenarioState, decision: Decision) -> dict:
    """Snapshot what the trainee knew when deciding (plus hidden truth for the AAR)."""
    rnd = state.round
    info = [r for r in state.reports
            if r.reported_position and r.category in INFO_CATEGORIES
            and (r.round == rnd or (r.category == "RECON" and r.round == rnd - 1))]
    contacts = [r for r in info if r.category != "RECON"]
    recon_fresh = any(r.category == "RECON" for r in info)

    # Two CONTACT reports 3.5–9 grid apart plausibly describe the same enemy in
    # different places; much further apart they are likely separate elements.
    ground = [r for r in contacts if r.category == "CONTACT"]
    pair_d = [_dist(a.reported_position, b.reported_position) for a, b in itertools.combinations(ground, 2)]
    spread = max((d for d in pair_d if d < 9), default=0.0)
    type_conflict = _type_conflict(ground)
    conflict = spread > 3.5 or type_conflict
    avg_conf = sum(r.confidence for r in info) / len(info) if info else 0.0
    best = max(info, key=lambda r: r.confidence, default=None)
    subs = _subs(state)

    nearest_reported = None
    if best:
        nearest_reported = round(min(_dist(best.reported_position, u.position) for u in subs), 1)

    paused = state.paused_total - state.decision_opened_paused_total
    wait_s = max(0.0, decision.timestamp - (state.decision_opened_at or decision.timestamp) - paused)

    truth_best_error = None
    if best and _hostiles(state):
        truth_best_error = round(min(_dist(best.reported_position, h["position"]) for h in _hostiles(state)), 1)

    return {
        "round": rnd,
        "t": _rel(state, decision.timestamp),
        "wait_s": round(wait_s, 1),
        "window_s": decision_window(state),
        "report_count": len(info),
        "reports": [
            {"id": r.id, "source": r.source_unit, "category": r.category, "content": r.content,
             "confidence": r.confidence, "position": r.reported_position.model_dump(), "delay_s": r.delay_s}
            for r in info
        ],
        "avg_confidence": round(avg_conf, 2),
        "max_confidence": best.confidence if best else 0.0,
        "spread": round(spread, 1),
        "type_conflict": type_conflict,
        "conflict": conflict,
        "recon_fresh": recon_fresh,
        "recon_remaining": state.recon_remaining,
        "best_report": {"source": best.source_unit, "position": best.reported_position.model_dump(),
                        "grid": grid(best.reported_position), "confidence": best.confidence} if best else None,
        "nearest_reported_threat": nearest_reported,
        "lost_units": [u.callsign for u in subs if u.comm_status == CommStatus.LOST],
        "delayed_units": [{"callsign": u.callsign, "status": u.comm_status.value, "delay_ms": u.comm_delay_ms}
                          for u in subs if u.comm_status in (CommStatus.DELAYED, CommStatus.DEGRADED)],
        "comm_status": {u.callsign: u.comm_status.value for u in state.units},
        # Hidden from the trainee until the reveal
        "truth": {
            "hostiles": [{"name": h["name"], "type": h["type"], "strength": h["strength"],
                          "position": dict(h["position"]), "grid": grid(h["position"]), "engaged": h.get("engaged", False)}
                         for h in _hostiles(state)],
            "best_report_error": truth_best_error,
            "dropped_reports": len([d for d in state.ground_truth.get("dropped_reports", []) if d["round"] == rnd]),
        },
    }


def _move_toward(u: Unit, target: dict, frac: float):
    tx, tz = _xz(target)
    u.position.x = round(u.position.x + (tx - u.position.x) * frac, 2)
    u.position.z = round(u.position.z + (tz - u.position.z) * frac, 2)


def _apply_consequences(state: ScenarioState, decision: Decision):
    """Apply scenario consequences based on the decision made."""
    dt = decision.decision_type
    ctx = decision.context
    subs = _subs(state)
    unit_1 = subs[0] if subs else None
    target = ctx["best_report"]["position"] if ctx.get("best_report") else None
    advance = _diff(state)["advance"]
    state.modifiers = {}
    outcome = ""

    if dt == DecisionType.OBSERVE:
        state.modifiers["observe_bonus"] = 0.12
        outcome = "Continued observation. Sensors refocused — next reports will be more reliable, but the enemy keeps moving."

    elif dt == DecisionType.MOVE and unit_1:
        _move_toward(unit_1, target or {"x": unit_1.position.x, "z": unit_1.position.z + 4}, 0.35)
        state.modifiers["vantage"] = unit_1.callsign
        outcome = f"{unit_1.callsign} repositioned to grid {grid(unit_1.position)} for a better vantage point."
        if any(_dist(h["position"], unit_1.position) < 3 for h in _hostiles(state)):
            unit_1.health = max(0, unit_1.health - 10)
            outcome += f" {unit_1.callsign} came under fire while moving (-10 strength)."

    elif dt == DecisionType.INTERCEPT:
        participants = [u for u in subs if u.comm_status != CommStatus.LOST]
        missed = [u.callsign for u in subs if u.comm_status == CommStatus.LOST]
        if target:
            for u in participants:
                _move_toward(u, target, 0.6)
        hit = None
        if target:
            near = min(_hostiles(state), key=lambda h: _dist(h["position"], target), default=None)
            if near and _dist(near["position"], target) <= 3:
                hit = near
        if hit:
            hit["engaged"] = True
            for u in participants:
                u.health = max(0, u.health - 10)
            outcome = f"Intercept at grid {grid(target)} made contact with {hit['name']}. Enemy advance halted."
        else:
            for u in participants:
                u.health = max(0, u.health - 20)
            where = f"grid {grid(target)}" if target else "the reported area"
            outcome = f"Intercept found no enemy at {where}. Units exposed in the open (-20 strength)."
        if missed:
            outcome += f" {', '.join(missed)} never received the order (comms lost)."

    elif dt == DecisionType.HOLD:
        state.modifiers["dug_in"] = True
        outcome = "All units holding position. Defensive posture maintained; enemy continues to manoeuvre unchecked."

    elif dt == DecisionType.WITHDRAW:
        for u in subs:
            u.position.z = round(max(-12, u.position.z - 3), 2)
            if u.comm_status == CommStatus.LOST:
                u.comm_status, u.comm_delay_ms = CommStatus.DEGRADED, 2500
                u.last_known_position = None
        state.modifiers["withdrawn"] = True
        outcome = "Tactical withdrawal to secondary positions. Ground conceded; closer to command, links partially recover."

    elif dt == DecisionType.REQUEST_RECON:
        if state.recon_remaining > 0:
            state.recon_remaining -= 1
            rng = _rng(state, "recon")
            parts = []
            for h in _hostiles(state):
                hx, hz = _xz(h["position"])
                pos = {"x": hx + rng.uniform(-0.3, 0.3), "y": 0, "z": hz + rng.uniform(-0.3, 0.3)}
                parts.append(f"{TYPE_WORDS.get(h['type'], 'enemy')} ({h['strength'].lower()}) at grid {grid(pos)}")
                _report(state, "RECON_ASSET", f"AERIAL RECON: Confirmed {parts[-1]}.", "RECON", 0.95, pos)
            for u in subs:
                if u.comm_status == CommStatus.LOST:
                    u.comm_status, u.comm_delay_ms = CommStatus.DEGRADED, 3000
                    u.last_known_position = None
                    parts.append(f"{u.callsign} located, relay established")
            outcome = f"Aerial recon tasked ({state.recon_remaining} asset(s) left). " + "; ".join(parts) + ". The sortie cost time."
        else:
            outcome = "Recon requested but no assets remain. Request denied — time lost."
        advance += 0.5  # tasking recon takes time

    # The threat evolves: unengaged hostiles push south toward friendly lines
    for h in _hostiles(state):
        if not h.get("engaged"):
            h["position"]["z"] = round(max(-12, h["position"]["z"] - advance), 2)

    _event(state, "CONSEQUENCE", outcome, effect=dt.value, round=state.round)

    for h in _hostiles(state):
        close = [u.callsign for u in subs if _dist(h["position"], u.position) < 2.5]
        if close and not h.get("engaged"):
            _event(state, "THREAT_CONTACT", f"Enemy forces in contact with {', '.join(close)}!", round=state.round)


# ── Scoring Engine ──────────────────────────────────────────────────

def _score_decision(d: Decision, idx: int) -> dict:
    """Score a single decision using only what the trainee knew at that moment."""
    c = d.context
    dt = d.decision_type
    # Fresh aerial recon resolves conflicting ground reports
    uncertain = not c["recon_fresh"] and (c["conflict"] or c["avg_confidence"] < 0.6)
    good_picture = c["recon_fresh"] or (not c["conflict"] and c["max_confidence"] >= 0.75)
    threat_close = c["nearest_reported_threat"] is not None and c["nearest_reported_threat"] < 5
    lost = c["lost_units"]
    delayed = c["delayed_units"]
    notes = []

    # Evidence summary in plain language
    if c["report_count"]:
        evidence = f"{c['report_count']} reports at avg {c['avg_confidence']:.0%} confidence"
        if c["spread"] > 3.5:
            evidence += f", positions {c['spread']:.1f} grid apart"
        if c["type_conflict"]:
            evidence += ", disagreeing on enemy type"
        if c["recon_fresh"]:
            evidence += ", with fresh aerial recon"
    else:
        evidence = "no usable contact reports"

    # 1. Decision quality — judged in context
    if good_picture:
        dq = {DecisionType.INTERCEPT: 80 if lost else 90, DecisionType.MOVE: 78,
              DecisionType.HOLD: 72 if threat_close else 68, DecisionType.OBSERVE: 50,
              DecisionType.REQUEST_RECON: 40 if c["recon_fresh"] else 60,
              DecisionType.WITHDRAW: 70 if threat_close else 55}[dt]
        situation = "the picture was clear enough to act"
    elif uncertain:
        dq = {DecisionType.REQUEST_RECON: 92 if c["recon_remaining"] > 0 else 45,
              DecisionType.OBSERVE: 62 if threat_close else 78, DecisionType.HOLD: 72,
              DecisionType.MOVE: 66, DecisionType.WITHDRAW: 72 if threat_close else 60,
              DecisionType.INTERCEPT: 30}[dt]
        situation = "the picture was uncertain"
    else:
        dq = {DecisionType.INTERCEPT: 72, DecisionType.MOVE: 76, DecisionType.HOLD: 66,
              DecisionType.REQUEST_RECON: 74, DecisionType.OBSERVE: 64, DecisionType.WITHDRAW: 52}[dt]
        situation = "the picture was partial but consistent"
    if d.reasoning and len(d.reasoning.strip()) >= 15:
        dq = min(100, dq + 5)
        notes.append("Rationale was recorded (+5).")

    # 2. Response time — relative to the decision window, paused time excluded
    ratio = c["wait_s"] / max(c["window_s"], 1)
    rt = 95 if ratio < 0.15 else 85 if ratio < 0.35 else 70 if ratio < 0.6 else 55 if ratio <= 1 else 30
    rt_note = f"Decided in {c['wait_s']:.0f}s of a {c['window_s']:.0f}s window"
    if ratio > 1:
        rt_note += " — window exceeded"
    if delayed and ratio >= 0.35:
        names = ", ".join(f"{u['callsign']} +{u['delay_ms'] / 1000:.1f}s" for u in delayed)
        rt_note += f"; delayed communication ({names}) increased response time"
    notes.append(rt_note + ".")

    # 3. Uncertainty handling
    if uncertain:
        uh = {DecisionType.REQUEST_RECON: 92, DecisionType.OBSERVE: 85, DecisionType.HOLD: 70,
              DecisionType.WITHDRAW: 70, DecisionType.MOVE: 68, DecisionType.INTERCEPT: 30}[dt]
    elif good_picture:
        uh = {DecisionType.INTERCEPT: 88, DecisionType.MOVE: 88, DecisionType.HOLD: 70,
              DecisionType.OBSERVE: 55, DecisionType.REQUEST_RECON: 50, DecisionType.WITHDRAW: 60}[dt]
    else:
        uh = 75
    if uncertain and dt == DecisionType.INTERCEPT:
        notes.append("Committed to an attack on conflicting/low-confidence reports.")
    if good_picture and dt in (DecisionType.OBSERVE, DecisionType.REQUEST_RECON):
        notes.append("Waited for more information when the picture already supported action.")

    # 4. Communication handling
    if lost:
        ch = {DecisionType.REQUEST_RECON: 88, DecisionType.WITHDRAW: 78, DecisionType.HOLD: 72,
              DecisionType.OBSERVE: 72, DecisionType.MOVE: 62, DecisionType.INTERCEPT: 35}[dt]
        if dt == DecisionType.INTERCEPT:
            notes.append(f"{', '.join(lost)} had lost comms, so a coordinated attack was not possible.")
        elif dt in (DecisionType.REQUEST_RECON, DecisionType.WITHDRAW):
            notes.append(f"Worked around lost comms with {', '.join(lost)}.")
    elif delayed:
        ch = {DecisionType.INTERCEPT: 58, DecisionType.REQUEST_RECON: 82}.get(dt, 78)
    else:
        ch = 85

    # 5. Resource management
    if dt == DecisionType.REQUEST_RECON:
        rm = 40 if c["recon_remaining"] == 0 else 50 if c["recon_fresh"] else 88
        if c["recon_remaining"] == 0:
            notes.append("No recon assets remained — the request was wasted.")
        elif c["recon_fresh"]:
            notes.append("Duplicated recon that had just been delivered.")
    elif dt == DecisionType.INTERCEPT:
        rm = 40 if uncertain else 78
    elif dt == DecisionType.WITHDRAW:
        rm = 80 if threat_close else 55
    else:
        rm = {DecisionType.MOVE: 72, DecisionType.HOLD: 74, DecisionType.OBSERVE: 70}[dt]

    cats = {"decision_quality": dq, "response_time": rt, "uncertainty_handling": uh,
            "communication_handling": ch, "resource_management": rm}
    total = round(sum(cats[k] * w for k, w in WEIGHTS.items()), 1)

    if total >= 75:
        verdict = "Reasonable given the available evidence"
    elif total >= 55:
        verdict = "Defensible, but not the strongest option on the evidence"
    else:
        verdict = "Not well supported by the evidence available"

    # What actually happened — shown for learning, never scored
    truth = c["truth"]
    truth_note = ""
    if c.get("best_report") and truth.get("best_report_error") is not None:
        err = truth["best_report_error"]
        truth_note = (f"Your most trusted report ({c['best_report']['source']}, {c['best_report']['confidence']:.0%}) "
                      f"was {err:.1f} grid from the nearest real enemy. ")
        if err > 3 and dq >= 70:
            truth_note += "The intel was wrong, but your decision was sound on what you knew — not penalised."
        elif err <= 2 and dq < 55:
            truth_note += "The intel happened to be right, but acting as you did was still a gamble on what you knew."
    if truth.get("dropped_reports"):
        truth_note += f" {truth['dropped_reports']} report(s) were lost in transit before this decision."

    return {
        "index": idx + 1,
        "round": c["round"],
        "decision_type": dt.value,
        "t": c["t"],
        "reasoning": d.reasoning,
        "scores": cats,
        "total": total,
        "verdict": verdict,
        "explanation": f"{verdict}: {situation} ({evidence}).",
        "notes": notes,
        "truth_note": truth_note.strip(),
    }


def compute_score(state: ScenarioState) -> ScoreBreakdown:
    """Score the trainee's performance across 5 dimensions, averaged over all decisions."""
    score = ScoreBreakdown()

    if not state.decisions:
        score.explanations.append("No decisions were made during the scenario.")
        return score

    reviews = [_score_decision(d, i) for i, d in enumerate(state.decisions)]
    score.decision_reviews = reviews

    for key in WEIGHTS:
        setattr(score, key, round(sum(r["scores"][key] for r in reviews) / len(reviews), 1))
    score.total = round(sum(getattr(score, k) * w for k, w in WEIGHTS.items()), 1)

    for r in reviews:
        score.explanations.append(
            f"Decision {r['index']} ({r['decision_type'].replace('_', ' ')}, round {r['round']}): {r['explanation']}")
    best = max(reviews, key=lambda r: r["total"])
    worst = min(reviews, key=lambda r: r["total"])
    if len(reviews) > 1 and best is not worst:
        score.explanations.append(
            f"Strongest call: decision {best['index']} ({best['total']:.0f}). Weakest: decision {worst['index']} ({worst['total']:.0f}).")
    if len(state.decisions) < state.config.max_decisions:
        score.explanations.append(
            f"Scenario ended after {len(state.decisions)} of {state.config.max_decisions} decisions.")
    dropped = len(state.ground_truth.get("dropped_reports", []))
    if dropped:
        score.explanations.append(f"{dropped} report(s) never reached you due to link dropout — part of the fog you were trained against.")
    score.explanations.append("Scores judge each decision on the information you had at the time, not on the hidden ground truth.")

    return score
