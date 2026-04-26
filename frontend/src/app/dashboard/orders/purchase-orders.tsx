import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { PurchaseOrder, InventoryItem, Supplier } from "@/types";
import {
  Loader2,
  Package,
  Plus,
  X,
  Clock,
  CheckCircle,
  Truck,
} from "lucide-react";

// ── Progress Bar Component ──

function DeliveryProgressBar({ po }: { po: PurchaseOrder }) {
  const { t } = useTranslation();
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(0);

  const isActive =
    (po.status === "ORDERED" || po.status === "IN_TRANSIT") &&
    po.ordered_at &&
    po.estimated_delivery_at;

  useEffect(() => {
    if (!isActive) return;

    const tick = () => {
      const start = new Date(po.ordered_at!).getTime();
      const end = new Date(po.estimated_delivery_at!).getTime();
      const now = Date.now();
      const total = end - start;
      const elapsed = now - start;
      const pct = Math.min(100, Math.max(0, (elapsed / total) * 100));
      const secs = Math.max(0, Math.ceil((end - now) / 1000));
      setProgress(pct);
      setRemaining(secs);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, [isActive, po.ordered_at, po.estimated_delivery_at]);

  if (!isActive) return null;

  return (
    <div className="mt-2 space-y-1">
      <div className="flex items-center gap-2 text-xs text-cyan-400">
        <Truck size={12} className="animate-pulse" />
        <span>
          {remaining > 0 ? `${remaining}s ${t.finance.procurement.remaining}` : t.finance.procurement.arriving}
        </span>
      </div>
      <div className="w-full bg-neutral-800 rounded-full h-1.5">
        <div
          className="bg-gradient-to-r from-cyan-500 to-blue-500 h-1.5 rounded-full transition-all duration-1000"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

// ── New Order Modal ──

export function NewOrderModal({ onClose }: { onClose: () => void }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: rawMaterials } = useQuery<InventoryItem[]>({
    queryKey: ["items", "RAW_MATERIAL"],
    queryFn: async () =>
      (await api.get("/items", { params: { item_type: "RAW_MATERIAL" } }))
        .data,
  });

  const { data: suppliers } = useQuery<Supplier[]>({
    queryKey: ["suppliers"],
    queryFn: async () => (await api.get("/suppliers")).data,
  });

  const [formData, setFormData] = useState({
    supplier_id: "",
    item_id: "",
    quantity: 10,
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedItem = rawMaterials?.find(
    (m) => m.id === parseInt(formData.item_id)
  );
  const estimatedCost = selectedItem
    ? selectedItem.unit_cost * formData.quantity
    : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await api.post("/purchase-orders", {
        supplier_id: parseInt(formData.supplier_id),
        item_id: parseInt(formData.item_id),
        quantity: formData.quantity,
      });
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      onClose();
    } catch (err: any) {
      setError(
        err.response?.data?.detail || t.common.error
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-2xl overflow-y-auto max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-lg font-bold flex items-center gap-2">
            <Package className="text-blue-500" size={20} />
            {t.finance.procurement.newOrder}
          </h3>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Supplier */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {t.finance.procurement.supplier}
              </label>
              <select
                value={formData.supplier_id}
                onChange={(e) =>
                  setFormData((prev) => ({
                    ...prev,
                    supplier_id: e.target.value,
                  }))
                }
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">{t.orders.selectCustomer}</option>
                {suppliers?.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Raw Material */}
            <div>
              <label className="block text-sm text-gray-400 mb-1">
                {t.finance.procurement.rawMaterial}
              </label>
              <select
                value={formData.item_id}
                onChange={(e) =>
                  setFormData((prev) => ({ ...prev, item_id: e.target.value }))
                }
                required
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                <option value="">{t.orders.selectProduct}</option>
                {rawMaterials?.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} — {m.sku} ({t.inventory.stock}: {m.stock_quantity} {m.unit})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quantity */}
          <div>
            <label className="block text-sm text-gray-400 mb-1">
              {t.finance.procurement.quantity}
            </label>
            <input
              type="number"
              min={1}
              value={formData.quantity}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  quantity: parseInt(e.target.value) || 1,
                }))
              }
              required
              className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>

          {/* Cost Preview */}
          {selectedItem && (
            <div className="bg-gray-800/50 rounded-lg p-4 text-sm space-y-2 border border-gray-700/50">
              <div className="flex justify-between text-gray-400">
                <span>{t.finance.procurement.unitCost}</span>
                <span>{formatCurrency(selectedItem.unit_cost)}</span>
              </div>
              <div className="flex justify-between font-semibold text-white border-t border-gray-700/50 pt-2">
                <span>{t.finance.procurement.estimatedTotal}</span>
                <span className="text-blue-400">{formatCurrency(estimatedCost)}</span>
              </div>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-400 bg-red-500/10 p-3 rounded-lg border border-red-500/20">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-50 shadow-lg shadow-blue-500/20"
            >
              {isSubmitting ? (
                <Loader2 size={14} className="animate-spin" />
              ) : (
                <Plus size={14} />
              )}
              Create Draft PO
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Main View ──
export default function PurchaseOrdersView() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: purchaseOrders, isLoading } = useQuery<PurchaseOrder[]>({
    queryKey: ["purchase-orders"],
    queryFn: async () => (await api.get("/purchase-orders")).data,
    refetchInterval: 3000,
  });

  const handleApproveAndOrder = async (poId: number) => {
    try {
      await api.post(`/purchase-orders/${poId}/order`);
      queryClient.invalidateQueries({ queryKey: ["purchase-orders"] });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
      queryClient.invalidateQueries({ queryKey: ["items"] });
    } catch {
      alert("Failed to order PO");
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center p-12 text-gray-500">
        <Loader2 className="animate-spin" size={32} />
        {t.common.loading}
      </div>
    );
  }

  return (
    <div className="glass-card overflow-hidden">
      <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
        <h3 className="font-semibold text-lg flex items-center gap-2">
          <Package className="text-blue-500" size={18} />
          {t.finance.procurement.title}
        </h3>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-800/50">
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.finance.table.no}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.finance.procurement.supplier}
              </th>
              <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.finance.procurement.rawMaterial}
              </th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.finance.procurement.quantity}
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.orders.total}
              </th>
              <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                Status / ETA
              </th>
              <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">
                {t.finance.table.action}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-800/50">
            {purchaseOrders && purchaseOrders.length > 0 ? (
              purchaseOrders.map((po) => (
                <tr
                  key={po.id}
                  className="hover:bg-gray-800/30 transition-colors"
                >
                  <td className="px-6 py-4 text-sm font-mono text-blue-400">
                    {po.po_number}
                  </td>
                  <td className="px-6 py-4 text-sm">{po.supplier_name}</td>
                  <td className="px-6 py-4 text-sm font-medium">
                    {po.item_name}
                  </td>
                  <td className="px-6 py-4 text-sm text-center">
                    {po.quantity}
                  </td>
                  <td className="px-6 py-4 text-sm text-right font-medium">
                    {formatCurrency(po.total_cost)}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col items-center">
                      <span
                        className={`text-xs px-2.5 py-1 rounded-full font-bold ${
                          po.status === "DRAFT"
                            ? "bg-gray-500/20 text-gray-400 border border-gray-500/50"
                            : po.status === "ORDERED"
                            ? "bg-cyan-500/20 text-cyan-400"
                            : po.status === "IN_TRANSIT"
                            ? "bg-amber-500/20 text-amber-400"
                            : po.status === "RECEIVED"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : ""
                        }`}
                      >
                        {po.status === "RECEIVED" && (
                          <CheckCircle
                            size={10}
                            className="inline mr-1 -mt-0.5"
                          />
                        )}
                        {po.status === "IN_TRANSIT"
                          ? "IN TRANSIT"
                          : po.status}
                      </span>
                      <DeliveryProgressBar po={po} />
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {po.status === "DRAFT" && (
                      <button
                        onClick={() => handleApproveAndOrder(po.id)}
                        className="px-3 py-1.5 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 rounded-lg text-xs font-semibold text-white transition-all shadow-md shadow-cyan-500/20 flex items-center gap-1.5 ml-auto"
                      >
                        <Truck size={12} />
                        {t.finance.procurement.orderAndShip}
                      </button>
                    )}
                    {(po.status === "ORDERED" ||
                      po.status === "IN_TRANSIT") && (
                      <span className="text-xs text-cyan-400/60 flex items-center gap-1 justify-end">
                        <Truck size={12} className="animate-pulse" />
                        {t.finance.procurement.shipping}
                      </span>
                    )}
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="text-center py-12 text-gray-500">
                  {t.finance.procurement.noOrders}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
