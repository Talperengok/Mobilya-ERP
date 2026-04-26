"""
Customers API — simple CRUD for order creation support.
"""

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db
from app.models.customer import Customer, CustomerSource

router = APIRouter(prefix="/customers", tags=["Customers"])


class CustomerCreate(BaseModel):
    name: str
    email: Optional[str] = None
    phone: Optional[str] = None
    address: Optional[str] = None
    source: str = "ONLINE"


@router.get("/")
def list_customers(db: Session = Depends(get_db)):
    """List all customers."""
    customers = db.query(Customer).order_by(Customer.name).all()
    return [
        {
            "id": c.id,
            "name": c.name,
            "email": c.email,
            "phone": c.phone,
            "address": c.address,
            "source": c.source.value,
            "created_at": c.created_at.isoformat() if c.created_at else None,
        }
        for c in customers
    ]


@router.post("/", status_code=201)
def create_customer(data: CustomerCreate, db: Session = Depends(get_db)):
    """Create a new customer."""
    customer = Customer(
        name=data.name,
        email=data.email,
        phone=data.phone,
        address=data.address,
        source=CustomerSource(data.source),
    )
    db.add(customer)
    db.commit()
    db.refresh(customer)
    return {
        "id": customer.id,
        "name": customer.name,
        "message": "Customer created",
    }


@router.get("/{customer_id}")
def get_customer(customer_id: int, db: Session = Depends(get_db)):
    """Get a single customer with their order history."""
    customer = db.get(Customer, customer_id)
    if not customer:
        raise HTTPException(404, detail="Customer not found")
    
    return {
        "id": customer.id,
        "name": customer.name,
        "email": customer.email,
        "phone": customer.phone,
        "address": customer.address,
        "source": customer.source.value,
        "orders": [
            {
                "id": o.id,
                "order_number": o.order_number,
                "total_amount": float(o.total_amount),
                "status": o.status.value,
                "order_date": o.order_date.isoformat() if o.order_date else None,
            }
            for o in sorted(customer.orders, key=lambda x: x.order_date, reverse=True)
        ]
    }
