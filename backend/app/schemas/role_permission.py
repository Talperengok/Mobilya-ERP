from pydantic import BaseModel
from app.models.user import UserRole


class RolePermissionBase(BaseModel):
    module: str
    can_view: bool = True


class RolePermissionCreate(RolePermissionBase):
    role: UserRole


class RolePermissionUpdate(BaseModel):
    can_view: bool


class RolePermissionResponse(RolePermissionBase):
    id: int
    role: UserRole

    class Config:
        from_attributes = True


class BulkRolePermissionUpdate(BaseModel):
    role: UserRole
    permissions: list[RolePermissionBase]
