"""
Production Orders API — view manufacturing history and material consumption.
"""

from pydantic import BaseModel
from typing import List, Optional
import asyncio
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db, RequireRole
from app.db.session import SessionLocal
from app.models.user import UserRole
from app.models.item import Item, ItemType
from app.models.production import ProductionOrder, ProductionLog, ProductionStatus
from app.models.employee import Employee, EmployeeStatus
from app.models.workstation import Workstation
from app.models.bom import BOMItem
from app.models.order import Order, OrderStatus

router = APIRouter(prefix="/production", tags=["Production"])

BASE_PRODUCTION_TIME = 40  # seconds — default base time for simulation


def _utc_iso(dt):
    """Convert a naive-UTC datetime to an ISO string with 'Z' suffix for correct JS parsing."""
    if dt is None:
        return None
    return dt.isoformat() + "Z"


class ProductionOrderCreate(BaseModel):
    item_id: int
    quantity: float

class ProductionOrderStart(BaseModel):
    employee_ids: List[int]
    workstation_id: Optional[int] = None


# simulate_production has been moved to task_scheduler loop and ScheduledTask DB queue for crash-safety


@router.get("/")
def list_production_orders(
    status: str = None,
    db: Session = Depends(get_db),
):
    """List all production orders with their consumption logs."""
    query = db.query(ProductionOrder).options(
        joinedload(ProductionOrder.item),
        joinedload(ProductionOrder.logs).joinedload(ProductionLog.consumed_item),
        joinedload(ProductionOrder.assigned_workstation),
    )
    if status:
        query = query.filter(ProductionOrder.status == ProductionStatus(status))

    orders = query.order_by(ProductionOrder.created_at.desc()).all()

    return [
        {
            "id": po.id,
            "order_id": po.order_id,
            "item_id": po.item_id,
            "item_name": po.item.name,
            "item_sku": po.item.sku,
            "quantity_to_produce": float(po.quantity_to_produce),
            "status": po.status.value,
            "created_at": _utc_iso(po.created_at),
            "started_at": _utc_iso(po.started_at),
            "completed_at": _utc_iso(po.completed_at),
            "estimated_completion_at": _utc_iso(po.estimated_completion_at),
            "assigned_workstation": {
                "id": po.assigned_workstation.id,
                "name": po.assigned_workstation.name,
                "station_type": po.assigned_workstation.station_type.value,
            } if po.assigned_workstation else None,
            "worker_count": len(po.assigned_employees) if po.assigned_employees else 0,
            "materials_consumed": [
                {
                    "id": log.id,
                    "material_name": log.consumed_item.name,
                    "material_sku": log.consumed_item.sku,
                    "quantity": float(log.quantity_consumed),
                    "unit": log.consumed_item.unit,
                }
                for log in po.logs
            ],
        }
        for po in orders
    ]


@router.post("/")
def create_production_order(
    data: ProductionOrderCreate,
    db: Session = Depends(get_db),
    _=Depends(RequireRole([UserRole.FACTORY_MANAGER, UserRole.ADMIN]))
):
    """Manually create a DRAFT production order (Finished Goods/Sub Products only)."""
    item = db.get(Item, data.item_id)
    if not item:
        raise HTTPException(404, "Item not found")
    if item.item_type == ItemType.RAW_MATERIAL:
        raise HTTPException(400, "Cannot produce RAW_MATERIAL items.")
    
    po = ProductionOrder(
        item_id=data.item_id,
        quantity_to_produce=data.quantity,
        status=ProductionStatus.DRAFT
    )
    db.add(po)
    db.commit()
    db.refresh(po)
    return {
        "id": po.id,
        "status": po.status.value
    }


@router.patch("/{production_order_id}/approve")
def approve_production_order(
    production_order_id: int, 
    db: Session = Depends(get_db),
    _=Depends(RequireRole([UserRole.FACTORY_MANAGER, UserRole.ADMIN]))
):
    """Approve a DRAFT production order, changing its status to PLANNED."""
    po = db.get(ProductionOrder, production_order_id)
    if not po:
        raise HTTPException(404, "Production order not found")
    if po.status != ProductionStatus.DRAFT:
        raise HTTPException(400, f"Cannot approve production order in status: {po.status.value}")
    
    po.status = ProductionStatus.PLANNED
    db.commit()
    return {"id": po.id, "status": po.status.value}


@router.post("/{production_order_id}/start")
def start_production_order(
    production_order_id: int, 
    data: ProductionOrderStart,
    background_tasks: BackgroundTasks,
    db: Session = Depends(get_db),
    _=Depends(RequireRole([UserRole.FACTORY_MANAGER, UserRole.ADMIN]))
):
    """Assigns employees + workstation, consumes components, and triggers production simulation.
    
    Dynamic speed: base_time / num_workers. More workers = faster production.
    """
    po = db.get(ProductionOrder, production_order_id)
    if not po:
        raise HTTPException(404, "Production order not found")
    if po.status != ProductionStatus.PLANNED:
        raise HTTPException(400, f"Order status is {po.status.value}, expected PLANNED")

    # Validate and assign workstation
    if data.workstation_id:
        ws = db.query(Workstation).filter(Workstation.id == data.workstation_id).with_for_update().first()
        if not ws:
            raise HTTPException(400, "Workstation not found")
        if not ws.is_available:
            raise HTTPException(400, f"Workstation '{ws.name}' is not available")
        ws.is_available = False
        po.assigned_workstation_id = ws.id

    # Validate employees
    employees = db.query(Employee).filter(Employee.id.in_(data.employee_ids)).with_for_update().all()
    if len(employees) != len(data.employee_ids):
        raise HTTPException(400, "One or more provided employee IDs are invalid.")
    
    for emp in employees:
        if emp.status != EmployeeStatus.AVAILABLE:
            raise HTTPException(400, f"Employee {emp.name} is not available (Status: {emp.status.value})")

    # Set employees to busy
    for emp in employees:
        emp.status = EmployeeStatus.BUSY
        emp.current_production_id = po.id
    
    # Dynamic time calculation: base_time / num_workers (min 5s)
    num_workers = max(1, len(employees))
    base_time = getattr(po.item, 'base_production_time_seconds', None) or BASE_PRODUCTION_TIME
    actual_duration = max(5, int(base_time / num_workers))
        
    po.status = ProductionStatus.IN_PROGRESS
    po.started_at = datetime.utcnow()
    po.estimated_completion_at = datetime.utcnow() + timedelta(seconds=actual_duration)

    # Consume raw materials (1-level BOM deduction with FIFO Lot Tracking)
    from app.services.mrp_service import MRPService
    mrp_svc = MRPService(db)

    bom_items = db.query(BOMItem).filter(BOMItem.parent_item_id == po.item_id).all()
    if not bom_items:
        raise HTTPException(400, "Cannot start production: Item has no Bill of Materials.")
        
    for bom in bom_items:
        child = bom.child_item
        required_qty = float(bom.quantity) * float(po.quantity_to_produce)
        
        # 1. Log consumption (Header)
        log = ProductionLog(
            production_order_id=po.id,
            consumed_item_id=child.id,
            quantity_consumed=required_qty,
        )
        db.add(log)
        db.flush() # Get log.id for lot entries

        # 2. FIFO Consumption (with LotTracking)
        try:
            mrp_svc._consume_fifo(child, required_qty, log)
        except Exception as e:
            # If FIFO fails (not enough stock), we can still JIT-auto-fulfill for demonstration purposes if needed,
            # but ideally we should raise 400. In our earlier code we had a JIT-auto-fulfillment block.
            # For Phase 5, we should be stricter.
            raise HTTPException(400, detail=str(e))

    db.commit()

    # Initialize Operations from BOMRouting
    from app.models.bom_routing import BOMRouting
    from app.models.operation_log import OperationLog, OperationStatus
    routings = db.query(BOMRouting).filter(BOMRouting.item_id == po.item_id).order_by(BOMRouting.sequence).all()

    from app.models.scheduled_task import ScheduledTask, TaskType
    
    if routings:
        # Create OperationLogs
        ops = []
        for r in routings:
            op = OperationLog(
                production_order_id=po.id,
                routing_id=r.id,
                sequence=r.sequence,
                operation_name=r.operation_name,
                status=OperationStatus.PENDING,
            )
            db.add(op)
            ops.append(op)
        db.flush()

        # Start the first operation with the assigned workstation and first employee
        first_op = ops[0]
        first_op.status = OperationStatus.IN_PROGRESS
        first_op.started_at = datetime.utcnow()
        if data.workstation_id:
            first_op.assigned_workstation_id = data.workstation_id
        if data.employee_ids:
            first_op.assigned_employee_id = data.employee_ids[0]
            
        po.estimated_completion_at = datetime.utcnow() + timedelta(seconds=routings[-1].duration_seconds * len(routings))

        # Trigger first OPERATION_COMPLETE task
        task = ScheduledTask(
            task_type=TaskType.OPERATION_COMPLETE,
            target_id=first_op.id,
            execute_at=datetime.utcnow() + timedelta(seconds=routings[0].duration_seconds)
        )
        db.add(task)
    else:
        # Fallback to simple 1-step completion
        task = ScheduledTask(
            task_type=TaskType.PRODUCTION_COMPLETE,
            target_id=po.id,
            execute_at=po.estimated_completion_at
        )
        db.add(task)

    db.commit()
    return {
        "id": po.id, 
        "status": po.status.value,
        "duration_seconds": actual_duration,
        "worker_count": num_workers,
    }


@router.get("/{production_order_id}")
def get_production_order(production_order_id: int, db: Session = Depends(get_db)):
    """Get a single production order with full details."""
    po = (
        db.query(ProductionOrder)
        .options(
            joinedload(ProductionOrder.item),
            joinedload(ProductionOrder.order),
            joinedload(ProductionOrder.logs).joinedload(ProductionLog.consumed_item),
            joinedload(ProductionOrder.assigned_workstation),
        )
        .get(production_order_id)
    )
    if not po:
        raise HTTPException(404, detail="Production order not found")

    return {
        "id": po.id,
        "order_id": po.order_id,
        "order_number": po.order.order_number if po.order else None,
        "item_name": po.item.name,
        "item_sku": po.item.sku,
        "quantity_to_produce": float(po.quantity_to_produce),
        "status": po.status.value,
        "created_at": _utc_iso(po.created_at),
        "started_at": _utc_iso(po.started_at),
        "completed_at": _utc_iso(po.completed_at),
        "estimated_completion_at": _utc_iso(po.estimated_completion_at),
        "assigned_workstation": {
            "id": po.assigned_workstation.id,
            "name": po.assigned_workstation.name,
            "station_type": po.assigned_workstation.station_type.value,
        } if po.assigned_workstation else None,
        "materials_consumed": [
            {
                "id": log.id,
                "material_name": log.consumed_item.name,
                "material_sku": log.consumed_item.sku,
                "quantity": float(log.quantity_consumed),
                "unit": log.consumed_item.unit,
                "consumed_at": _utc_iso(log.consumed_at),
            }
            for log in po.logs
        ],
    }

@router.get("/{production_order_id}/operations")
def get_production_operations(production_order_id: int, db: Session = Depends(get_db)):
    """Get the multi-step operations for a production order."""
    from app.models.operation_log import OperationLog
    ops = (
        db.query(OperationLog)
        .options(
            joinedload(OperationLog.assigned_employee),
            joinedload(OperationLog.assigned_workstation),
        )
        .filter(OperationLog.production_order_id == production_order_id)
        .order_by(OperationLog.sequence)
        .all()
    )
    
    return [
        {
            "id": op.id,
            "sequence": op.sequence,
            "operation_name": op.operation_name,
            "status": op.status.value,
            "started_at": _utc_iso(op.started_at),
            "completed_at": _utc_iso(op.completed_at),
            "assigned_workstation": op.assigned_workstation.name if op.assigned_workstation else None,
            "assigned_employee": op.assigned_employee.name if op.assigned_employee else None,
        }
        for op in ops
    ]
