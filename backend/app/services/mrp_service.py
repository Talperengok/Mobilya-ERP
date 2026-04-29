"""
MRP (Material Requirements Planning) Engine
=============================================

This is the **heart** of the ERP simulation.  It handles:

  1. Finished-good stock checking when an order arrives
  2. Recursive BOM explosion to determine material requirements
  3. Simulated production: consuming raw/sub materials and creating finished stock
  4. Full audit trail via ProductionOrder + ProductionLog records

Key design decisions
--------------------
* **Synchronous** — runs inside a single DB transaction for atomicity
* **Recursive** — SUB_PRODUCTs are produced on-the-fly if their stock is insufficient
* **Depth-limited** — max 10 levels to guard against circular BOM references

Algorithmic walkthrough
-----------------------
Given:  Order for 5× "Oak Dining Table" and only 2 in stock

  1. Reserve 2 from stock  →  deficit = 3
  2. Look up BOM:  1 Polished Top + 4 Metal Legs + 16 Screws + 8 Bolts
  3. For deficit of 3 tables, need: 3 Tops, 12 Legs, 48 Screws, 24 Bolts
  4. "Polished Top" is a SUB_PRODUCT with its own BOM (2 Oak Panels + 0.5L Varnish)
     → recursively check its stock and produce if needed
  5. After all materials consumed, add 3 tables to stock
  6. Reserve the produced tables for the order
"""

import uuid
from datetime import datetime

from sqlalchemy.orm import Session

from app.models.item import Item, ItemType
from app.models.bom import BOMItem
from app.models.order import Order, OrderStatus
from app.models.production import ProductionOrder, ProductionLog, ProductionStatus
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.services.stock_evaluator import evaluate_stock_levels


# ─── Custom Exceptions ──────────────────────────────────────────────


class InsufficientRawMaterialError(Exception):
    """Raised when a raw material lacks sufficient stock and cannot be produced."""

    def __init__(self, item_name: str, sku: str, needed: float, available: float):
        self.item_name = item_name
        self.sku = sku
        self.needed = needed
        self.available = available
        super().__init__(
            f"Insufficient raw material '{item_name}' (SKU: {sku}): "
            f"need {needed:.4f}, only {available:.4f} available"
        )


class NoBOMDefinedError(Exception):
    """Raised when we need to produce an item but no BOM recipe exists."""

    def __init__(self, item_name: str):
        self.item_name = item_name
        super().__init__(f"No Bill of Materials defined for '{item_name}'")


# ─── MRP Result Accumulator ─────────────────────────────────────────


class MRPResult:
    """Collects all side-effects of an MRP run for reporting."""

    def __init__(self):
        self.production_orders: list[ProductionOrder] = []
        self.consumption_log: list[dict] = []
        self.items_produced: list[dict] = []
        self.purchase_orders_created: list[dict] = []

    @property
    def has_production(self) -> bool:
        return len(self.production_orders) > 0

    def to_dict(self) -> dict:
        return {
            "production_orders_created": len(self.production_orders),
            "materials_consumed": self.consumption_log,
            "items_produced": self.items_produced,
            "purchase_orders_created": self.purchase_orders_created,
        }


# ─── MRP Service ────────────────────────────────────────────────────


class MRPService:
    """
    Stateful service bound to a single DB session.
    All mutations are flushed (not committed) — the caller controls the transaction.
    """

    MAX_BOM_DEPTH = 10

    def __init__(self, db: Session):
        self.db = db

    # ── Public API ───────────────────────────────────────────────

    def process_order(self, order: Order) -> MRPResult:
        """
        Entry point: run MRP for every line-item in an order.

        Returns an MRPResult summarising all production and consumption.
        The caller is responsible for committing or rolling back.
        """
        result = MRPResult()

        for order_item in order.items:
            product = order_item.item

            # Guard: only FINISHED_GOODs can be ordered
            if product.item_type != ItemType.FINISHED_GOOD:
                raise ValueError(
                    f"Item '{product.name}' (SKU: {product.sku}) is not a FINISHED_GOOD. "
                    f"Only finished goods can appear in customer orders."
                )

            available = float(product.stock_quantity) - float(product.reserved_quantity)
            needed = order_item.quantity

            if available >= needed:
                # ✅ Happy path — fulfill entirely from existing stock
                # Stock is already reserved by order_service.
                # Physical deduction and FIFO consumption will happen when the order is SHIPPED.
                pass
            else:
                # ⚠️ Partial or zero stock — need production
                deficit = needed - max(0.0, available)

                # Produce the deficit quantity
                success = self._produce_item(
                    item=product,
                    quantity=deficit,
                    order_id=order.id,
                    result=result,
                    depth=0,
                )

                if success:
                    # Stock reservation was already fully applied in order_service,
                    # so we just successfully produced the deficit stock!
                    pass

        # Update order status based on what happened
        # Filter to ensure we only count non-waiting production orders
        has_active_production = any(
            p.status in [ProductionStatus.IN_PROGRESS, ProductionStatus.COMPLETED]
            for p in result.production_orders
        )
        has_waiting_production = any(
            p.status == ProductionStatus.WAITING_CAPACITY
            for p in result.production_orders
        )

        if has_waiting_production:
            order.status = OrderStatus.WAITING_FOR_MATERIALS
        elif has_active_production:
            order.status = OrderStatus.IN_PRODUCTION
        else:
            order.status = OrderStatus.READY
            if hasattr(order, "shipment") and order.shipment:
                from app.models.shipment import ShipmentStatus
                order.shipment.status = ShipmentStatus.READY_FOR_PICKUP

        self.db.flush()
        return result

    def explode_bom(self, item_id: int, quantity: float = 1.0):
        """
        Recursive BOM explosion — builds a tree structure matching the 
        frontend BOMExplosionNode interface.
        """
        return self._build_bom_tree(item_id, 1.0, quantity, 0)

    def _build_bom_tree(self, item_id: int, qty_per_parent: float, parent_total_qty: float, level: int):
        item = self.db.get(Item, item_id)
        if not item:
            raise ValueError(f"Item with id {item_id} not found")
            
        total_quantity = qty_per_parent * parent_total_qty
        
        node = {
            "item_id": item.id,
            "item_name": item.name,
            "item_sku": item.sku,
            "item_type": item.item_type.value,
            "unit": item.unit,
            "quantity_per_unit": qty_per_parent,
            "total_quantity": total_quantity,
            "unit_cost": float(item.unit_cost),
            "total_cost": float(item.unit_cost) * total_quantity,
            "stock_available": float(item.stock_quantity),
            "stock_sufficient": float(item.stock_quantity) >= total_quantity,
            "level": level,
            "children": []
        }
        
        from app.models.bom import BOMItem
        children_links = self.db.query(BOMItem).filter(BOMItem.parent_item_id == item.id).all()
        for link in children_links:
            child_node = self._build_bom_tree(
                link.child_item_id, 
                float(link.quantity), 
                total_quantity, 
                level + 1
            )
            node["children"].append(child_node)
            
        return node

    # ── Direct Stock Consumption (no production log) ────────────

    def _consume_stock_direct(self, item: Item, quantity: float):
        """
        Consume `quantity` units from StockLots via FIFO for direct fulfillment.
        Unlike _consume_fifo, this does NOT require a ProductionLog —
        used when finished goods are shipped directly from existing stock.
        
        Note: item.stock_quantity is already decremented by the caller;
        this method only updates the StockLot.remaining_quantity values
        to keep the lot ledger in sync.
        """
        from app.models.stock_lot import StockLot

        lots = (
            self.db.query(StockLot)
            .filter(StockLot.item_id == item.id, StockLot.remaining_quantity > 0)
            .order_by(StockLot.received_at.asc())
            .with_for_update()
            .all()
        )

        remaining_need = quantity
        for lot in lots:
            if remaining_need <= 0:
                break
            take = min(float(lot.remaining_quantity), remaining_need)
            lot.remaining_quantity = float(lot.remaining_quantity) - take
            remaining_need -= take

        # If remaining_need > 0, lots are out of sync with stock_quantity.
        # This is a data integrity issue from legacy data; log but don't crash.
        if remaining_need > 0.0001:
            import logging
            logging.getLogger(__name__).warning(
                f"StockLot deficit for {item.sku}: needed {quantity} from lots, "
                f"but {remaining_need:.4f} units were not covered by any lot."
            )

    # ── FIFO Lot Consumption (with production log audit) ──────

    def _consume_fifo(self, item: Item, required_qty: float, prod_log: ProductionLog):
        """
        Consume `required_qty` units of `item` using FIFO lot ordering.
        Each lot is locked with FOR UPDATE to prevent concurrent over-consumption.
        """
        from app.models.stock_lot import StockLot
        from app.models.lot_consumption import LotConsumption

        lots = (
            self.db.query(StockLot)
            .filter(StockLot.item_id == item.id, StockLot.remaining_quantity > 0)
            .order_by(StockLot.received_at.asc())
            .with_for_update()
            .all()
        )

        remaining_need = required_qty
        for lot in lots:
            if remaining_need <= 0:
                break

            take = min(float(lot.remaining_quantity), remaining_need)
            lot.remaining_quantity = float(lot.remaining_quantity) - take
            remaining_need -= take

            # Audit trail: which lot supplied how much
            consumption = LotConsumption(
                stock_lot_id=lot.id,
                production_log_id=prod_log.id,
                quantity_consumed=take,
            )
            self.db.add(consumption)

        if remaining_need > 0.0001:  # float tolerance
            raise InsufficientRawMaterialError(
                item_name=item.name, sku=item.sku,
                needed=required_qty,
                available=required_qty - remaining_need,
            )

        # Update cache column
        item.stock_quantity = float(item.stock_quantity) - required_qty


    def _produce_item(
        self,
        item: Item,
        quantity: float,
        order_id: int | None,
        result: MRPResult,
        depth: int,
    ) -> bool:
        """
        Recursively produce `quantity` units of `item`.

        Algorithm:
        ─────────
        1. Fetch BOM for this item (its recipe)
        2. Create a ProductionOrder record
        3. For each BOM component:
           a) Calculate required_qty = BOM.quantity × production quantity
           b) If the component is a SUB_PRODUCT with insufficient stock:
              → recursively _produce_item for the sub-product first
           c) Verify stock is now sufficient
           d) Deduct stock and log the consumption
        4. Add the produced quantity to this item's stock
        5. Mark the ProductionOrder as COMPLETED
        """
        # ── Safety: prevent infinite recursion from circular BOMs
        if depth > self.MAX_BOM_DEPTH:
            raise RecursionError(
                f"BOM recursion depth exceeded ({self.MAX_BOM_DEPTH} levels) "
                f"while producing '{item.name}'. Check for circular BOM references."
            )

        # ── 1. Get BOM components
        bom_items = (
            self.db.query(BOMItem)
            .filter(BOMItem.parent_item_id == item.id)
            .all()
        )
        if not bom_items:
            raise NoBOMDefinedError(item.name)

        # ── 2. Create production order
        prod_order = ProductionOrder(
            order_id=order_id,
            item_id=item.id,
            quantity_to_produce=quantity,
            started_at=datetime.utcnow()
        )
        
        from app.models.employee import Employee, EmployeeStatus
        from app.models.workstation import Workstation

        employee = self.db.query(Employee).filter(Employee.status == EmployeeStatus.AVAILABLE).with_for_update().first()
        workstation = self.db.query(Workstation).filter(Workstation.is_available == True).with_for_update().first()

        if employee and workstation:
            prod_order.assigned_employee_id = employee.id
            prod_order.assigned_workstation_id = workstation.id
            employee.status = EmployeeStatus.BUSY
            workstation.is_available = False
            prod_order.status = ProductionStatus.IN_PROGRESS
        else:
            # Block production: set status and return immediately without consuming materials
            prod_order.status = ProductionStatus.WAITING_CAPACITY
            self.db.add(prod_order)
            self.db.flush()
            result.production_orders.append(prod_order)
            return False

        self.db.add(prod_order)
        self.db.flush()  # Assigns prod_order.id for FK reference in logs
        result.production_orders.append(prod_order)

        # ── 3. Process each BOM component
        for bom in bom_items:
            # Re-fetch child with a pessimistic lock
            child = self.db.query(Item).filter(Item.id == bom.child_item_id).with_for_update().first()
            required_qty = float(bom.quantity) * quantity
            current_stock = float(child.stock_quantity)

            # 3a. If child is a SUB_PRODUCT with insufficient stock → produce it
            if child.item_type == ItemType.SUB_PRODUCT and current_stock < required_qty:
                sub_deficit = required_qty - current_stock
                sub_success = self._produce_item(
                    item=child,
                    quantity=sub_deficit,
                    order_id=None,  # sub-production isn't tied to the customer order
                    result=result,
                    depth=depth + 1,
                )
                if not sub_success:
                    # Cascade failure up to this parent order: abort
                    prod_order.status = ProductionStatus.WAITING_CAPACITY
                    if employee:
                        employee.status = EmployeeStatus.AVAILABLE
                    if workstation:
                        workstation.is_available = True
                    self.db.flush()
                    return False
                # After the recursive call, child.stock_quantity has been updated

            # 3b. If still insufficient → auto-purchase for RAW_MATERIALs
            current_stock = float(child.stock_quantity)
            if current_stock < required_qty:
                if child.item_type == ItemType.RAW_MATERIAL:
                    purchase_deficit = required_qty - current_stock
                    self._auto_purchase(child, purchase_deficit, prod_order, result)
                    # Stock has been updated by _auto_purchase
                else:
                    raise InsufficientRawMaterialError(
                        item_name=child.name,
                        sku=child.sku,
                        needed=required_qty,
                        available=current_stock,
                    )

            # 3c. Create audit log FIRST so we can use its ID for lot consumptions
            log = ProductionLog(
                production_order_id=prod_order.id,
                consumed_item_id=child.id,
                quantity_consumed=required_qty,
            )
            self.db.add(log)
            self.db.flush()

            # 3d. Consume stock using FIFO
            self._consume_fifo(child, required_qty, log)

            result.consumption_log.append(
                {
                    "material": child.name,
                    "sku": child.sku,
                    "quantity_consumed": round(required_qty, 4),
                    "unit": child.unit,
                    "remaining_stock": round(float(child.stock_quantity), 4),
                    "produced_for": item.name,
                }
            )

        # ── 4. Production complete → add output to item stock
        item.stock_quantity = float(item.stock_quantity) + quantity
        
        # In case the new stock isn't enough to bring us above critical, we evaluate
        from app.services.stock_evaluator import evaluate_stock_levels
        evaluate_stock_levels(self.db, item.id)

        prod_order.status = ProductionStatus.COMPLETED
        prod_order.completed_at = datetime.utcnow()
        if employee:
            employee.status = EmployeeStatus.AVAILABLE
        if workstation:
            workstation.is_available = True

        result.items_produced.append(
            {
                "item": item.name,
                "sku": item.sku,
                "quantity_produced": round(quantity, 4),
                "new_stock": round(float(item.stock_quantity), 4),
            }
        )

        self.db.flush()
        return True

    # ── Auto-Purchase for Raw Material Deficits ──────────────────

    def _auto_purchase(
        self,
        item: Item,
        quantity: float,
        production_order: ProductionOrder,
        result: MRPResult,
    ) -> None:
        """
        Auto-generate a Purchase Order when raw material stock is insufficient.

        The purchase is INSTANTLY simulated (received immediately) so
        production can continue without blocking. In a real system, this
        would create a DRAFT PO and pause production until materials arrive.
        """
        # Find any available supplier
        supplier = self.db.query(Supplier).first()
        if not supplier:
            raise InsufficientRawMaterialError(
                item_name=item.name,
                sku=item.sku,
                needed=quantity + float(item.stock_quantity),
                available=float(item.stock_quantity),
            )

        po = PurchaseOrder(
            po_number=f"PO-{uuid.uuid4().hex[:8].upper()}",
            supplier_id=supplier.id,
            item_id=item.id,
            quantity=quantity,
            unit_cost=float(item.unit_cost),
            total_cost=round(float(item.unit_cost) * quantity, 2),
            status=PurchaseOrderStatus.RECEIVED,  # Instantly fulfilled (simulation)
            order_date=datetime.utcnow(),
            received_date=datetime.utcnow(),
            triggered_by_production_id=production_order.id,
            notes=f"Auto-generated by MRP engine during production",
        )
        self.db.add(po)

        # Simulate receiving: add purchased stock
        item.stock_quantity = float(item.stock_quantity) + quantity
        
        # Create lot
        from app.models.stock_lot import StockLot
        lot = StockLot(
            item_id=item.id,
            source_type="PURCHASE",
            source_id=po.id,
            initial_quantity=quantity,
            remaining_quantity=quantity,
            unit_cost=float(item.unit_cost),
        )
        self.db.add(lot)

        result.purchase_orders_created.append(
            {
                "po_number": po.po_number,
                "item": item.name,
                "sku": item.sku,
                "quantity_purchased": round(quantity, 4),
                "unit": item.unit,
                "supplier": supplier.name,
                "total_cost": po.total_cost,
            }
        )

        self.db.flush()

    # ── Read-Only BOM Explosion (for display) ────────────────────

    # ── Read-Only BOM Explosion has been moved to SQL CTE for performance (see explode_bom)
