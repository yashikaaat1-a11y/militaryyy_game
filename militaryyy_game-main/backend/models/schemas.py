"""Pydantic models for the TactiComm scenario engine."""
from pydantic import BaseModel, Field
from typing import Optional
from enum import Enum
import time, uuid


class CommStatus(str, Enum):
    NORMAL = "NORMAL"
    DELAYED = "DELAYED"
    DEGRADED = "DEGRADED"
    LOST = "LOST"


class UnitType(str, Enum):
    INFANTRY = "INFANTRY"
    ARMOR = "ARMOR"
    RECON = "RECON"
    COMMAND = "COMMAND"


class Faction(str, Enum):
    FRIENDLY = "FRIENDLY"
    UNKNOWN = "UNKNOWN"
    HOSTILE = "HOSTILE"


class ScenarioPhase(str, Enum):
    BRIEFING = "BRIEFING"
    NORMAL = "NORMAL"
    DEGRADATION = "DEGRADATION"
    CONFLICTING = "CONFLICTING"
    DECISION = "DECISION"
    CONSEQUENCE = "CONSEQUENCE"
    REVEAL = "REVEAL"
    AAR = "AAR"


class DecisionType(str, Enum):
    OBSERVE = "OBSERVE"
    MOVE = "MOVE"
    INTERCEPT = "INTERCEPT"
    HOLD = "HOLD"
    WITHDRAW = "WITHDRAW"
    REQUEST_RECON = "REQUEST_RECON"


class Position(BaseModel):
    x: float = 0
    y: float = 0
    z: float = 0


class Unit(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    name: str
    callsign: str
    unit_type: UnitType
    faction: Faction
    position: Position
    comm_status: CommStatus = CommStatus.NORMAL
    health: float = 100.0
    is_visible: bool = True
    comm_delay_ms: int = 0
    last_known_position: Optional[Position] = None


class IntelReport(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: float = Field(default_factory=time.time)
    source_unit: str
    content: str
    reported_position: Optional[Position] = None
    confidence: float = 1.0  # 0.0 to 1.0
    is_accurate: bool = True  # ground truth
    category: str = "CONTACT"
    received_at: Optional[float] = None  # when trainee actually sees it
    round: int = 1
    delay_s: float = 0.0  # how long the report sat in a degraded link


class Decision(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: float = Field(default_factory=time.time)
    decision_type: DecisionType
    target_unit: Optional[str] = None
    reasoning: Optional[str] = None
    available_info: list[str] = []  # report IDs available at decision time
    phase: ScenarioPhase = ScenarioPhase.DECISION
    round: int = 1
    context: dict = {}  # what the trainee knew (and, hidden, the truth) at decision time
    assessment: Optional[dict] = None  # commander's belief: {x, z, confidence}


class ScenarioEvent(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    timestamp: float = Field(default_factory=time.time)
    event_type: str  # PHASE_CHANGE, COMM_CHANGE, REPORT, DECISION, CONSEQUENCE
    description: str
    data: dict = {}


class ScoreBreakdown(BaseModel):
    decision_quality: float = 0.0       # 30%
    response_time: float = 0.0          # 20%
    uncertainty_handling: float = 0.0   # 20%
    communication_handling: float = 0.0 # 15%
    resource_management: float = 0.0    # 15%
    total: float = 0.0
    explanations: list[str] = []
    decision_reviews: list[dict] = []  # per-decision breakdown + verdict
    cognitive: dict = {}  # calibration, detected biases, decision regret


class ScenarioConfig(BaseModel):
    name: str = "Urban Comms Failure"
    scenario_type: str = "URBAN"  # URBAN, MOUNTAIN, RIVER, DESERT
    duration_seconds: int = 300
    comm_reliability: float = 0.8
    delay_range_ms: tuple[int, int] = (500, 5000)
    dropout_probability: float = 0.2
    conflicting_report_probability: float = 0.3
    threat_difficulty: str = "MEDIUM"
    num_friendly_units: int = 3
    max_decisions: int = 3
    recon_assets: int = 2
    seed: Optional[int] = None


class ScenarioState(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4())[:8])
    config: ScenarioConfig = Field(default_factory=ScenarioConfig)
    phase: ScenarioPhase = ScenarioPhase.BRIEFING
    elapsed_time: float = 0.0
    started_at: float = Field(default_factory=time.time)
    round: int = 1
    recon_remaining: int = 2
    is_paused: bool = False
    paused_at: Optional[float] = None
    paused_total: float = 0.0
    decision_opened_at: Optional[float] = None
    decision_opened_paused_total: float = 0.0
    modifiers: dict = {}  # consequence effects carried into the next round
    snapshots: list[dict] = []  # replay frames
    units: list[Unit] = []
    reports: list[IntelReport] = []
    decisions: list[Decision] = []
    events: list[ScenarioEvent] = []
    ground_truth: dict = {}
    is_running: bool = False
    is_complete: bool = False
    score: Optional[ScoreBreakdown] = None
