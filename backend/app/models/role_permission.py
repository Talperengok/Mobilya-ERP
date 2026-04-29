"""
Role Permission model — dynamic access control for roles.
"""

from sqlalchemy import String, Boolean, Enum, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base
from app.models.user import UserRole


class RolePermission(Base):
    __tablename__ = "role_permissions"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    role: Mapped[UserRole] = mapped_column(
        Enum(UserRole), nullable=False, index=True
    )
    module: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    can_view: Mapped[bool] = mapped_column(Boolean, default=True)

    def __repr__(self) -> str:
        return f"<RolePermission(role={self.role.value}, module={self.module}, can_view={self.can_view})>"
