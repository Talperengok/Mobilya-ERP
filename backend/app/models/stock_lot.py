from sqlalchemy import Column, Integer, String, Numeric, DateTime, ForeignKey, func
from sqlalchemy.orm import relationship

from app.db.base import Base

class StockLot(Base):
    __tablename__ = "stock_lots"

    id = Column(Integer, primary_key=True, index=True)
    item_id = Column(Integer, ForeignKey("items.id"), nullable=False, index=True)
    source_type = Column(String(20), nullable=False)  # PURCHASE | PRODUCTION | INITIAL
    source_id = Column(Integer, nullable=True)        # PO.id or ProductionOrder.id
    initial_quantity = Column(Numeric(12, 4), nullable=False)
    remaining_quantity = Column(Numeric(12, 4), nullable=False)
    unit_cost = Column(Numeric(12, 2), nullable=False)
    received_at = Column(DateTime, server_default=func.now(), index=True)

    # Relationships
    item = relationship("Item", back_populates="stock_lots")
    consumptions = relationship("LotConsumption", back_populates="stock_lot")

    def __repr__(self) -> str:
        return f"<StockLot(item_id={self.item_id}, source={self.source_type}, remaining={self.remaining_quantity})>"
