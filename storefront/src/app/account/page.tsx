"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { LogOut, Package, User, Clock, Loader2, ArrowRight, X, ShoppingCart, Eye, ChevronRight, ChevronDown, FileText, Truck, Star } from "lucide-react";
import { api } from "@/lib/api";
import { useAuthStore } from "@/store/auth";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency } from "@/lib/utils";
import type { OrderHistory } from "@/types";

const ORDERS_PER_PAGE = 5;

function useOrderHistory(userId?: number) {
  return useQuery<OrderHistory[]>({
    queryKey: ["my-orders", userId],
    queryFn: async () => (await api.get("/auth/me/orders")).data,
    enabled: !!userId,
  });
}

export default function AccountPage() {
  const router = useRouter();
  const { user, isAuthenticated, logout } = useAuthStore();
  const { t, locale } = useTranslation();
  const { data: orders, isLoading } = useOrderHistory(user?.id);
  const [selectedOrderId, setSelectedOrderId] = useState<number | null>(null);
  const [viewInvoiceOrderId, setViewInvoiceOrderId] = useState<number | null>(null);
  const [viewWaybillOrderId, setViewWaybillOrderId] = useState<number | null>(null);
  const [visibleCount, setVisibleCount] = useState(ORDERS_PER_PAGE);
  const selectedOrder = orders?.find(o => o.id === selectedOrderId);

  useEffect(() => {
    if (!isAuthenticated && !user) {
      router.push("/login");
    }
  }, [isAuthenticated, user, router]);

  if (!user) return null;

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const totalSpent = orders?.reduce((acc, o) => acc + o.total_amount, 0) || 0;
  const activeOrders = orders?.filter(o => o.status !== "DELIVERED").length || 0;

  return (
    <>
      <div className="max-w-6xl mx-auto px-6 py-12">
        {/* Premium Header */}
        <div className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-amber-500/20 to-orange-600/10 border border-amber-500/10 p-8 md:p-12 mb-12">
          <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-white mb-2">
                {locale === "tr" ? `HoÅŸ geldin, ${user.full_name.split(' ')[0]}` : `Welcome back, ${user.full_name.split(' ')[0]}`}
              </h1>
              <p className="text-neutral-400">{t.account.subtitle}</p>
            </div>
            <button
              onClick={handleLogout}
              className="flex items-center gap-2 px-6 py-3 bg-white/5 hover:bg-white/10 text-white rounded-2xl text-sm font-bold border border-white/10 backdrop-blur-md transition-all self-start md:self-auto"
            >
              <LogOut size={16} />
              {t.auth.logout}
            </button>
          </div>
          
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-amber-500/20 blur-[100px] rounded-full" />
          <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-orange-600/20 blur-[100px] rounded-full" />
        </div>

        {/* Stats Bar */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12">
          {[
            { label: t.account.stats.totalOrders, value: orders?.length || 0, icon: Package, color: "text-blue-400" },
            { label: t.account.stats.totalSpent, value: formatCurrency(totalSpent), icon: ShoppingCart, color: "text-emerald-400" },
            { label: t.account.stats.activeTracking, value: activeOrders, icon: Clock, color: "text-amber-400" },
            { label: t.account.stats.loyaltyPoints, value: "1,250", icon: Star, color: "text-purple-400" },
          ].map((stat, i) => (
            <div key={i} className="bg-neutral-900/40 border border-neutral-800/50 p-6 rounded-3xl backdrop-blur-sm">
              <div className="flex items-center gap-3 mb-3">
                <div className={`p-2 rounded-xl bg-neutral-950 border border-neutral-800 ${stat.color}`}>
                  <stat.icon size={18} />
                </div>
                <span className="text-xs font-bold text-neutral-500 uppercase tracking-widest">{stat.label}</span>
              </div>
              <p className="text-2xl font-bold text-white">{stat.value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Profile Card */}
          <div className="md:col-span-1 border border-neutral-800 rounded-2xl p-6 bg-neutral-900/50 self-start">
            <div className="flex items-center gap-4 mb-6 pb-6 border-b border-neutral-800">
              <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center">
                <User size={32} />
              </div>
              <div>
                <h2 className="text-xl font-semibold">{user.full_name}</h2>
                <p className="text-neutral-400 text-sm">{user.email}</p>
              </div>
            </div>
            <div className="space-y-4">
              <h3 className="text-sm font-medium text-neutral-500 uppercase tracking-wider">{t.account.profile}</h3>
              <div>
                <p className="text-sm text-neutral-400">Role</p>
                <p className="font-medium">{user.role}</p>
              </div>
              {user.customer_id && (
                <div>
                  <p className="text-sm text-neutral-400">Customer ID</p>
                  <p className="font-medium font-mono text-amber-500">#{user.customer_id}</p>
                </div>
              )}
            </div>
          </div>

          {/* Orders Card */}
          <div className="md:col-span-2 border border-neutral-800 rounded-2xl p-6 bg-neutral-900/50">
            <div className="flex items-center gap-3 mb-6">
              <Package className="text-amber-500" />
              <h2 className="text-xl font-semibold">{t.account.orders}</h2>
            </div>

            {isLoading ? (
              <div className="flex justify-center p-12 text-neutral-500">
                <Loader2 className="animate-spin" size={32} />
              </div>
            ) : orders && orders.length > 0 ? (
              <div className="space-y-4">
                {orders.slice(0, visibleCount).map((order) => (
                  <div key={order.id} className="border border-neutral-800 p-5 rounded-xl bg-neutral-950 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-mono text-amber-500 font-medium">{order.order_number}</span>
                        <span className="px-2.5 py-0.5 bg-neutral-800 text-neutral-300 text-xs rounded-full">
                          {t.tracking[order.status as keyof typeof t.tracking] || order.status.replace(/_/g, " ")}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-neutral-400">
                        <span className="flex items-center gap-1.5"><Clock size={14}/> {new Date(order.order_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}</span>
                        <span>{order.item_count} {locale === "tr" ? "Ã¼rÃ¼n" : "items"}</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-4 sm:gap-8">
                      <div className="text-right">
                        <p className="text-xs text-neutral-500">{t.account.total}</p>
                        <p className="font-semibold">{formatCurrency(order.total_amount, locale === "tr" ? "TRY" : "USD", locale === "tr" ? "tr-TR" : "en-US")}</p>
                      </div>

                      <div className="flex items-center gap-3">
                        <button
                          onClick={() => setSelectedOrderId(order.id)}
                          className="p-2 text-neutral-400 hover:text-amber-500 hover:bg-amber-500/10 rounded-lg transition-all"
                          title={t.account.orderDetails || "Details"}
                        >
                          <Eye size={18} />
                        </button>
                        
                        {order.shipment && (
                          <Link
                            href={`/tracking?query=${order.shipment.tracking_number}`}
                            className="flex items-center gap-1 text-sm bg-amber-500 hover:bg-amber-400 text-black px-4 py-1.5 rounded-lg font-medium transition-colors"
                          >
                            {t.account.track} <ArrowRight size={16} />
                          </Link>
                        )}
                        <button
                          onClick={() => setViewInvoiceOrderId(order.id)}
                          className="p-2 text-neutral-400 hover:text-emerald-400 hover:bg-emerald-500/10 rounded-lg transition-all"
                          title={t.account.viewInvoice}
                        >
                          <FileText size={18} />
                        </button>
                        <button
                          onClick={() => setViewWaybillOrderId(order.id)}
                          className="p-2 text-neutral-400 hover:text-blue-400 hover:bg-blue-500/10 rounded-lg transition-all"
                          title={t.account.viewWaybill}
                        >
                          <Truck size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}

                {/* Show More Button */}
                {orders.length > visibleCount && (
                  <button
                    onClick={() => setVisibleCount((prev) => prev + ORDERS_PER_PAGE)}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-medium text-amber-500 hover:text-amber-400 bg-amber-500/5 hover:bg-amber-500/10 border border-amber-500/20 rounded-xl transition-all"
                  >
                    <ChevronDown size={16} />
                    {t.account.loadMore.replace("{count}", (orders.length - visibleCount).toString())}
                  </button>
                )}
              </div>
            ) : (
              <div className="text-center p-12 border border-dashed border-neutral-800 rounded-xl">
                <p className="text-neutral-500">{t.account.noOrders}</p>
                <Link href="/" className="inline-block mt-4 text-amber-500 hover:underline">
                  {t.account.browse}
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* â”€â”€ Order Detail Modal â”€â”€ */}
      {selectedOrderId && selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in transition-all">
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-xl">
                  <Package className="text-amber-500" size={24} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white">{selectedOrder.order_number}</h2>
                  <p className="text-xs text-neutral-400">{new Date(selectedOrder.order_date).toLocaleString()}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedOrderId(null)}
                className="p-2 text-neutral-500 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              {/* Items List */}
              <div>
                <h3 className="text-xs font-semibold text-neutral-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                  <ShoppingCart size={14} /> {t.account.lineItems || "Line Items"}
                </h3>
                <div className="space-y-4">
                  {(selectedOrder as any).items?.map((item: any) => (
                    <div key={item.id} className="flex justify-between items-center text-sm">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-800 rounded-lg flex items-center justify-center text-neutral-500 font-bold p-2">
                          <Package size={16} />
                        </div>
                        <div>
                          <p className="font-medium text-neutral-200">{item.item_name}</p>
                          <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
                        </div>
                      </div>
                      <p className="font-medium text-white">{formatCurrency(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Status Tracker */}
              <div className="pt-6 border-t border-neutral-800">
                 <div className="bg-neutral-950 p-4 rounded-2xl flex items-center justify-between">
                   <div className="flex items-center gap-3">
                     <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
                     <span className="text-sm font-medium">{t.account.status}:</span>
                   </div>
                   <span className="text-sm text-neutral-300 font-bold px-3 py-1 bg-neutral-800 rounded-full">
                     {t.tracking[selectedOrder.status as keyof typeof t.tracking] || selectedOrder.status}
                   </span>
                 </div>
              </div>

              {/* Summary */}
              <div className="bg-amber-500/5 p-6 rounded-3xl border border-amber-500/10 space-y-2">
                <div className="flex justify-between text-sm text-neutral-500">
                  <span>{t.account.total}</span>
                  <span className="text-white font-bold text-lg">{formatCurrency(selectedOrder.total_amount)}</span>
                </div>
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 pt-0">
               {selectedOrder.shipment ? (
                  <Link
                    href={`/tracking?query=${selectedOrder.shipment.tracking_number}`}
                    onClick={() => setSelectedOrderId(null)}
                    className="w-full h-12 bg-white hover:bg-neutral-200 text-black rounded-2xl font-bold transition-all flex items-center justify-center gap-2"
                  >
                    {t.account.track} <ChevronRight size={18} />
                  </Link>
               ) : (
                  <button
                    disabled
                    className="w-full h-12 bg-neutral-800 text-neutral-500 rounded-2xl font-bold cursor-not-allowed"
                  >
                    Processing Order...
                  </button>
               )}
            </div>
          </div>
        </div>
      )}
      {/* â”€â”€ Invoice Modal (Lightweight) â”€â”€ */}
      {viewInvoiceOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewInvoiceOrderId(null)}>
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><FileText className="text-emerald-500" size={20} /> {t.account.invoice}</h3>
              <button onClick={() => setViewInvoiceOrderId(null)} className="p-1 text-neutral-500 hover:text-white"><X size={18} /></button>
            </div>
            <InvoiceContent orderId={viewInvoiceOrderId} />
          </div>
        </div>
      )}

      {/* â”€â”€ Waybill Modal (Lightweight) â”€â”€ */}
      {viewWaybillOrderId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4" onClick={() => setViewWaybillOrderId(null)}>
          <div className="bg-neutral-900 border border-neutral-800 w-full max-w-lg rounded-2xl p-6 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2"><Truck className="text-blue-500" size={20} /> {t.account.waybill}</h3>
              <button onClick={() => setViewWaybillOrderId(null)} className="p-1 text-neutral-500 hover:text-white"><X size={18} /></button>
            </div>
            <WaybillContent orderId={viewWaybillOrderId} />
          </div>
        </div>
      )}
    </>
  );
}

/* â”€â”€ Inline document components â”€â”€ */

function InvoiceContent({ orderId }: { orderId: number }) {
  const { t, locale } = useTranslation();
  const { data: invoices, isLoading } = useQuery({
    queryKey: ["customer-invoices"],
    queryFn: async () => (await api.get("/auth/me/invoices")).data as any[],
  });

  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="animate-spin text-neutral-500" size={24} /></div>;

  const inv = invoices?.find((i: any) => i.order_id === orderId);

  if (!inv) return <p className="text-neutral-500 text-sm text-center py-6">{t.account.noInvoice}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="font-mono text-amber-500 font-bold">{inv.invoice_number}</span>
        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
          inv.status === "PAID" ? "bg-emerald-500/20 text-emerald-400" : "bg-blue-500/20 text-blue-400"
        }`}>
          {inv.status === "PAID" ? t.account.paid : t.account.issued}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-neutral-400">
          <span>{t.checkout.subtotal}</span>
          <span className="text-white font-mono">₺{inv.subtotal.toFixed(2)}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>{t.checkout.tax}</span>
          <span className="text-amber-400 font-mono">₺{inv.tax_amount.toFixed(2)}</span>
        </div>
        <div className="flex justify-between font-bold text-white border-t border-neutral-800 pt-2">
          <span>{t.cart.total}</span>
          <span className="text-emerald-400 font-mono">₺{inv.total_amount.toFixed(2)}</span>
        </div>
      </div>
      <p className="text-[10px] text-neutral-600 text-center">
        {t.account.date}: {inv.issued_date ? new Date(inv.issued_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
      </p>
    </div>
  );
}

function WaybillContent({ orderId }: { orderId: number }) {
  const { t, locale } = useTranslation();
  const { data: waybills, isLoading } = useQuery({
    queryKey: ["customer-waybills"],
    queryFn: async () => (await api.get("/auth/me/waybills")).data as any[],
  });

  if (isLoading) return <div className="flex justify-center p-6"><Loader2 className="animate-spin text-neutral-500" size={24} /></div>;

  const wb = waybills?.find((w: any) => w.order_id === orderId);

  if (!wb) return <p className="text-neutral-500 text-sm text-center py-6">{t.account.noWaybill}</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <span className="font-mono text-amber-500 font-bold">{wb.waybill_number}</span>
        <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400">
          {wb.status === "ISSUED" ? t.account.wayIssued : t.account.wayDraft}
        </span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between text-neutral-400">
          <span>{t.account.orderNo}</span>
          <span className="text-white font-mono">{wb.order_number}</span>
        </div>
        <div className="flex justify-between text-neutral-400">
          <span>{t.checkout.trackNow}</span>
          <span className="text-white font-mono">{wb.tracking_number || "-"}</span>
        </div>
      </div>
      <p className="text-[10px] text-neutral-600 text-center">
        {t.account.date}: {wb.issue_date ? new Date(wb.issue_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
      </p>
    </div>
  );
}
