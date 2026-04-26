from sqlalchemy import Column, Integer, Numeric, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base

class LotConsumption(Base):
    __tablename__ = "lot_consumptions"

    id = Column(Integer, primary_key=True, index=True)
    stock_lot_id = Column(Integer, ForeignKey("stock_lots.id"), nullable=False)
    production_log_id = Column(Integer, ForeignKey("production_logs.id", ondelete="CASCADE"), nullable=False)
    quantity_consumed = Column(Numeric(12, 4), nullable=False)

    stock_lot = relationship("StockLot", back_populates="consumptions")
    production_log = relationship("ProductionLog", back_populates="lot_consumptions")

    def __repr__(self) -> str:
        return f"<LotConsumption(lot_id={self.stock_lot_id}, qty={self.quantity_consumed})>"
