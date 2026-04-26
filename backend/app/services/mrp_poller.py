"""
MRP Background Service — periodically scans all items and triggers
auto-replenishment when stock falls below critical levels.
"""

import asyncio
from app.db.session import SessionLocal
from app.models.item import Item
from app.services.stock_evaluator import evaluate_stock_levels


async def mrp_background_loop():
    """Runs every 30 seconds, scanning all items for critical stock levels.
    Creates DRAFT purchase orders or production orders as needed."""
    while True:
        await asyncio.sleep(30)
        db = SessionLocal()
        try:
            items = db.query(Item).all()
            actions = []
            for item in items:
                result = evaluate_stock_levels(db, item.id)
                if result:
                    actions.append(result)
            if actions:
                db.commit()
                print(f"[MRP Poll] Auto-generated {len(actions)} replenishment orders: {actions}")
        except Exception as e:
            db.rollback()
            print(f"[MRP Poll] Error during stock evaluation: {e}")
        finally:
            db.close()
