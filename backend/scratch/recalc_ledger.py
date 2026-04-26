from sqlalchemy.orm import Session, joinedload
from app.db.session import SessionLocal
from app.models.invoice import Invoice, InvoiceType
from app.models.journal_entry import JournalEntry
from app.models.ledger import LedgerEntry, AccountType
from app.services.ledger_service import record_revenue

def repair_cogs():
    db = SessionLocal()
    print("🛠️ Repairing Ledger: Adding missing COGS to historical sales...")
    
    # 1. Find all Sales Invoices
    sales_invoices = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.SALES).all()
    
    for inv in sales_invoices:
        # Check if COGS (Account 5000) already exists for this invoice
        je = db.query(JournalEntry).filter(
            JournalEntry.reference_type == "INVOICE",
            JournalEntry.reference_id == inv.id
        ).first()
        
        if not je:
            print(f"   Invoice #{inv.invoice_number}: No journal entry found. Creating new...")
            record_revenue(db, inv)
            continue
            
        has_cogs = db.query(LedgerEntry).filter(
            LedgerEntry.journal_entry_id == je.id,
            LedgerEntry.account_code == "5000"
        ).first()
        
        if not has_cogs:
            print(f"   Invoice #{inv.invoice_number}: Missing COGS. Calculating and adding legs...")
            total_cogs = 0.0
            if inv.order:
                for oi in inv.order.items:
                    cost = float(oi.item.unit_cost or (oi.unit_price * 0.5))
                    total_cogs += cost * float(oi.quantity)
            
            # DR COGS
            db.add(LedgerEntry(
                journal_entry_id=je.id,
                account_code="5000",
                account_name="Cost of Goods Sold (SMM)",
                account_type=AccountType.EXPENSE,
                debit_amount=round(total_cogs, 2),
                credit_amount=0
            ))
            # CR Inventory
            db.add(LedgerEntry(
                journal_entry_id=je.id,
                account_code="1200",
                account_name="Inventory (Asset)",
                account_type=AccountType.ASSET,
                debit_amount=0,
                credit_amount=round(total_cogs, 2)
            ))
            print(f"      Added COGS: ₺{total_cogs:.2f}")
        else:
            print(f"   Invoice #{inv.invoice_number}: COGS already present. Skipping.")

    db.commit()
    db.close()
    print("✅ Repair complete!")

if __name__ == "__main__":
    repair_cogs()
