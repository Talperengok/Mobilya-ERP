"""
Pydantic schemas for Orders and the MRP result response.
"""

from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------- REQUEST SCHEMAS ----------


class OrderItemCreate(BaseModel):
    item_id: int
    quantity: int


class OrderCreate(BaseModel):
    customer_id: int
    source: str = "ONLINE"
    items: list[OrderItemCreate]


# ---------- RESPONSE SCHEMAS ----------


class OrderItemRead(BaseModel):
    id: int
    item_id: int
    item_name: str
    quantity: int
    unit_price: float
    line_total: float


class OrderRead(BaseModel):
    id: int
    order_number: str
    customer_id: int
    customer_name: str
    status: str
    source: str
    total_amount: float
    order_date: str
    item_count: int
    items: list[OrderItemRead] = []


class MaterialConsumed(BaseModel):
    material: str
    sku: str
    quantity_consumed: float
    unit: str
    remaining_stock: float
    produced_for: str


class ItemProduced(BaseModel):
    item: str
    sku: str
    quantity_produced: float
    new_stock: float


class MRPResultResponse(BaseModel):
    production_orders_created: int
    materials_consumed: list[MaterialConsumed]
    items_produced: list[ItemProduced]


class PlaceOrderResponse(BaseModel):
    order: dict
    mrp_result: dict
    message: str
