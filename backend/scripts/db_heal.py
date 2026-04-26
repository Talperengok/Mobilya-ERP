"""
Database Capacity Healing Script

Use Case: If the server crashes mid-production or a bug strands an Employee/Workstation in `is_available = False`, this script can be run on a CRON schedule to "heal" capacity.

Strategy:
1. Scan all Employees and Workstations where `is_available` == False.
2. Cross-reference `ProductionOrder` where status is `IN_PROGRESS`.
3. If the resource ID is NOT in the active IN_PROGRESS list, set it back to `True`.
"""

import sys
import os

# Add backend to path so we can import app modules directly
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.core.database import SessionLocal
from app.models.employee import Employee
from app.models.workstation import Workstation
from app.models.production import ProductionOrder, ProductionStatus

def heal_deadlocks():
    db = SessionLocal()
    try:
        # Get all busy employees
        busy_employees = db.query(Employee).filter(Employee.is_available == False).all()
        # Get all active production assignments
        active_prod_orders = db.query(ProductionOrder).filter(ProductionOrder.status == ProductionStatus.IN_PROGRESS).all()
        
        active_emp_ids = {p.assigned_employee_id for p in active_prod_orders if p.assigned_employee_id}
        
        healed_emps = 0
        for emp in busy_employees:
            if emp.id not in active_emp_ids:
                emp.is_available = True
                healed_emps += 1
                
        # Get all busy workstations
        busy_workstations = db.query(Workstation).filter(Workstation.is_available == False).all()
        active_ws_ids = {p.assigned_workstation_id for p in active_prod_orders if p.assigned_workstation_id}
        
        healed_ws = 0
        for ws in busy_workstations:
            if ws.id not in active_ws_ids:
                ws.is_available = True
                healed_ws += 1
                
        if healed_emps > 0 or healed_ws > 0:
            db.commit()
            print(f"✅ DB Healed: Freed {healed_emps} deadlocked Employees and {healed_ws} Workstations.")
        else:
            print("👍 DB OK: No stranded capacities found.")
            
    except Exception as e:
        db.rollback()
        print(f"❌ Error healing DB: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    heal_deadlocks()
