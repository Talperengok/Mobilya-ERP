"""
Workstation model — factory machines/benches for capacity planning.
"""

import enum

from sqlalchemy import String, Boolean, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.base import Base


class WorkstationType(str, enum.Enum):
    ASSEMBLY = "ASSEMBLY"
    CNC = "CNC"
    FINISHING = "FINISHING"
    WELDING = "WELDING"


class Workstation(Base):
    __tablename__ = "workstations"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    station_type: Mapped[WorkstationType] = mapped_column(Enum(WorkstationType), nullable=False)
    is_available: Mapped[bool] = mapped_column(Boolean, default=True)

    # --- Relationships ---
    production_assignments = relationship("ProductionOrder", back_populates="assigned_workstation")

    def __repr__(self) -> str:
        return f"<Workstation(name={self.name!r}, type={self.station_type.value}, available={self.is_available})>"
