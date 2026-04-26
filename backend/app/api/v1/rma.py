"""
RMA API — manage return merchandise authorizations
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from pydantic import BaseModel

from app.core.deps import get_db, RequireRole
from app.models.rma import RMATicket, RMAStatus
from app.models.item import Item
from app.models.order import Order
from app.models.user import UserRole

router = APIRouter(prefix="/rma", tags=["RMA"])

class RMACreate(BaseModel):
    order_id: int
    defective_item_id: int
    issue_description: str


@router.get("/")
def list_rma_tickets(db: Session = Depends(get_db)):
    tickets = db.query(RMATicket).options(
        joinedload(RMATicket.order),
        joinedload(RMATicket.defective_item)
    ).order_by(RMATicket.created_at.desc()).all()
    
    return [
        {
            "id": t.id,
            "order_id": t.order_id,
            "order_number": t.order.order_number,
            "defective_item": t.defective_item.name,
            "sku": t.defective_item.sku,
            "issue_description": t.issue_description,
            "status": t.status.value,
            "created_at": t.created_at.isoformat() if t.created_at else None,
            "resolution_production_order_id": t.resolution_production_order_id
        }
        for t in tickets
    ]


@router.post("/", dependencies=[Depends(RequireRole([UserRole.SALES_REP, UserRole.ADMIN]))])
def submit_rma(data: RMACreate, db: Session = Depends(get_db)):
    order = db.get(Order, data.order_id)
    if not order:
        raise HTTPException(404, "Order not found")
        
    item = db.get(Item, data.defective_item_id)
    if not item:
        raise HTTPException(404, "Defective item not found")

    ticket = RMATicket(
        order_id=data.order_id,
        defective_item_id=data.defective_item_id,
        issue_description=data.issue_description,
        status=RMAStatus.SUBMITTED
    )
    db.add(ticket)
    db.commit()
    db.refresh(ticket)
    return {"id": ticket.id, "status": ticket.status.value}


@router.patch("/{ticket_id}/approve", dependencies=[Depends(RequireRole([UserRole.ADMIN]))])
def approve_rma(ticket_id: int, db: Session = Depends(get_db)):
    from app.services.rma_service import approve_rma_and_trigger_repair
    try:
        ticket, mrp_result = approve_rma_and_trigger_repair(db, ticket_id)
        return {
            "id": ticket.id,
            "status": ticket.status.value,
            "production_order_id": ticket.resolution_production_order_id,
            "mrp_result": mrp_result.to_dict()
        }
    except ValueError as e:
        raise HTTPException(400, str(e))


@router.patch("/{ticket_id}/reject", dependencies=[Depends(RequireRole([UserRole.ADMIN]))])
def reject_rma(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(RMATicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "RMA Ticket not found")
    if ticket.status != RMAStatus.SUBMITTED:
        raise HTTPException(400, "Only SUBMITTED tickets can be rejected")
        
    ticket.status = RMAStatus.REJECTED
    db.commit()
    return {"id": ticket.id, "status": ticket.status.value}


@router.patch("/{ticket_id}/resolve", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.FACTORY_MANAGER]))])
def resolve_rma(ticket_id: int, db: Session = Depends(get_db)):
    ticket = db.get(RMATicket, ticket_id)
    if not ticket:
        raise HTTPException(404, "RMA Ticket not found")
        
    from datetime import datetime
    ticket.status = RMAStatus.RESOLVED
    ticket.resolved_at = datetime.utcnow()
    db.commit()
    return {"id": ticket.id, "status": ticket.status.value}
