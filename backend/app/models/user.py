"""
User model — authentication for B2C Storefront customers.

Links to the existing Customer model via optional FK so that
order history is preserved when a guest customer registers.
"""

import enum
from datetime import datetime

from sqlalchemy import String, DateTime, Enum, ForeignKey, Integer, Boolean, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class UserRole(str, enum.Enum):
    CUSTOMER = "CUSTOMER"
    ADMIN = "ADMIN"
    FACTORY_MANAGER = "FACTORY_MANAGER"
    LOGISTICS_OFFICER = "LOGISTICS_OFFICER"
    SALES_REP = "SALES_REP"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    email: Mapped[str] = mapped_column(
        String(255), unique=True, nullable=False, index=True
    )
    hashed_password: Mapped[str] = mapped_column(String(255), nullable=False)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), default=UserRole.CUSTOMER
    )
    customer_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("customers.id"), nullable=True
    )
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())

    # --- Relationships ---
    customer = relationship("Customer", backref="user")

    def __repr__(self) -> str:
        return f"<User(email={self.email!r}, role={self.role.value})>"
