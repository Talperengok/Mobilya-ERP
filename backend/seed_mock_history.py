"""
Mock History Seeder — populates the database with additional testing data,
such as historical Customer Orders, Purchase Orders, and Production Logs.

Run with:  docker exec erp_backend python seed_mock_history.py
"""

from datetime import datetime, timedelta
import random

from app.db.session import SessionLocal
from app.models.item import Item, ItemType
from app.models.customer import Customer
from app.models.supplier import Supplier
from app.models.order import Order, OrderStatus, OrderItem
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.production import ProductionOrder, ProductionStatus

def seed_history():
    db = SessionLocal()
    
    print("🌱 Generating mock historical data for testing...")

    items = db.query(Item).all()
    customers = db.query(Customer).all()
    suppliers = db.query(Supplier).all()

    if not items or not customers or not suppliers:
        print("⚠️ Core data missing. Please run seed_data.py first.")
        db.close()
        return

    raw_mats = [i for i in items if i.item_type == ItemType.RAW_MATERIAL]
    finished_goods = [i for i in items if i.item_type == ItemType.FINISHED_GOOD]

    # --- 1. Historical Purchase Orders (Procurement) ---
    print("📦 Creating past purchase orders...")
    po_list = []
    for i in range(15):
        days_ago = random.randint(1, 30)
        ordered_date = datetime.utcnow() - timedelta(days=days_ago)
        supplier = random.choice(suppliers)
        material = random.choice(raw_mats)
        qty = random.randint(50, 500)
        status = random.choice([PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.IN_TRANSIT])
        
        po = PurchaseOrder(
            po_number=f"PO-2026MOCK-{100+i}",
            supplier_id=supplier.id,
            item_id=material.id,
            quantity=qty,
            unit_cost=material.unit_cost,
            total_cost=float(material.unit_cost) * qty,
            status=status,
            order_date=ordered_date,
            ordered_at=ordered_date if status != PurchaseOrderStatus.DRAFT else None,
            estimated_delivery_at=ordered_date + timedelta(seconds=20) if status in [PurchaseOrderStatus.ORDERED, PurchaseOrderStatus.IN_TRANSIT] else None,
            received_date=ordered_date + timedelta(days=2) if status == PurchaseOrderStatus.RECEIVED else None,
            notes="Auto-generated mock PO for testing."
        )
        po_list.append(po)
    
    db.add_all(po_list)
    
    # --- 2. Historical Customer Orders (Sales) ---
    print("🛒 Creating past customer orders...")
    order_list = []
    for i in range(25):
        days_ago = random.randint(1, 30)
        order_date = datetime.utcnow() - timedelta(days=days_ago)
        customer = random.choice(customers)
        status = random.choice([OrderStatus.DELIVERED, OrderStatus.DELIVERED, OrderStatus.SHIPPED, OrderStatus.READY, OrderStatus.IN_PRODUCTION])
        
        order = Order(
            order_number=f"ORD-MOCK-{1000+i}",
            customer_id=customer.id,
            status=status,
            source=random.choice(["ONLINE", "POS"]),
            total_amount=0, # calculated below
            order_date=order_date
        )
        db.add(order)
        db.flush() # get order ID
        
        total = 0
        num_lines = random.randint(1, 3)
        for _ in range(num_lines):
            fg = random.choice(finished_goods)
            qty = random.randint(1, 4)
            price = fg.selling_price
            line_total = float(price) * qty
            total += line_total
            
            oi = OrderItem(
                order_id=order.id,
                item_id=fg.id,
                quantity=qty,
                unit_price=price,
                line_total=line_total
            )
            db.add(oi)
        
        order.total_amount = total
    
    # --- 3. Historical Production Orders ---
    print("🏭 Creating past production orders...")
    prod_list = []
    for i in range(10):
        days_ago = random.randint(1, 15)
        start_date = datetime.utcnow() - timedelta(days=days_ago)
        fg = random.choice(finished_goods)
        qty = random.randint(5, 20)
        status = random.choice([ProductionStatus.COMPLETED, ProductionStatus.COMPLETED, ProductionStatus.PLANNED, ProductionStatus.IN_PROGRESS])
        
        po = ProductionOrder(
            item_id=fg.id,
            quantity_to_produce=qty,
            status=status,
            created_at=start_date - timedelta(hours=1),
            started_at=start_date if status in [ProductionStatus.IN_PROGRESS, ProductionStatus.COMPLETED] else None,
            completed_at=start_date + timedelta(minutes=45) if status == ProductionStatus.COMPLETED else None,
            estimated_completion_at=start_date + timedelta(minutes=45) if status == ProductionStatus.IN_PROGRESS else None,
        )
        prod_list.append(po)
    
    db.add_all(prod_list)

    db.commit()
    print("✅ Successfully seeded historical mock data!")
    db.close()

if __name__ == "__main__":
    seed_history()
