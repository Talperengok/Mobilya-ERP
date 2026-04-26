"""
Invoices API — view and manage payment status for invoices.
Supports both SALES and PURCHASE invoice types.
"""

from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload

from app.core.deps import get_db
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus

router = APIRouter(prefix="/invoices", tags=["Invoices"])


@router.get("/")
def list_invoices(
    status: str = None,
    invoice_type: str = None,
    db: Session = Depends(get_db),
):
    query = db.query(Invoice)
    if status:
        query = query.filter(Invoice.status == InvoiceStatus(status))
    if invoice_type:
        query = query.filter(Invoice.invoice_type == InvoiceType(invoice_type))

    invoices = query.order_by(Invoice.issued_date.desc()).all()

    return [
        {
            "id": inv.id,
            "invoice_number": inv.invoice_number,
            "invoice_type": inv.invoice_type.value,
            "order_id": inv.order_id,
            "purchase_order_id": inv.purchase_order_id,
            "subtotal": float(inv.subtotal),
            "tax_rate": float(inv.tax_rate),
            "tax_amount": float(inv.tax_amount),
            "total_amount": float(inv.total_amount),
            "status": inv.status.value,
            "issued_date": inv.issued_date.isoformat() + "Z" if inv.issued_date else None,
            "paid_date": inv.paid_date.isoformat() + "Z" if inv.paid_date else None,
        }
        for inv in invoices
    ]


@router.patch("/{invoice_id}/pay")
def mark_invoice_paid(invoice_id: int, db: Session = Depends(get_db)):
    """Mark an invoice as paid."""
    invoice = db.get(Invoice, invoice_id)
    if not invoice:
        raise HTTPException(404, detail="Invoice not found")
    if invoice.status == InvoiceStatus.PAID:
        raise HTTPException(400, detail="Already paid")

    invoice.status = InvoiceStatus.PAID
    invoice.paid_date = datetime.utcnow()

    # Record revenue in ledger for SALES invoices
    if invoice.invoice_type == InvoiceType.SALES:
        from app.models.journal_entry import JournalEntry
        existing = db.query(JournalEntry).filter(
            JournalEntry.reference_type == "INVOICE",
            JournalEntry.reference_id == invoice.id
        ).first()
        if not existing:
            from app.services.ledger_service import record_revenue
            record_revenue(db, invoice)

    db.commit()
    return {
        "invoice_number": invoice.invoice_number,
        "status": invoice.status.value,
        "paid_date": invoice.paid_date.isoformat() + "Z",
    }
