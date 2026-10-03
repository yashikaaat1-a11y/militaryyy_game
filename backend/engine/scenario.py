"""Scenario engine — manages scenario lifecycle, communication degradation,
report generation, decision consequences, and scoring."""

import time, random, math, copy
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
    state = ScenarioState(config=cfg)

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

    state.events.append(ScenarioEvent(
        event_type="SCENARIO_CREATED",
        description=f"{cfg.name} ({cfg.scenario_type}) scenario initialized",
        data={"config": cfg.model_dump()}
    ))

    return state


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


def advance_phase(state: ScenarioState) -> ScenarioState:
    """Move to the next scenario phase and apply phase-specific effects."""
    idx = PHASE_ORDER.index(state.phase)
    
    # Loop back logic for multiple decisions
    if state.phase == ScenarioPhase.CONSEQUENCE and len(state.decisions) < state.config.max_decisions:
        new_phase = ScenarioPhase.DEGRADATION  # Loop back to give new intel
        state.events.append(ScenarioEvent(
            event_type="PHASE_CHANGE",
            description=f"Situation evolving... Awaiting Decision {len(state.decisions) + 1} of {state.config.max_decisions}",
            data={"from": state.phase.value, "to": new_phase.value}
        ))
    elif idx < len(PHASE_ORDER) - 1:
        new_phase = PHASE_ORDER[idx + 1]
        state.events.append(ScenarioEvent(
            event_type="PHASE_CHANGE",
            description=f"Phase changed to {new_phase.value}",
            data={"from": PHASE_ORDER[idx].value, "to": new_phase.value}
        ))
    else:
        return state

    state.phase = new_phase
    _apply_phase_effects(state)
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
        # Initial accurate reports
        _generate_normal_reports(state)

    elif phase == ScenarioPhase.DEGRADATION:
        friendly = [u for u in state.units if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD"]
        unit_2 = friendly[1].callsign if len(friendly) > 1 else "BRAVO"
        unit_3 = friendly[2].callsign if len(friendly) > 2 else "CHARLIE"

        # unit_2 gets delayed, unit_3 goes offline
        for u in state.units:
            if u.callsign == unit_2:
                u.comm_status = CommStatus.DELAYED
                u.comm_delay_ms = random.randint(2000, 5000)
                state.events.append(ScenarioEvent(
                    event_type="COMM_CHANGE",
                    description=f"{u.callsign} communications degraded — delays of {u.comm_delay_ms}ms",
                    data={"unit": u.callsign, "status": "DELAYED", "delay": u.comm_delay_ms}
                ))
            elif u.callsign == unit_3:
                u.comm_status = CommStatus.LOST
                u.comm_delay_ms = 0
                state.events.append(ScenarioEvent(
                    event_type="COMM_CHANGE",
                    description=f"{u.callsign} communications LOST — no contact",
                    data={"unit": u.callsign, "status": "LOST"}
                ))
        _generate_degraded_reports(state)

    elif phase == ScenarioPhase.CONFLICTING:
        _generate_conflicting_reports(state)

    elif phase == ScenarioPhase.DECISION:
        state.events.append(ScenarioEvent(
            event_type="DECISION_REQUIRED",
            description="Commander must make a decision based on available intelligence",
            data={"available_reports": len(state.reports)}
        ))

    elif phase == ScenarioPhase.REVEAL:
        # Reveal ground truth
        state.events.append(ScenarioEvent(
            event_type="GROUND_TRUTH_REVEALED",
            description="Actual enemy positions and intentions revealed",
            data=state.ground_truth
        ))

    elif phase == ScenarioPhase.AAR:
        state.is_running = False
        state.is_complete = True
        state.score = compute_score(state)


# ── Report Generation ───────────────────────────────────────────────

def _generate_normal_reports(state: ScenarioState):
    now = time.time()
    friendly = [u for u in state.units if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD"]
    unit_1 = friendly[0].callsign if len(friendly) > 0 else "ALPHA"
    unit_2 = friendly[1].callsign if len(friendly) > 1 else "BRAVO"
    unit_3 = friendly[2].callsign if len(friendly) > 2 else "CHARLIE"

    state.reports.extend([
        IntelReport(
            timestamp=now,
            source_unit=unit_1,
            content="Sector clear. No enemy contact. Holding position at grid reference NW-4.",
            confidence=0.95,
            is_accurate=True,
            category="SITREP",
            received_at=now,
        ),
        IntelReport(
            timestamp=now + 0.5,
            source_unit=unit_2,
            content="Moving to overwatch position. Terrain is open with limited cover. No contacts.",
            confidence=0.90,
            is_accurate=True,
            category="SITREP",
            received_at=now + 0.5,
        ),
        IntelReport(
            timestamp=now + 1,
            source_unit=unit_3,
            content="Recon patrol proceeding north. Observed vehicle tracks, age unknown. Investigating.",
            reported_position=Position(x=3, y=0, z=7),
            confidence=0.85,
            is_accurate=True,
            category="CONTACT",
            received_at=now + 1,
        ),
    ])


def _generate_degraded_reports(state: ScenarioState):
    now = time.time()
    friendly = [u for u in state.units if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD"]
    unit_1 = friendly[0].callsign if len(friendly) > 0 else "ALPHA"
    unit_2 = friendly[1].callsign if len(friendly) > 1 else "BRAVO"
    unit_3 = friendly[2].callsign if len(friendly) > 2 else "CHARLIE"

    state.reports.extend([
        IntelReport(
            timestamp=now,
            source_unit=unit_1,
            content="Hearing engine noise to the northeast. Cannot confirm visual. Possible armored vehicle.",
            reported_position=Position(x=4, y=0, z=6),
            confidence=0.60,
            is_accurate=True,
            category="CONTACT",
            received_at=now,
        ),
        IntelReport(
            timestamp=now - 3,
            source_unit=unit_2,
            content="[DELAYED] Spotted movement at grid E-7. Two vehicles, type unclear. Requesting air recon.",
            reported_position=Position(x=6, y=0, z=7),
            confidence=0.55,
            is_accurate=True,
            category="CONTACT",
            received_at=now + 2.5,
        ),
        IntelReport(
            timestamp=now,
            source_unit="OVERLORD",
            content=f"Lost contact with {unit_3}. Last known position grid N-6. Attempting re-establishment.",
            confidence=0.40,
            is_accurate=True,
            category="COMM",
            received_at=now,
        ),
    ])


def _generate_conflicting_reports(state: ScenarioState):
    now = time.time()
    friendly = [u for u in state.units if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD"]
    unit_1 = friendly[0].callsign if len(friendly) > 0 else "ALPHA"
    unit_2 = friendly[1].callsign if len(friendly) > 1 else "BRAVO"

    # These reports deliberately conflict about the contact location and type
    state.reports.extend([
        IntelReport(
            timestamp=now,
            source_unit=unit_1,
            content="CONTACT REPORT: Enemy infantry squad at grid NE-8. Estimated 8-10 personnel. No vehicles observed.",
            reported_position=Position(x=5, y=0, z=8),
            confidence=0.70,
            is_accurate=False,
            category="CONTACT",
            received_at=now,
        ),
        IntelReport(
            timestamp=now - 4,
            source_unit=unit_2,
            content="[DELAYED] FLASH: Mechanized platoon with 3 vehicles at grid E-9. Moving south. URGENT.",
            reported_position=Position(x=7, y=0, z=9),
            confidence=0.50,
            is_accurate=True,
            category="CONTACT",
            received_at=now + 3,
        ),
        IntelReport(
            timestamp=now,
            source_unit="OVERLORD",
            content="SIGINT intercept suggests enemy recon element operating west of reported positions. Low confidence.",
            reported_position=Position(x=-2, y=0, z=8),
            confidence=0.35,
            is_accurate=True,
            category="SIGINT",
            received_at=now,
        ),
        IntelReport(
            timestamp=now,
            source_unit=unit_1,
            content="Correction to previous: May be vehicles not infantry. Visibility poor. Confidence LOW.",
            reported_position=Position(x=6, y=0, z=8),
            confidence=0.45,
            is_accurate=True,
            category="CONTACT",
            received_at=now + 1,
        ),
    ])


# ── Decision Processing ────────────────────────────────────────────

def process_decision(state: ScenarioState, decision: Decision) -> ScenarioState:
    """Process a trainee decision and apply consequences."""
    decision.available_info = [r.id for r in state.reports]
    state.decisions.append(decision)

    state.events.append(ScenarioEvent(
        event_type="DECISION",
        description=f"Commander decided: {decision.decision_type.value}",
        data={"decision": decision.model_dump()}
    ))

    # Apply consequences based on decision
    _apply_consequences(state, decision)

    return state


def _apply_consequences(state: ScenarioState, decision: Decision):
    """Apply scenario consequences based on the decision made."""
    dt = decision.decision_type
    hostile = state.ground_truth.get("hostile_units", [])
    
    friendly = [u for u in state.units if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD"]
    unit_1 = friendly[0].callsign if len(friendly) > 0 else "ALPHA"
    unit_2 = friendly[1].callsign if len(friendly) > 1 else "BRAVO"

    if dt == DecisionType.OBSERVE:
        # Passive — gains more info but enemy advances
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description="Continued observation. Additional intelligence gathered but enemy has advanced closer.",
            data={"effect": "intel_gain", "risk": "enemy_advance"}
        ))
        for h in hostile:
            h["position"]["z"] -= 1  # enemy moves south

    elif dt == DecisionType.MOVE:
        # Repositions friendly units
        for u in state.units:
            if u.callsign == unit_1:
                u.position.x += 2
                u.position.z += 2
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description=f"{unit_1} repositioned to better vantage point. Improved observation but increased exposure.",
            data={"effect": "reposition", "risk": "exposure"}
        ))

    elif dt == DecisionType.INTERCEPT:
        # Aggressive — high risk, high reward
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description=f"Intercept order issued. {unit_1} and {unit_2} moving to engage. High risk — comms still degraded.",
            data={"effect": "engagement", "risk": "high_with_degraded_comms"}
        ))
        for u in state.units:
            if u.callsign in (unit_1, unit_2):
                u.position.z += 3

    elif dt == DecisionType.HOLD:
        # Defensive — safe but loses initiative
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description="All units holding position. Defensive posture maintained. Enemy continues advance unchecked.",
            data={"effect": "defensive", "risk": "lose_initiative"}
        ))

    elif dt == DecisionType.WITHDRAW:
        # Cautious — safe but concedes ground
        for u in state.units:
            if u.faction == Faction.FRIENDLY and u.callsign != "OVERLORD":
                u.position.z -= 3
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description="Tactical withdrawal ordered. Units falling back to secondary positions. Ground conceded.",
            data={"effect": "withdrawal", "risk": "ground_loss"}
        ))

    elif dt == DecisionType.REQUEST_RECON:
        # Smart — gains critical info but takes time
        state.events.append(ScenarioEvent(
            event_type="CONSEQUENCE",
            description="Aerial reconnaissance requested. High-confidence intel expected in 60 seconds. Decision delayed.",
            data={"effect": "recon_request", "risk": "time_delay"}
        ))
        # Add a high-confidence report
        state.reports.append(IntelReport(
            source_unit="RECON_ASSET",
            content="AERIAL RECON: Confirmed mechanized platoon (3 vehicles) at grid E-8. Enemy recon squad at grid W-9. Both moving south.",
            reported_position=Position(x=7, y=0, z=8),
            confidence=0.95,
            is_accurate=True,
            category="RECON",
        ))


# ── Scoring Engine ──────────────────────────────────────────────────

def compute_score(state: ScenarioState) -> ScoreBreakdown:
    """Score the trainee's performance across 5 dimensions."""
    score = ScoreBreakdown()

    if not state.decisions:
        score.explanations.append("No decisions were made during the scenario.")
        return score

    decision = state.decisions[-1]  # primary decision
    dt = decision.decision_type

    # 1. Decision Quality (30%) — was it reasonable given available info?
    reports_at_decision = [r for r in state.reports if r.id in decision.available_info]
    avg_confidence = sum(r.confidence for r in reports_at_decision) / max(len(reports_at_decision), 1)
    has_conflicting = len(set(r.content[:20] for r in reports_at_decision if r.category == "CONTACT")) > 1

    if dt == DecisionType.REQUEST_RECON:
        score.decision_quality = 90
        score.explanations.append("Requesting recon with low-confidence intel was a strong decision.")
    elif dt == DecisionType.OBSERVE and avg_confidence < 0.5:
        score.decision_quality = 80
        score.explanations.append("Choosing to observe when confidence was low shows good judgment.")
    elif dt == DecisionType.INTERCEPT and avg_confidence < 0.5:
        score.decision_quality = 35
        score.explanations.append("Intercepting with low-confidence intel is high-risk. Consider gathering more information first.")
    elif dt == DecisionType.HOLD:
        score.decision_quality = 65
        score.explanations.append("Holding position is cautious but may surrender initiative.")
    elif dt == DecisionType.WITHDRAW:
        score.decision_quality = 55
        score.explanations.append("Withdrawal concedes ground but preserves force. Reasonable if threat is uncertain.")
    elif dt == DecisionType.MOVE:
        score.decision_quality = 70
        score.explanations.append("Repositioning improves awareness but increases exposure.")
    elif dt == DecisionType.INTERCEPT:
        score.decision_quality = 75
        score.explanations.append("Intercept is aggressive but appropriate if intelligence supports it.")
    else:
        score.decision_quality = 60

    # 2. Response Time (20%)
    decision_events = [e for e in state.events if e.event_type == "DECISION_REQUIRED"]
    if decision_events:
        wait_time = decision.timestamp - decision_events[0].timestamp
        if wait_time < 10:
            score.response_time = 95
            score.explanations.append(f"Quick response in {wait_time:.1f}s demonstrates decisiveness.")
        elif wait_time < 30:
            score.response_time = 80
            score.explanations.append(f"Response in {wait_time:.1f}s. Adequate speed for the situation.")
        elif wait_time < 60:
            score.response_time = 60
            score.explanations.append(f"Response took {wait_time:.1f}s. Consider faster decision-making under pressure.")
        else:
            score.response_time = 40
            score.explanations.append(f"Slow response ({wait_time:.1f}s). In degraded comms, speed is critical.")
    else:
        score.response_time = 70

    # 3. Uncertainty Handling (20%)
    if has_conflicting and dt in (DecisionType.REQUEST_RECON, DecisionType.OBSERVE):
        score.uncertainty_handling = 90
        score.explanations.append("Appropriately sought more information when reports conflicted.")
    elif has_conflicting and dt == DecisionType.INTERCEPT:
        score.uncertainty_handling = 30
        score.explanations.append("Acting aggressively on conflicting reports increases risk of friendly fire or wasted resources.")
    elif has_conflicting:
        score.uncertainty_handling = 60
        score.explanations.append("Conflicting reports were present. Consider how uncertainty factored into your decision.")
    else:
        score.uncertainty_handling = 75

    # 4. Communication Handling (15%)
    lost_comms = any(u.comm_status == CommStatus.LOST for u in state.units if u.faction == Faction.FRIENDLY)
    delayed_comms = any(u.comm_status == CommStatus.DELAYED for u in state.units if u.faction == Faction.FRIENDLY)

    if lost_comms and dt == DecisionType.REQUEST_RECON:
        score.communication_handling = 85
        score.explanations.append("Used alternative recon asset when primary comms were lost. Good adaptation.")
    elif lost_comms and dt in (DecisionType.OBSERVE, DecisionType.HOLD):
        score.communication_handling = 70
        score.explanations.append("Cautious approach with lost comms is prudent but consider backup communication methods.")
    elif lost_comms and dt == DecisionType.INTERCEPT:
        score.communication_handling = 35
        score.explanations.append("Engaging with lost comms to a unit is dangerous — coordination will be compromised.")
    else:
        score.communication_handling = 65

    # 5. Resource Management (15%)
    if dt == DecisionType.WITHDRAW:
        score.resource_management = 80
        score.explanations.append("Preserving force when situation is unclear shows good resource management.")
    elif dt == DecisionType.INTERCEPT:
        score.resource_management = 50
        score.explanations.append("Committing forces to contact risks attrition in uncertain conditions.")
    elif dt == DecisionType.REQUEST_RECON:
        score.resource_management = 85
        score.explanations.append("Using reconnaissance assets before committing forces is efficient.")
    else:
        score.resource_management = 70

    # Weighted total
    score.total = round(
        score.decision_quality * 0.30 +
        score.response_time * 0.20 +
        score.uncertainty_handling * 0.20 +
        score.communication_handling * 0.15 +
        score.resource_management * 0.15,
        1
    )

    return score
