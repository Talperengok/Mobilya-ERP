"""
Waybill model — İrsaliye (delivery note / dispatch document).

Auto-generated when a Sales Order's shipment status changes to SHIPPED.
Strictly separated from Invoices (Fatura) per Turkish commercial law.

Status lifecycle: DRAFT → ISSUED
"""

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WaybillStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"


class Waybill(Base):
    __tablename__ = "waybills"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    waybill_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=False
    )
    shipment_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("shipments.id"), nullable=True
    )
    status: Mapped[WaybillStatus] = mapped_column(
        Enum(WaybillStatus), default=WaybillStatus.ISSUED
    )
    issue_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # --- Relationships ---
    order = relationship("Order", back_populates="waybill")
    shipment = relationship("Shipment", back_populates="waybill")

    def __repr__(self) -> str:
        return f"<Waybill(number={self.waybill_number!r}, status={self.status.value})>"
