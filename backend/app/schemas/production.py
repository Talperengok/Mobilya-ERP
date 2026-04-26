"""
Pydantic schemas for Production Orders.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ProductionLogRead(BaseModel):
    id: int
    consumed_item_id: int
    consumed_item_name: str
    consumed_item_sku: str
    quantity_consumed: float
    unit: str
    consumed_at: Optional[str] = None


class ProductionOrderRead(BaseModel):
    id: int
    order_id: Optional[int] = None
    item_id: int
    item_name: str
    item_sku: str
    quantity_to_produce: float
    status: str
    created_at: Optional[str] = None
    started_at: Optional[str] = None
    completed_at: Optional[str] = None
    materials_consumed: list[ProductionLogRead] = []
