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
        print("📦 Seeding Items...")
        base_items = [
            # Raw Materials
            Item(sku="RM-SCREW-M6", name="M6 Steel Screw", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=0.1, stock_quantity=10000, target_stock_level=10000, critical_stock_level=2000),
            Item(sku="RM-WOOD-OAK", name="Oak Wood Panel", item_type=ItemType.RAW_MATERIAL, unit="m2", unit_cost=45.0, stock_quantity=500, target_stock_level=500, critical_stock_level=100),
            Item(sku="RM-WOOD-PINE", name="Pine Wood Panel", item_type=ItemType.RAW_MATERIAL, unit="m2", unit_cost=25.0, stock_quantity=800, target_stock_level=800, critical_stock_level=150),
            Item(sku="RM-VARNISH", name="Wood Varnish", item_type=ItemType.RAW_MATERIAL, unit="liters", unit_cost=15.0, stock_quantity=200, target_stock_level=200, critical_stock_level=50),
            Item(sku="RM-STEEL-TUBE", name="Steel Tubing", item_type=ItemType.RAW_MATERIAL, unit="m", unit_cost=12.0, stock_quantity=1000, target_stock_level=1000, critical_stock_level=200),
            Item(sku="RM-RUBBER-CAP", name="Rubber Leg Cap", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=0.5, stock_quantity=2000, target_stock_level=2000, critical_stock_level=400),
            Item(sku="RM-FOAM-SEAT", name="Seat Foam", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=8.0, stock_quantity=300, target_stock_level=300, critical_stock_level=50),
            Item(sku="RM-FABRIC-BLU", name="Blue Fabric", item_type=ItemType.RAW_MATERIAL, unit="m2", unit_cost=18.0, stock_quantity=400, target_stock_level=400, critical_stock_level=100),
            Item(sku="RM-FABRIC-GRY", name="Grey Fabric", item_type=ItemType.RAW_MATERIAL, unit="m2", unit_cost=18.0, stock_quantity=400, target_stock_level=400, critical_stock_level=100),
            Item(sku="RM-DOWEL", name="Wooden Dowel", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=0.05, stock_quantity=5000, target_stock_level=5000, critical_stock_level=1000),
            Item(sku="RM-HINGE", name="Cabinet Hinge", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=2.5, stock_quantity=1000, target_stock_level=1000, critical_stock_level=200),
            Item(sku="RM-DRAWER-SLD", name="Drawer Slider", item_type=ItemType.RAW_MATERIAL, unit="set", unit_cost=15.0, stock_quantity=500, target_stock_level=500, critical_stock_level=100),
            Item(sku="RM-HANDLE", name="Metal Handle", item_type=ItemType.RAW_MATERIAL, unit="pcs", unit_cost=3.0, stock_quantity=1000, target_stock_level=1000, critical_stock_level=200),

            # Sub Products
            Item(sku="SP-TABLE-TOP-OAK", name="Oak Table Top (Treated)", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=110.0, stock_quantity=50, target_stock_level=50, critical_stock_level=10),
            Item(sku="SP-TABLE-TOP-PINE", name="Pine Table Top (Treated)", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=70.0, stock_quantity=50, target_stock_level=50, critical_stock_level=10),
            Item(sku="SP-METAL-LEG", name="Finished Metal Leg", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=15.0, stock_quantity=200, target_stock_level=200, critical_stock_level=40),
            Item(sku="SP-SEAT-PAD-BLU", name="Blue Seat Pad", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=35.0, stock_quantity=40, target_stock_level=40, critical_stock_level=10),
            Item(sku="SP-SEAT-PAD-GRY", name="Grey Seat Pad", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=35.0, stock_quantity=40, target_stock_level=40, critical_stock_level=10),
            Item(sku="SP-DRAWER-BOX", name="Assembled Drawer Box", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=45.0, stock_quantity=30, target_stock_level=30, critical_stock_level=5),
            Item(sku="SP-CABINET-FRAME", name="Pine Cabinet Frame", item_type=ItemType.SUB_PRODUCT, unit="pcs", unit_cost=105.0, stock_quantity=20, target_stock_level=20, critical_stock_level=5),

            # Finished Goods
            Item(sku="FG-DINING-TABLE-OAK", name="Premium Oak Dining Table", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=180.0, selling_price=599.0, stock_quantity=15, target_stock_level=20, critical_stock_level=5),
            Item(sku="FG-DINING-TABLE-PINE", name="Classic Pine Dining Table", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=140.0, selling_price=399.0, stock_quantity=25, target_stock_level=30, critical_stock_level=10),
            Item(sku="FG-OFFICE-CHAIR-BLU", name="Ergonomic Office Chair (Blue)", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=65.0, selling_price=189.0, stock_quantity=40, target_stock_level=50, critical_stock_level=15),
            Item(sku="FG-OFFICE-CHAIR-GRY", name="Ergonomic Office Chair (Grey)", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=65.0, selling_price=189.0, stock_quantity=35, target_stock_level=50, critical_stock_level=15),
            Item(sku="FG-BOOKSHELF", name="Tall Pine Bookshelf", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=120.0, selling_price=299.0, stock_quantity=20, target_stock_level=30, critical_stock_level=8),
            Item(sku="FG-NIGHTSTAND", name="Pine Nightstand", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=95.0, selling_price=159.0, stock_quantity=30, target_stock_level=40, critical_stock_level=10),
            Item(sku="FG-TV-STAND", name="Modern TV Stand", item_type=ItemType.FINISHED_GOOD, unit="pcs", unit_cost=210.0, selling_price=450.0, stock_quantity=10, target_stock_level=15, critical_stock_level=3),
        ]
        db.add_all(base_items)
        db.commit()

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

    # --- SUPPLIERS ---
    print("🚚 Checking/Seeding Suppliers...")
    if db.query(Supplier).count() == 0:
        suppliers = [
            Supplier(name="Kastamonu Entegre A.Ş.", contact_person="Ali Demir", email="ali@kastamonu.com", phone="+90 532 111 2233", address="Kastamonu Merkez OSB"),
            Supplier(name="Yıldız Sunta MDF", contact_person="Ayşe Çelik", email="ayse@yildizsunta.com", phone="+90 533 444 5566", address="Kocaeli Gebze OSB"),
            Supplier(name="Häfele Türkiye", contact_person="Mehmet Yılmaz", email="mehmet@hafele.com.tr", phone="+90 212 999 8877", address="İstanbul Dudullu OSB"),
            Supplier(name="Boya-Kim Sanayi", contact_person="Fatma Öz", email="fatma@boyakim.com", phone="+90 544 333 2211", address="Bursa İnegöl Mobilya İhtisas OSB")
        ]
        db.add_all(suppliers)
        db.flush()

    # --- WORKSTATIONS ---
    print("🏭 Checking/Seeding Workstations...")
    if db.query(Workstation).count() == 0:
        workstations = [
            Workstation(name="CNC Router 1 (High Speed)", station_type=WorkstationType.CNC, is_available=True),
            Workstation(name="CNC Router 2 (Precision)", station_type=WorkstationType.CNC, is_available=True),
            Workstation(name="CNC Router 3 (Heavy Duty)", station_type=WorkstationType.CNC, is_available=True),
            Workstation(name="Assembly Line A (Desks)", station_type=WorkstationType.ASSEMBLY, is_available=True),
            Workstation(name="Assembly Line B (Chairs)", station_type=WorkstationType.ASSEMBLY, is_available=True),
            Workstation(name="Assembly Line C (Cabinets)", station_type=WorkstationType.ASSEMBLY, is_available=True),
            Workstation(name="Assembly Line D (General)", station_type=WorkstationType.ASSEMBLY, is_available=True),
            Workstation(name="Paint & Finish Booth 1", station_type=WorkstationType.FINISHING, is_available=True),
            Workstation(name="Paint & Finish Booth 2", station_type=WorkstationType.FINISHING, is_available=True),
            Workstation(name="Welding Station 1", station_type=WorkstationType.WELDING, is_available=True),
            Workstation(name="Welding Station 2", station_type=WorkstationType.WELDING, is_available=True),
        ]
        db.add_all(workstations)
        db.flush()

    # --- EMPLOYEES ---
    print("👷 Checking/Seeding Employees...")
    from app.models.employee import EmployeeStatus
    if db.query(Employee).count() == 0:
        employees = [
            Employee(name="Ahmet Yılmaz", role=EmployeeRole.ASSEMBLER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Mehmet Demir", role=EmployeeRole.ASSEMBLER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Ayşe Kaya", role=EmployeeRole.ASSEMBLER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Fatma Çelik", role=EmployeeRole.ASSEMBLER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Ali Yıldız", role=EmployeeRole.TECHNICIAN, status=EmployeeStatus.AVAILABLE),
            Employee(name="Veli Şahin", role=EmployeeRole.TECHNICIAN, status=EmployeeStatus.AVAILABLE),
            Employee(name="Hasan Özcan", role=EmployeeRole.TECHNICIAN, status=EmployeeStatus.AVAILABLE),
            Employee(name="Hüseyin Aydın", role=EmployeeRole.PAINTER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Mustafa Arslan", role=EmployeeRole.PAINTER, status=EmployeeStatus.AVAILABLE),
            Employee(name="Zeynep Doğan", role=EmployeeRole.QUALITY_INSPECTOR, status=EmployeeStatus.AVAILABLE),
            Employee(name="Elif Kılıç", role=EmployeeRole.QUALITY_INSPECTOR, status=EmployeeStatus.AVAILABLE),
            Employee(name="Caner Kurt", role=EmployeeRole.ASSEMBLER, status=EmployeeStatus.AVAILABLE),
        ]
        db.add_all(employees)
        db.flush()

    # --- USERS (Quick Login Accounts) ---
    print("👤 Checking/Seeding Quick Login Users...")
    quick_users = [
        ("admin@mobilya.com", "admin123", UserRole.ADMIN, "Sistem Yöneticisi"),
        ("fabrika@mobilya.com", "fabrika123", UserRole.FACTORY_MANAGER, "Fabrika Müdürü"),
        ("lojistik@mobilya.com", "lojistik123", UserRole.LOGISTICS_OFFICER, "Lojistik Sorumlusu"),
        ("satis@mobilya.com", "satis123", UserRole.SALES_REP, "Satış Temsilcisi"),
    ]

    for email, password, role, full_name in quick_users:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            # Update password to match frontend presets
            existing.hashed_password = hash_password(password)
            existing.role = role
            existing.full_name = full_name
        else:
            db.add(User(
                email=email,
                hashed_password=hash_password(password),
                role=role,
                full_name=full_name,
            ))
    db.flush()

    db.commit()
    db.close()
    print("✅ Database BOM/Routing/Users saturation complete!")

if __name__ == "__main__":
    seed()
