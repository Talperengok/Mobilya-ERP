"""
HRM & Capacity API — manage workforce and workstations
"""
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from app.core.deps import get_db, RequireRole
from app.models.employee import Employee, EmployeeRole, EmployeeStatus
from app.models.workstation import Workstation, WorkstationType
from app.models.user import UserRole

router = APIRouter(prefix="/hrm", tags=["HRM"])

class EmployeeCreate(BaseModel):
    name: str
    role: EmployeeRole

class WorkstationCreate(BaseModel):
    name: str
    station_type: WorkstationType

# --- Employees ---

@router.get("/employees")
def list_employees(db: Session = Depends(get_db)):
    employees = db.query(Employee).order_by(Employee.name).all()
    return [
        {
            "id": e.id,
            "name": e.name,
            "role": e.role.value,
            "status": e.status.value,
            "current_production_id": e.current_production_id,
        }
        for e in employees
    ]

@router.post("/employees", dependencies=[Depends(RequireRole([UserRole.ADMIN]))])
def create_employee(data: EmployeeCreate, db: Session = Depends(get_db)):
    emp = Employee(name=data.name, role=data.role, status=EmployeeStatus.AVAILABLE)
    db.add(emp)
    db.commit()
    db.refresh(emp)
    return {"id": emp.id, "name": emp.name, "role": emp.role.value}

# --- Workstations ---

@router.get("/workstations")
def list_workstations(db: Session = Depends(get_db)):
    workstations = db.query(Workstation).order_by(Workstation.name).all()
    return [
        {
            "id": w.id,
            "name": w.name,
            "station_type": w.station_type.value,
            "is_available": w.is_available,
        }
        for w in workstations
    ]

@router.post("/workstations", dependencies=[Depends(RequireRole([UserRole.ADMIN]))])
def create_workstation(data: WorkstationCreate, db: Session = Depends(get_db)):
    ws = Workstation(name=data.name, station_type=data.station_type, is_available=True)
    db.add(ws)
    db.commit()
    db.refresh(ws)
    return {"id": ws.id, "name": ws.name, "station_type": ws.station_type.value}

@router.patch("/workstations/{ws_id}/availability", dependencies=[Depends(RequireRole([UserRole.ADMIN, UserRole.FACTORY_MANAGER]))])
def toggle_workstation_availability(ws_id: int, is_available: bool, db: Session = Depends(get_db)):
    ws = db.get(Workstation, ws_id)
    if not ws:
        raise HTTPException(404, "Workstation not found")
    ws.is_available = is_available
    db.commit()
    return {"id": ws.id, "is_available": ws.is_available}
