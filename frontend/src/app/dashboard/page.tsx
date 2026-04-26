"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { 
  Package, 
  ShoppingCart, 
  Factory, 
  TrendingUp, 
  AlertTriangle, 
  Box, 
  CheckCircle2, 
  Clock,
  ArrowUpRight,
  Monitor
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface DashboardStats {
  items: {
    raw_materials: number;
    sub_products: number;
    finished_goods: number;
    total: number;
  };
  low_stock_alerts: Array<{
    id: number;
    name: string;
    sku: string;
    stock: number;
    critical_stock_level: number;
  }>;
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

export default function ERPDashboard() {
  const { t, locale } = useTranslation();

  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["dashboard", "stats"],
    queryFn: async () => (await api.get("/dashboard/stats")).data,
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <div className="animate-spin text-blue-500">
           <Package size={40} />
        </div>
        <p className="text-gray-500 animate-pulse">Loading manufacturing insights...</p>
      </div>
    );
  }

  if (!stats) return null;

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-white flex items-center gap-3">
          <Monitor className="text-blue-500" />
          {t.sidebar.dashboard}
        </h1>
        <p className="text-gray-400">{t.dashboard.subtitle}</p>
      </div>

      {/* ── KPI Grid ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Inventory Card */}
        <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-blue-500/50 transition-all duration-300">
           <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 group-hover:scale-110 transition-transform">
               <Package size={24} />
             </div>
             <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
               <ArrowUpRight size={12} /> Live
             </span>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t.dashboard.totalItems}</p>
             <h3 className="text-3xl font-bold text-white">{stats.items.total}</h3>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-2 gap-2 text-xs">
              <div className="text-gray-400">{t.dashboard.finishedGoods}: <span className="text-white font-bold">{stats.items.finished_goods}</span></div>
              <div className="text-gray-400">{t.dashboard.rawMaterials}: <span className="text-white font-bold">{stats.items.raw_materials}</span></div>
           </div>
        </div>

        {/* Revenue Card (Split Gross & Net) */}
        <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all duration-300 flex flex-col justify-between">
           <div>
             <div className="flex justify-between items-start mb-4">
               <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-500 group-hover:scale-110 transition-transform">
                 <TrendingUp size={24} />
               </div>
               <span className="flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                 <ArrowUpRight size={12} /> Live
               </span>
             </div>
             <div className="space-y-1">
               <p className="text-sm font-medium text-gray-500 uppercase tracking-wider text-ellipsis whitespace-nowrap overflow-hidden" title="Gross Sales (Incl. VAT & Pending)">Brüt Satışlar</p>
               <h3 className="text-2xl font-bold text-white">{formatCurrency(stats.revenue.gross, locale === 'tr' ? 'TRY' : 'USD')}</h3>
               <p className="text-[10px] text-gray-400 flex items-center gap-1 mt-1">
                 Total from {stats.orders.total} orders
               </p>
             </div>
           </div>
           
           <div className="mt-4 pt-4 border-t border-gray-800/50">
             <div className="space-y-1">
               <p className="text-[11px] font-medium text-gray-500 uppercase tracking-wider">Net Gelir (Faturalanmış)</p>
               <h4 className="text-xl font-bold text-emerald-400">{formatCurrency(stats.revenue.net, locale === 'tr' ? 'TRY' : 'USD')}</h4>
             </div>
           </div>
        </div>

        {/* Orders Card */}
        <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-amber-500/50 transition-all duration-300">
           <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-amber-500/10 rounded-xl text-amber-500 group-hover:scale-110 transition-transform">
               <ShoppingCart size={24} />
             </div>
             {stats.orders.pending > 0 && (
               <span className="flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full animate-pulse">
                Action Required
               </span>
             )}
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t.dashboard.totalOrders}</p>
             <h3 className="text-3xl font-bold text-white">{stats.orders.total}</h3>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-800/50 grid grid-cols-2 gap-2 text-xs text-gray-400">
              <div className="flex items-center gap-1"><Clock size={12} className="text-amber-500" /> {t.dashboard.pending}: <span className="text-white font-bold">{stats.orders.pending}</span></div>
              <div className="flex items-center gap-1"><CheckCircle2 size={12} className="text-emerald-500" /> {t.dashboard.delivered}: <span className="text-white font-bold">{stats.orders.delivered}</span></div>
           </div>
        </div>

        {/* Production Card */}
        <div className="group relative bg-gray-900 border border-gray-800 rounded-2xl p-6 hover:border-purple-500/50 transition-all duration-300">
           <div className="flex justify-between items-start mb-4">
             <div className="p-3 bg-purple-500/10 rounded-xl text-purple-500 group-hover:scale-110 transition-transform">
               <Factory size={24} />
             </div>
           </div>
           <div className="space-y-1">
             <p className="text-sm font-medium text-gray-500 uppercase tracking-wider">{t.production.title}</p>
             <h3 className="text-3xl font-bold text-white">{stats.production.active}</h3>
           </div>
           <div className="mt-4 pt-4 border-t border-gray-800/50 text-xs text-gray-400">
             Currently active workstation tasks.
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* ── Low Stock Monitor ── */}
        <div className="lg:col-span-2 bg-gray-900 border border-gray-800 rounded-2xl h-full flex flex-col overflow-hidden">
          <div className="p-6 border-b border-gray-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="text-amber-500" size={20} />
              <h2 className="text-lg font-bold text-white">Low Stock Monitor</h2>
            </div>
          </div>
          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-sm text-gray-400">
              <thead className="bg-gray-950/50 text-xs uppercase text-gray-500">
                <tr>
                  <th className="px-6 py-4">{t.inventory.name}</th>
                  <th className="px-6 py-4">{t.inventory.sku}</th>
                  <th className="px-6 py-4 text-center">{t.inventory.stock}</th>
                  <th className="px-6 py-4 text-center">Critical</th>
                  <th className="px-6 py-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800">
                {stats.low_stock_alerts.length > 0 ? (
                  stats.low_stock_alerts.map((alert) => (
                    <tr key={alert.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-gray-200">{alert.name}</td>
                      <td className="px-6 py-4 font-mono text-xs text-gray-500">{alert.sku}</td>
                      <td className="px-6 py-4 text-center font-bold text-amber-500">{alert.stock}</td>
                      <td className="px-6 py-4 text-center text-gray-500">{alert.critical_stock_level}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="px-2 py-1 bg-red-500/10 text-red-500 text-[10px] font-bold rounded uppercase tracking-tighter">Urgent</span>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <CheckCircle2 size={32} className="text-emerald-500" />
                        All items are properly stocked.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Status Guide ── */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
           <h2 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
             <Box className="text-blue-500" size={20} />
             Order Roadmap
           </h2>
           <div className="space-y-6">
             {[
               { label: "Pending", value: stats.orders.pending, color: "bg-blue-500", icon: Clock },
               { label: "In Production", value: stats.orders.in_production, color: "bg-purple-500", icon: Factory },
               { label: "Ready to Ship", value: stats.orders.ready, color: "bg-amber-500", icon: Box },
               { label: "Completed", value: stats.orders.delivered, color: "bg-emerald-500", icon: CheckCircle2 },
             ].map((item, i) => (
               <div key={i} className="flex items-center gap-4">
                  <div className={`p-2 rounded-lg ${item.color}/10 text-white`}>
                    <item.icon size={16} className={item.color.replace('bg-', 'text-')} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm text-gray-300 font-medium">{item.label}</span>
                      <span className="text-xs text-gray-500 font-bold">{Math.round((item.value / (stats.orders.total || 1)) * 100)}%</span>
                    </div>
                    <div className="w-full h-1.5 bg-gray-800 rounded-full overflow-hidden">
                       <div 
                         className={`h-full ${item.color} transition-all duration-1000`} 
                         style={{ width: `${(item.value / (stats.orders.total || 1)) * 100}%` }} 
                       />
                    </div>
                  </div>
                  <span className="text-sm font-bold text-white w-4 text-right">{item.value}</span>
               </div>
             ))}
           </div>
        </div>
      </div>
    </div>
  );
}
