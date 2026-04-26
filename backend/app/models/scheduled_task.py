from enum import Enum as PyEnum
from sqlalchemy import Column, Integer, String, DateTime, Enum
from datetime import datetime

from app.db.base import Base

class TaskType(PyEnum):
    PRODUCTION_COMPLETE = "PRODUCTION_COMPLETE"
    OPERATION_COMPLETE = "OPERATION_COMPLETE"
    DELIVERY_TRANSIT = "DELIVERY_TRANSIT"
    DELIVERY_RECEIVED = "DELIVERY_RECEIVED"

class TaskStatus(PyEnum):
    PENDING = "PENDING"
    COMPLETED = "COMPLETED"
    FAILED = "FAILED"

class ScheduledTask(Base):
    __tablename__ = "scheduled_tasks"

    id = Column(Integer, primary_key=True, index=True)
    task_type = Column(Enum(TaskType), nullable=False)
    target_id = Column(Integer, nullable=False)  # ID of ProductionOrder or PurchaseOrder
    execute_at = Column(DateTime, nullable=False, index=True)
    status = Column(Enum(TaskStatus), default=TaskStatus.PENDING, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
