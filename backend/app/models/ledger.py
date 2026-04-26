"""
Ledger Entry model — Double-Entry Bookkeeping for finances.
"""

import enum
from sqlalchemy import Column, Integer, String, Numeric, Enum, ForeignKey
from sqlalchemy.orm import relationship

from app.db.base import Base

class AccountType(str, enum.Enum):
    REVENUE = "REVENUE"
    EXPENSE = "EXPENSE"
    ASSET = "ASSET"
    LIABILITY = "LIABILITY"
    EQUITY = "EQUITY"

class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    journal_entry_id = Column(Integer, ForeignKey("journal_entries.id"), nullable=False, index=True)
    account_code = Column(String(10), nullable=False, index=True)
    account_name = Column(String(100), nullable=False)
    account_type = Column(Enum(AccountType), nullable=False)
    debit_amount = Column(Numeric(14, 2), default=0, nullable=False)
    credit_amount = Column(Numeric(14, 2), default=0, nullable=False)

    journal_entry = relationship("JournalEntry", back_populates="entries")

    def __repr__(self) -> str:
        return f"<LedgerEntry(account={self.account_code}, DR={self.debit_amount}, CR={self.credit_amount})>"
