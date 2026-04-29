from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.deps import get_db, get_current_user
from app.models.user import User, UserRole
from app.models.role_permission import RolePermission
from app.schemas.role_permission import RolePermissionResponse, BulkRolePermissionUpdate

router = APIRouter()


@router.get("/", response_model=list[RolePermissionResponse])
def get_permissions(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
    role: UserRole | None = None,
):
    """
    Get permissions. ADMIN can get permissions for any role (or all roles).
    Other users can only get their own role's permissions.
    """
    query = db.query(RolePermission)
    
    if current_user.role != UserRole.ADMIN:
        query = query.filter(RolePermission.role == current_user.role)
    elif role:
        query = query.filter(RolePermission.role == role)
        
    return query.all()


@router.put("/bulk", response_model=list[RolePermissionResponse])
def update_role_permissions(
    payload: BulkRolePermissionUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    Update permissions for a specific role in bulk.
    Only ADMIN can do this.
    """
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can manage permissions"
        )
        
    # Delete existing permissions for this role
    db.query(RolePermission).filter(RolePermission.role == payload.role).delete()
    
    # Insert new ones
    new_perms = []
    for p in payload.permissions:
        new_perm = RolePermission(
            role=payload.role,
            module=p.module,
            can_view=p.can_view
        )
        db.add(new_perm)
        new_perms.append(new_perm)
        
    db.commit()
    
    # Return updated permissions
    return db.query(RolePermission).filter(RolePermission.role == payload.role).all()
