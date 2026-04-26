from sqlalchemy import Column, Integer, String, ForeignKey, Text, Enum
from sqlalchemy.orm import relationship

from app.db.base import Base
from app.models.workstation import WorkstationType

class BOMRouting(Base):
    __tablename__ = "bom_routings"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True)
    sequence = Column(Integer, nullable=False) # 10, 20, 30...
    operation_name = Column(String(100), nullable=False) # "Cutting", "Assembly"
    workstation_type = Column(Enum(WorkstationType), nullable=False)
    duration_seconds = Column(Integer, nullable=False, default=30)
    description = Column(Text, nullable=True)

    item = relationship("Item", back_populates="routings")

    def __repr__(self) -> str:
        return f"<BOMRouting(item={self.item_id}, seq={self.sequence}, op={self.operation_name})>"
