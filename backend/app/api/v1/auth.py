"""
Authentication API — Handles user registration, login, and protected info retrieval.
"""

from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.security import OAuth2PasswordRequestForm, OAuth2PasswordBearer
from sqlalchemy.orm import Session, joinedload

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/v1/auth/login")

from app.core.rate_limit import limiter

from app.core.deps import get_db, get_current_user
from app.core.security import verify_password, hash_password, create_access_token
from app.models.user import User, UserRole
from app.models.customer import Customer, CustomerSource
from app.models.order import Order, OrderItem
from app.models.invoice import Invoice
from app.models.waybill import Waybill
from app.schemas.auth import UserRegister, TokenResponse, UserProfile
from app.schemas.shipment import OrderWithShipmentInfo

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=TokenResponse)
@limiter.limit("3/minute")
def register_user(request: Request, data: UserRegister, db: Session = Depends(get_db)):
    """Create a new user account. Auto-links or creates a Customer record."""
    if db.query(User).filter(User.email == data.email).first():
        raise HTTPException(status_code=400, detail="Email already registered")

    # Check if a customer already exists with this email (guest checkout past)
    customer = db.query(Customer).filter(Customer.email == data.email).first()
    if not customer:
        customer = Customer(
            name=data.full_name,
            email=data.email,
            source=CustomerSource.ONLINE
        )
        db.add(customer)
        db.flush()

    user = User(
        email=data.email,
        hashed_password=hash_password(data.password),
        full_name=data.full_name,
        role=UserRole.CUSTOMER,
        customer_id=customer.id
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token, 
        "user": user
    }


@router.post("/login", response_model=TokenResponse)
@limiter.limit("10/minute")
def login(
    request: Request,
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """Authenticate user and return JWT."""
    user = db.query(User).filter(User.email == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password"
        )
    
    access_token = create_access_token(subject=user.id)
    return {
        "access_token": access_token, 
        "user": user
    }

@router.post("/logout")
def logout(token: str = Depends(oauth2_scheme)):
    """Invalidate current token by adding it to the blacklist."""
    from jose import jwt, JWTError
    from app.core.config import settings
    from app.core.token_blacklist import blacklist_token
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        jti = payload.get("jti")
        if jti:
            blacklist_token(jti)
        return {"success": True, "message": "Successfully logged out"}
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

@router.get("/me", response_model=UserProfile)
def get_me(current_user: User = Depends(get_current_user)):
    """Return the current authenticated user's profile."""
    return current_user


@router.get("/me/orders", response_model=list[OrderWithShipmentInfo])
def get_my_orders(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return order history for the current authenticated user."""
    if not current_user.customer_id:
        return []
    
    orders = (
        db.query(Order)
        .options(joinedload(Order.items).joinedload(OrderItem.item), joinedload(Order.shipment))
        .filter(Order.customer_id == current_user.customer_id)
        .order_by(Order.order_date.desc())
        .all()
    )

    # Attach item_count and items manually
    results = []
    for o in orders:
        items_list = [
            {
                "id": oi.id,
                "item_name": oi.item.name,
                "quantity": oi.quantity,
                "unit_price": float(oi.unit_price),
                "line_total": float(oi.line_total),
            }
            for oi in o.items
        ]
        results.append(OrderWithShipmentInfo(
            id=o.id,
            order_number=o.order_number,
            status=o.status.value,
            total_amount=float(o.total_amount),
            order_date=o.order_date,
            item_count=sum(i.quantity for i in o.items),
            shipment=o.shipment,
            items=items_list
        ))
    return results

@router.get("/me/invoices")
def get_my_invoices(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return invoices for the current authenticated user's orders."""
    if not current_user.customer_id:
        return []
    
    invoices = (
        db.query(Invoice)
        .join(Order, Invoice.order_id == Order.id)
        .filter(Order.customer_id == current_user.customer_id)
        .order_by(Invoice.issued_date.desc())
        .all()
    )
    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "order_id": inv.order_id,
            "status": inv.status.value,
            "subtotal": float(inv.subtotal),
            "tax_amount": float(inv.tax_amount),
            "total_amount": float(inv.total_amount),
            "issued_date": inv.issued_date.isoformat() if inv.issued_date else None,
        }
        for inv in invoices
    ]

@router.get("/me/waybills")
def get_my_waybills(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return waybills for the current authenticated user's orders."""
    if not current_user.customer_id:
        return []
    
    waybills = (
        db.query(Waybill)
        .join(Order, Waybill.order_id == Order.id)
        .filter(Order.customer_id == current_user.customer_id)
        .order_by(Waybill.issue_date.desc())
        .all()
    )
    return [
        {
            "id": wb.id,
            "waybill_number": wb.waybill_number,
            "order_id": wb.order_id,
            "status": wb.status.value,
            "order_number": wb.order.order_number if wb.order else None,
            "tracking_number": wb.shipment.tracking_number if wb.shipment else None,
            "issue_date": wb.issue_date.isoformat() if wb.issue_date else None,
        }
        for wb in waybills
    ]
