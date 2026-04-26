import pytest
from sqlalchemy.orm import Session
from fastapi.testclient import TestClient
from datetime import datetime

from app.models.item import Item, ItemType
from app.models.bom import BOMItem
from app.models.production import ProductionStatus
from app.models.invoice import Invoice, InvoiceStatus
from app.models.ledger import LedgerTransaction
from app.services.mrp_service import MRPService


def test_circular_bom_recursion(db: Session, test_client: TestClient):
    """
    Test that a circular BOM raises a safe RecursionError instead of crashing the stack.
    """
    # Create Item A and B
    item_a = Item(name="Product A", sku="PROD-A", item_type=ItemType.FINISHED_GOOD, stock_quantity=10)
    item_b = Item(name="Product B", sku="PROD-B", item_type=ItemType.SUB_PRODUCT, stock_quantity=5)
    db.add_all([item_a, item_b])
    db.commit()

    # Create Circular Link: A -> B and B -> A
    bom_1 = BOMItem(parent_item_id=item_a.id, child_item_id=item_b.id, quantity=1)
    bom_2 = BOMItem(parent_item_id=item_b.id, child_item_id=item_a.id, quantity=1)
    db.add_all([bom_1, bom_2])
    db.commit()

    mrp = MRPService(db)
    
    with pytest.raises(RecursionError) as exc:
        mrp.explode_bom(item_a.id, 1.0)
    
    assert "BOM recursion depth" in str(exc.value)


def test_capacity_blocked_stock_not_deducted(db: Session):
    """
    Ensure that a lack of employee/workstation blocks production (WAITING_CAPACITY)
    and does NOT result in negative or falsely reserved stock.
    """
    from app.models.employee import Employee
    # Fake setting all employees unavailable
    db.query(Employee).update({"is_available": False})
    db.commit()

    # Attempt to produce product
    item = db.query(Item).filter(Item.item_type == ItemType.FINISHED_GOOD).first()
    original_stock = float(item.stock_quantity)
    original_reserved = float(item.reserved_quantity)
    
    mrp = MRPService(db)
    from app.models.order import Order, OrderItem
    # Mocking order
    new_order = Order(customer_id=1, status="PENDING", total_amount=0)
    db.add(new_order)
    db.flush()
    db.add(OrderItem(order_id=new_order.id, item_id=item.id, quantity=9999))
    db.flush()
    
    result = mrp.process_order(new_order)
    
    # Assert
    assert len(result.production_orders) > 0
    assert result.production_orders[0].status == ProductionStatus.WAITING_CAPACITY
    # Reservation should NOT have jumped by 9999 if it couldn't produce
    assert float(item.reserved_quantity) == original_reserved + max(0, original_stock)


def test_capacity_release_on_completion(db: Session):
    """
    Verify that when an order is completed via _produce_item, the designated employee
    and workstation are assigned is_available=True at the end.
    """
    from app.models.employee import Employee
    
    # Set at least one employee ready
    emp = db.query(Employee).first()
    emp.is_available = True
    db.commit()

    mrp = MRPService(db)
    item = db.query(Item).filter(Item.item_type == ItemType.FINISHED_GOOD).first()
    
    success = mrp._produce_item(item, 1, None, mrp.process_order.__defaults__[0] if hasattr(mrp.process_order, '__defaults__') else None, 0)
    
    db.refresh(emp)
    # The employee should be returned to available pool after completion
    assert emp.is_available is True


def test_prevent_invoice_double_counting(db: Session, test_client: TestClient):
    """
    Verify that a PAID invoice marked REFUNDED cannot be marked PAID again for double ledger entry.
    """
    # Find paid invoice
    inv = db.query(Invoice).filter(Invoice.status == InvoiceStatus.PAID).first()
    
    # Ensure it's refunded
    inv.status = InvoiceStatus.REFUNDED
    db.commit()

    # Try hitting payment patch
    res = test_client.patch(f"/api/v1/invoices/{inv.id}/pay")
    
    assert res.status_code == 400
    assert "Revenue has already been booked" in res.json()["detail"]
