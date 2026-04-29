"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { ProductionOrder, Workstation } from "@/types";
import {
  Factory,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  FileEdit,
  Timer,
  Wrench,
  Users,
  Plus,
} from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Employee } from "@/types";

const BASE_PRODUCTION_TIME = 40; // fallback if item doesn't specify

function useInventory() {
  return useQuery<any[]>({
    queryKey: ["inventory-for-production"],
    queryFn: async () => (await api.get("/dashboard/inventory")).data,
  });
}

function useProduction() {
  return useQuery<ProductionOrder[]>({
    queryKey: ["production"],
    queryFn: async () => (await api.get("/production")).data,
    refetchInterval: 3000,
  });
}

const statusConfig: Record<
  string,
  { icon: any; color: string; bgColor: string }
> = {
  DRAFT: {
    icon: FileEdit,
    color: "text-gray-400",
    bgColor: "bg-gray-500/20",
  },
  COMPLETED: {
    icon: CheckCircle,
    color: "text-emerald-400",
    bgColor: "bg-emerald-500/20",
  },
  IN_PROGRESS: {
    icon: Loader2,
    color: "text-blue-400",
    bgColor: "bg-blue-500/20",
  },
  PLANNED: {
    icon: Clock,
    color: "text-yellow-400",
    bgColor: "bg-yellow-500/20",
  },
  FAILED: {
    icon: AlertCircle,
    color: "text-red-400",
    bgColor: "bg-red-500/20",
  },
};

const roleColors: Record<string, string> = {
  ASSEMBLER: "text-blue-400",
  TECHNICIAN: "text-purple-400",
  PAINTER: "text-orange-400",
  QUALITY_INSPECTOR: "text-emerald-400",
};

// ── Production Progress Bar ──

function ProductionProgressBar({ po }: { po: ProductionOrder }) {
  const [progress, setProgress] = useState(0);
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (
      po.status !== "IN_PROGRESS" ||
      !po.started_at ||
      !po.estimated_completion_at
    )
      return;

    const tick = () => {
      const start = new Date(po.started_at!).getTime();
      const end = new Date(po.estimated_completion_at!).getTime();
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
  }, [po.status, po.started_at, po.estimated_completion_at]);

  if (
    po.status !== "IN_PROGRESS" ||
    !po.started_at ||
    !po.estimated_completion_at
  )
    return null;

  return (
    <div className="px-5 pb-4 space-y-2">
      <div className="flex items-center justify-between text-xs">
        <div className="flex items-center gap-1.5 text-blue-400">
          <Timer size={12} className="animate-pulse" />
          <span className="font-medium">Manufacturing in progress</span>
          {po.assigned_workstation && (
            <span className="text-gray-500 ml-1">
              @ {po.assigned_workstation.name}
            </span>
          )}
          {po.worker_count > 0 && (
            <span className="text-gray-500 ml-1">
              · {po.worker_count} worker{po.worker_count > 1 ? "s" : ""}
            </span>
          )}
        </div>
        <span className="text-blue-300 font-mono font-bold tabular-nums">
          {remaining > 0 ? `${remaining}s remaining` : "Finishing..."}
        </span>
      </div>
      <div className="w-full bg-neutral-800 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-blue-500 to-cyan-400 h-2 rounded-full transition-all duration-1000 shadow-sm shadow-blue-500/50"
          style={{ width: `${progress}%` }}
        />
      </div>
      <div className="text-right text-[10px] text-gray-500 font-mono">
        {Math.round(progress)}% complete
      </div>
    </div>
  );
}

// ── Start Modal (with Workstation, Role-Grouped Employees, Time Preview) ──

function StartModal({
  po,
  onClose,
}: {
  po: ProductionOrder;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["hrm", "employees"],
    queryFn: async () => (await api.get("/hrm/employees")).data,
  });

  const { data: workstations } = useQuery<Workstation[]>({
    queryKey: ["hrm", "workstations"],
    queryFn: async () => (await api.get("/hrm/workstations")).data,
  });

  const availableEmployees =
    employees?.filter((e) => e.status === "AVAILABLE") || [];
  const availableWorkstations =
    workstations?.filter((w) => w.is_available) || [];

  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [selectedWorkstationId, setSelectedWorkstationId] = useState<string>("");

  // Group employees by role
  const employeesByRole = useMemo(() => {
    const groups: Record<string, Employee[]> = {};
    availableEmployees.forEach((emp) => {
      if (!groups[emp.role]) groups[emp.role] = [];
      groups[emp.role].push(emp);
    });
    return groups;
  }, [availableEmployees]);

  // Dynamic time calculation
  const numWorkers = Math.max(1, selectedIds.length);
  const estimatedTime = Math.max(5, Math.round(BASE_PRODUCTION_TIME / numWorkers));

  const toggleEmp = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleStart = async () => {
    if (selectedIds.length === 0) return alert("Select at least 1 employee");
    try {
      await api.post(`/production/${po.id}/start`, {
        employee_ids: selectedIds,
        workstation_id: selectedWorkstationId
          ? parseInt(selectedWorkstationId)
          : null,
      });
      queryClient.invalidateQueries({ queryKey: ["production"] });
      queryClient.invalidateQueries({ queryKey: ["hrm", "employees"] });
      queryClient.invalidateQueries({ queryKey: ["hrm", "workstations"] });
      onClose();
    } catch (e: any) {
      alert(
        "Failed to start: " + (e.response?.data?.detail || e.message)
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-1 flex items-center gap-2">
          <Factory size={18} className="text-blue-500" />
          Start Production — {po.item_name}
        </h3>
        <p className="text-xs text-gray-500 mb-5 font-mono">
          {po.item_sku} · ×{formatNumber(po.quantity_to_produce, 0)}
        </p>

        {/* Time Preview */}
        <div className="bg-gradient-to-r from-blue-950/50 to-cyan-950/50 border border-blue-500/20 rounded-lg p-4 mb-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-sm text-blue-300">
              <Timer size={16} />
              <span className="font-medium">Estimated Production Time</span>
            </div>
            <div className="text-right">
              <span className="text-2xl font-bold text-white tabular-nums">
                {estimatedTime}s
              </span>
              <p className="text-[10px] text-gray-500">
                {BASE_PRODUCTION_TIME}s base ÷ {numWorkers} worker
                {numWorkers > 1 ? "s" : ""}
              </p>
            </div>
          </div>
          {selectedIds.length > 0 && (
            <div className="mt-3 w-full bg-gray-800 rounded-full h-1.5">
              <div
                className="bg-gradient-to-r from-blue-500 to-cyan-400 h-1.5 rounded-full transition-all duration-500"
                style={{ width: `${Math.min(100, (numWorkers / 4) * 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* Workstation Selection */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1.5">
            <Wrench size={14} />
            Workstation
          </label>
          <select
            value={selectedWorkstationId}
            onChange={(e) => setSelectedWorkstationId(e.target.value)}
            className="w-full px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
          >
            <option value="">No workstation (manual)</option>
            {availableWorkstations.map((ws) => (
              <option key={ws.id} value={ws.id}>
                {ws.name} — {ws.station_type}
              </option>
            ))}
          </select>
        </div>

        {/* Employee Selection (grouped by role) */}
        <div className="mb-5">
          <label className="block text-sm text-gray-400 mb-2 flex items-center gap-1.5">
            <Users size={14} />
            Assign Workers
            {selectedIds.length > 0 && (
              <span className="text-blue-400 ml-1">
                ({selectedIds.length} selected)
              </span>
            )}
          </label>

          <div className="space-y-3 max-h-[40vh] overflow-y-auto pr-1 custom-scrollbar">
            {Object.entries(employeesByRole).map(([role, emps]) => (
              <div key={role}>
                <p
                  className={`text-xs font-semibold uppercase mb-1.5 ${
                    roleColors[role] || "text-gray-400"
                  }`}
                >
                  {role.replace(/_/g, " ")} ({emps.length})
                </p>
                <div className="space-y-1">
                  {emps.map((emp) => (
                    <label
                      key={emp.id}
                      className={`flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-all ${
                        selectedIds.includes(emp.id)
                          ? "bg-blue-500/10 border border-blue-500/30"
                          : "bg-gray-800 border border-transparent hover:bg-gray-700"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(emp.id)}
                        onChange={() => toggleEmp(emp.id)}
                        className="accent-blue-500"
                      />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{emp.name}</div>
                      </div>
                      <span
                        className={`text-[10px] uppercase font-bold ${
                          roleColors[emp.role] || "text-gray-400"
                        }`}
                      >
                        {emp.role.replace(/_/g, " ")}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            ))}
            {availableEmployees.length === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">
                No available employees.
              </p>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleStart}
            disabled={selectedIds.length === 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white rounded-lg text-sm font-medium transition-all disabled:opacity-40 shadow-lg shadow-blue-500/20"
          >
            <Factory size={14} />
            Start Production ({estimatedTime}s)
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Create Manual Production Modal ──

function CreateProductionModal({ onClose }: { onClose: () => void }) {
  const queryClient = useQueryClient();
  const { data: inventory } = useInventory();
  
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [quantity, setQuantity] = useState<number>(1);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Filter out RAW_MATERIAL
  const producibleItems = inventory?.filter(i => i.item_type !== "RAW_MATERIAL") || [];

  const handleCreate = async () => {
    if (!selectedItemId || quantity <= 0) return alert("Select an item and enter valid quantity.");
    setIsSubmitting(true);
    try {
      await api.post("/production/", {
        item_id: parseInt(selectedItemId),
        quantity: quantity
      });
      queryClient.invalidateQueries({ queryKey: ["production"] });
      onClose();
    } catch (e: any) {
      alert("Failed to create: " + (e.response?.data?.detail || e.message));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="bg-gray-900 border border-gray-700 p-6 rounded-xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
          <Plus size={18} className="text-emerald-500" />
          New Production Order
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Product to Manufacture</label>
            <select
              value={selectedItemId}
              onChange={(e) => setSelectedItemId(e.target.value)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            >
              <option value="">-- Select Product --</option>
              {producibleItems.map(item => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-gray-400 mb-1.5">Quantity</label>
            <input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(parseInt(e.target.value) || 0)}
              className="w-full px-3 py-2.5 bg-gray-800 border border-gray-700 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/50"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-6 mt-2 border-t border-gray-800">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-300 hover:text-white">
            Cancel
          </button>
          <button
            onClick={handleCreate}
            disabled={isSubmitting || !selectedItemId || quantity <= 0}
            className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
            Create Order
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Production Card ──

function ProductionCard({
  po,
  onStart,
}: {
  po: ProductionOrder;
  onStart: (po: ProductionOrder) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const queryClient = useQueryClient();
  const config = statusConfig[po.status] || statusConfig.PLANNED;
  const StatusIcon = config.icon;

  const handleApprove = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await api.patch(`/production/${po.id}/approve`);
      queryClient.invalidateQueries({ queryKey: ["production"] });
    } catch {
      alert("Failed to approve order");
    }
  };

  return (
    <div
      className={`glass-card overflow-hidden transition-all duration-200 hover:border-gray-700 ${
        po.status === "DRAFT" ? "border-dashed border-gray-600" : ""
      }`}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between p-5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-4">
          <div className={`p-2.5 rounded-lg ${config.bgColor}`}>
            <StatusIcon
              className={`${config.color} ${
                po.status === "IN_PROGRESS" ? "animate-spin" : ""
              }`}
              size={20}
            />
          </div>
          <div>
            <h3 className="font-medium text-gray-200">{po.item_name}</h3>
            <p className="text-xs text-gray-500 font-mono">{po.item_sku}</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${config.bgColor} ${config.color}`}
            >
              {po.status}
            </span>
            <p className="text-lg font-bold mt-1">
              ×{formatNumber(po.quantity_to_produce, 0)}
            </p>
          </div>
          {po.status === "DRAFT" ? (
            <button
              onClick={handleApprove}
              className="ml-2 px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded-lg text-xs font-semibold text-white transition-colors"
            >
              Approve
            </button>
          ) : po.status === "PLANNED" ? (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onStart(po);
              }}
              className="ml-2 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 rounded-lg text-xs font-semibold text-white transition-colors flex items-center gap-1"
            >
              <CheckCircle size={14} /> Assign & Start
            </button>
          ) : po.materials_consumed?.length > 0 ? (
            expanded ? (
              <ChevronDown size={16} className="text-gray-500 ml-2" />
            ) : (
              <ChevronRight size={16} className="text-gray-500 ml-2" />
            )
          ) : null}
        </div>
      </div>

      {/* Progress Bar for IN_PROGRESS */}
      <ProductionProgressBar po={po} />

      {/* Expanded: Materials Consumed */}
      {expanded && po.materials_consumed.length > 0 && (
        <div className="border-t border-gray-800 bg-gray-800/30 px-5 py-4">
          <p className="text-xs text-gray-400 uppercase font-medium mb-3">
            Materials Consumed
          </p>
          <div className="space-y-2">
            {po.materials_consumed.map((mc, i) => (
              <div
                key={i}
                className="flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                  <span className="text-gray-300">{mc.material_name}</span>
                  <span className="text-xs text-gray-600 font-mono">
                    {mc.material_sku}
                  </span>
                </div>
                <span className="text-orange-400 font-medium">
                  {formatNumber(mc.quantity, 2)} {mc.unit}
                </span>
              </div>
            ))}
          </div>

          {/* Workstation + Timestamps */}
          <div className="mt-3 pt-3 border-t border-gray-700/50 flex flex-wrap gap-4 text-xs text-gray-500">
            {po.assigned_workstation && (
              <span className="flex items-center gap-1">
                <Wrench size={10} /> {po.assigned_workstation.name}
              </span>
            )}
            {po.created_at && (
              <span>
                Created: {new Date(po.created_at).toLocaleString()}
              </span>
            )}
            {po.completed_at && (
              <span>
                Completed: {new Date(po.completed_at).toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Page ──

export default function ProductionPage() {
  const { data: orders, isLoading } = useProduction();
  const [activePo, setActivePo] = useState<ProductionOrder | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Factory className="text-blue-500" />
            Production Orders
          </h1>
          <p className="text-sm text-gray-400 mt-1">
            Manufacturing history and material consumption audit trail
          </p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-sm font-medium transition-all shadow-lg shadow-blue-500/20"
        >
          <Plus size={16} />
          New Production Order
        </button>
      </div>

      {/* Summary */}
      {orders && orders.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusConfig).map(([status, config]) => {
            const count = orders.filter((o) => o.status === status).length;
            return (
              <div key={status} className="glass-card p-4">
                <p className="text-xs text-gray-400">{status}</p>
                <p className={`text-2xl font-bold ${config.color}`}>
                  {count}
                </p>
              </div>
            );
          })}
        </div>
      )}

      {/* Production Order Cards */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-3">
          {orders.map((po) => (
            <ProductionCard key={po.id} po={po} onStart={setActivePo} />
          ))}
        </div>
      ) : (
        <div className="glass-card p-12 text-center">
          <Factory className="mx-auto text-gray-600 mb-3" size={40} />
          <p className="text-gray-400">No production orders yet</p>
          <p className="text-sm text-gray-500 mt-1">
            Place an order with insufficient stock to trigger MRP production
          </p>
        </div>
      )}

      {activePo && (
        <StartModal po={activePo} onClose={() => setActivePo(null)} />
      )}
      
      {isCreateModalOpen && (
        <CreateProductionModal onClose={() => setIsCreateModalOpen(false)} />
      )}
    </div>
  );
}
