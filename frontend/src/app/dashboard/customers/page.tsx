"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { Customer, Order } from "@/types";
import {
  Users,
  History,
  Loader2,
  X,
  Info,
  ShoppingCart,
  Eye,
  Factory,
  CheckCircle2,
  Mail,
  Phone,
  MapPin,
  User,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

// â”€â”€ Hooks â”€â”€

function useCustomers() {
  return useQuery<Customer[]>({
    queryKey: ["customers"],
    queryFn: async () => (await api.get("/customers")).data,
  });
}

function useCustomerDetail(id: number | null) {
  return useQuery({
    queryKey: ["customers", id],
    queryFn: async () => (await api.get(`/customers/${id}`)).data,
    enabled: !!id,
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
const orderStatusStyles: Record<string, string> = {
  PENDING: "bg-yellow-500/20 text-yellow-300 border-yellow-500/20",
  IN_PRODUCTION: "bg-blue-500/20 text-blue-300 border-blue-500/20",
  READY: "bg-emerald-500/20 text-emerald-300 border-emerald-500/20",
  SHIPPED: "bg-cyan-500/20 text-cyan-300 border-cyan-500/20",
  DELIVERED: "bg-gray-500/20 text-gray-300 border-gray-500/20",
  CANCELLED: "bg-red-500/20 text-red-300 border-red-500/20",
};

export default function CustomersPage() {
  const { t } = useTranslation();
  const { data: customers, isLoading } = useCustomers();

  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);

  const { data: customerDetail, isLoading: isLoadingDetail } = useCustomerDetail(selectedCustomerId);
  const { data: orderDetail, isLoading: isLoadingOrder } = useOrderDetail(selectedOrderId);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <Users className="text-blue-500" />
          {t.customers?.title || "Customer Management"}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {t.customers?.subtitle || "Review customer profiles and order histories"}
        </p>
      </div>

      {/* Customers Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Name</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Contact</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">Source</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="text-center py-12 text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Loading customers...
                  </td>
                </tr>
              ) : customers?.map((c) => (
                <tr key={c.id} className="hover:bg-gray-800/30 transition-colors group">
                  <td className="px-6 py-4 text-sm font-mono text-gray-500">#{c.id}</td>
                  <td className="px-6 py-4 text-sm font-medium text-white">{c.name}</td>
                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Mail size={12} /> {c.email || "â€”"}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-gray-400">
                        <Phone size={12} /> {c.phone || "â€”"}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-center">
                    <span className="text-[10px] uppercase font-bold py-1 px-2 rounded bg-gray-800 text-gray-400 border border-gray-700">
                      {c.source}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => setSelectedCustomerId(c.id)}
                      className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-xs font-medium transition-all"
                    >
                      <History size={14} />
                      {t.customers?.history || "History"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* â”€â”€ Order History Modal â”€â”€ */}
      {selectedCustomerId && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="glass-card w-full max-w-xl max-h-[85vh] overflow-hidden flex flex-col border-blue-500/30 shadow-2xl">
            {/* Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-500/10 rounded-lg">
                  <History className="text-blue-500" size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">
                    {t.customers?.orderHistoryTitle || "Order History"}
                  </h2>
                  <p className="text-sm text-gray-400">
                    {customerDetail?.name || "..."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCustomerId(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
              {isLoadingDetail ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  Loading history...
                </div>
              ) : customerDetail?.orders?.length > 0 ? (
                customerDetail.orders.map((o: any) => (
                  <div
                    key={o.id}
                    className="group border border-gray-800 bg-gray-800/20 hover:bg-gray-800/40 hover:border-blue-500/30 p-4 rounded-xl transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-mono text-blue-400 font-bold">{o.order_number}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${orderStatusStyles[o.status]}`}>
                          {o.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500">
                        {new Date(o.order_date).toLocaleString()} â€” {formatCurrency(o.total_amount)}
                      </p>
                    </div>
                    <button
                      onClick={() => setSelectedOrderId(o.id)}
                      className="p-2 text-gray-500 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-colors group-hover:bg-blue-500/20"
                      title="View Details"
                    >
                      <Eye size={18} />
                    </button>
                  </div>
                ))
              ) : (
                <div className="text-center py-12">
                   <ShoppingCart className="mx-auto text-gray-700 mb-3" size={48} />
                   <p className="text-gray-500">{t.customers?.noOrders || "No orders found."}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* â”€â”€ Order Detail Modal (Nested/Overlay) â”€â”€ */}
      {selectedOrderId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in zoom-in-95">
          <div className="glass-card w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col border-blue-500/30">
            {/* Modal Header */}
            <div className="p-6 border-b border-gray-800 flex items-center justify-between bg-gray-900/50 text-white">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Info className="text-blue-500" size={20} />
                  {orderDetail?.order_number || "..."}
                </h2>
                <div className="flex items-center gap-4 mt-1 text-xs text-gray-400">
                  <span className="flex items-center gap-1"><User size={12} /> {orderDetail?.customer?.name}</span>
                  <span className="flex items-center gap-1"><ShoppingCart size={12} /> {orderDetail?.items?.length} items</span>
                </div>
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
              {isLoadingOrder ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                  <Loader2 className="animate-spin mb-2" size={32} />
                  Loading details...
                </div>
              ) : orderDetail ? (
                <>
                  <section>
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                      <ShoppingCart size={14} /> Items
                    </h3>
                    <div className="bg-gray-800/40 rounded-xl overflow-hidden border border-gray-700/50">
                      <table className="w-full text-sm text-left">
                        <thead className="bg-gray-800/60 text-gray-400 text-xs uppercase">
                          <tr>
                            <th className="px-4 py-2 font-medium">Product</th>
                            <th className="px-4 py-2 font-medium text-center">Qty</th>
                            <th className="px-4 py-2 font-medium text-right">Price</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-700/50">
                          {orderDetail.items?.map((item: any) => (
                            <tr key={item.id} className="hover:bg-gray-700/20">
                              <td className="px-4 py-3 text-white font-medium">{item.item_name}</td>
                              <td className="px-4 py-3 text-center text-gray-300">{item.quantity}</td>
                              <td className="px-4 py-3 text-right text-white font-semibold">{formatCurrency(item.line_total)}</td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot className="bg-gray-900/40 font-bold border-t border-gray-700">
                          <tr>
                            <td colSpan={2} className="px-4 py-3 text-right text-gray-400">TOTAL</td>
                            <td className="px-4 py-3 text-right text-blue-400">{formatCurrency(orderDetail.total_amount)}</td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </section>

                  {orderDetail.production_orders?.length > 0 && (
                    <section>
                      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                        <Factory size={14} /> Production Tracking
                      </h3>
                      <div className="space-y-2">
                        {orderDetail.production_orders.map((po: any) => (
                          <div key={po.id} className="flex items-center justify-between p-3 bg-gray-800/40 rounded-xl border border-gray-700/50">
                            <p className="text-sm font-medium text-white">{po.item_name}</p>
                            <span className={`text-[10px] uppercase font-bold py-1 px-2 rounded-lg ${
                               po.status === 'COMPLETED' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
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
                <div className="text-center text-gray-500">Failed to load order info.</div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
