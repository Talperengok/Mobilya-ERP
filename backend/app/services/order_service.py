"""
Order Service — orchestrates order creation and MRP triggering.

Transaction boundary: this service flushes but does NOT commit.
The API layer handles commit/rollback.
"""

import uuid
from sqlalchemy.orm import Session
from fastapi import HTTPException

from app.models.item import Item, ItemType
from app.models.customer import Customer
from app.models.order import Order, OrderItem, OrderSource, OrderStatus
from app.models.shipment import Shipment, ShipmentStatus
from app.services.mrp_service import MRPService, MRPResult


def generate_order_number() -> str:
    """Generate a unique order number like ORD-A1B2C3D4."""
    return f"ORD-{uuid.uuid4().hex[:8].upper()}"


def create_order(
    db: Session,
    customer_id: int,
    source: str,
    items: list[dict],
) -> tuple[Order, MRPResult]:
    """
    Create a customer order and run MRP processing.

    Steps:
    1. Validate customer
    2. Validate all items are FINISHED_GOODs and calculate prices
    3. Create Order + OrderItems
    4. Run MRP engine (check stock → produce if needed)
    5. Auto-create SALES invoice with item-level VAT
    6. Auto-create Shipment
    7. Return order + MRP result (caller commits)
    """
    # ── 1. Validate customer
    customer = db.get(Customer, customer_id)
    if not customer:
        raise ValueError(f"Customer with id {customer_id} not found")

    # ── 2. Create order shell
    order = Order(
        order_number=generate_order_number(),
        customer_id=customer_id,
        source=OrderSource(source),
        status=OrderStatus.PENDING,
    )
    db.add(order)
    db.flush()  # Get order.id for FK references

    # ── 3. Add line items
    total_amount = 0.0
    for item_data in items:
        product = db.query(Item).filter(Item.id == item_data["item_id"]).with_for_update().first()
        if not product:
            raise ValueError(f"Item with id {item_data['item_id']} not found")
        if product.item_type != ItemType.FINISHED_GOOD:
            raise ValueError(
                f"Item '{product.name}' (type: {product.item_type.value}) "
                f"is not a FINISHED_GOOD. Only finished goods can be ordered."
            )

        unit_price = float(product.selling_price or product.unit_cost)
        quantity = item_data["quantity"]
        
        # ── Atomic Stock Validation Guard
        if quantity > product.available_stock:
            raise HTTPException(
                status_code=400,
                detail=f"Yetersiz stok. Mevcut satılabilir miktar: {product.available_stock}."
            )
        
        # Reserve stock immediately inside current transaction to prevent race conditions
        product.reserved_quantity = float(product.reserved_quantity) + quantity
        
        line_total = unit_price * quantity

        order_item = OrderItem(
            order_id=order.id,
            item_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            line_total=line_total,
        )
        db.add(order_item)
        total_amount += line_total

    order.total_amount = total_amount
    db.flush()

    # Reload order so .items relationship is populated
    db.refresh(order)

    # ── 4. Run MRP engine
    mrp = MRPService(db)
    result = mrp.process_order(order)

    # ── 5. Auto-create SALES invoice (using item-level VAT via finance_service)
    from app.services.finance_service import generate_sales_invoice
    generate_sales_invoice(db, order)

    # ── 6. Auto-create Shipment
    shipment = Shipment(
        order_id=order.id,
        tracking_number=f"TRK-{uuid.uuid4().hex[:6].upper()}",
        status=ShipmentStatus.PREPARING
    )
    db.add(shipment)
    db.flush()

    # flush is done inside MRP; caller will commit
    return order, result
