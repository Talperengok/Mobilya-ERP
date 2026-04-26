"""
Employee model — factory workforce for capacity planning.
"""

import enum
from datetime import datetime

from sqlalchemy import String, Boolean, DateTime, Enum, Integer, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class EmployeeRole(str, enum.Enum):
    ASSEMBLER = "ASSEMBLER"
    TECHNICIAN = "TECHNICIAN"
    PAINTER = "PAINTER"
    QUALITY_INSPECTOR = "QUALITY_INSPECTOR"


class EmployeeStatus(str, enum.Enum):
    AVAILABLE = "AVAILABLE"
    ON_LEAVE = "ON_LEAVE"
    BUSY = "BUSY"


class Employee(Base):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[EmployeeRole] = mapped_column(Enum(EmployeeRole), nullable=False)
    status: Mapped[EmployeeStatus] = mapped_column(Enum(EmployeeStatus), default=EmployeeStatus.AVAILABLE)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    
    current_production_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("production_orders.id", name="fk_employee_production_order"), nullable=True
    )

    # --- Relationships ---
    production_assignments = relationship(
        "ProductionOrder", 
        back_populates="assigned_employee", 
        foreign_keys="[ProductionOrder.assigned_employee_id]"
    )
    current_production = relationship(
        "ProductionOrder", 
        back_populates="assigned_employees", 
        foreign_keys=[current_production_id]
    )

    def __repr__(self) -> str:
        return f"<Employee(name={self.name!r}, role={self.role.value}, status={self.status.value})>"
