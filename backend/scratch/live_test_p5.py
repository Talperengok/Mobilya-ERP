from app.db.session import SessionLocal
from app.models.item import Item
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.order import Order
from app.models.production import ProductionOrder, ProductionStatus
from app.models.stock_lot import StockLot
from app.models.ledger import LedgerEntry
from app.models.journal_entry import JournalEntry
from app.models.operation_log import OperationLog
from app.api.v1.purchase_orders import receive_purchase_order
from app.api.v1.production import start_production_order
from app.services.order_service import create_order
from app.models.workstation import Workstation
from app.models.employee import Employee
from app.models.supplier import Supplier
from datetime import datetime
import time

def live_test():
    db = SessionLocal()
    
    print("\n--- 🧪 Live Test Phase 5 ---")

    # 1. Purchase Receipt Test
    print("\n📦 Test 1: Purchase Order Receipt (LOT + LEDGER)")
    s = db.query(Supplier).first()
    item = db.query(Item).filter(Item.sku == "RM-WOOD-OAK").first()
    po = PurchaseOrder(
        po_number=f"PO-TEST-{int(time.time())}",
        supplier_id=s.id,
        item_id=item.id,
        quantity=10,
        unit_cost=50,
        total_cost=500,
        status=PurchaseOrderStatus.ORDERED
    )
    db.add(po)
    db.commit()
    
    print(f"Receiving NEW PO #{po.po_number}...")
    receive_purchase_order(po.id, db)
    
    lot = db.query(StockLot).filter(StockLot.source_id == po.id, StockLot.source_type == "PURCHASE").first()
    if lot:
        print(f"✅ StockLot created: {lot.id}, Qty: {lot.initial_quantity}")
    else:
        print("❌ StockLot NOT created!")

    je = db.query(JournalEntry).filter(JournalEntry.reference_id == po.id, JournalEntry.reference_type == "PURCHASE_ORDER").first()
    if je:
        print(f"✅ Journal Entry created: {je.journal_number}")
        total_dr = sum(e.debit_amount for e in je.entries)
        total_cr = sum(e.credit_amount for e in je.entries)
        print(f"   Debits: {total_dr}, Credits: {total_cr} (Balanced: {total_dr == total_cr})")
    else:
        print("❌ Journal Entry NOT created!")

    # 2. FIFO Order Test
    print("\n🛒 Test 2: FIFO Stock Consumption")
    oak = db.query(Item).filter(Item.sku == "RM-WOOD-OAK").first()
    initial_stock = float(oak.stock_quantity)
    
    sp_oak = db.query(Item).filter(Item.sku == "SP-TABLE-TOP-OAK").first()
    prod = ProductionOrder(item_id=sp_oak.id, quantity_to_produce=1, status=ProductionStatus.PLANNED)
    db.add(prod)
    db.commit()
    
    from app.api.v1.production import ProductionOrderStart
    ws = db.query(Workstation).first()
    emp = db.query(Employee).first()
    start_data = ProductionOrderStart(workstation_id=ws.id, employee_ids=[emp.id])
    
    print(f"Starting production order for {sp_oak.sku}...")
    start_production_order(prod.id, start_data, None, db)
    
    oak_after = db.query(Item).filter(Item.sku == "RM-WOOD-OAK").first()
    print(f"Oak stock: {initial_stock} -> {oak_after.stock_quantity}")
    
    from app.models.lot_consumption import LotConsumption
    lc = db.query(LotConsumption).join(ProductionLog).filter(ProductionLog.production_order_id == prod.id).all()
    if lc:
        print(f"✅ LotConsumption records found: {len(lc)}")
        for entry in lc:
            print(f"   Lot {entry.stock_lot_id} consumed {entry.quantity_consumed}")
    else:
        print("❌ LotConsumption NOT found!")

    # 3. Routing Test
    print("\n⚙️ Test 3: Production Routing")
    fg_oak = db.query(Item).filter(Item.sku == "FG-DINING-TABLE-OAK").first()
    prod_fg = ProductionOrder(item_id=fg_oak.id, quantity_to_produce=1, status=ProductionStatus.PLANNED)
    db.add(prod_fg)
    db.commit()
    
    ws2 = db.query(Workstation).filter(Workstation.id != ws.id).first()
    if not ws2: ws2 = ws; ws2.is_available = True; db.commit()
    
    print(f"Starting multi-step production for {fg_oak.sku}...")
    start_data_2 = ProductionOrderStart(workstation_id=ws2.id, employee_ids=[emp.id])
    start_production_order(prod_fg.id, start_data_2, None, db)
    
    ops = db.query(OperationLog).filter(OperationLog.production_order_id == prod_fg.id).all()
    if ops:
        print(f"✅ OperationLogs created: {len(ops)}")
        for op in ops:
            print(f"   Seq {op.sequence}: {op.operation_name} ({op.status.value})")
    else:
        print("❌ OperationLogs NOT created!")

    db.close()

if __name__ == "__main__":
    from app.models.production import ProductionLog # Ensure import for join
    live_test()
