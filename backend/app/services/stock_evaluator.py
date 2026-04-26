"""
Stock Evaluator Service
=======================

Evaluates stock thresholds (`critical_stock_level`) and auto-generates 
DRAFT Purchase Orders or DRAFT Production Orders if stock is too low.
"""

from typing import Optional, Dict, Any
from datetime import datetime
from sqlalchemy.orm import Session

from app.models.item import Item, ItemType
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.production import ProductionOrder, ProductionStatus
from app.models.supplier import Supplier

def evaluate_stock_levels(db: Session, item_id: int) -> Optional[Dict[str, Any]]:
    """
    Checks if item's stock is below critical_stock_level.
    If so, checks if there is already an active DRAFT order replenishing it.
    If not, creates a DRAFT PurchaseOrder (for RAW_MATERIAL) 
    or DRAFT ProductionOrder (for FINISHED_GOOD/SUB_PRODUCT).
    
    Returns a dict describing the action taken, or None if no action.
    """
    item = db.get(Item, item_id)
    if not item or item.critical_stock_level <= 0:
        return None

    # We evaluate against "available" stock (stock - reserved) to ensure
    # true availability triggers replenishment (Available to Promise).
    available_stock = float(item.stock_quantity) - float(item.reserved_quantity)
    if available_stock > float(item.critical_stock_level):
        return None

    # Calculate quantity needed to reach target based on available stock
    target = float(item.target_stock_level)
    current = available_stock
    if target <= current:
        return None
    
    qty_to_order = target - current

    if item.item_type == ItemType.RAW_MATERIAL:
        # Prevent duplicate DRAFT/ORDERED purchase orders for same item
        existing_po = (
            db.query(PurchaseOrder)
            .filter(
                PurchaseOrder.item_id == item.id,
                PurchaseOrder.status.in_([PurchaseOrderStatus.DRAFT, PurchaseOrderStatus.ORDERED])
            )
            .first()
        )
        if existing_po:
            return None # Already replenishing
        
        # Pick first available supplier (this can be optimized to pick preferred supplier)
        supplier = db.query(Supplier).first()
        if not supplier:
            return None # Can't create PO without a supplier
        
        # Determine next PO Number
        po_count = db.query(PurchaseOrder).count()
        po_number = f"PO-{datetime.utcnow().strftime('%Y%m')}-{po_count + 1:04d}"
        
        po = PurchaseOrder(
            po_number=po_number,
            supplier_id=supplier.id,
            item_id=item.id,
            quantity=qty_to_order,
            unit_cost=item.unit_cost,
            total_cost=float(item.unit_cost) * qty_to_order,
            status=PurchaseOrderStatus.DRAFT,
            notes="Auto-generated: stock below critical level"
        )
        db.add(po)
        db.flush()
        
        return {
            "action": "CREATE_DRAFT_PO",
            "item_name": item.name,
            "quantity": qty_to_order,
            "po_id": po.id
        }
        
    elif item.item_type in [ItemType.FINISHED_GOOD, ItemType.SUB_PRODUCT]:
        # Prevent duplicate DRAFT/PLANNED production orders
        existing_prd = (
            db.query(ProductionOrder)
            .filter(
                ProductionOrder.item_id == item.id,
                ProductionOrder.status.in_([
                    ProductionStatus.DRAFT, 
                    ProductionStatus.PLANNED, 
                    ProductionStatus.WAITING_CAPACITY, 
                    ProductionStatus.IN_PROGRESS
                ])
            )
            .first()
        )
        if existing_prd:
            return None # Already replenishing
        
        prd = ProductionOrder(
            item_id=item.id,
            quantity_to_produce=qty_to_order,
            status=ProductionStatus.DRAFT
        )
        db.add(prd)
        db.flush()
        
        return {
            "action": "CREATE_DRAFT_PRODUCTION",
            "item_name": item.name,
            "quantity": qty_to_order,
            "production_id": prd.id
        }

    return None
