"""
Dashboard API — KPI stats and the Live Inventory view.

These endpoints power the real-time frontend dashboard.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.core.deps import get_db
from app.models.item import Item, ItemType
from app.models.order import Order, OrderStatus
from app.models.production import ProductionOrder, ProductionStatus

router = APIRouter(prefix="/dashboard", tags=["Dashboard"])


@router.get("/stats")
def get_dashboard_stats(db: Session = Depends(get_db)):
    """
    Aggregated KPIs for the dashboard home page.
    Returns item counts, order counts, revenue, and low-stock alerts.
    """
    # Item counts by type
    item_counts = dict(
        db.query(Item.item_type, func.count(Item.id))
        .group_by(Item.item_type)
        .all()
    )

    # Low stock items (where stock ≤ critical_stock_level and critical_stock_level > 0)
    low_stock_items = (
        db.query(Item)
        .filter(Item.stock_quantity <= Item.critical_stock_level)
        .filter(Item.critical_stock_level > 0)
        .all()
    )

    # Order counts by status
    order_counts = dict(
        db.query(Order.status, func.count(Order.id))
        .group_by(Order.status)
        .all()
    )

    # Total revenue (Gross vs Net)
    gross_revenue = db.query(func.sum(Order.total_amount)).scalar() or 0
    from app.services.finance_service import get_financial_summary
    net_revenue = get_financial_summary(db)["total_revenue"]

    # Active production orders
    active_productions = (
        db.query(func.count(ProductionOrder.id))
        .filter(
            ProductionOrder.status.in_([
                ProductionStatus.PLANNED,
                ProductionStatus.IN_PROGRESS,
            ])
        )
        .scalar()
    )

    # Total completed production orders
    completed_productions = (
        db.query(func.count(ProductionOrder.id))
        .filter(ProductionOrder.status == ProductionStatus.COMPLETED)
        .scalar()
    )

    return {
        "items": {
            "raw_materials": item_counts.get(ItemType.RAW_MATERIAL, 0),
            "sub_products": item_counts.get(ItemType.SUB_PRODUCT, 0),
            "finished_goods": item_counts.get(ItemType.FINISHED_GOOD, 0),
            "total": sum(item_counts.values()) if item_counts else 0,
        },
        "low_stock_alerts": [
            {
                "id": i.id,
                "name": i.name,
                "sku": i.sku,
                "item_type": i.item_type.value,
                "stock": float(i.stock_quantity),
                "reorder_level": float(i.critical_stock_level),
                "critical_stock_level": float(i.critical_stock_level),
                "target_stock_level": float(i.target_stock_level),
            }
            for i in low_stock_items
        ],
        "orders": {
            "pending": order_counts.get(OrderStatus.PENDING, 0),
            "in_production": order_counts.get(OrderStatus.IN_PRODUCTION, 0),
            "ready": order_counts.get(OrderStatus.READY, 0),
            "shipped": order_counts.get(OrderStatus.SHIPPED, 0),
            "delivered": order_counts.get(OrderStatus.DELIVERED, 0),
            "total": sum(order_counts.values()) if order_counts else 0,
        },
        "revenue": {
            "gross": float(gross_revenue),
            "net": float(net_revenue),
        },
        "production": {
            "active": active_productions,
            "completed": completed_productions,
        },
    }


@router.get("/inventory")
def get_inventory_view(db: Session = Depends(get_db)):
    """
    Flattened inventory view for the Live Inventory Monitor.
    Returns all items with computed available_quantity and is_low_stock flag.
    Auto-polled by the frontend every 3 seconds via TanStack Query.
    """
    items = db.query(Item).order_by(Item.item_type, Item.name).all()

    return [
        {
            "id": item.id,
            "sku": item.sku,
            "name": item.name,
            "item_type": item.item_type.value,
            "unit": item.unit,
            "unit_cost": float(item.unit_cost),
            "selling_price": float(item.selling_price) if item.selling_price else None,
            "stock_quantity": round(float(item.stock_quantity), 4),
            "reserved_quantity": round(float(item.reserved_quantity), 4),
            "available_quantity": round(
                float(item.stock_quantity) - float(item.reserved_quantity), 4
            ),
            "reorder_level": float(item.critical_stock_level),
            "critical_stock_level": float(item.critical_stock_level),
            "target_stock_level": float(item.target_stock_level),
            "is_critical": (
                float(item.stock_quantity) <= float(item.critical_stock_level)
                and float(item.critical_stock_level) > 0
            ),
            "is_low_stock": (
                float(item.stock_quantity) <= float(item.critical_stock_level)
                and float(item.critical_stock_level) > 0
            ),
        }
        for item in items
    ]
