"""
Finance Service — handles invoice/waybill generation and financial analytics.

Strict rules:
  - Net amounts and tax amounts are always separated
  - Employee salaries are NOT included in the ledger
  - VAT rate is read from the item-level vat_rate field
"""

import uuid
from datetime import datetime
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.waybill import Waybill, WaybillStatus
from app.models.order import Order
from app.models.purchase_order import PurchaseOrder
from app.models.shipment import Shipment
from app.models.ledger import AccountType


def generate_sales_invoice(db: Session, order: Order) -> Invoice:
    """Create a SALES invoice for a customer order.
    Uses item-level VAT rates for accurate tax calculation."""

    # Check if invoice already exists
    if order.invoice:
        return order.invoice

    # Calculate subtotal and tax from line items
    subtotal = 0.0
    weighted_vat_total = 0.0

    for oi in order.items:
        line_subtotal = float(oi.line_total)
        subtotal += line_subtotal
        # Use item-level VAT rate
        item_vat_rate = float(oi.item.vat_rate) / 100.0 if hasattr(oi.item, 'vat_rate') else 0.20
        weighted_vat_total += line_subtotal * item_vat_rate

    tax_amount = round(weighted_vat_total, 2)
    effective_tax_rate = round(weighted_vat_total / subtotal, 4) if subtotal > 0 else 0.20

    inv_count = db.query(Invoice).count()
    invoice = Invoice(
        invoice_number=f"INV-{datetime.utcnow().strftime('%Y')}-{inv_count + 1:04d}",
        invoice_type=InvoiceType.SALES,
        order_id=order.id,
        subtotal=subtotal,
        tax_rate=effective_tax_rate,
        tax_amount=tax_amount,
        total_amount=round(subtotal + tax_amount, 2),
        status=InvoiceStatus.ISSUED,
    )
    db.add(invoice)
    db.flush()
    return invoice


def generate_purchase_invoice(db: Session, po: PurchaseOrder) -> Invoice:
    """Create a PURCHASE invoice when a PO is received."""

    # Check if invoice already exists
    if po.invoice:
        return po.invoice

    subtotal = float(po.total_cost)
    item_vat_rate = float(po.item.vat_rate) / 100.0 if hasattr(po.item, 'vat_rate') else 0.20
    tax_amount = round(subtotal * item_vat_rate, 2)

    inv_count = db.query(Invoice).count()
    invoice = Invoice(
        invoice_number=f"INV-{datetime.utcnow().strftime('%Y')}-{inv_count + 1:04d}",
        invoice_type=InvoiceType.PURCHASE,
        purchase_order_id=po.id,
        subtotal=subtotal,
        tax_rate=item_vat_rate,
        tax_amount=tax_amount,
        total_amount=round(subtotal + tax_amount, 2),
        status=InvoiceStatus.ISSUED,
    )
    db.add(invoice)
    db.flush()
    return invoice


def generate_waybill(db: Session, order: Order, shipment: Shipment) -> Waybill:
    """Create a Waybill (İrsaliye) when shipment starts."""

    # Check if waybill already exists
    existing = db.query(Waybill).filter(Waybill.order_id == order.id).first()
    if existing:
        return existing

    wb_count = db.query(Waybill).count()
    waybill = Waybill(
        waybill_number=f"WAY-{datetime.utcnow().strftime('%Y')}-{wb_count + 1:04d}",
        order_id=order.id,
        shipment_id=shipment.id,
        status=WaybillStatus.ISSUED,
    )
    db.add(waybill)
    db.flush()
    return waybill


def get_financial_summary(db: Session) -> dict:
    """Calculate comprehensive financial summary from DOUBLE-ENTRY Ledger.
    
    Net Profit = Total Revenue (Credits to REVENUE accounts) - Total Expenses (Debits to EXPENSE accounts)
    """
    from app.models.ledger import LedgerEntry, AccountType
    from app.models.invoice import Invoice, InvoiceType

    # Revenue from Ledger (Credits to REVENUE accounts)
    revenue_data = db.query(
        func.coalesce(func.sum(LedgerEntry.credit_amount), 0).label("revenue_total")
    ).filter(LedgerEntry.account_type == AccountType.REVENUE).first()

    # Expenses from Ledger (Debits to EXPENSE accounts)
    expense_data = db.query(
        func.coalesce(func.sum(LedgerEntry.debit_amount), 0).label("expense_total")
    ).filter(LedgerEntry.account_type == AccountType.EXPENSE).first()

    # VAT Liability: VAT collected on sales (Credit to 2200) - VAT paid on purchases (Debit to 2200)
    # This requires looking specifically at account 2200
    vat_data = db.query(
        func.coalesce(func.sum(LedgerEntry.credit_amount), 0).label("vat_credit"),
        func.coalesce(func.sum(LedgerEntry.debit_amount), 0).label("vat_debit")
    ).filter(LedgerEntry.account_code == "2200").first()

    revenue = float(revenue_data.revenue_total)
    cogs = float(expense_data.expense_total)
    
    sales_vat = float(vat_data.vat_credit)
    purchase_vat = float(vat_data.vat_debit)
    vat_liability = sales_vat - purchase_vat
    
    net_profit = revenue - cogs
    
    sales_invoice_count = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.SALES).count()
    purchase_invoice_count = db.query(Invoice).filter(Invoice.invoice_type == InvoiceType.PURCHASE).count()

    return {
        "total_revenue": round(revenue, 2),
        "total_revenue_with_vat": round(revenue + sales_vat, 2), # Approximation for dashboard
        "total_expenses": round(cogs, 2),
        "total_expenses_with_vat": round(cogs + purchase_vat, 2), # Approximation for dashboard
        "sales_vat": round(sales_vat, 2),
        "purchase_vat": round(purchase_vat, 2),
        "vat_liability": round(vat_liability, 2),
        "net_profit": round(net_profit, 2),
        "sales_invoice_count": sales_invoice_count,
        "purchase_invoice_count": purchase_invoice_count,
    }
