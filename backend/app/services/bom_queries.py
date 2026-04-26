from sqlalchemy.orm import Session
from sqlalchemy import text
from typing import List, Dict, Any

def explode_bom_cte(db: Session, item_id: int, quantity: float = 1.0) -> List[Dict[str, Any]]:
    """
    Returns a flattened bill of materials required to produce `quantity` units of `item_id`.
    Uses a recursive CTE to prevent N+1 queries.
    """
    stmt = text("""
        WITH RECURSIVE bom_tree AS (
            -- Base case: The requested item's direct components
            SELECT 
                b.child_item_id as item_id,
                b.quantity as req_qty,
                1 AS depth,
                CAST(b.child_item_id AS VARCHAR) AS path
            FROM bill_of_materials b
            WHERE b.parent_item_id = :item_id
            
            UNION ALL
            
            -- Recursive step: Components of components
            SELECT 
                b.child_item_id as item_id,
                b.quantity * t.req_qty as req_qty,
                t.depth + 1 AS depth,
                t.path || '->' || b.child_item_id AS path
            FROM bill_of_materials b
            INNER JOIN bom_tree t ON b.parent_item_id = t.item_id
        )
        SELECT 
            i.id,
            i.name,
            i.sku,
            i.item_type,
            SUM(t.req_qty * :quantity) as total_required,
            i.stock_quantity,
            i.unit_cost
        FROM bom_tree t
        JOIN items i ON t.item_id = i.id
        GROUP BY i.id, i.name, i.sku, i.item_type, i.stock_quantity, i.unit_cost
        ORDER BY i.item_type, i.name;
    """)

    result = db.execute(stmt, {"item_id": item_id, "quantity": quantity}).fetchall()
    
    return [
        {
            "id": row.id,
            "name": row.name,
            "sku": row.sku,
            "item_type": row.item_type,
            "total_required": float(row.total_required),
            "current_stock": float(row.stock_quantity),
            "unit_cost": float(row.unit_cost),
        }
        for row in result
    ]
