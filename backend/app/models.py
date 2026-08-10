"""
Pydantic schemas - these define what data goes in/out of the API,
and FastAPI auto-validates against them (and auto-generates the /docs page).
"""
from pydantic import BaseModel, Field
from typing import Optional
from datetime import date


class StorageCondition:
    ROOM_TEMP = "room_temp"
    COLD_STORAGE = "cold_storage"
    REFRIGERATED = "refrigerated"


class BatchCreate(BaseModel):
    produce_type: str = Field(..., examples=["tomato"])
    quantity_kg: float = Field(..., gt=0, examples=[50])
    harvest_date: date
    storage_condition: str = Field(..., examples=["room_temp", "cold_storage", "refrigerated"])
    location: str = Field(..., examples=["Azadpur Mandi, Delhi"])
    latitude: Optional[float] = Field(None, ge=-90, le=90, examples=[28.7069])
    longitude: Optional[float] = Field(None, ge=-180, le=180, examples=[77.1746])
    seller_name: Optional[str] = None
    price_per_kg: Optional[float] = Field(None, gt=0, examples=[30])
    notes: Optional[str] = None
    language: Optional[str] = Field(
        "en",
        examples=["en", "hi", "bn", "ta", "te", "mr", "gu", "kn", "pa"],
        description="ISO 639-1 code the seller's UI is in - used to ask the AI agent "
                    "to write its reasoning in that language (falls back to English).",
    )
    # Optional - filled in automatically when the seller uploads/captures a photo
    # and it's run through POST /vision/analyze-image on the frontend first.
    # Left blank, everything behaves exactly as before (manual entry only).
    quality_label: Optional[str] = Field(None, examples=["good"])
    quality_score: Optional[int] = Field(None, ge=0, le=100, examples=[78])
    vision_source: Optional[str] = Field(None, examples=["gemini:gemini-2.0-flash"])


class BatchPreviewRequest(BatchCreate):
    """Same shape as BatchCreate - used for the live 'AI Recommendation Preview' before submit."""
    pass


class BatchPreviewResponse(BaseModel):
    remaining_shelf_life_days: float
    status: str
    recommended_action: str
    discount_pct: float
    agent_reasoning: str
    agent_source: str
    discounted_price_per_kg: Optional[float] = None


class VisionAnalysisResponse(BaseModel):
    """Returned by POST /vision/analyze-image - one photo in, produce type + quality out."""
    produce_type: str = Field(..., examples=["tomato"])
    produce_confidence: float = Field(..., ge=0, le=1, examples=[0.92])
    quality_label: str = Field(..., examples=["good"], description="excellent | good | fair | poor | spoiled")
    quality_score: int = Field(..., ge=0, le=100, examples=[78])
    defects_observed: list[str] = Field(default_factory=list)
    reasoning: str = ""
    source: str = Field(..., description="which provider answered: gemini:<model> / groq:<model> / classical_cv")
    shelf_life_adjustment_pct: float = Field(
        0.0, description="Suggested nudge to the harvest-date shelf-life estimate based on visible quality."
    )


class ClaimRequest(BaseModel):
    claimed_by: str = Field(..., examples=["Robin Hood Army - Delhi Chapter"])
    contact: Optional[str] = Field(None, examples=["+91 98765 43210"])


class BatchResponse(BaseModel):
    id: int
    produce_type: str
    quantity_kg: float
    harvest_date: str
    storage_condition: str
    location: str
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    seller_name: Optional[str]
    created_at: str
    remaining_shelf_life_days: Optional[float]
    status: str
    recommended_action: Optional[str]
    discount_pct: Optional[float]
    agent_reasoning: Optional[str]
    agent_source: Optional[str]
    price_per_kg: Optional[float]
    notes: Optional[str]
    claimed_by: Optional[str]
    claimed_contact: Optional[str] = None
    claimed_at: Optional[str]
    completed_at: Optional[str] = None
    quality_label: Optional[str] = None
    quality_score: Optional[int] = None
    vision_source: Optional[str] = None


class ImpactResponse(BaseModel):
    total_batches_logged: int
    total_kg_listed: float
    batches_rescued: int
    batches_in_progress: int
    batches_expired: int
    batches_composted: int = 0
    kg_rescued: float
    kg_in_progress: float
    kg_currently_at_risk: float
    kg_composted: float = 0
    revenue_recovered: float