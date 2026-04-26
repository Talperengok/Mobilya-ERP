"""
Pydantic schemas for Logistics and Shipment Tracking.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


class ShipmentCreate(BaseModel):
    order_id: int
    courier_name: Optional[str] = None


class ShipmentStatusUpdate(BaseModel):
    status: str
    courier_name: Optional[str] = None
    estimated_delivery_date: Optional[datetime] = None


class ShipmentRead(BaseModel):
    id: int
    order_id: int
    tracking_number: str
    courier_name: Optional[str]
    status: str
    estimated_delivery_date: Optional[datetime]
    shipped_at: Optional[datetime]
    delivered_at: Optional[datetime]
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class OrderItemRead(BaseModel):
    id: int
    item_name: str
    quantity: int
    unit_price: float
    line_total: float

    class Config:
        from_attributes = True


class OrderWithShipmentInfo(BaseModel):
    id: int
    order_number: str
    status: str
    total_amount: float
    order_date: datetime
    item_count: int
    shipment: Optional[ShipmentRead] = None
    items: list[OrderItemRead] = []

    class Config:
        from_attributes = True
