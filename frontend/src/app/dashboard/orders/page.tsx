"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type {
  Order,
  Customer,
  InventoryItem,
  PlaceOrderResponse,
} from "@/types";
import {
  ShoppingCart,
  Plus,
  Trash2,
  Loader2,
  CheckCircle,
  Factory,
  X,
  Eye,
  Info,
  Package,
  AlertCircle,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";
import PurchaseOrdersView, { NewOrderModal } from "./purchase-orders";

// â”€â”€ Hooks â”€â”€

function useOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders"],
    queryFn: async () => (await api.get("/orders")).data,
    refetchInterval: 5000,
  });
}

function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });
}

function useFinishedGoods() {
  return useQuery<InventoryItem[]>({
    queryKey: ["items", "FINISHED_GOOD"],
    queryFn: async () =>
      (await api.get("/items", { params: { item_type: "FINISHED_GOOD" } }))
        .data,
  });
}

function useCreateOrder() {
  const queryClient = useQueryClient();
  return useMutation<PlaceOrderResponse, Error, any>({
    mutationFn: async (orderData) => (await api.post("/orders", orderData)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    },
  });
}

function useOrderDetail(id: number | null) {
  return useQuery({
    queryKey: ["orders", id],
    queryFn: async () => (await api.get(`/orders/${id}`)).data,
    enabled: !!id,
  });
}

// â”€â”€ Status badge colors â”€â”€

const statusStyles: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-300",
  IN_PRODUCTION: "bg-blue-500/20 text-blue-300",
  READY: "bg-emerald-500/20 text-emerald-300",
  SHIPPED: "bg-cyan-500/20 text-cyan-300",
  DELIVERED: "bg-gray-500/20 text-gray-300",
  CANCELLED: "bg-red-500/20 text-red-300",
};

// â”€â”€ Page Component â”€â”€

export default function OrdersPage() {
  const { t } = useTranslation();
  const { data: orders, isLoading } = useOrders();
  const { data: customers } = useCustomers();
  const { data: products } = useFinishedGoods();
  const createOrder = useCreateOrder();

  const [showForm, setShowForm] = useState(false);
  const [mrpResult, setMrpResult] = useState<PlaceOrderResponse | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  
  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"customer" | "purchase">("customer");

  // Purchase Order modal state (controlled from header)
  const [isPurchaseModalOpen, setIsPurchaseModalOpen] = useState(false);

  // New filter states
  const [statusFilter, setStatusFilter] = useState<string>(''); // empty = all
  const [searchId, setSearchId] = useState<string>('');
  // Compute filtered orders based on status and ID search
  const filteredOrders = orders?.filter((order) => {
    const matchesStatus = statusFilter ? order.status === statusFilter : true;
    const matchesId = searchId ? order.order_number.toLowerCase().includes(searchId.toLowerCase()) : true;
    return matchesStatus && matchesId;
  }) || [];
  const [formData, setFormData] = useState({
    customer_id: "",
    source: "ONLINE",
    items: [{ item_id: "", quantity: 1 }],
  });
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const { data: orderDetail, isLoading: isLoadingDetail } = useOrderDetail(selectedOrderId);

  const addLineItem = () => {
    setFormData((prev) => ({
      ...prev,
      items: [...prev.items, { item_id: "", quantity: 1 }],
    }));
  };

  const removeLineItem = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setMrpResult(null);

    try {
      const result = await createOrder.mutateAsync({
        customer_id: parseInt(formData.customer_id),
        source: formData.source,
        items: formData.items.map((item) => ({
          item_id: parseInt(item.item_id),
          quantity: parseInt(String(item.quantity)),
        })),
      });
      setMrpResult(result);
      setFormData({
        customer_id: "",
        source: "ONLINE",
        items: [{ item_id: "", quantity: 1 }],
      });
    } catch (error: any) {
      const detail = error.response?.data?.detail;
      setErrorMsg(
        typeof detail === "string"
          ? detail
          : detail?.message || t.common.error
      );
    }
  };

  return (
    <div className="space-y-6">
      {/* â”€â”€ Header â”€â”€ */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <ShoppingCart className="text-blue-500" />
            {t.orders.title}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t.orders.subtitle}
          </p>
        </div>
        <button
          onClick={() => {
            if (activeTab === "purchase") {
              setIsPurchaseModalOpen(true);
            } else {
              setShowForm(!showForm);
              setMrpResult(null);
              setErrorMsg(null);
            }
          }}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          {(activeTab === "customer" && showForm) ? <X size={16} /> : <Plus size={16} />}
          {activeTab === "purchase"
            ? t.orders.newPurchaseOrder
            : showForm
            ? t.orders.cancel
            : t.orders.newOrder}
        </button>
      </div>

      {/* â”€â”€ Tabs â”€â”€ */}
      <div className="flex items-center gap-1 bg-gray-900 w-fit p-1 rounded-lg border border-gray-800">
        <button
          onClick={() => setActiveTab("customer")}
          className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === "customer" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {t.orders.tabs.customer}
        </button>
        <button
          onClick={() => setActiveTab("purchase")}
          className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
            activeTab === "purchase" ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          <Package size={14} /> {t.orders.tabs.procurement}
        </button>
      </div>

      {/* â”€â”€ Content Area â”€â”€ */}
      {activeTab === "purchase" ? (
        <>
          <PurchaseOrdersView />
          {isPurchaseModalOpen && (
            <NewOrderModal onClose={() => setIsPurchaseModalOpen(false)} />
          )}
        </>
      ) : (
      <>
        {/* â”€â”€ Order Form â”€â”€ */}
      {showForm && (
        <div className="glass-card p-6 border-blue-500/30">
          <h3 className="text-lg font-semibold mb-4">{t.orders.newOrder}</h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Customer */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {t.orders.customer}
                </label>
                <select
                  value={formData.customer_id}
                  onChange={(e) =>
                    setFormData((prev) => ({
                      ...prev,
                      customer_id: e.target.value,
                    }))
                  }
                  required
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="">{t.orders.selectCustomer}</option>
                  {customers?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.source})
                    </option>
                  ))}
                </select>
              </div>

              {/* Source */}
              <div>
                <label className="block text-sm text-gray-400 mb-1">
                  {t.orders.channel}
                </label>
                <select
                  value={formData.source}
                  onChange={(e) =>
                    setFormData((prev) => ({ ...prev, source: e.target.value }))
                  }
                  className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                >
                  <option value="ONLINE">Online</option>
                  <option value="POS">POS (In-Store)</option>
                </select>
              </div>
            </div>

            {/* Line Items */}
            <div>
              <label className="block text-sm text-gray-400 mb-2">
                {t.orders.products}
              </label>
              <div className="space-y-2">
                {formData.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 items-center">
                    <select
                      value={item.item_id}
                      onChange={(e) => {
                        const items = [...formData.items];
                        items[idx].item_id = e.target.value;
                        setFormData((prev) => ({ ...prev, items }));
                      }}
                      required
                      className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="">{t.orders.selectProduct}</option>
                      {products?.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.name} â€” {formatCurrency(p.selling_price || p.unit_cost)} (Stock:{" "}
                          {p.available_quantity})
                        </option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="1"
                      value={item.quantity}
                      onChange={(e) => {
                        const items = [...formData.items];
                        items[idx].quantity = parseInt(e.target.value) || 1;
                        setFormData((prev) => ({ ...prev, items }));
                      }}
                      className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm text-center focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    />
                    {formData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeLineItem(idx)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addLineItem}
                  className="text-sm text-blue-400 hover:text-blue-300 flex items-center gap-1"
                >
                  <Plus size={14} /> {t.orders.addProduct}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={createOrder.isPending}
              className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              {createOrder.isPending ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ShoppingCart size={16} />
              )}
              {t.orders.placeOrder}
            </button>
          </form>
        </div>
      )}

      {/* â”€â”€ Filter Controls â”€â”€ */}
      <div className="flex flex-col md:flex-row items-center gap-4 mb-4">
        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        >
          <option value="">{t.orders.filterPlaceholder}</option>
          {Object.keys(statusStyles).map((status) => (
            <option key={status} value={status}>
              {status.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
        {/* Order ID Search */}
        <input
          type="text"
          placeholder={t.orders.searchPlaceholder}
          value={searchId}
          onChange={(e) => setSearchId(e.target.value)}
          className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
        />
      </div>
      {/* â”€â”€ MRP Result â”€â”€ */}
      {mrpResult && (
        <div className="glass-card border-emerald-500/30 bg-emerald-950/10 p-6">
          <h3 className="font-semibold text-emerald-400 flex items-center gap-2 mb-3">
            <CheckCircle size={18} />
            {mrpResult.message}
          </h3>
          <div className="text-sm space-y-1 text-gray-300">
            <p>
              Order:{" "}
              <span className="font-mono text-white">
                {mrpResult.order.order_number}
              </span>{" "}
              â€” Status:{" "}
              <span className="font-semibold">{mrpResult.order.status}</span>
            </p>
            <p>Total: {formatCurrency(mrpResult.order.total_amount)}</p>
          </div>

          {mrpResult.mrp_result.production_orders_created > 0 && (
            <div className="mt-4 space-y-3">
              {mrpResult.mrp_result.items_produced.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-2 flex items-center gap-1">
                    <Factory size={12} /> Items Produced
                  </p>
                  {mrpResult.mrp_result.items_produced.map((ip, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>
                        {ip.item}{" "}
                        <span className="text-gray-500">({ip.sku})</span>
                      </span>
                      <span className="text-emerald-400">
                        +{ip.quantity_produced} â†’ stock: {ip.new_stock}
                      </span>
                    </div>
                  ))}
                </div>
              )}
              {mrpResult.mrp_result.materials_consumed.length > 0 && (
                <div className="bg-gray-900/50 rounded-lg p-4">
                  <p className="text-xs text-gray-400 uppercase font-medium mb-2">
                    Materials Consumed
                  </p>
                  {mrpResult.mrp_result.materials_consumed.map((mc, i) => (
                    <div key={i} className="flex justify-between text-sm py-1">
                      <span>
                        {mc.material}{" "}
                        <span className="text-gray-500">({mc.sku})</span>
                      </span>
                      <span className="text-orange-400">
                        -{mc.quantity_consumed} {mc.unit} â†’ remaining:{" "}
                        {mc.remaining_stock}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* â”€â”€ Error â”€â”€ */}
      {errorMsg && (
        <div className="glass-card border-red-500/30 bg-red-950/20 p-4">
          <p className="text-red-400 flex items-center gap-2 text-sm">
            <AlertCircle size={16} />
            {errorMsg}
          </p>
        </div>
      )}

      {/* â”€â”€ Orders Table â”€â”€ */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  Order #
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.customer}
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.channel}
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.items}
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.total}
                </th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.status}
                </th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.orders.date}
                </th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                  {t.finance.table.action}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="text-center py-12 text-gray-500">
                    <Loader2
                      className="animate-spin mx-auto mb-2"
                      size={24}
                    />
                    Loading orders...
                  </td>
                </tr>
              ) : orders && orders.length > 0 ? (
                filteredOrders.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-gray-800/30 transition-colors"
                  >
                    <td className="px-6 py-4 text-sm font-mono text-blue-400">
                      {order.order_number}
                    </td>
                    <td className="px-6 py-4 text-sm">{order.customer_name}</td>
                    <td className="px-6 py-4 text-sm text-center text-gray-400">
                      {order.source}
                    </td>
                    <td className="px-6 py-4 text-sm text-center">
                      {order.item_count}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium">
                      {formatCurrency(order.total_amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                          statusStyles[order.status] || ""
                        }`}
                      >
                        {order.status.replace(/_/g, " ")}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-400">
                      {order.order_date
                        ? new Date(order.order_date).toLocaleString()
                        : "â€”"}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedOrderId(order.id)}
                        className="p-1.5 text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors"
                        title={t.orders.viewDetails}
                      >
                        <Eye size={18} />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td
                    colSpan={7}
                    className="text-center py-12 text-gray-500"
                  >
                    No orders yet. Place your first order above!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* â”€â”€ Order Detail Modal â”€â”€ */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border-blue-500/30">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  <Info className="text-blue-500" size={20} />
                  {orderDetail?.order_number || "..."}
                </h2>
                <p className="text-sm text-gray-400 mt-1">
                  {orderDetail?.customer?.name} â€” {orderDetail?.order_date ? new Date(orderDetail.order_date).toLocaleString() : ""}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
              {isLoadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  Loading details...
                </div>
              ) : orderDetail ? (
                <>
                  {/* Line Items */}
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShoppingCart size={14} /> {t.orders.lineItems}
                    </h3>
                    <div className="bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700/50">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 font-medium">Product</th>
                            <th className="px-4 py-2 font-medium text-center">Qty</th>
                            <th className="px-4 py-2 font-medium text-right">{t.orders.unitPrice}</th>
                            <th className="px-4 py-2 font-medium text-right">Total</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {orderDetail.items?.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-700/20">
                              <td className="px-4 py-3 text-white font-medium">{item.item_name}</td>
                              <td className="px-4 py-3 text-center text-gray-300">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-gray-400">{formatCurrency(item.unit_price)}</td>
                              <td className="px-4 py-3 text-right text-white font-semibold">{formatCurrency(item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-900/40">
                          <tr>
                            <td colSpan={3} className="px-4 py-3 text-right text-gray-400 uppercase text-xs font-bold">{t.orders.total}</td>
                            <td className="px-4 py-3 text-right text-blue-400 font-bold text-lg">{formatCurrency(orderDetail.total_amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>

                  {/* Production Orders */}
                  {orderDetail.production_orders?.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Factory size={14} /> {t.orders.productionOrders}
                      </h3>
                      <div className="space-y-2">
                        {orderDetail.production_orders.map((po: any) => (
                          <div key={po.id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/50">
                            <div>
                              <p className="text-sm font-medium text-white">{po.item_name}</p>
                              <p className="text-xs text-gray-400">Quantity: {po.quantity}</p>
                            </div>
                            <span className={`text-[10px] uppercase font-bold py-1 px-2 rounded-lg ${
                              po.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 
                              po.status === 'IN_PROGRESS' ? 'bg-blue-500/10 text-blue-400' : 'bg-gray-500/10 text-gray-400'
                            }`}>
                              {po.status}
                            </span>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </>
              ) : (
                <div className="text-center text-gray-500">Failed to load order details.</div>
              )}
            </div>
          </div>
        </div>
      )}
      </>
      )}
    </div>
  );
}
