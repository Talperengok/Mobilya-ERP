"""
Storefront API — dedicated endpoints for the B2C e-commerce frontend.

Provides a single /checkout endpoint that handles:
  1. Guest customer creation (or lookup by email)
  2. Order placement → MRP trigger
  3. Invoice generation
All in one API call — optimized for the B2C checkout flow.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.rate_limit import limiter

from app.core.deps import get_db
from app.models.item import Item, ItemType
from app.models.customer import Customer, CustomerSource
from app.services.order_service import create_order
from app.services.mrp_service import InsufficientRawMaterialError, NoBOMDefinedError

router = APIRouter(prefix="/storefront", tags=["Storefront"])


# ── Schemas ──


class CheckoutItem(BaseModel):
    item_id: int
    quantity: int


class CheckoutRequest(BaseModel):
    customer_name: str
    customer_email: str
    customer_phone: str
    customer_address: str
    items: list[CheckoutItem]


# ── Endpoints ──


@router.get("/catalog")
@limiter.limit("60/minute")
def get_catalog(request: Request, db: Session = Depends(get_db)):
    """Return only FINISHED_GOODs for the storefront product catalog."""
    products = (
        db.query(Item)
        .filter(Item.item_type == ItemType.FINISHED_GOOD)
        .filter(Item.selling_price.isnot(None))
        .order_by(Item.name)
        .all()
    )
    return [
        {
            "id": p.id,
            "sku": p.sku,
            "name": p.name,
            "category": "Furniture",
            "selling_price": float(p.selling_price),
            "unit_cost": float(p.unit_cost),
            "stock_quantity": round(float(p.stock_quantity), 0),
            "available_stock": round(float(p.available_stock), 0),
            "available": float(p.available_stock) > 0,
            "image_url": p.image_url,
        }
        for p in products
    ]


@router.get("/catalog/{item_id}")
@limiter.limit("60/minute")
def get_product_detail(request: Request, item_id: int, db: Session = Depends(get_db)):
    """Get product detail for the storefront."""
    product = db.get(Item, item_id)
    if not product or product.item_type != ItemType.FINISHED_GOOD:
        raise HTTPException(404, detail="Product not found")

    return {
        "id": product.id,
        "sku": product.sku,
        "name": product.name,
        "category": "Furniture",
        "selling_price": float(product.selling_price or product.unit_cost),
        "unit_cost": float(product.unit_cost),
        "stock_quantity": round(float(product.stock_quantity), 0),
        "available_stock": round(float(product.available_stock), 0),
        "available": float(product.available_stock) > 0,
        "unit": product.unit,
        "image_url": product.image_url,
    }


@router.post("/checkout")
@limiter.limit("5/minute")
def checkout(request: Request, data: CheckoutRequest, db: Session = Depends(get_db)):
    """
    Single-call B2C checkout:
    1. Find or create customer by email
    2. Place order → triggers MRP engine
    3. Returns order confirmation + invoice + MRP details
    """
    if not data.customer_phone.strip():
        raise HTTPException(status_code=400, detail="Phone number is required")
    if not data.customer_address.strip():
        raise HTTPException(status_code=400, detail="Address is required")

    try:
        # ── 1. Find or create customer
        customer = db.query(Customer).filter(Customer.email == data.customer_email).first()
        if not customer:
            customer = Customer(
                name=data.customer_name,
                email=data.customer_email,
                phone=data.customer_phone,
                address=data.customer_address,
                source=CustomerSource.ONLINE,
            )
            db.add(customer)
            db.flush()

        # ── 2. Place order (triggers MRP + creates invoice inside order_service)
        order, mrp_result = create_order(
            db=db,
            customer_id=customer.id,
            source="ONLINE",
            items=[item.model_dump() for item in data.items],
        )

        # ── 3. Build response
        invoice_data = None
        if order.invoice:
            invoice_data = {
                "invoice_number": order.invoice.invoice_number,
                "subtotal": float(order.invoice.subtotal),
                "tax_amount": float(order.invoice.tax_amount),
                "total_amount": float(order.invoice.total_amount),
                "status": order.invoice.status.value,
            }

        response = {
            "success": True,
            "order": {
                "id": order.id,
                "order_number": order.order_number,
                "status": order.status.value,
                "total_amount": float(order.total_amount),
            },
            "invoice": invoice_data,
            "mrp_summary": {
                "production_triggered": mrp_result.has_production,
                "production_orders": len(mrp_result.production_orders),
                "materials_consumed": len(mrp_result.consumption_log),
                "purchase_orders_created": len(mrp_result.purchase_orders_created),
            },
            "message": (
                "Order placed successfully! Your furniture will be ready soon."
                if mrp_result.has_production
                else "Order confirmed! All items are in stock."
            ),
        }

        db.commit()
        return response

    except InsufficientRawMaterialError as e:
        db.rollback()
        raise HTTPException(
            status_code=422,
            detail={"error": "out_of_stock", "message": f"Sorry, we cannot fulfill this order: {e.item_name} is currently unavailable."},
        )
    except NoBOMDefinedError as e:
        db.rollback()
        raise HTTPException(400, detail={"error": "configuration_error", "message": str(e)})
    except ValueError as e:
        db.rollback()
        raise HTTPException(400, detail=str(e))
    except Exception as e:
        db.rollback()
        raise HTTPException(500, detail=f"Checkout failed: {str(e)}")
