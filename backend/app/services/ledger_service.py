"""
Ledger Service — automatically handles double-entry bookkeeping transactions.
"""
from datetime import datetime
from sqlalchemy.orm import Session
from app.models.journal_entry import JournalEntry
from app.models.ledger import LedgerEntry, AccountType
from app.models.invoice import Invoice
from app.models.purchase_order import PurchaseOrder
from app.models.rma import RMATicket

def _create_journal_entry(
    db: Session,
    description: str,
    ref_type: str,
    ref_id: int,
    legs: list[dict],
) -> JournalEntry:
    """
    Creates a balanced journal entry. Raises ValueError if debits != credits.
    """
    total_debit  = sum(l["debit"] for l in legs)
    total_credit = sum(l["credit"] for l in legs)
    if round(total_debit, 2) != round(total_credit, 2):
        raise ValueError(
            f"Unbalanced journal entry: debit={total_debit}, credit={total_credit}"
        )

    je_count = db.query(JournalEntry).count()
    je = JournalEntry(
        journal_number=f"JE-{datetime.utcnow().strftime('%Y')}-{je_count+1:04d}",
        description=description,
        reference_type=ref_type,
        reference_id=ref_id,
    )
    db.add(je)
    db.flush()

    for leg in legs:
        entry = LedgerEntry(
            journal_entry_id=je.id,
            account_code=leg["code"],
            account_name=leg["name"],
            account_type=leg["type"],
            debit_amount=leg["debit"],
            credit_amount=leg["credit"],
        )
        db.add(entry)

    db.flush()
    return je


def record_revenue(db: Session, invoice: Invoice):
    """
    Sales Invoice → Double-Entry:
      DR 1100 Accounts Receivable   (total with VAT)
      CR 4000 Sales Revenue          (subtotal net)
      CR 2200 VAT Payable            (tax amount)
      
      ACADEMIC ADDITION (COGS/SMM):
      DR 5000 Cost of Goods Sold     (total item unit costs)
      CR 1200 Inventory (Finished)    (total item unit costs)
    """
    total_cogs = 0.0
    if invoice.order:
        for oi in invoice.order.items:
            # Fallback to 50% of selling price if unit_cost is not set (for safety)
            cost = float(oi.item.unit_cost or (oi.unit_price * 0.5))
            total_cogs += cost * float(oi.quantity)

    _create_journal_entry(db,
        description=f"Sales revenue & COGS for Invoice #{invoice.invoice_number}",
        ref_type="INVOICE", ref_id=invoice.id,
        legs=[
            {"code":"1100","name":"Accounts Receivable",
             "type":AccountType.ASSET,
             "debit":float(invoice.total_amount),"credit":0},
            {"code":"4000","name":"Sales Revenue",
             "type":AccountType.REVENUE,
             "debit":0,"credit":float(invoice.subtotal)},
            {"code":"2200","name":"VAT Payable/Receivable",
             "type":AccountType.LIABILITY,
             "debit":0,"credit":float(invoice.tax_amount)},
            # COGS LEGS
            {"code":"5000","name":"Cost of Goods Sold (SMM)",
             "type":AccountType.EXPENSE,
             "debit":round(total_cogs, 2),"credit":0},
            {"code":"1200","name":"Inventory (Asset)",
             "type":AccountType.ASSET,
             "debit":0,"credit":round(total_cogs, 2)},
        ]
    )


def record_expense(db: Session, purchase_order: PurchaseOrder):
    """
    PO Received → Double-Entry:
      DR 1200 Inventory (Raw Material)  (net cost)
      DR 2200 VAT Receivable            (input VAT, offsets payable)
      CR 2100 Accounts Payable          (total with VAT)
    """
    net_cost = float(purchase_order.total_cost)
    vat_rate = float(purchase_order.item.vat_rate) / 100.0 if hasattr(purchase_order.item, 'vat_rate') else 0.20
    vat_amount = round(net_cost * vat_rate, 2)
    total = round(net_cost + vat_amount, 2)

    _create_journal_entry(db,
        description=f"Raw materials from {purchase_order.supplier.name} via PO #{purchase_order.po_number}",
        ref_type="PURCHASE_ORDER", ref_id=purchase_order.id,
        legs=[
            {"code":"1200","name":"Inventory (Raw Material)",
             "type":AccountType.ASSET,
             "debit":net_cost,"credit":0},
            {"code":"2200","name":"VAT Payable/Receivable",
             "type":AccountType.LIABILITY, # Representing input VAT as reduction of liability here for simplicity
             "debit":vat_amount,"credit":0},
            {"code":"2100","name":"Accounts Payable",
             "type":AccountType.LIABILITY,
             "debit":0,"credit":total},
        ]
    )


def record_rma_refund(db: Session, rma_ticket: RMATicket, amount: float):
    """
    RMA Refund → Double-Entry:
      DR 5200 RMA Refunds            (refund amount)
      CR 1000 Cash / Bank            (refund amount)
    """
    _create_journal_entry(db,
        description=f"Refund issued for RMA Ticket #{rma_ticket.id}",
        ref_type="RMA_REFUND", ref_id=rma_ticket.id,
        legs=[
            {"code":"5200","name":"RMA Refunds",
             "type":AccountType.EXPENSE,
             "debit":amount,"credit":0},
            {"code":"1000","name":"Cash / Bank",
             "type":AccountType.ASSET,
             "debit":0,"credit":amount},
        ]
    )
