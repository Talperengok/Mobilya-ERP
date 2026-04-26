import asyncio
from datetime import datetime, timedelta
import logging

from app.db.session import SessionLocal
from app.models.order import Order, OrderStatus
from app.models.item import Item

logger = logging.getLogger(__name__)

async def clean_stale_reservations_loop(interval_seconds: int = 300, timeout_minutes: int = 30):
    """
    Background worker that runs every `interval_seconds`.
    It checks for PENDING orders older than `timeout_minutes`.
    If found, it cancels the order and releases the reserved material stock.
    """
    logger.info(f"Reservation cleaner started. Interval: {interval_seconds}s, Timeout: {timeout_minutes}m")
    while True:
        try:
            db = SessionLocal()
            now = datetime.utcnow()
            cutoff_time = now - timedelta(minutes=timeout_minutes)

            # Find stale PENDING orders
            stale_orders = (
                db.query(Order)
                .filter(Order.status == OrderStatus.PENDING)
                .filter(Order.order_date <= cutoff_time)
                .all()
            )

            for order in stale_orders:
                logger.info(f"Cancelling stale order {order.order_number} to release inventory.")
                
                # Release reserved quantities
                for order_item in order.items:
                    item = db.query(Item).filter(Item.id == order_item.item_id).with_for_update().first()
                    if item and item.reserved_quantity >= order_item.quantity:
                        item.reserved_quantity = float(item.reserved_quantity) - float(order_item.quantity)
                
                order.status = OrderStatus.CANCELLED
            
            db.commit()
        except Exception as e:
            logger.error(f"Error in reservation cleaner loop: {e}")
            if 'db' in locals():
                db.rollback()
        finally:
            if 'db' in locals():
                db.close()
        
        await asyncio.sleep(interval_seconds)
