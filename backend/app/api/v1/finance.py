"""
Finance API — financial summary, invoices, waybills, and ledger.

Provides:
  GET /finance/summary    — Revenue, COGS, VAT, Net Profit
  GET /finance/invoices   — List all invoices (filterable by type/status)
  GET /finance/invoices/:id — Invoice detail (for printable view)
  GET /finance/waybills   — List all waybills
  GET /finance/waybills/:id — Waybill detail (for printable view)
  GET /finance/ledger     — Recent ledger transactions
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session, joinedload
from sqlalchemy import func
from datetime import datetime, timedelta

from app.core.deps import get_db, RequireRole
from app.models.user import UserRole
from app.models.ledger import AccountType
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.waybill import Waybill

router = APIRouter(prefix="/finance", tags=["Finance"])


def _utc_iso(dt):
    if dt is None:
        return None
    return dt.isoformat() + "Z"


@router.get("/summary", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.FACTORY_MANAGER, UserRole.SALES_REP]))])
def get_financial_summary(db: Session = Depends(get_db)):
    """Returns total revenue, expenses (COGS), VAT liability, and net profit.
    Employee salaries are excluded."""
    from app.services.finance_service import get_financial_summary
    return get_financial_summary(db)


@router.get("/invoices", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.FACTORY_MANAGER, UserRole.SALES_REP, UserRole.LOGISTICS_OFFICER]))])
def list_invoices(
    invoice_type: str = None,
    status: str = None,
    db: Session = Depends(get_db),
):
    """List all invoices with optional filters."""
    query = db.query(Invoice)

    if invoice_type:
        query = query.filter(Invoice.invoice_type == InvoiceType(invoice_type))
    if status:
        query = query.filter(Invoice.status == InvoiceStatus(status))

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
            "issued_date": _utc_iso(inv.issued_date),
            "paid_date": _utc_iso(inv.paid_date),
            "notes": inv.notes,
        }
        for inv in invoices
    ]


@router.get("/invoices/{invoice_id}", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.FACTORY_MANAGER, UserRole.SALES_REP, UserRole.LOGISTICS_OFFICER]))])
def get_invoice_detail(invoice_id: int, db: Session = Depends(get_db)):
    """Get full invoice detail for printable document view."""
    inv = (
        db.query(Invoice)
        .options(
            joinedload(Invoice.order),
            joinedload(Invoice.purchase_order),
        )
        .get(invoice_id)
    )
    if not inv:
        raise HTTPException(404, "Invoice not found")

    # Build line items depending on type
    line_items = []
    company_info = {
        "name": "Mobilya Üretim A.Ş.",
        "address": "Organize Sanayi Bölgesi No:42, Istanbul",
        "tax_id": "TR-1234567890",
        "phone": "+90 212 555 0100",
        "email": "muhasebe@mobilya.com",
    }

    if inv.invoice_type == InvoiceType.SALES and inv.order:
        # Eagerly load order items
        from app.models.order import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == inv.order_id).all()
        for oi in items:
            item = oi.item
            vat_pct = float(item.vat_rate) if hasattr(item, 'vat_rate') else 20.0
            line_sub = float(oi.line_total)
            line_tax = round(line_sub * vat_pct / 100, 2)
            line_items.append({
                "description": item.name,
                "sku": item.sku,
                "quantity": oi.quantity,
                "unit_price": float(oi.unit_price),
                "vat_rate": vat_pct,
                "subtotal": line_sub,
                "tax": line_tax,
                "total": round(line_sub + line_tax, 2),
            })

        customer_info = {
            "name": inv.order.customer.name if inv.order.customer else "N/A",
            "order_number": inv.order.order_number,
        }
    elif inv.invoice_type == InvoiceType.PURCHASE and inv.purchase_order:
        po = inv.purchase_order
        vat_pct = float(po.item.vat_rate) if hasattr(po.item, 'vat_rate') else 20.0
        line_sub = float(po.total_cost)
        line_tax = round(line_sub * vat_pct / 100, 2)
        line_items.append({
            "description": po.item.name,
            "sku": po.item.sku,
            "quantity": float(po.quantity),
            "unit_price": float(po.unit_cost),
            "vat_rate": vat_pct,
            "subtotal": line_sub,
            "tax": line_tax,
            "total": round(line_sub + line_tax, 2),
        })
        customer_info = {
            "name": po.supplier.name if po.supplier else "N/A",
            "order_number": po.po_number,
        }
    else:
        customer_info = {"name": "N/A", "order_number": "N/A"}

    return {
        "id": inv.id,
        "invoice_number": inv.invoice_number,
        "invoice_type": inv.invoice_type.value,
        "status": inv.status.value,
        "issued_date": _utc_iso(inv.issued_date),
        "paid_date": _utc_iso(inv.paid_date),
        "subtotal": float(inv.subtotal),
        "tax_rate": float(inv.tax_rate),
        "tax_amount": float(inv.tax_amount),
        "total_amount": float(inv.total_amount),
        "notes": inv.notes,
        "company": company_info,
        "customer": customer_info,
        "line_items": line_items,
    }


@router.get("/waybills", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.LOGISTICS_OFFICER, UserRole.SALES_REP]))])
def list_waybills(db: Session = Depends(get_db)):
    """List all waybills (İrsaliye)."""
    waybills = (
        db.query(Waybill)
        .options(joinedload(Waybill.order), joinedload(Waybill.shipment))
        .order_by(Waybill.issue_date.desc())
        .all()
    )
    return [
        {
            "id": wb.id,
            "waybill_number": wb.waybill_number,
            "order_id": wb.order_id,
            "order_number": wb.order.order_number if wb.order else None,
            "shipment_id": wb.shipment_id,
            "tracking_number": wb.shipment.tracking_number if wb.shipment else None,
            "status": wb.status.value,
            "issue_date": _utc_iso(wb.issue_date),
        }
        for wb in waybills
    ]


@router.get("/waybills/{waybill_id}", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.LOGISTICS_OFFICER, UserRole.SALES_REP]))])
def get_waybill_detail(waybill_id: int, db: Session = Depends(get_db)):
    """Get full waybill detail for printable document view."""
    wb = (
        db.query(Waybill)
        .options(
            joinedload(Waybill.order),
            joinedload(Waybill.shipment),
        )
        .get(waybill_id)
    )
    if not wb:
        raise HTTPException(404, "Waybill not found")

    # Build item list from order
    line_items = []
    if wb.order:
        from app.models.order import OrderItem
        items = db.query(OrderItem).filter(OrderItem.order_id == wb.order_id).all()
        for oi in items:
            line_items.append({
                "description": oi.item.name,
                "sku": oi.item.sku,
                "quantity": oi.quantity,
                "unit": oi.item.unit,
            })

    return {
        "id": wb.id,
        "waybill_number": wb.waybill_number,
        "order_number": wb.order.order_number if wb.order else None,
        "tracking_number": wb.shipment.tracking_number if wb.shipment else None,
        "courier": wb.shipment.courier_name if wb.shipment else None,
        "status": wb.status.value,
        "issue_date": _utc_iso(wb.issue_date),
        "shipped_at": _utc_iso(wb.shipment.shipped_at) if wb.shipment else None,
        "company": {
            "name": "Mobilya Üretim A.Ş.",
            "address": "Organize Sanayi Bölgesi No:42, Istanbul",
            "tax_id": "TR-1234567890",
        },
        "recipient": {
            "name": wb.order.customer.name if wb.order and wb.order.customer else "N/A",
            "address": wb.order.customer.address if wb.order and wb.order.customer else "N/A",
        },
        "line_items": line_items,
    }


@router.get("/ledger", dependencies=[Depends(RequireRole([UserRole.ADMIN]))])
def list_ledger_transactions(db: Session = Depends(get_db)):
    """List recent ledger transactions with double-entry legs."""
    from app.models.journal_entry import JournalEntry
    jes = db.query(JournalEntry).options(joinedload(JournalEntry.entries)).order_by(JournalEntry.transaction_date.desc()).limit(100).all()
    
    result = []
    for je in jes:
        legs = []
        for entry in je.entries:
            legs.append({
                "account_code": entry.account_code,
                "account_name": entry.account_name,
                "account_type": entry.account_type.value,
                "debit": float(entry.debit_amount),
                "credit": float(entry.credit_amount),
            })
            
        result.append({
            "id": je.id,
            "journal_number": je.journal_number,
            "transaction_date": _utc_iso(je.transaction_date),
            "description": je.description,
            "reference_type": je.reference_type,
            "reference_id": je.reference_id,
            "total_amount": sum(l["debit"] for l in legs),
            "entries": legs,
        })
        
    return result
