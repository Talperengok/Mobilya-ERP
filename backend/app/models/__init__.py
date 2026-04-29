"""
Models package — import all models here so SQLAlchemy registers them
with the Base metadata when the package is imported.
"""

from app.models.item import Item, ItemType
from app.models.bom import BOMItem
from app.models.customer import Customer, CustomerSource
from app.models.order import Order, OrderItem, OrderStatus, OrderSource
from app.models.production import ProductionOrder, ProductionLog, ProductionStatus
from app.models.supplier import Supplier
from app.models.purchase_order import PurchaseOrder, PurchaseOrderStatus
from app.models.invoice import Invoice, InvoiceType, InvoiceStatus
from app.models.user import User, UserRole
from app.models.shipment import Shipment, ShipmentStatus
from app.models.employee import Employee, EmployeeRole
from app.models.workstation import Workstation, WorkstationType
from app.models.rma import RMATicket, RMAStatus
from app.models.journal_entry import JournalEntry
from app.models.ledger import LedgerEntry, AccountType
from app.models.waybill import Waybill, WaybillStatus
from app.models.scheduled_task import ScheduledTask, TaskStatus, TaskType
from app.models.bom_routing import BOMRouting
from app.models.operation_log import OperationLog, OperationStatus
from app.models.stock_lot import StockLot
from app.models.lot_consumption import LotConsumption
from app.models.role_permission import RolePermission

__all__ = [
    "Item", "ItemType",
    "BOMItem",
    "Customer", "CustomerSource",
    "Order", "OrderItem", "OrderStatus", "OrderSource",
    "ProductionOrder", "ProductionLog", "ProductionStatus",
    "Supplier",
    "PurchaseOrder", "PurchaseOrderStatus",
    "Invoice", "InvoiceType", "InvoiceStatus",
    "User", "UserRole",
    "Shipment", "ShipmentStatus",
    "Employee", "EmployeeRole",
    "Workstation", "WorkstationType",
    "RMATicket", "RMAStatus",
    "JournalEntry",
    "LedgerEntry", "AccountType",
    "Waybill", "WaybillStatus",
    "ScheduledTask", "TaskStatus", "TaskType",
    "BOMRouting",
    "OperationLog", "OperationStatus",
    "StockLot", "LotConsumption",
    "RolePermission",
]
