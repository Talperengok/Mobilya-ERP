"""
Seed Data Script - populates the database with realistic furniture manufacturing data.
"""

from app.db.session import SessionLocal, engine
from app.db.base import Base
from app.models.item import Item, ItemType
from app.models.bom import BOMItem
from app.models.customer import Customer, CustomerSource
from app.models.stock_lot import StockLot
from app.models.bom_routing import BOMRouting
from app.models.workstation import Workstation, WorkstationType
from app.models.user import User, UserRole
from app.core.security import hash_password
from app.models.employee import Employee, EmployeeRole
from app.models.supplier import Supplier

# Ensure all models are imported so create_all works
import app.models  # noqa: F401

def seed():
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()

    print("🌱 Seeding/Fixing database...")

    # --- ITEMS ---
    if db.query(Item).count() == 0:
        # (Assuming items exist from previous runs, but defining for robustness)
        pass

    items = {i.sku: i for i in db.query(Item).all()}

    # --- BOM (TRULY COMPREHENSIVE) ---
    print("📋 Checking/Seeding BOMs (Final Check)...")
    existing_boms = db.query(BOMItem.parent_item_id, BOMItem.child_item_id).all()
    all_boms = [
        # Oak Dining Table
        (items["FG-DINING-TABLE-OAK"].id, items["SP-TABLE-TOP-OAK"].id, 1),
        (items["FG-DINING-TABLE-OAK"].id, items["SP-METAL-LEG"].id, 4),
        (items["FG-DINING-TABLE-OAK"].id, items["RM-SCREW-M6"].id, 16),
        
        # Pine Dining Table
        (items["FG-DINING-TABLE-PINE"].id, items["SP-TABLE-TOP-PINE"].id, 1),
        (items["FG-DINING-TABLE-PINE"].id, items["SP-METAL-LEG"].id, 4),
        (items["FG-DINING-TABLE-PINE"].id, items["RM-SCREW-M6"].id, 16),
        
        # Table Tops
        (items["SP-TABLE-TOP-OAK"].id, items["RM-WOOD-OAK"].id, 2),
        (items["SP-TABLE-TOP-OAK"].id, items["RM-VARNISH"].id, 0.5),
        (items["SP-TABLE-TOP-PINE"].id, items["RM-WOOD-PINE"].id, 2),
        (items["SP-TABLE-TOP-PINE"].id, items["RM-VARNISH"].id, 0.5),
        
        # Metal Leg
        (items["SP-METAL-LEG"].id, items["RM-STEEL-TUBE"].id, 1),
        (items["SP-METAL-LEG"].id, items["RM-RUBBER-CAP"].id, 1),

        # Office Chairs
        (items["FG-OFFICE-CHAIR-BLU"].id, items["SP-SEAT-PAD-BLU"].id, 1),
        (items["FG-OFFICE-CHAIR-BLU"].id, items["SP-METAL-LEG"].id, 1), # Simple base
        (items["FG-OFFICE-CHAIR-GRY"].id, items["SP-SEAT-PAD-GRY"].id, 1),
        (items["FG-OFFICE-CHAIR-GRY"].id, items["SP-METAL-LEG"].id, 1),

        # Seat Pads
        (items["SP-SEAT-PAD-BLU"].id, items["RM-FOAM-SEAT"].id, 1),
        (items["SP-SEAT-PAD-BLU"].id, items["RM-FABRIC-BLU"].id, 1),
        (items["SP-SEAT-PAD-GRY"].id, items["RM-FOAM-SEAT"].id, 1),
        (items["SP-SEAT-PAD-GRY"].id, items["RM-FABRIC-GRY"].id, 1),

        # Bookshelf
        (items["FG-BOOKSHELF"].id, items["RM-WOOD-PINE"].id, 4),
        (items["FG-BOOKSHELF"].id, items["RM-VARNISH"].id, 1),
        (items["FG-BOOKSHELF"].id, items["RM-DOWEL"].id, 12),

        # Nightstand
        (items["FG-NIGHTSTAND"].id, items["SP-DRAWER-BOX"].id, 1),
        (items["FG-NIGHTSTAND"].id, items["RM-WOOD-PINE"].id, 2),
        
        # TV Stand
        (items["FG-TV-STAND"].id, items["SP-CABINET-FRAME"].id, 1),
        (items["FG-TV-STAND"].id, items["SP-DRAWER-BOX"].id, 2),
        (items["FG-TV-STAND"].id, items["RM-HINGE"].id, 4),

        # Cabinet Frame
        (items["SP-CABINET-FRAME"].id, items["RM-WOOD-PINE"].id, 4),
        (items["SP-CABINET-FRAME"].id, items["RM-SCREW-M6"].id, 20),

        # Drawer Box
        (items["SP-DRAWER-BOX"].id, items["RM-WOOD-PINE"].id, 1),
        (items["SP-DRAWER-BOX"].id, items["RM-DRAWER-SLD"].id, 1),
        (items["SP-DRAWER-BOX"].id, items["RM-HANDLE"].id, 1),
    ]
    
    for pid, cid, qty in all_boms:
        if (pid, cid) not in existing_boms:
            db.add(BOMItem(parent_item_id=pid, child_item_id=cid, quantity=qty))
    db.flush()

    # --- ROUTINGS (FULL CATALOG) ---
    print("⚙️ Checking/Seeding Routings...")
    existing_routings = db.query(BOMRouting.item_id, BOMRouting.sequence).all()
    all_routings = [
        # Oak/Pine Table
        (items["FG-DINING-TABLE-OAK"].id, 10, "Cutting", WorkstationType.CNC, 30),
        (items["FG-DINING-TABLE-OAK"].id, 20, "Assembly", WorkstationType.ASSEMBLY, 45),
        (items["FG-DINING-TABLE-OAK"].id, 30, "Finishing", WorkstationType.FINISHING, 30),
        (items["FG-DINING-TABLE-PINE"].id, 10, "Cutting", WorkstationType.CNC, 30),
        (items["FG-DINING-TABLE-PINE"].id, 20, "Assembly", WorkstationType.ASSEMBLY, 45),
        (items["FG-DINING-TABLE-PINE"].id, 30, "Finishing", WorkstationType.FINISHING, 30),
        
        # Office Chairs
        (items["FG-OFFICE-CHAIR-BLU"].id, 10, "Assembly", WorkstationType.ASSEMBLY, 30),
        (items["FG-OFFICE-CHAIR-GRY"].id, 10, "Assembly", WorkstationType.ASSEMBLY, 30),
        
        # Bookshelf
        (items["FG-BOOKSHELF"].id, 10, "Cutting", WorkstationType.CNC, 25),
        (items["FG-BOOKSHELF"].id, 20, "Assembly", WorkstationType.ASSEMBLY, 35),
        
        # Nightstand
        (items["FG-NIGHTSTAND"].id, 10, "Assembly", WorkstationType.ASSEMBLY, 30),
        (items["FG-NIGHTSTAND"].id, 20, "Finishing", WorkstationType.FINISHING, 20),

        # TV Stand
        (items["FG-TV-STAND"].id, 10, "Frame Assembly", WorkstationType.ASSEMBLY, 40),
        (items["FG-TV-STAND"].id, 20, "Drawer Fitting", WorkstationType.ASSEMBLY, 30),
        (items["FG-TV-STAND"].id, 30, "Finishing", WorkstationType.FINISHING, 30),
    ]
    
    for iid, seq, name, ws_type, dur in all_routings:
        if (iid, seq) not in existing_routings:
            db.add(BOMRouting(item_id=iid, sequence=seq, operation_name=name, workstation_type=ws_type, duration_seconds=dur))
    db.flush()

    db.commit()
    db.close()
    print("✅ Database BOM/Routing saturation complete!")

if __name__ == "__main__":
    seed()
