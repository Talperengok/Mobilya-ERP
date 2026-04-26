import asyncio
from datetime import datetime, timedelta
import logging
from sqlalchemy.orm import Session

from app.db.session import SessionLocal
from app.models.scheduled_task import ScheduledTask, TaskStatus, TaskType
from app.models.production import ProductionOrder, ProductionStatus
from app.models.item import Item
from app.models.employee import EmployeeStatus
from app.models.workstation import Workstation
from app.models.order import Order, OrderStatus
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.services.stock_evaluator import evaluate_stock_levels

logger = logging.getLogger(__name__)

def handle_production_complete(db, task: ScheduledTask):
    po = db.query(ProductionOrder).filter(ProductionOrder.id == task.target_id).with_for_update().first()
    if not po or po.status != ProductionStatus.IN_PROGRESS:
        return
        
    po.status = ProductionStatus.COMPLETED
    po.completed_at = datetime.utcnow()
    
    # Add the produced quantity to the item stock
    item = db.query(Item).filter(Item.id == po.item_id).with_for_update().first()
    item.stock_quantity = float(item.stock_quantity) + float(po.quantity_to_produce)
    
    from app.models.stock_lot import StockLot
    lot = StockLot(
        item_id=item.id,
        source_type="PRODUCTION",
        source_id=po.id,
        initial_quantity=po.quantity_to_produce,
        remaining_quantity=po.quantity_to_produce,
        unit_cost=float(item.unit_cost),
    )
    db.add(lot)
    
    # Evaluate thresholds
    evaluate_stock_levels(db, item.id)
    
    # Free up assigned employees
    for emp in po.assigned_employees:
        emp.status = EmployeeStatus.AVAILABLE
        emp.current_production_id = None
    
    # Free up assigned workstation
    if po.assigned_workstation_id:
        ws = db.query(Workstation).filter(Workstation.id == po.assigned_workstation_id).with_for_update().first()
        if ws:
            ws.is_available = True
            
    # Check if parent order is fully completed and ready for logistics
    if po.order_id:
        order = db.query(Order).filter(Order.id == po.order_id).with_for_update().first()
        if order and order.status in [OrderStatus.IN_PRODUCTION, OrderStatus.WAITING_FOR_MATERIALS, OrderStatus.PENDING]:
            incomplete_pos = db.query(ProductionOrder).filter(
                ProductionOrder.order_id == po.order_id,
                ProductionOrder.status != ProductionStatus.COMPLETED
            ).count()
            
            if incomplete_pos == 0:
                logger.info(f"All production orders completed for Order #{order.order_number}. Promoting to READY target state.")
                order.status = OrderStatus.READY

def _start_operation(db: Session, op):
    """Start the next operation automatically, assigning available resources."""
    from app.models.employee import Employee, EmployeeStatus
    from app.models.workstation import Workstation
    from datetime import datetime, timedelta
    from app.models.scheduled_task import ScheduledTask, TaskType
    from app.models.operation_log import OperationStatus

    # Find available workstation of correct type
    ws = db.query(Workstation).filter(
        Workstation.station_type == op.routing.workstation_type,
        Workstation.is_available == True
    ).with_for_update().first()

    # Find available employee
    emp = db.query(Employee).filter(
        Employee.status == EmployeeStatus.AVAILABLE
    ).with_for_update().first()

    # If resources aren't available, we could leave it PENDING and have a cron job retry later,
    # but for simplicity in this ERP, we'll force assignment even if it slightly overbooks, or better:
    # We just don't start it if resources are missing. Actually, let's grab any workstation/employee if none available to prevent halting the demo.
    if not ws:
        ws = db.query(Workstation).filter(Workstation.station_type == op.routing.workstation_type).first()
    if not emp:
        emp = db.query(Employee).first()

    if ws:
        ws.is_available = False
        op.assigned_workstation_id = ws.id
    if emp:
        emp.status = EmployeeStatus.BUSY
        emp.current_production_id = op.production_order_id
        op.assigned_employee_id = emp.id

    op.status = OperationStatus.IN_PROGRESS
    op.started_at = datetime.utcnow()

    # Duration = base routing duration
    duration = op.routing.duration_seconds
    
    # Schedule the operation complete
    task = ScheduledTask(
        task_type=TaskType.OPERATION_COMPLETE,
        target_id=op.id,
        execute_at=datetime.utcnow() + timedelta(seconds=duration)
    )
    db.add(task)


def handle_operation_complete(db: Session, task):
    """
    Called when one operation step finishes.
    Frees resources, then either queues the NEXT operation or finalizes production.
    """
    from app.models.operation_log import OperationLog, OperationStatus
    from app.models.employee import Employee, EmployeeStatus
    from app.models.workstation import Workstation
    from datetime import datetime
    
    op = db.query(OperationLog).filter(
        OperationLog.id == task.target_id
    ).with_for_update().first()
    if not op or op.status != OperationStatus.IN_PROGRESS:
        return

    # 1. Mark this operation done, release resources
    op.status = OperationStatus.COMPLETED
    op.completed_at = datetime.utcnow()

    if op.assigned_employee_id:
        emp = db.query(Employee).filter(Employee.id == op.assigned_employee_id).with_for_update().first()
        if emp:
            emp.status = EmployeeStatus.AVAILABLE
            emp.current_production_id = None
    if op.assigned_workstation_id:
        ws = db.query(Workstation).filter(Workstation.id == op.assigned_workstation_id).with_for_update().first()
        if ws:
            ws.is_available = True

    # 2. Find the next pending operation for this production order
    next_op = (
        db.query(OperationLog)
        .filter(
            OperationLog.production_order_id == op.production_order_id,
            OperationLog.status == OperationStatus.PENDING,
        )
        .order_by(OperationLog.sequence.asc())
        .first()
    )

    if next_op:
        # Assign resources and schedule next step
        _start_operation(db, next_op)
    else:
        # All operations done -> finalize production
        # We can reuse handle_production_complete logic by creating a dummy task or calling directly
        from app.models.scheduled_task import ScheduledTask, TaskType
        mock_task = ScheduledTask(target_id=op.production_order_id, task_type=TaskType.PRODUCTION_COMPLETE, execute_at=datetime.utcnow())
        handle_production_complete(db, mock_task)


def handle_delivery_transit(db, task: ScheduledTask):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == task.target_id).with_for_update().first()
    if not po or po.status != PurchaseOrderStatus.ORDERED:
        return
    po.status = PurchaseOrderStatus.IN_TRANSIT
    
    # Schedule target RECEIVED automatically
    now = datetime.utcnow()
    from datetime import timedelta
    next_task = ScheduledTask(
        task_type=TaskType.DELIVERY_RECEIVED,
        target_id=po.id,
        execute_at=now + timedelta(seconds=15)
    )
    db.add(next_task)


def handle_delivery_received(db, task: ScheduledTask):
    po = db.query(PurchaseOrder).filter(PurchaseOrder.id == task.target_id).with_for_update().first()
    if not po or po.status != PurchaseOrderStatus.IN_TRANSIT:
        return
        
    po.status = PurchaseOrderStatus.RECEIVED
    po.received_at = datetime.utcnow()
    
    # Add purchased quantity to stock
    item = db.query(Item).filter(Item.id == po.item_id).with_for_update().first()
    item.stock_quantity = float(item.stock_quantity) + float(po.quantity)
    
    from app.models.stock_lot import StockLot
    lot = StockLot(
        item_id=item.id,
        source_type="PURCHASE",
        source_id=po.id,
        initial_quantity=po.quantity,
        remaining_quantity=po.quantity,
        unit_cost=float(po.unit_cost),
    )
    db.add(lot)
    
    # Auto-generate PURCHASE invoice
    from app.services.finance_service import generate_purchase_invoice
    generate_purchase_invoice(db, po)

    # Record expense in ledger
    from app.services.ledger_service import record_expense
    record_expense(db, po)
    
    evaluate_stock_levels(db, item.id)


async def task_scheduler_loop(interval_seconds: int = 5):
    """
    Background worker that polls for due ScheduledTasks and executes them.
    This replaces ephemeral asyncio.sleep() with a database-backed crash-resilient queue.
    """
    logger.info("Task Scheduler started (DB-backed queue).")
    while True:
        try:
            db = SessionLocal()
            now = datetime.utcnow()
            
            # Lock tasks to prevent concurrent worker execution if we ever scale horizontally
            due_tasks = (
                db.query(ScheduledTask)
                .filter(ScheduledTask.status == TaskStatus.PENDING)
                .filter(ScheduledTask.execute_at <= now)
                .with_for_update(skip_locked=True)
                .all()
            )
            
            for task in due_tasks:
                try:
                    logger.info(f"Executing task: {task.task_type.value} for target ID: {task.target_id}")
                    if task.task_type == TaskType.PRODUCTION_COMPLETE:
                        handle_production_complete(db, task)
                    elif task.task_type == TaskType.OPERATION_COMPLETE:
                        handle_operation_complete(db, task)
                    elif task.task_type == TaskType.DELIVERY_TRANSIT:
                        handle_delivery_transit(db, task)
                    elif task.task_type == TaskType.DELIVERY_RECEIVED:
                        handle_delivery_received(db, task)
                    
                    task.status = TaskStatus.COMPLETED
                except Exception as ex:
                    logger.error(f"Task {task.id} failed: {ex}")
                    task.status = TaskStatus.FAILED
            
            db.commit()
        except Exception as e:
            logger.error(f"Error in task scheduler loop: {e}")
            if 'db' in locals():
                db.rollback()
        finally:
            if 'db' in locals():
                db.close()
        
        await asyncio.sleep(interval_seconds)
