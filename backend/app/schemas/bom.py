"""
Pydantic schemas for BOM management.
"""

from typing import Optional
from pydantic import BaseModel, ConfigDict


class BOMItemCreate(BaseModel):
    child_item_id: int
    quantity: float
    notes: Optional[str] = None


class BOMItemUpdate(BaseModel):
    quantity: Optional[float] = None
    notes: Optional[str] = None


class BOMItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    parent_item_id: int
    child_item_id: int
    quantity: float
    notes: Optional[str] = None
    # Denormalized child info (populated in the API layer)
    child_item_name: Optional[str] = None
    child_item_sku: Optional[str] = None
    child_item_type: Optional[str] = None
    child_item_unit: Optional[str] = None


class BOMExplosionNode(BaseModel):
    """Single node in a recursive BOM tree (read-only display)."""
    item_id: int
    item_name: str
    item_sku: str
    item_type: str
    unit: str
    quantity_per_unit: float
    total_quantity: float
    unit_cost: float
    total_cost: float
    stock_available: float
    stock_sufficient: bool
    level: int
    children: list["BOMExplosionNode"] = []
