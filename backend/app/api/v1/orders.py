"""
Orders API — the gateway to the MRP engine.

POST /orders  →  creates an order and IMMEDIATELY runs MRP,
                 which may trigger a cascade of production orders.
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db
from app.models.order import Order, OrderStatus
from app.schemas.order import OrderCreate
from app.services.order_service import create_order
from app.services.mrp_service import InsufficientRawMaterialError, NoBOMDefinedError

router = APIRouter(prefix="/orders", tags=["Orders"])


@router.get("/")
def list_orders(
    status: str = None,
    db: Session = Depends(get_db),
):
    """List all orders with their line items."""
    query = db.query(Order).options(
        joinedload(Order.items),
        joinedload(Order.customer),
        joinedload(Order.shipment),
    )
    if status:
        query = query.filter(Order.status == OrderStatus(status))

    orders = query.order_by(Order.order_date.desc()).all()

    return [
        {
            "id": o.id,
            "order_number": o.order_number,
            "customer_name": o.customer.name,
            "customer_id": o.customer_id,
            "status": o.status.value,
            "source": o.source.value,
            "total_amount": float(o.total_amount),
            "order_date": o.order_date.isoformat() if o.order_date else None,
            "item_count": len(o.items),
            "items": [
                {
                    "id": oi.id,
                    "item_id": oi.item_id,
                    "item_name": oi.item.name,
                    "quantity": oi.quantity,
                    "unit_price": float(oi.unit_price),
                    "line_total": float(oi.line_total),
                }
                for oi in o.items
            ],
            "shipment": {
                "id": o.shipment.id,
                "status": o.shipment.status.value,
                "tracking_number": o.shipment.tracking_number,
            } if o.shipment else None,
        }
        for o in orders
    ]


@router.post("/", status_code=201)
def place_order(data: OrderCreate, db: Session = Depends(get_db)):
    """
    Place a new order.

    This is the **trigger** for the MRP engine:
    1. Validates customer and product availability
    2. Creates Order + OrderItems
    3. Checks finished-good stock
    4. If insufficient → recursively explodes BOM, consumes materials, produces items
    5. Returns the order + detailed MRP report

    The response includes exactly what materials were consumed and
    what items were produced, making the simulation transparent.
    """
    try:
        order, mrp_result = create_order(
            db=db,
            customer_id=data.customer_id,
            source=data.source,
            items=[item.model_dump() for item in data.items],
        )

        # Build response BEFORE commit (ORM objects still loaded)
        response = {
            "order": {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status.value,
                "total_amount": float(order.total_amount),
            },
            "mrp_result": mrp_result.to_dict(),
            "message": (
                "✅ Order fulfilled from existing stock"
                if not mrp_result.has_production
                else f"🏭 Order triggered {len(mrp_result.production_orders)} production order(s)"
            ),
        }

        db.commit()
        return response

    except InsufficientRawMaterialError as e:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail={
                "error": "insufficient_raw_material",
                "message": str(e),
                "item": e.item_name,
                "sku": e.sku,
                "needed": e.needed,
                "available": e.available,
            },
        )
    except NoBOMDefinedError as e:
        db.rollback()
        raise HTTPException(
            status_code=400,
            detail={"error": "no_bom_defined", "message": str(e)},
        )
    except ValueError as e:
        db.rollback()
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=f"Internal error: {str(e)}")


@router.get("/{order_id}")
def get_order(order_id: int, db: Session = Depends(get_db)):
    """Get full order details including production orders."""
    order = (
        db.query(Order)
        .options(
            joinedload(Order.items),
            joinedload(Order.customer),
            joinedload(Order.production_orders),
        )
        .get(order_id)
    )
    if not order:
        raise HTTPException(404, detail="Order not found")

    return {
        "id": order.id,
        "order_number": order.order_number,
        "customer": {"id": order.customer.id, "name": order.customer.name},
        "status": order.status.value,
        "source": order.source.value,
        "total_amount": float(order.total_amount),
        "order_date": order.order_date.isoformat() if order.order_date else None,
        "items": [
            {
                "id": oi.id,
                "item_name": oi.item.name,
                "quantity": oi.quantity,
                "unit_price": float(oi.unit_price),
                "line_total": float(oi.line_total),
            }
            for oi in order.items
        ],
        "production_orders": [
            {
                "id": po.id,
                "item_name": po.item.name,
                "quantity": float(po.quantity_to_produce),
                "status": po.status.value,
            }
            for po in order.production_orders
        ],
    }


@router.patch("/{order_id}/status")
def update_order_status(order_id: int, status: str, db: Session = Depends(get_db)):
    """Manually update an order's status."""
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, detail="Order not found")
    new_status = OrderStatus(status)
    if new_status == OrderStatus.CANCELLED and order.status != OrderStatus.CANCELLED:
        if order.status in [OrderStatus.SHIPPED, OrderStatus.DELIVERED]:
            raise HTTPException(400, "Cannot cancel an order that has already been shipped or delivered")
        # Release reservations
        for order_item in order.items:
            product = order_item.item
            product.reserved_quantity = max(0.0, float(product.reserved_quantity) - float(order_item.quantity))

    order.status = new_status
    db.commit()
    return {"id": order.id, "status": order.status.value}
