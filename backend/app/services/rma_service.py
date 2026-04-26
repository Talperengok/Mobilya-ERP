"""
RMA Service — handles the lifecycle of Returns and targeted Repairs.
"""
from sqlalchemy.orm import Session
from app.models.rma import RMATicket, RMAStatus
from app.models.item import Item
from app.models.order import Order
from app.services.mrp_service import MRPService


def approve_rma_and_trigger_repair(db: Session, rma_id: int):
    """
    Approves an RMA ticket and specifically triggers production for the single defective component.
    """
    rma = db.get(RMATicket, rma_id)
    if not rma:
        raise ValueError(f"RMATicket with ID {rma_id} not found.")
    
    if rma.status != RMAStatus.SUBMITTED:
        raise ValueError("Only SUBMITTED tickets can be approved.")

    # Mark as approved and in progress
    rma.status = RMAStatus.REPAIR_IN_PROGRESS
    
    # We use MRPService but directly call `_produce_item` to target just this item
    # because `process_order` only accepts FINISHED_GOODs. RMA targets parts.
    mrp = MRPService(db)
    
    # We must construct a dummy MRPResult to capture the output logs
    from app.services.mrp_service import MRPResult
    result = MRPResult()

    # Produce ONE unit of the defective part
    mrp._produce_item(
        item=rma.defective_item,
        quantity=1.0,
        order_id=rma.order_id, # Link it back to the customer's order visually
        result=result,
        depth=0
    )

    # Note: _produce_item flushes automatically, so the ProductionOrder is generated.
    # We grab the first production order created as the primary resolution driver.
    if result.production_orders:
        rma.resolution_production_order_id = result.production_orders[0].id

    db.commit()
    db.refresh(rma)
    return rma, result

