from typing import Any, Optional
from pydantic import BaseModel, Field

class IntakeRequest(BaseModel):
    text: str
    current: Optional[dict[str, Any]] = None

class EditRequest(BaseModel):
    instruction: str
    current: dict[str, Any]

class Investigation(BaseModel):
    id: Optional[int] = None
    status: str = "Draft"
    incident_title: str = ""
    incident_date: str = ""
    site: str = ""
    department: str = ""
    process_stage: str = ""
    product_api: str = ""
    batch_lot: str = ""
    equipment_id: str = ""
    deviation_description: str = ""
    immediate_actions: str = ""
    batch_impact: str = ""
    containment: str = ""
    investigation_method: str = "5 Whys"
    five_whys: list[str] = Field(default_factory=list)
    fishbone: dict[str, list[str]] = Field(default_factory=dict)
    potential_root_causes: list[dict[str, Any]] = Field(default_factory=list)
    contributing_factors: list[str] = Field(default_factory=list)
    missing_evidence: list[str] = Field(default_factory=list)
    capa: list[dict[str, Any]] = Field(default_factory=list)
    risk_level: str = "Not assessed"
    risk_rationale: str = ""
    evidence_summary: str = ""
    source_text: str = ""
    ai_disclaimer: str = "AI suggestions require qualified QA review and approval."
