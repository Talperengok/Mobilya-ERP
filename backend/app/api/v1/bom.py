"""
BOM (Bill of Materials) API — manage product recipes and view BOM explosions.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db
from app.models.item import Item
from app.models.bom import BOMItem
from app.schemas.bom import BOMItemCreate, BOMItemUpdate
from app.services.mrp_service import MRPService

router = APIRouter(prefix="/bom", tags=["Bill of Materials"])


@router.get("/{parent_item_id}")
def get_bom(parent_item_id: int, db: Session = Depends(get_db)):
    """Get the BOM (recipe) for a given parent item."""
    item = db.get(Item, parent_item_id)
    if not item:
        raise HTTPException(404, detail="Parent item not found")

    bom_items = (
        db.query(BOMItem)
        .filter(BOMItem.parent_item_id == parent_item_id)
        .all()
    )
    return [
        {
            "id": b.id,
            "parent_item_id": b.parent_item_id,
            "child_item_id": b.child_item_id,
            "child_item_name": b.child_item.name,
            "child_item_sku": b.child_item.sku,
            "child_item_type": b.child_item.item_type.value,
            "child_item_unit": b.child_item.unit,
            "quantity": float(b.quantity),
            "notes": b.notes,
        }
        for b in bom_items
    ]


@router.post("/{parent_item_id}", status_code=201)
def add_bom_item(
    parent_item_id: int,
    data: BOMItemCreate,
    db: Session = Depends(get_db),
):
    """Add a component to a parent item's BOM."""
    parent = db.get(Item, parent_item_id)
    if not parent:
        raise HTTPException(404, detail="Parent item not found")

    child = db.get(Item, data.child_item_id)
    if not child:
        raise HTTPException(404, detail="Child item not found")

    if parent_item_id == data.child_item_id:
        raise HTTPException(400, detail="An item cannot be a component of itself")

    # Prevent duplicate entries
    existing = (
        db.query(BOMItem)
        .filter(
            BOMItem.parent_item_id == parent_item_id,
            BOMItem.child_item_id == data.child_item_id,
        )
        .first()
    )
    if existing:
        raise HTTPException(
            400, detail=f"'{child.name}' is already in the BOM for '{parent.name}'"
        )

    bom = BOMItem(
        parent_item_id=parent_item_id,
        child_item_id=data.child_item_id,
        quantity=data.quantity,
        notes=data.notes,
    )
    db.add(bom)
    db.commit()
    db.refresh(bom)
    return {
        "id": bom.id,
        "message": f"Added '{child.name}' ×{data.quantity} to BOM of '{parent.name}'",
    }


@router.put("/{bom_item_id}")
def update_bom_item(
    bom_item_id: int,
    data: BOMItemUpdate,
    db: Session = Depends(get_db),
):
    """Update a BOM entry's quantity or notes."""
    bom = db.get(BOMItem, bom_item_id)
    if not bom:
        raise HTTPException(404, detail="BOM item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(bom, key, value)
    db.commit()
    db.refresh(bom)
    return {"id": bom.id, "message": "BOM item updated"}


@router.delete("/{bom_item_id}", status_code=204)
def delete_bom_item(bom_item_id: int, db: Session = Depends(get_db)):
    """Remove a component from a BOM."""
    bom = db.get(BOMItem, bom_item_id)
    if not bom:
        raise HTTPException(404, detail="BOM item not found")
    db.delete(bom)
    db.commit()


@router.get("/{parent_item_id}/explode")
def explode_bom(
    parent_item_id: int,
    quantity: float = Query(1.0, gt=0, description="How many units to produce"),
    db: Session = Depends(get_db),
):
    """
    Recursive BOM explosion — shows the full material tree needed
    to produce `quantity` units of the given item.  Read-only.
    """
    mrp = MRPService(db)
    try:
        tree = mrp.explode_bom(parent_item_id, quantity)
    except ValueError as e:
        raise HTTPException(404, detail=str(e))
    return tree
