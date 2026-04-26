from sqlalchemy import Column, Integer, String, DateTime, Text, func
from sqlalchemy.orm import relationship

from app.db.base import Base

class JournalEntry(Base):
    __tablename__ = "journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    journal_number = Column(String(30), unique=True, nullable=False, index=True)
    transaction_date = Column(DateTime, server_default=func.now())
    description = Column(Text, nullable=False)
    reference_type = Column(String(30), nullable=True) # INVOICE | PURCHASE_ORDER | RMA
    reference_id = Column(Integer, nullable=True)

    entries = relationship("LedgerEntry", back_populates="journal_entry", cascade="all, delete-orphan")

    def __repr__(self) -> str:
        return f"<JournalEntry(number={self.journal_number}, ref={self.reference_type}-{self.reference_id})>"
