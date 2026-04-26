"""
Customer model — buyers from both Online and POS channels.
"""

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class CustomerSource(str, enum.Enum):
    ONLINE = "ONLINE"
    POS = "POS"


class Customer(Base):
    __tablename__ = "customers"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=True)
    phone: Mapped[str] = mapped_column(String(20), nullable=True)
    address: Mapped[str] = mapped_column(String(500), nullable=True)
    source: Mapped[CustomerSource] = mapped_column(
        Enum(CustomerSource), default=CustomerSource.ONLINE
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # --- Relationships ---
    orders = relationship("Order", back_populates="customer")

    def __repr__(self) -> str:
        return f"<Customer(name={self.name!r}, source={self.source.value})>"
