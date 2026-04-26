"""
Shipments API — manages logistics for fulfilled orders.

Protected by RBAC: only LOGISTICS_OFFICER and ADMIN can create/update shipments.
The tracking endpoint remains public for customer use.

Auto-generates Waybills (İrsaliye) when shipment status changes to SHIPPED.
"""

import uuid
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, RequireRole
from app.models.user import User, UserRole
from app.models.shipment import Shipment, ShipmentStatus
from app.models.order import Order, OrderStatus
from app.schemas.shipment import ShipmentCreate, ShipmentRead, ShipmentStatusUpdate

router = APIRouter(prefix="/shipments", tags=["Logistics"])

# ── Role shortcuts ──
_logistics = RequireRole([UserRole.LOGISTICS_OFFICER])
_logistics_or_sales = RequireRole([UserRole.LOGISTICS_OFFICER, UserRole.SALES_REP])


def generate_tracking_number() -> str:
    return f"TRK-{uuid.uuid4().hex[:6].upper()}"


@router.get("/", response_model=list[ShipmentRead])
def list_shipments(
    db: Session = Depends(get_db),
    _user: User = Depends(_logistics_or_sales),
):
    """List all shipments (for ERP dashboard). Requires LOGISTICS_OFFICER, SALES_REP, or ADMIN."""
    return db.query(Shipment).order_by(Shipment.created_at.desc()).all()


@router.post("/", response_model=ShipmentRead)
def create_shipment(
    data: ShipmentCreate,
    db: Session = Depends(get_db),
    _user: User = Depends(_logistics),
):
    """Convert a READY order into a PREPARING shipment. Requires LOGISTICS_OFFICER or ADMIN."""
    order = db.get(Order, data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
    
    if order.status != OrderStatus.READY:
        raise HTTPException(400, "Can only create shipment for READY orders")
    
    if order.shipment:
        # If a shipment already exists (e.g. was auto-created), update its courier and return it
        if data.courier_name:
            order.shipment.courier_name = data.courier_name
        db.commit()
        db.refresh(order.shipment)
        return order.shipment
    
    shipment = Shipment(
        order_id=order.id,
        tracking_number=generate_tracking_number(),
        courier_name=data.courier_name,
        status=ShipmentStatus.PREPARING
    )
    db.add(shipment)
    db.commit()
    db.refresh(shipment)
    return shipment


@router.get("/{tracking_number}", response_model=ShipmentRead)
def track_shipment(tracking_number: str, db: Session = Depends(get_db)):
    """Public endpoint to track an order status — no auth required. Supports TRK- or ORD- routing."""
    shipment = db.query(Shipment).filter(Shipment.tracking_number == tracking_number).first()
    
    if not shipment:
        order = db.query(Order).filter(Order.order_number == tracking_number).first()
        if order and order.shipment:
            shipment = order.shipment

    if not shipment:
        raise HTTPException(404, "Invalid tracking or order number")
    return shipment


@router.patch("/{shipment_id}/status", response_model=ShipmentRead)
def update_shipment_status(
    shipment_id: int,
    data: ShipmentStatusUpdate,
    db: Session = Depends(get_db),
    _user: User = Depends(_logistics),
):
    """Progress a shipment's lifecycle. Auto-generates Waybill on SHIPPED, Invoice on DELIVERED."""
    shipment = db.get(Shipment, shipment_id)
    if not shipment:
        raise HTTPException(404, "Shipment not found")
    
    shipment.status = ShipmentStatus(data.status)
    
    if hasattr(data, "courier_name") and data.courier_name is not None:
        shipment.courier_name = data.courier_name

    if data.estimated_delivery_date:
        shipment.estimated_delivery_date = data.estimated_delivery_date
    
    if shipment.status == ShipmentStatus.SHIPPED:
        if not shipment.courier_name:
            raise HTTPException(400, "Cannot mark shipment as SHIPPED without assigning a courier_name first.")
        if not shipment.shipped_at:
            shipment.shipped_at = datetime.utcnow()
            # Sync order status
            shipment.order.status = OrderStatus.SHIPPED

        # ── AUTO-GENERATE WAYBILL (İrsaliye) ──
        from app.services.finance_service import generate_waybill
        generate_waybill(db, shipment.order, shipment)
        
    if shipment.status == ShipmentStatus.DELIVERED and not shipment.delivered_at:
        shipment.delivered_at = datetime.utcnow()
        shipment.order.status = OrderStatus.DELIVERED

        # ── AUTO-RECORD REVENUE in ledger ──
        if shipment.order.invoice:
            from app.services.ledger_service import record_revenue
            record_revenue(db, shipment.order.invoice)
        
    db.commit()
    db.refresh(shipment)
    return shipment
