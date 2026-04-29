"""
Unified Item model — the core of the 'Single Items Table' strategy.

Instead of separate Materials / Products tables, every inventory entity
lives here with an `item_type` discriminator:
  - RAW_MATERIAL  → purchased inputs (wood, screws, varnish)
  - SUB_PRODUCT   → manufactured intermediates (polished table top, metal leg)
  - FINISHED_GOOD → sellable end-products (dining table, office chair)

Stock is tracked directly on the item to keep queries simple.
"""

import enum
from typing import Optional
from datetime import datetime

from sqlalchemy import String, Numeric, Boolean, DateTime, Enum, Integer, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.ext.hybrid import hybrid_property

from app.db.base import Base


class ItemType(str, enum.Enum):
    RAW_MATERIAL = "RAW_MATERIAL"
    SUB_PRODUCT = "SUB_PRODUCT"
    FINISHED_GOOD = "FINISHED_GOOD"


class Item(Base):
    __tablename__ = "items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    sku: Mapped[str] = mapped_column(String(50), unique=True, nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    item_type: Mapped[ItemType] = mapped_column(Enum(ItemType), nullable=False, index=True)
    unit: Mapped[str] = mapped_column(String(20), nullable=False)  # pcs, kg, m², liters
    unit_cost: Mapped[float] = mapped_column(Numeric(12, 2), default=0, nullable=False)
    selling_price: Mapped[float] = mapped_column(Numeric(12, 2), nullable=True)  # Only for FINISHED_GOOD
    vat_rate: Mapped[float] = mapped_column(Numeric(5, 2), default=20.0, nullable=False, server_default="20.00")  # KDV %
    image_url: Mapped[Optional[str]] = mapped_column(String(512), nullable=True)  # Product photography URL

    # --- Stock fields (tracked directly on the item) ---
    stock_quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=0, nullable=False)
    reserved_quantity: Mapped[float] = mapped_column(Numeric(12, 4), default=0, nullable=False)
    critical_stock_level: Mapped[float] = mapped_column(Numeric(12, 4), default=0, nullable=False)
    target_stock_level: Mapped[float] = mapped_column(Numeric(12, 4), default=0, nullable=False)
    base_production_time_seconds: Mapped[int] = mapped_column(Integer, default=40, nullable=False, server_default="40")

    # --- Timestamps ---
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, server_default=func.now(), onupdate=func.now()
    )

    # --- Relationships ---
    # BOM: items this item is made FROM (this item is the parent/assembly)
    bom_as_parent = relationship(
        "BOMItem",
        foreign_keys="BOMItem.parent_item_id",
        back_populates="parent_item",
        cascade="all, delete-orphan",
    )
    # BOM: items that USE this item as a component
    bom_as_child = relationship(
        "BOMItem",
        foreign_keys="BOMItem.child_item_id",
        back_populates="child_item",
    )

    order_items = relationship("OrderItem", back_populates="item")
    production_orders = relationship("ProductionOrder", back_populates="item")
    stock_lots = relationship("StockLot", back_populates="item", cascade="all, delete-orphan")
    routings = relationship("BOMRouting", back_populates="item", cascade="all, delete-orphan")

    @hybrid_property
    def available_stock(self) -> float:
        """Stock available for new orders (not reserved)."""
        return float(self.stock_quantity) - float(self.reserved_quantity)

    @hybrid_property
    def is_critical(self) -> bool:
        """True if available stock is at or below critical level."""
        return self.critical_stock_level > 0 and self.available_stock <= float(self.critical_stock_level)

    def __repr__(self) -> str:
        return f"<Item(sku={self.sku!r}, name={self.name!r}, type={self.item_type.value})>"
