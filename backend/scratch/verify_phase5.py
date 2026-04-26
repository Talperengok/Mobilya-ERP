from app.db.session import SessionLocal
from app.models.item import Item
from app.models.stock_lot import StockLot
from app.models.bom_routing import BOMRouting
from app.models.ledger import LedgerEntry, AccountType
from app.models.journal_entry import JournalEntry

def verify():
    db = SessionLocal()
    
    # 1. Check Lots
    lots = db.query(StockLot).all()
    print(f"📊 Total StockLots: {len(lots)}")
    for lot in lots[:3]:
        print(f"  - Lot ID {lot.id}: Item {lot.item_id}, Source {lot.source_type}, Qty {lot.remaining_quantity}")

    # 2. Check Routings
    routings = db.query(BOMRouting).all()
    print(f"⚙️ Total Routings: {len(routings)}")
    for r in routings:
        print(f"  - Routing: Item {r.item_id}, Seq {r.sequence}, Op {r.operation_name}, WS {r.workstation_type.value}")

    # 3. Check Ledger (Should be empty after seed)
    ledger = db.query(LedgerEntry).all()
    print(f"💰 Total LedgerEntries: {len(ledger)}")

    db.close()

if __name__ == "__main__":
    verify()
