"""
Items API — CRUD + stock adjustment.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from app.core.deps import get_db, RequireRole
from app.models.user import UserRole
from app.models.item import Item, ItemType
from app.schemas.item import ItemCreate, ItemUpdate, ItemRead, StockAdjustment, ThresholdUpdate
from app.services.stock_evaluator import evaluate_stock_levels

router = APIRouter(prefix="/items", tags=["Items"])


@router.get("/", response_model=list[ItemRead])
def list_items(
    item_type: Optional[str] = Query(None, description="Filter by RAW_MATERIAL, SUB_PRODUCT, or FINISHED_GOOD"),
    search: Optional[str] = Query(None, description="Search by name (case-insensitive)"),
    db: Session = Depends(get_db),
):
    """List all items with optional type filter and name search."""
    query = db.query(Item)
    if item_type:
        query = query.filter(Item.item_type == ItemType(item_type))
    if search:
        query = query.filter(Item.name.ilike(f"%{search}%"))
    return query.order_by(Item.item_type, Item.name).all()


@router.post("/", response_model=ItemRead, status_code=201)
def create_item(data: ItemCreate, db: Session = Depends(get_db)):
    """Create a new item (raw material, sub-product, or finished good)."""
    existing = db.query(Item).filter(Item.sku == data.sku).first()
    if existing:
        raise HTTPException(400, detail=f"Item with SKU '{data.sku}' already exists")

    item = Item(**data.model_dump())
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}")
def get_item_detail(item_id: int, db: Session = Depends(get_db)):
    """Get a single item with its BOM components and production routing."""
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, detail="Item not found")

    # Base item data
    result = {
        "id": item.id,
        "sku": item.sku,
        "name": item.name,
        "item_type": item.item_type.value,
        "unit": item.unit,
        "unit_cost": float(item.unit_cost),
        "selling_price": float(item.selling_price) if item.selling_price else None,
        "stock_quantity": float(item.stock_quantity),
        "reserved_quantity": float(item.reserved_quantity),
        "available_quantity": float(item.stock_quantity) - float(item.reserved_quantity),
        "critical_stock_level": float(item.critical_stock_level),
        "target_stock_level": float(item.target_stock_level),
    }

    # BOM children (direct components)
    from app.models.bom import BOMItem
    bom_items = db.query(BOMItem).filter(BOMItem.parent_item_id == item_id).all()
    result["bom"] = [
        {
            "id": b.id,
            "child_item_id": b.child_item_id,
            "child_item_name": b.child_item.name,
            "child_item_sku": b.child_item.sku,
            "child_item_type": b.child_item.item_type.value,
            "child_item_unit": b.child_item.unit,
            "quantity": float(b.quantity),
            "child_stock": float(b.child_item.stock_quantity),
        }
        for b in bom_items
    ]

    # BOM parents (which products use this item as a component)
    bom_parents = db.query(BOMItem).filter(BOMItem.child_item_id == item_id).all()
    result["used_in"] = [
        {
            "parent_item_id": b.parent_item_id,
            "parent_item_name": b.parent_item.name,
            "parent_item_sku": b.parent_item.sku,
            "parent_item_type": b.parent_item.item_type.value,
            "quantity": float(b.quantity),
        }
        for b in bom_parents
    ]

    # Production routing
    from app.models.bom_routing import BOMRouting
    routings = db.query(BOMRouting).filter(BOMRouting.item_id == item_id).order_by(BOMRouting.sequence).all()
    result["routing"] = [
        {
            "sequence": r.sequence,
            "operation_name": r.operation_name,
            "workstation_type": r.workstation_type.value,
            "duration_seconds": r.duration_seconds,
            "description": r.description,
        }
        for r in routings
    ]

    return result


@router.put("/{item_id}", response_model=ItemRead)
def update_item(item_id: int, data: ItemUpdate, db: Session = Depends(get_db)):
    """Update an existing item's mutable fields."""
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, detail="Item not found")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(item, key, value)
    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
def delete_item(item_id: int, db: Session = Depends(get_db)):
    """Delete an item (cascade removes BOM references)."""
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, detail="Item not found")
    db.delete(item)
    db.commit()


@router.patch("/{item_id}/thresholds")
def update_thresholds(
    item_id: int, 
    data: ThresholdUpdate, 
    db: Session = Depends(get_db),
    _=Depends(RequireRole([UserRole.FACTORY_MANAGER, UserRole.ADMIN]))
):
    """Update critical and target stock thresholds for an item."""
    item = db.get(Item, item_id)
    if not item:
        raise HTTPException(404, "Item not found")

    item.critical_stock_level = data.critical_stock_level
    item.target_stock_level = data.target_stock_level
    db.commit()
    
    # Check if this new threshold immediately triggers a re-order
    evaluate_stock_levels(db, item.id)
    db.commit()
    
    db.refresh(item)
    return {
        "id": item.id,
        "critical_stock_level": float(item.critical_stock_level),
        "target_stock_level": float(item.target_stock_level)
    }


@router.post("/adjust-stock")
def adjust_stock(data: StockAdjustment, db: Session = Depends(get_db)):
    """
    Manually adjust stock for an item.
    Positive quantity → add stock.  Negative → subtract stock.
    """
    item = db.get(Item, data.item_id)
    if not item:
        raise HTTPException(404, detail="Item not found")

    new_qty = float(item.stock_quantity) + data.quantity
    if new_qty < 0:
        raise HTTPException(
            400,
            detail=f"Cannot reduce stock below 0. Current: {float(item.stock_quantity):.4f}, "
            f"adjustment: {data.quantity:.4f}",
        )

    item.stock_quantity = new_qty
    db.commit()
    db.refresh(item)
    
    evaluate_stock_levels(db, item.id)
    db.commit()

    return {
        "item_id": item.id,
        "sku": item.sku,
        "name": item.name,
        "previous_stock": new_qty - data.quantity,
        "adjustment": data.quantity,
        "new_stock": float(item.stock_quantity),
        "reason": data.reason,
    }


@router.post("/evaluate-all")
def evaluate_all_stock(
    db: Session = Depends(get_db),
    _=Depends(RequireRole([UserRole.FACTORY_MANAGER, UserRole.ADMIN]))
):
    """Run MRP stock evaluator over all active items."""
    items = db.query(Item).all()
    count = 0
    for item in items:
        if item.is_critical:
            evaluate_stock_levels(db, item.id)
            count += 1
    db.commit()
    return {"message": "Evaluation complete", "evaluated_items": count}
