"""
Pydantic schemas for Item CRUD and stock adjustment.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, ConfigDict, computed_field

from app.models.item import ItemType


# ---------- REQUEST SCHEMAS ----------


class ItemCreate(BaseModel):
    sku: str
    name: str
    item_type: ItemType
    unit: str
    unit_cost: float = 0
    selling_price: Optional[float] = None
    stock_quantity: float = 0
    critical_stock_level: float = 0
    target_stock_level: float = 0


class ItemUpdate(BaseModel):
    name: Optional[str] = None
    unit_cost: Optional[float] = None
    selling_price: Optional[float] = None
    critical_stock_level: Optional[float] = None
    target_stock_level: Optional[float] = None

class ThresholdUpdate(BaseModel):
    critical_stock_level: float
    target_stock_level: float


class StockAdjustment(BaseModel):
    """Positive quantity → add stock, negative → remove stock."""
    item_id: int
    quantity: float
    reason: str = "Manual adjustment"


# ---------- RESPONSE SCHEMAS ----------


class ItemRead(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    sku: str
    name: str
    item_type: ItemType
    unit: str
    unit_cost: float
    selling_price: Optional[float] = None
    stock_quantity: float
    reserved_quantity: float
    available_stock: float
    critical_stock_level: float
    target_stock_level: float
    created_at: datetime
    updated_at: Optional[datetime] = None


class InventoryRow(BaseModel):
    """Flattened view used by the Live Inventory Monitor."""
    id: int
    sku: str
    name: str
    item_type: str
    unit: str
    unit_cost: float
    stock_quantity: float
    reserved_quantity: float
    available_stock: float
    critical_stock_level: float
    target_stock_level: float
    is_critical: bool
