from sqlalchemy.orm import Session
from app.models.user import UserRole
from app.models.role_permission import RolePermission

DEFAULT_PERMISSIONS = {
    UserRole.ADMIN: ["dashboard", "inventory", "orders", "customers", "production", "logistics", "rma", "hrm", "finance", "roles"],
    UserRole.FACTORY_MANAGER: ["dashboard", "inventory", "orders", "production", "hrm"],
    UserRole.LOGISTICS_OFFICER: ["dashboard", "orders", "logistics"],
    UserRole.SALES_REP: ["dashboard", "orders", "customers", "rma", "finance"],
    UserRole.CUSTOMER: ["storefront"],
}

def seed_default_permissions(db: Session):
    """
    Seed default permissions into the database if none exist for a given role.
    """
    for role, modules in DEFAULT_PERMISSIONS.items():
        # Check if this role already has permissions
        existing_count = db.query(RolePermission).filter(RolePermission.role == role).count()
        if existing_count == 0:
            for module in modules:
                new_perm = RolePermission(role=role, module=module, can_view=True)
                db.add(new_perm)
    
    db.commit()
