import enum
from sqlalchemy import Column, Integer, String, DateTime, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base

class OperationStatus(str, enum.Enum):
    PENDING = "PENDING"
    IN_PROGRESS = "IN_PROGRESS"
    COMPLETED = "COMPLETED"

class OperationLog(Base):
    __tablename__ = "operation_logs"

    id = Column(Integer, primary_key=True, index=True)
    production_order_id = Column(Integer, ForeignKey("production_orders.id", ondelete="CASCADE"), nullable=False)
    routing_id = Column(Integer, ForeignKey("bom_routings.id"), nullable=False)
    sequence = Column(Integer, nullable=False)
    operation_name = Column(String(100), nullable=False)
    status = Column(Enum(OperationStatus), default=OperationStatus.PENDING)
    assigned_employee_id = Column(Integer, ForeignKey("employees.id"), nullable=True)
    assigned_workstation_id = Column(Integer, ForeignKey("workstations.id"), nullable=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    production_order = relationship("ProductionOrder", back_populates="operations")
    routing = relationship("BOMRouting")
    assigned_employee = relationship("Employee")
    assigned_workstation = relationship("Workstation")

    def __repr__(self) -> str:
        return f"<OperationLog(po={self.production_order_id}, seq={self.sequence}, status={self.status.value})>"
