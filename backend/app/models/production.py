"""
Production Order and Production Log models.

ProductionOrder — a simulated manufacturing task triggered by the MRP engine.
ProductionLog  — an audit trail of each material consumed during production.
"""

import enum
from datetime import datetime

from sqlalchemy import String, Numeric, DateTime, Enum, ForeignKey, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base
# from app.models.employee import Employee
# from app.models.workstation import Workstation


class ProductionStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    PLANNED = "PLANNED"
    WAITING_CAPACITY = "WAITING_CAPACITY"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"


class ProductionOrder(Base):
    __tablename__ = "production_orders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=True  # NULL for make-to-stock
    )
    item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=False
    )
    quantity_to_produce: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    status: Mapped[ProductionStatus] = mapped_column(
        Enum(ProductionStatus), default=ProductionStatus.PLANNED
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    started_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)
    estimated_completion_at: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # Capacity Assignments
    assigned_employee_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("employees.id"), nullable=True
    )
    assigned_workstation_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("workstations.id"), nullable=True
    )

    # --- Relationships ---
    order = relationship("Order", back_populates="production_orders")
    item = relationship("Item", back_populates="production_orders")
    logs = relationship(
        "ProductionLog",
        back_populates="production_order",
        cascade="all, delete-orphan",
    )
    operations = relationship(
        "OperationLog",
        back_populates="production_order",
        cascade="all, delete-orphan",
        order_by="OperationLog.sequence"
    )
    assigned_employee = relationship(
        "Employee", 
        back_populates="production_assignments", 
        foreign_keys=[assigned_employee_id]
    )
    assigned_workstation = relationship("Workstation", back_populates="production_assignments")
    assigned_employees = relationship(
        "Employee", 
        back_populates="current_production", 
        foreign_keys="[Employee.current_production_id]"
    )

    def __repr__(self) -> str:
        return (
            f"<ProductionOrder(item_id={self.item_id}, "
            f"qty={self.quantity_to_produce}, status={self.status.value})>"
        )


class ProductionLog(Base):
    """Audit record: one row per material consumed in a production run."""

    __tablename__ = "production_logs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    production_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False
    )
    consumed_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id"), nullable=False
    )
    quantity_consumed: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    consumed_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # --- Relationships ---
    production_order = relationship("ProductionOrder", back_populates="logs")
    consumed_item = relationship("Item")
    lot_consumptions = relationship("LotConsumption", back_populates="production_log", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return (
            f"<ProductionLog(prod_order={self.production_order_id}, "
            f"item={self.consumed_item_id}, qty={self.quantity_consumed})>"
        )
