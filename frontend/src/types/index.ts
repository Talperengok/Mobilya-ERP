// ── TypeScript types matching the backend API schemas ──

export type ItemType = "RAW_MATERIAL" | "SUB_PRODUCT" | "FINISHED_GOOD";
export type EmployeeStatus = "AVAILABLE" | "ON_LEAVE" | "BUSY";
export type EmployeeRole = "ASSEMBLER" | "TECHNICIAN" | "PAINTER" | "QUALITY_INSPECTOR";

export interface InventoryItem {
  id: number;
  sku: string;
  name: string;
  item_type: ItemType;
  unit: string;
  unit_cost: number;
  selling_price: number | null;
  stock_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  reorder_level: number;
  critical_stock_level: number;
  target_stock_level: number;
  base_production_time_seconds: number;
  is_critical: boolean;
  is_low_stock: boolean;
}

export interface Customer {
  id: number;
  name: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  source: string;
}

export interface Employee {
  id: number;
  name: string;
  role: EmployeeRole;
  status: EmployeeStatus;
  current_production_id: number | null;
}

export interface OrderItem {
  id: number;
  item_id: number;
  item_name: string;
  quantity: number;
  unit_price: number;
  line_total: number;
}

export interface Shipment {
  id: number;
  order_id: number;
  tracking_number: string;
  courier_name: string | null;
  status: string;
  estimated_delivery_date: string | null;
  shipped_at: string | null;
  delivered_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Order {
  id: number;
  order_number: string;
  customer_name: string;
  customer_id: number;
  status: string;
  source: string;
  total_amount: number;
  order_date: string;
  item_count: number;
  items: OrderItem[];
  shipment?: Shipment;
}

export interface MaterialConsumed {
  material_name: string;
  material_sku: string;
  quantity: number;
  unit: string;
}

export interface ProductionOrder {
  id: number;
  order_id: number | null;
  item_id: number;
  item_name: string;
  item_sku: string;
  quantity_to_produce: number;
  status: string;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  estimated_completion_at: string | null;
  assigned_workstation: {
    id: number;
    name: string;
    station_type: string;
  } | null;
  worker_count: number;
  materials_consumed: MaterialConsumed[];
}

export interface DashboardStats {
  items: {
    raw_materials: number;
    sub_products: number;
    finished_goods: number;
    total: number;
  };
  low_stock_alerts: {
    id: number;
    name: string;
    sku: string;
    item_type: string;
    stock: number;
    reorder_level: number;
    critical_stock_level: number;
    target_stock_level: number;
  }[];
  orders: {
    pending: number;
    in_production: number;
    ready: number;
    shipped: number;
    delivered: number;
    total: number;
  };
  revenue: {
    gross: number;
    net: number;
  };
  production: {
    active: number;
    completed: number;
  };
}

export interface MRPResult {
  production_orders_created: number;
  materials_consumed: {
    material: string;
    sku: string;
    quantity_consumed: number;
    unit: string;
    remaining_stock: number;
    produced_for: string;
  }[];
  items_produced: {
    item: string;
    sku: string;
    quantity_produced: number;
    new_stock: number;
  }[];
}

export interface PlaceOrderResponse {
  order: {
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
  };
  mrp_result: MRPResult;
  message: string;
}

export interface PurchaseOrder {
  id: number;
  po_number: string;
  supplier_name: string;
  supplier_id: number;
  item_name: string;
  item_id: number;
  item_sku: string;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  status: string;
  order_date: string;
  ordered_at: string | null;
  estimated_delivery_at: string | null;
  received_date: string | null;
  notes: string | null;
  triggered_by_production_id: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  contact_person: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
}

export interface Workstation {
  id: number;
  name: string;
  station_type: string;
  is_available: boolean;
}

export interface BOMExplosionNode {
  item_id: number;
  item_name: string;
  item_sku: string;
  item_type: string;
  unit: string;
  quantity_per_unit: number;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  stock_available: number;
  stock_sufficient: boolean;
  level: number;
  children: BOMExplosionNode[];
}
