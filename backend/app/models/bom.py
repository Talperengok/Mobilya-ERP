"""
Bill of Materials (BOM) model.

Self-referencing join table on `items`:
  parent_item_id → the assembly / product being built
  child_item_id  → a component consumed during production
  quantity       → how many units of the child are needed per 1 unit of parent

Example:
  BOMItem(parent=DiningTable, child=PolishedTop, quantity=1)
  BOMItem(parent=DiningTable, child=MetalLeg,    quantity=4)
  BOMItem(parent=DiningTable, child=M6Screw,     quantity=16)
"""

from sqlalchemy import Integer, Numeric, String, ForeignKey
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class BOMItem(Base):
    __tablename__ = "bom_items"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    parent_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    child_item_id: Mapped[int] = mapped_column(
        Integer, ForeignKey("items.id", ondelete="CASCADE"), nullable=False, index=True
    )
    quantity: Mapped[float] = mapped_column(Numeric(12, 4), nullable=False)
    notes: Mapped[str] = mapped_column(String(255), nullable=True)

    # --- Relationships ---
    parent_item = relationship(
        "Item", foreign_keys=[parent_item_id], back_populates="bom_as_parent"
    )
    child_item = relationship(
        "Item", foreign_keys=[child_item_id], back_populates="bom_as_child"
    )

    def __repr__(self) -> str:
        return (
            f"<BOMItem(parent_id={self.parent_item_id}, "
            f"child_id={self.child_item_id}, qty={self.quantity})>"
        )
