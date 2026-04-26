"""
RMA (Return Merchandise Authorization) Ticket model.
Tracks defective parts returned by customers and spawns targeted repairs.
"""

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class RMAStatus(str, enum.Enum):
    SUBMITTED = "SUBMITTED"
    APPROVED = "APPROVED"
    REPAIR_IN_PROGRESS = "REPAIR_IN_PROGRESS"
    RESOLVED = "RESOLVED"
    REJECTED = "REJECTED"


class RMATicket(Base):
    __tablename__ = "rma_tickets"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=False
    )
    defective_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=False
    )
    issue_description: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[RMAStatus] = mapped_column(
        Enum(RMAStatus), default=RMAStatus.SUBMITTED
    )
    resolution_production_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    resolved_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # --- Relationships ---
    order = relationship("Order")
    defective_item = relationship("Item")
    resolution_production_order = relationship("ProductionOrder", foreign_keys=[resolution_production_order_id])

    def __repr__(self) -> str:
        return f"<RMATicket(order_id={self.order_id}, item={self.defective_item_id}, status={self.status.value})>"
