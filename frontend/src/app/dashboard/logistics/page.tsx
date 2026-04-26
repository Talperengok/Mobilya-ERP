"use client";

import { useState } from "react";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import type { Shipment, Order } from "@/types";
import { useTranslation } from "@/hooks/useTranslation";
import {
  Truck,
  Loader2,
  PackageCheck,
  PackageOpen,
  MapPin,
  CheckCircle2,
  Plus,
  X
} from "lucide-react";

// â”€â”€ Status Configurations â”€â”€

const shipmentStatusConfig: Record<string, { color: string; icon: any; next?: string }> = {
  PREPARING: { color: "text-yellow-400 bg-yellow-500/10 border-yellow-500/20", icon: PackageOpen, next: "SHIPPED" },
  SHIPPED: { color: "text-blue-400 bg-blue-500/10 border-blue-500/20", icon: Truck, next: "IN_TRANSIT" },
  IN_TRANSIT: { color: "text-purple-400 bg-purple-500/10 border-purple-500/20", icon: MapPin, next: "DELIVERED" },
  DELIVERED: { color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20", icon: CheckCircle2 },
};

// â”€â”€ Hooks â”€â”€

function useShipments() {
  return useQuery<Shipment[]>({
    queryKey: ["shipments"],
    queryFn: async () => (await api.get("/shipments")).data,
    refetchInterval: 3000,
  });
}

function useReadyOrders() {
  return useQuery<Order[]>({
    queryKey: ["orders", "READY"],
    queryFn: async () => {
      const data = (await api.get("/orders", { params: { status: "READY" } })).data as Order[];
      // Filter out orders that already have dispatched shipments (courier assigned)
      return data.filter(o => !o.shipment || !o.shipment.courier_name);
    },
    refetchInterval: 5000,
  });
}

export default function LogisticsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { data: shipments, isLoading: loadingShipments } = useShipments();
  const { data: readyOrders, isLoading: loadingOrders } = useReadyOrders();

  const [showCreate, setShowCreate] = useState(false);
  const [activeTab, setActiveTab] = useState<"preparing" | "ready" | "shipped" | "inTransit" | "delivered">("preparing");
  const tabFilters = {
    preparing: ["PREPARING"],
    ready: ["READY_FOR_PICKUP"],
    shipped: ["SHIPPED"],
    inTransit: ["IN_TRANSIT"],
    delivered: ["DELIVERED"],
  };
  const filteredShipments = shipments?.filter((s) =>
    tabFilters[activeTab].includes(s.status)
  );
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [courierName, setCourierName] = useState<string>("");
  const [errorHeader, setErrorHeader] = useState<string | null>(null);

  const [editingShipmentId, setEditingShipmentId] = useState<number | null>(null);
  const [editCourierName, setEditCourierName] = useState<string>("");

  const updateCourierMutation = useMutation({
    mutationFn: async ({ id, courier_name, status }: { id: number; courier_name: string; status: string }) => {
      return (await api.patch(`/shipments/${id}/status`, { courier_name, status })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      setEditingShipmentId(null);
    },
    onError: () => {
      alert("Kurye gÃ¼ncellenirken bir hata oluÅŸtu.");
    }
  });

  const createMutation = useMutation({
    mutationFn: async (data: { order_id: number; courier_name: string }) => {
      return (await api.post("/shipments", data)).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowCreate(false);
      setSelectedOrders([]);
      setCourierName("");
      setErrorHeader(null);
    },
    onError: (err: any) => {
      const msg = err.response?.data?.detail || "Sevkiyat oluşturulamadı.";
      setErrorHeader(msg);
    }
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: number; status: string }) => {
      return (await api.patch(`/shipments/${id}/status`, { status })).data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
    }
  });

  const [isDispatching, setIsDispatching] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedOrders.length === 0) return;
    setIsDispatching(true);
    setErrorHeader(null);

    try {
      await Promise.all(
        selectedOrders.map(orderId =>
          api.post("/shipments", {
            order_id: parseInt(orderId),
            courier_name: courierName || "Standard Courier"
          })
        )
      );
      queryClient.invalidateQueries({ queryKey: ["shipments"] });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      setShowCreate(false);
      setSelectedOrders([]);
      setCourierName("");
    } catch (err: any) {
      const msg = err.response?.data?.detail || "Sevkiyatlar oluşturulamadı.";
      setErrorHeader(msg);
    } finally {
      setIsDispatching(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Truck className="text-blue-500" />
            {t.logistics?.title || "Logistics"}
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            {t.logistics?.subtitle || "Manage shipments"}
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-colors shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} />
          {t.logistics?.createShipment || "Create Shipment"}
        </button>
      </div>

      {/* Create Shipment Form */}
      {showCreate && (
        <div className="glass-card p-6 border-blue-500/30 animate-in fade-in slide-in-from-top-4">
          <form onSubmit={handleCreate} className="flex gap-4 items-end">
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">Select READY Orders</label>
              <div className="w-full max-h-32 overflow-y-auto px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus-within:ring-2 focus-within:ring-blue-500/50 space-y-1">
                {readyOrders?.length === 0 ? (
                  <p className="text-gray-500 italic">No orders ready.</p>
                ) : (
                  readyOrders?.map((o) => (
                    <label key={o.id} className="flex items-center gap-2 cursor-pointer hover:bg-gray-700/50 p-1 rounded transition-colors">
                      <input
                        type="checkbox"
                        value={o.id}
                        checked={selectedOrders.includes(o.id.toString())}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedOrders([...selectedOrders, o.id.toString()]);
                          } else {
                            setSelectedOrders(selectedOrders.filter(id => id !== o.id.toString()));
                          }
                        }}
                        className="rounded border-gray-600 bg-gray-700 text-blue-500 focus:ring-blue-500 w-4 h-4"
                      />
                      <span className="text-gray-200 font-medium">{o.order_number} <span className="text-gray-500 font-normal">â€” {o.customer_name}</span></span>
                    </label>
                  ))
                )}
              </div>
            </div>
            <div className="flex-1">
              <label className="block text-sm text-gray-400 mb-1">{t.logistics?.courier || "Courier"}</label>
              <input
                type="text"
                placeholder="e.g. UPS, FedEx, Aras Kargo"
                value={courierName}
                onChange={(e) => setCourierName(e.target.value)}
                className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
              />
            </div>
            <button
              type="submit"
              disabled={isDispatching || loadingOrders || selectedOrders.length === 0}
              className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors h-[38px] flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isDispatching ? <Loader2 className="animate-spin" size={16} /> : null}
              {t.logistics?.dispatch || "Dispatch"}
            </button>
          </form>
          {errorHeader && (
            <div className="mt-4 p-3 bg-red-950/20 border border-red-500/30 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <CheckCircle2 className="text-red-500 rotate-180" size={16} />
              {errorHeader}
            </div>
          )}
          {readyOrders?.length === 0 && (
            <p className="text-sm text-yellow-500 mt-2">No orders are currently in READY status.</p>
          )}
        </div>
      )}

      <div className="flex flex-wrap gap-3 mb-6">
        <button
          onClick={() => setActiveTab("preparing")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "preparing" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
        >
          {t.logistics?.tabs?.preparing || "Hazırlananlar"}
        </button>
        <button
          onClick={() => setActiveTab("shipped")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "shipped" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
        >
          {t.logistics?.tabs?.shipped || "Kargoya Verildi"}
        </button>
        <button
          onClick={() => setActiveTab("inTransit")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "inTransit" ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
        >
          {t.logistics?.tabs?.inTransit || "Yolda"}
        </button>
        <button
          onClick={() => setActiveTab("delivered")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${activeTab === "delivered" ? "bg-gray-600 text-white shadow-lg shadow-gray-500/20" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
        >
          {t.logistics?.tabs?.delivered || "Teslim Edilenler"}
        </button>
      </div>

      {/* Shipments Table */}
      <div className="glass-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-800/50">
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t.logistics?.trackingNo || "Tracking #"}</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">Order ID</th>
                <th className="text-left px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t.logistics?.courier || "Courier"}</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t.logistics?.date || "Date"}</th>
                <th className="text-center px-6 py-3 text-xs font-medium text-gray-400 uppercase">{t.logistics?.status || "Status"}</th>
                <th className="text-right px-6 py-3 text-xs font-medium text-gray-400 uppercase">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800/50">
              {loadingShipments ? (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    <Loader2 className="animate-spin mx-auto mb-2" size={24} />
                    Loading...
                  </td>
                </tr>
              ) : filteredShipments && filteredShipments.length > 0 ? (
                filteredShipments.map((shipment) => {
                  const conf = shipmentStatusConfig[shipment.status];
                  const Icon = conf.icon;
                  return (
                    <tr key={shipment.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono font-medium text-white">
                        {shipment.tracking_number}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-400">
                        #{shipment.order_id}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        {editingShipmentId === shipment.id ? (
                          <div className="flex gap-2 items-center">
                            <input
                              type="text"
                              value={editCourierName}
                              onChange={(e) => setEditCourierName(e.target.value)}
                              className="px-2 py-1 bg-gray-900 border border-gray-600 rounded text-xs w-28 text-white"
                              autoFocus
                            />
                            <button
                              onClick={() => updateCourierMutation.mutate({ id: shipment.id, courier_name: editCourierName, status: shipment.status })}
                              disabled={updateCourierMutation.isPending}
                              className="text-emerald-400 hover:text-emerald-300"
                            >
                              <CheckCircle2 size={16} />
                            </button>
                            <button
                              onClick={() => setEditingShipmentId(null)}
                              className="text-red-400 hover:text-red-300"
                            >
                              <X size={16} />
                            </button>
                          </div>
                        ) : (
                          <span className="text-gray-300 font-medium">{shipment.courier_name || "â€”"}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-center text-gray-400">
                        {new Date(shipment.created_at).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${conf.color}`}>
                          <Icon size={12} />
                          {(t.logistics as unknown as Record<string, string>)?.[shipment.status.toLowerCase().replace('_', '')] || shipment.status.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {conf.next && (
                          <div className="flex justify-end gap-2 items-center">
                            <button
                               onClick={() => { setEditingShipmentId(shipment.id); setEditCourierName(shipment.courier_name || ""); }}
                               className="text-xs px-2.5 py-1.5 bg-gray-800 border border-gray-700 hover:bg-gray-700 text-gray-300 hover:text-white rounded-md transition-colors"
                            >
                               Edit
                            </button>
                            <button
                              onClick={() => updateStatusMutation.mutate({ id: shipment.id, status: conf.next! })}
                              disabled={updateStatusMutation.isPending || !shipment.courier_name}
                              className="text-xs px-3 py-1.5 bg-blue-600/20 border border-blue-500/30 hover:bg-blue-600/40 text-blue-400 hover:text-blue-300 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              title={!shipment.courier_name ? t.logistics?.courierGuardTooltip || "Lütfen sevkiyatı başlatmadan önce bir kurye firması seçin." : undefined}
                            >
                              Mark {conf.next.replace(/_/g, " ")}
                            </button>
                          </div>
                        )}
                        {!conf.next && (
                          <span className="text-xs text-gray-500">Completed</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={6} className="text-center py-12 text-gray-500">
                    {t.logistics?.noShipments || "No shipments yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
