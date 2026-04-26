"""
API v1 Router — aggregates all sub-routers into a single prefix.
"""

from fastapi import APIRouter

from app.api.v1 import (
    items, bom, customers, orders, production, dashboard,
    suppliers, purchase_orders, invoices, storefront,
    auth, shipments, rma, hrm, finance
)

api_router = APIRouter()

api_router.include_router(auth.router)
api_router.include_router(items.router)
api_router.include_router(bom.router)
api_router.include_router(customers.router)
api_router.include_router(orders.router)
api_router.include_router(production.router)
api_router.include_router(dashboard.router)
api_router.include_router(suppliers.router)
api_router.include_router(purchase_orders.router)
api_router.include_router(invoices.router)
api_router.include_router(storefront.router)
api_router.include_router(shipments.router)
api_router.include_router(rma.router)
api_router.include_router(hrm.router)
api_router.include_router(finance.router)
