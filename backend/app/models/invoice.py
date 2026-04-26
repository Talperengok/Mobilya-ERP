"""
Invoice model — tracks billing documents for both Sales and Procurement.

Types:
  - SALES:    Generated when a customer order is placed/delivered
  - PURCHASE: Generated when a purchase order (raw materials) is received

Status lifecycle: DRAFT → ISSUED → PAID
"""

import enum
from datetime import datetime

from sqlalchemy import String, Numeric, DateTime, Enum, ForeignKey, Integer, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class InvoiceType(str, enum.Enum):
    SALES = "SALES"
    PURCHASE = "PURCHASE"


class InvoiceStatus(str, enum.Enum):
    DRAFT = "DRAFT"
    ISSUED = "ISSUED"
    PAID = "PAID"


class Invoice(Base):
    __tablename__ = "invoices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    invoice_number: Mapped[str] = mapped_column(
        String(30), unique=True, nullable=False, index=True
    )
    invoice_type: Mapped[InvoiceType] = mapped_column(
        Enum(InvoiceType), nullable=False, index=True
    )

    # Nullable FKs — SALES invoices reference orders, PURCHASE invoices reference POs
    order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("orders.id"), nullable=True
    )
    purchase_order_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("purchase_orders.id"), nullable=True
    )

    # Financial fields
    subtotal: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    tax_rate: Mapped[float] = mapped_column(Numeric(5, 4), default=0.20)  # 20% KDV
    tax_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)
    total_amount: Mapped[float] = mapped_column(Numeric(14, 2), nullable=False)

    status: Mapped[InvoiceStatus] = mapped_column(
        Enum(InvoiceStatus), default=InvoiceStatus.DRAFT
    )
    notes: Mapped[str] = mapped_column(Text, nullable=True)

    # Timestamps
    issued_date: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    paid_date: Mapped[datetime] = mapped_column(DateTime, nullable=True)

    # --- Relationships ---
    order = relationship("Order", back_populates="invoice")
    purchase_order = relationship("PurchaseOrder", back_populates="invoice")

    def __repr__(self) -> str:
        return f"<Invoice(number={self.invoice_number!r}, type={self.invoice_type.value}, status={self.status.value})>"
