export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  selling_price: number;
  unit_cost: number;
  stock_quantity: number;
  available: boolean;
  available_stock?: number;
  unit?: string;
  image_url?: string | null;
}

export interface CartItem {
  id: number;
  name: string;
  sku: string;
  price: number;
  quantity: number;
  available_stock: number;
}

export interface CheckoutResponse {
  success: boolean;
  order: {
    id: number;
    order_number: string;
    status: string;
    total_amount: number;
  };
  invoice: {
    invoice_number: string;
    subtotal: number;
    tax_amount: number;
    total_amount: number;
    status: string;
  } | null;
  mrp_summary: {
    production_triggered: boolean;
    production_orders: number;
    materials_consumed: number;
    purchase_orders_created: number;
  };
  message: string;
}

export interface UserProfile {
  id: number;
  email: string;
  full_name: string;
  role: string;
  customer_id: number | null;
}

export interface ShipmentTracking {
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

export interface OrderHistory {
  id: number;
  order_number: string;
  status: string;
  total_amount: number;
  order_date: string;
  item_count: number;
  shipment: ShipmentTracking | null;
}
