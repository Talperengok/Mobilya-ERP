from app.db.session import SessionLocal
from app.models.item import Item, ItemType
from app.models.bom import BOMItem

def diagnose():
    db = SessionLocal()
    items = db.query(Item).all()
    print(f"--- ITEMS ({len(items)}) ---")
    sku_to_ids = {}
    for i in items:
        sku_to_ids.setdefault(i.sku, []).append(i.id)
    
    duplicates = {sku: ids for sku, ids in sku_to_ids.items() if len(ids) > 1}
    if duplicates:
        print("⚠️ DUPLICATE SKUs FOUND:")
        for sku, ids in duplicates.items():
            print(f"  {sku}: {ids}")
    else:
        print("✅ No duplicate SKUs.")

    print("\n--- BOM COVERAGE (FINISHED GOODS) ---")
    fgs = db.query(Item).filter(Item.item_type == ItemType.FINISHED_GOOD).all()
    for fg in fgs:
        bom_count = db.query(BOMItem).filter(BOMItem.parent_item_id == fg.id).count()
        status = "✅" if bom_count > 0 else "❌ MISSING"
        print(f"  {fg.sku} ({fg.id}): {status} (Components: {bom_count})")

    print("\n--- BOM COVERAGE (SUB-PRODUCTS) ---")
    sps = db.query(Item).filter(Item.item_type == ItemType.SUB_PRODUCT).all()
    for sp in sps:
        bom_count = db.query(BOMItem).filter(BOMItem.parent_item_id == sp.id).count()
        status = "✅" if bom_count > 0 else "❌ MISSING"
        print(f"  {sp.sku} ({sp.id}): {status} (Components: {bom_count})")
    
    db.close()

if __name__ == "__main__":
    diagnose()
