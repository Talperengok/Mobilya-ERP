"""
Order and OrderItem models.

Orders flow through these statuses:
  PENDING → IN_PRODUCTION → READY → SHIPPED → DELIVERED
                                  → CANCELLED (from any state)
"""

import enum
from datetime import datetime

from sqlalchemy import String, Numeric, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class OrderStatus(str, enum.Enum):
    PENDING = "PENDING"
    WAITING_FOR_MATERIALS = "WAITING_FOR_MATERIALS"
    IN_PRODUCTION = "IN_PRODUCTION"
    READY = "READY"
    SHIPPED = "SHIPPED"
    DELIVERED = "DELIVERED"
    CANCELLED = "CANCELLED"


class OrderSource(str, enum.Enum):
    ONLINE = "ONLINE"
    POS = "POS"


class Order(Base):
    __tablename__ = "orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=False
    )
    status: Mapped[OrderStatus] = mapped_column(
        Enum(OrderStatus), default=OrderStatus.PENDING
    )
    source: Mapped[OrderSource] = mapped_column(Enum(OrderSource), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), default=0)
    order_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # --- Relationships ---
    customer = relationship("Customer", back_populates="orders")
    items = relationship(
        "OrderItem", back_populates="order", cascade="all, delete-orphan"
    )
    production_orders = relationship("ProductionOrder", back_populates="order")
    invoice = relationship("Invoice", back_populates="order", uselist=False)
    shipment = relationship("Shipment", back_populates="order", uselist=False)
    waybill = relationship("Waybill", back_populates="order", uselist=False)

    def __repr__(self) -> str:
        return f"<Order(number={self.order_number!r}, status={self.status.value})>"


class OrderItem(Base):
    __tablename__ = "order_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id", ondelete="CASCADE"), nullable=False
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=False
    )
    quantity: Mapped[int] = mapped_column(Integer, nullable=False)
    unit_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False)
    line_total: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    # --- Relationships ---
    order = relationship("Order", back_populates="items")
    item = relationship("Item", back_populates="order_items")

    def __repr__(self) -> str:
        return f"<OrderItem(order_id={self.order_id}, item_id={self.item_id}, qty={self.quantity})>"
