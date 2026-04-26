"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import type { InventoryItem, ItemType, BOMExplosionNode } from "@/types";
import { AlertTriangle, Package, RefreshCw, Search, Edit2, X, Layers, ChevronRight, Settings } from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";

/**
 * LIVE INVENTORY MONITOR
 */

function useInventory() {
  return useQuery<InventoryItem[]>({
    queryKey: ["inventory"],
    queryFn: async () => {
      const { data } = await api.get("/dashboard/inventory");
      return data;
    },
    refetchInterval: 3000,
  });
}

const typeStyles: Record<string, string> = {
  RAW_MATERIAL: "bg-purple-500/20 text-purple-300 border border-purple-500/30",
  SUB_PRODUCT: "bg-orange-500/20 text-orange-300 border border-orange-500/30",
  FINISHED_GOOD: "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30",
};

// Recursive Component for BOM Tree
function BOMNode({ node, level = 0 }: { node: BOMExplosionNode; level?: number }) {
  const isRaw = node.item_type === "RAW_MATERIAL";
  const [expanded, setExpanded] = useState(true);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div className="flex flex-col text-sm">
      <div
        className={`flex items-center justify-between py-2.5 pr-4 group transition-colors ${level > 0 ? "border-t border-gray-800/50 hover:bg-gray-800/30" : "bg-gray-800/40 rounded-lg mb-2 px-4 border border-gray-700"}`}
        style={{ paddingLeft: level > 0 ? `${(level * 1.5) + 1}rem` : undefined }}
      >
        <div className="flex items-center gap-3">
          {hasChildren ? (
            <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-white transition-colors">
              <ChevronRight size={16} className={`transition-transform duration-200 ${expanded ? "rotate-90" : ""}`} />
            </button>
          ) : (
            <div className="w-4" /> // spacer
          )}

          <div className="flex flex-col">
            <span className="font-medium text-gray-200 flex items-center gap-2">
              {node.item_name}
              {level === 0 && <span className="text-xs text-gray-500 font-mono bg-gray-900 px-2 py-0.5 rounded-full border border-gray-700">{node.item_sku}</span>}
            </span>
            {level > 0 && <span className="text-xs text-gray-500 font-mono">{node.item_sku}</span>}
          </div>
        </div>

        <div className="flex items-center gap-6">
          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium uppercase tracking-wider ${typeStyles[node.item_type] || "bg-gray-700 text-gray-300"}`}>
            {node.item_type.replace("_", " ")}
          </span>

          <div className="flex flex-col items-end min-w-[80px]">
            <span className="text-gray-300 font-medium">
              {formatNumber(node.total_quantity, 2)} <span className="text-gray-500 text-xs">{node.unit}</span>
            </span>
            {level > 0 && (
              <span className="text-xs text-gray-500">
                {formatNumber(node.quantity_per_unit, 2)} / unit
              </span>
            )}
          </div>

          <div className="min-w-[100px] text-right">
            <span className={`text-xs font-medium px-2 py-1 rounded-full ${node.stock_sufficient ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              Stock: {formatNumber(node.stock_available, 2)}
            </span>
          </div>
        </div>
      </div>

      {hasChildren && expanded && (
        <div className="flex flex-col border-l border-gray-800 ml-[1.375rem] relative">
          <div className="absolute top-0 bottom-0 left-0 border-l border-gray-700/50 z-[-1]" />
          {node.children.map((child) => (
            <BOMNode key={child.item_id} node={child} level={level + 1} />
          ))}
        </div>
      )}
    </div>
  );
}

function BOMViewer({ itemId }: { itemId: number }) {
  const { data, isLoading, error } = useQuery<BOMExplosionNode>({
    queryKey: ["bom-explode", itemId],
    queryFn: async () => {
      const { data } = await api.get(`/bom/${itemId}/explode?quantity=1`);
      return data;
    },
  });

  if (isLoading) return <div className="p-8 flex justify-center"><div className="animate-spin h-6 w-6 border-b-2 border-blue-500 rounded-full" /></div>;
  if (error || !data) return <div className="p-8 text-center text-red-400 bg-red-500/10 rounded-lg">Failed to load BOM or this item has no BOM.</div>;

  return (
    <div className="mt-6 border border-gray-800 rounded-xl overflow-hidden bg-gray-900/30">
      <div className="bg-gray-800/50 px-5 py-3 border-b border-gray-800 flex items-center gap-2 text-sm font-medium text-gray-300">
        <Layers size={16} className="text-blue-400" />
        Bill of Materials (BOM) Tree
      </div>
      <div className="p-4 overflow-x-auto">
        <BOMNode node={data} />
      </div>
    </div>
  );
}

export default function InventoryPage() {
  const { data: inventory, isLoading, dataUpdatedAt } = useInventory();
  const [filter, setFilter] = useState<ItemType | "">("");
  const [search, setSearch] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const handleEditThresholds = async (item: InventoryItem, e: React.MouseEvent) => {
    e.stopPropagation();
    const crit = window.prompt(`Set critical level for ${item.name}`, item.critical_stock_level.toString());
    if (crit === null) return;
    const targ = window.prompt(`Set target level for ${item.name}`, item.target_stock_level.toString());
    if (targ === null) return;

    try {
      await api.patch(`/items/${item.id}/thresholds`, {
        critical_stock_level: parseFloat(crit) || 0,
        target_stock_level: parseFloat(targ) || 0,
      });
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err) {
      alert("Failed to update thresholds");
    }
  };

  const handleFullMRP = async () => {
    try {
      const res = await api.post("/items/evaluate-all");
      alert(`MRP Check Complete: ${res.data.evaluated_items} critical items evaluated.`);
      queryClient.invalidateQueries({ queryKey: ["inventory"] });
    } catch (err: any) {
      alert("MRP Check failed: " + err.message);
    }
  };

  const typeFilters: { label: string; value: ItemType | "" }[] = [
    { label: t.inventory.allItems, value: "" },
    { label: t.inventory.rawMats, value: "RAW_MATERIAL" },
    { label: t.inventory.subProds, value: "SUB_PRODUCT" },
    { label: t.inventory.finGoods, value: "FINISHED_GOOD" },
  ];

  const filtered = inventory?.filter((item) => {
    const matchesType = !filter || item.item_type === filter;
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      item.sku.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-3">
            <Package className="text-blue-500" />
            {t.inventory.title}
          </h1>
          <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
            </span>
            {t.inventory.autoRef}
            {dataUpdatedAt && (
              <span className="text-gray-500">
                · {t.inventory.lastUpdate}:{" "}
                {new Date(dataUpdatedAt).toLocaleTimeString()}
              </span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <button
            onClick={handleFullMRP}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600/20 hover:bg-blue-600/40 text-blue-400 font-medium rounded-lg transition-colors"
          >
            <RefreshCw size={14} /> Run Full MRP Check
          </button>
          <span>
            <RefreshCw size={14} className="animate-spin inline mr-1" style={{ animationDuration: "3s" }} />
            {filtered?.length ?? 0} {t.inventory.items}
          </span>
        </div>
      </div>

      {/* ── Filters ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex gap-2">
          {typeFilters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${filter === f.value
                ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                : "bg-gray-800 border border-gray-700 text-gray-300 hover:bg-gray-700"
                }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs">
          <Search
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500"
          />
          <input
            type="text"
            placeholder={t.inventory.search}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-gray-800/50 border border-gray-700 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500 transition-all"
          />
        </div>
      </div>

      {/* ── Inventory Table ── */}
      {isLoading ? (
        <div className="flex items-center justify-center h-40">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
        </div>
      ) : (
        <div className="glass-card overflow-hidden border border-gray-800 shadow-xl rounded-xl">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-gray-900 border-b border-gray-800">
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.sku}</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.name}</th>
                  <th className="px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.type}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.stock}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.reserved}</th>
                  <th className="text-right px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.available}</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.unit}</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">{t.inventory.status}</th>
                  <th className="text-center px-6 py-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">Act</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50 bg-gray-900/20">
                {filtered?.map((item) => (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`group transition-all hover:bg-gray-800 cursor-pointer ${item.is_low_stock ? "bg-red-950/10" : ""
                      }`}
                  >
                    <td className="px-6 py-4 text-sm font-mono text-gray-400 group-hover:text-blue-400 transition-colors">
                      {item.sku}
                    </td>
                    <td className="px-6 py-4 text-sm font-medium text-gray-200">
                      {item.name}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs px-2.5 py-1 rounded-full font-medium tracking-wide ${typeStyles[item.item_type]}`}>
                        {item.item_type === "RAW_MATERIAL" ? t.inventory.rawMats :
                          item.item_type === "SUB_PRODUCT" ? t.inventory.subProds :
                            t.inventory.finGoods}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-medium">
                      {formatNumber(item.stock_quantity, 2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-right text-yellow-400">
                      {item.reserved_quantity > 0 ? formatNumber(item.reserved_quantity, 2) : "—"}
                    </td>
                    <td className="px-6 py-4 text-sm text-right font-bold text-white">
                      {formatNumber(item.available_quantity, 2)}
                    </td>
                    <td className="px-6 py-4 text-sm text-center text-gray-400">
                      {item.unit}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {item.is_critical ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-red-400 bg-red-500/10 px-2.5 py-1 rounded-full font-bold border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                          <AlertTriangle size={12} /> CRITICAL
                        </span>
                      ) : item.is_low_stock ? (
                        <span className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-orange-400 bg-orange-500/10 px-2.5 py-1 rounded-full font-bold border border-orange-500/20">
                          <AlertTriangle size={12} /> {t.inventory.low}
                        </span>
                      ) : (
                        <span className="text-xs text-green-400 bg-green-500/10 px-2.5 py-1 rounded-full border border-green-500/20">● {t.inventory.ok}</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <button
                        onClick={(e) => handleEditThresholds(item, e)}
                        className="p-1.5 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-md text-gray-400 hover:text-white transition-all shadow-sm"
                        title="Edit Thresholds"
                      >
                        <Settings size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Product Details & BOM Modal ── */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity"
            onClick={() => setSelectedItem(null)}
          />
          <div className="relative bg-gray-900 border border-gray-700 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-6 border-b border-gray-800 bg-gray-900/80 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400">
                  <Package size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    {selectedItem.name}
                    <span className={`text-xs px-2.5 py-1 rounded-full font-medium tracking-wide ${typeStyles[selectedItem.item_type]}`}>
                      {selectedItem.item_type === "RAW_MATERIAL" ? t.inventory.rawMats :
                        selectedItem.item_type === "SUB_PRODUCT" ? t.inventory.subProds :
                          t.inventory.finGoods}
                    </span>
                  </h2>
                  <div className="text-sm text-gray-400 font-mono mt-1">SKU: {selectedItem.sku}</div>
                </div>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1 bg-gradient-to-b from-gray-900 to-gray-950">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-500 mb-1">Available Stock</div>
                  <div className="text-2xl font-bold text-white">{formatNumber(selectedItem.available_quantity, 2)} <span className="text-sm text-gray-500 font-normal">{selectedItem.unit}</span></div>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-500 mb-1">Reserved</div>
                  <div className="text-2xl font-bold text-yellow-400">{formatNumber(selectedItem.reserved_quantity, 2)} <span className="text-sm text-gray-500 font-normal">{selectedItem.unit}</span></div>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-500 mb-1">Target Stock</div>
                  <div className="text-2xl font-bold text-blue-400">{formatNumber(selectedItem.target_stock_level, 2)} <span className="text-sm text-gray-500 font-normal">{selectedItem.unit}</span></div>
                </div>
                <div className="bg-gray-800/40 p-4 rounded-xl border border-gray-800">
                  <div className="text-sm text-gray-500 mb-1">Critical Level</div>
                  <div className="text-2xl font-bold text-red-400">{formatNumber(selectedItem.critical_stock_level, 2)} <span className="text-sm text-gray-500 font-normal">{selectedItem.unit}</span></div>
                </div>
              </div>

              {(selectedItem.item_type === "SUB_PRODUCT" || selectedItem.item_type === "FINISHED_GOOD") && (
                <BOMViewer itemId={selectedItem.id} />
              )}

              {selectedItem.item_type === "RAW_MATERIAL" && (
                <div className="flex flex-col items-center justify-center p-12 border border-gray-800 border-dashed rounded-xl bg-gray-900/30">
                  <div className="h-16 w-16 rounded-full bg-purple-500/10 flex items-center justify-center text-purple-400 mb-4">
                    <Layers size={32} />
                  </div>
                  <h3 className="text-lg font-medium text-gray-300">Raw Material</h3>
                  <p className="text-gray-500 text-sm mt-1 text-center max-w-sm">This is a base material and does not have a Bill of Materials (BOM) or sub-components.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
