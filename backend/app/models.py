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
    seller_name: Optional[str] = None
    price_per_kg: Optional[float] = Field(None, gt=0, examples=[30])
    notes: Optional[str] = None


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


class ClaimRequest(BaseModel):
    claimed_by: str = Field(..., examples=["Robin Hood Army - Delhi Chapter"])


class BatchResponse(BaseModel):
    id: int
    produce_type: str
    quantity_kg: float
    harvest_date: str
    storage_condition: str
    location: str
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
    claimed_at: Optional[str]