"""
Shipment model — tracks logistics and delivery of fulfilled orders.

Status pipeline: PREPARING → SHIPPED → IN_TRANSIT → DELIVERED
Tracking numbers are auto-generated as TRK-XXXXX format.
"""

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class ShipmentStatus(str, enum.Enum):
    PREPARING = "PREPARING"
    READY_FOR_PICKUP = "READY_FOR_PICKUP"
    SHIPPED = "SHIPPED"
    IN_TRANSIT = "IN_TRANSIT"
    DELIVERED = "DELIVERED"


class Shipment(Base):
    __tablename__ = "shipments"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=False, unique=True
    )
    tracking_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    courier_name: Mapped[str] = mapped_column(String(100), nullable=True)
    status: Mapped[ShipmentStatus] = mapped_column(
        Enum(ShipmentStatus), default=ShipmentStatus.PREPARING
    )
    estimated_delivery_date: Mapped[datetime] = mapped_column(
        DateTime, nullable=True
    )
    shipped_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    delivered_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # --- Relationships ---
    order = relationship("Order", back_populates="shipment")
    waybill = relationship("Waybill", back_populates="shipment", uselist=False)

    def __repr__(self) -> str:
        return f"<Shipment(tracking={self.tracking_number!r}, status={self.status.value})>"
