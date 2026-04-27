"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Wallet,
  FileText,
  Truck,
  BookOpen,
  X,
  Printer,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  Clock,
} from "lucide-react";
import { useTranslation } from "@/hooks/useTranslation";


/* â•â•â• Types â•â•â• */

interface FinanceSummary {
  total_revenue: number;
  total_revenue_with_vat: number;
  total_expenses: number;
  total_expenses_with_vat: number;
  sales_vat: number;
  purchase_vat: number;
  vat_liability: number;
  net_profit: number;
  sales_invoice_count: number;
  purchase_invoice_count: number;
}

interface InvoiceRow {
  id: number;
  invoice_number: string;
  invoice_type: "SALES" | "PURCHASE";
  order_id: number | null;
  purchase_order_id: number | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  status: string;
  issued_date: string | null;
  paid_date: string | null;
  notes: string | null;
}

interface InvoiceDetail {
  id: number;
  invoice_number: string;
  invoice_type: string;
  status: string;
  issued_date: string | null;
  paid_date: string | null;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total_amount: number;
  notes: string | null;
  company: { name: string; address: string; tax_id: string; phone: string; email: string };
  customer: { name: string; order_number: string };
  line_items: {
    description: string;
    sku: string;
    quantity: number;
    unit_price: number;
    vat_rate: number;
    subtotal: number;
    tax: number;
    total: number;
  }[];
}

interface WaybillRow {
  id: number;
  waybill_number: string;
  order_id: number;
  order_number: string | null;
  shipment_id: number | null;
  tracking_number: string | null;
  status: string;
  issue_date: string | null;
}

interface WaybillDetail {
  id: number;
  waybill_number: string;
  order_number: string | null;
  tracking_number: string | null;
  courier: string | null;
  status: string;
  issue_date: string | null;
  shipped_at: string | null;
  company: { name: string; address: string; tax_id: string };
  recipient: { name: string; address: string };
  line_items: { description: string; sku: string; quantity: number; unit: string }[];
}

interface LedgerTx {
  id: number;
  journal_number: string;
  transaction_date: string;
  description: string;
  reference_type: string | null;
  reference_id: number | null;
  total_amount: number;
  entries: {
    account_code: string;
    account_name: string;
    account_type: string;
    debit: number;
    credit: number;
  }[];
}

interface ProvisionOrder {
  id: number;
  order_number: string;
  customer_name: string;
  status: string;
  order_date: string;
  subtotal: number;
  vat_amount: number;
  total_with_vat: number;
  item_count: number;
}

interface ProvisionData {
  orders: ProvisionOrder[];
  total_provision: number;
  total_with_vat: number;
  count: number;
}

/* â•â•â• Hooks â•â•â• */

function useSummary() {
  return useQuery<FinanceSummary>({
    queryKey: ["finance", "summary"],
    queryFn: async () => (await api.get("/finance/summary")).data,
    refetchInterval: 5000,
  });
}

function useInvoices(type?: string) {
  return useQuery<InvoiceRow[]>({
    queryKey: ["finance", "invoices", type],
    queryFn: async () =>
      (await api.get("/finance/invoices", { params: type ? { invoice_type: type } : {} })).data,
    refetchInterval: 5000,
  });
}

function useWaybills() {
  return useQuery<WaybillRow[]>({
    queryKey: ["finance", "waybills"],
    queryFn: async () => (await api.get("/finance/waybills")).data,
    refetchInterval: 5000,
  });
}

function useLedger() {
  return useQuery<LedgerTx[]>({
    queryKey: ["finance", "ledger"],
    queryFn: async () => (await api.get("/finance/ledger")).data,
    refetchInterval: 5000,
  });
}

function useProvisions() {
  return useQuery<ProvisionData>({
    queryKey: ["finance", "provisions"],
    queryFn: async () => (await api.get("/finance/provisions")).data,
    refetchInterval: 10000,
  });
}

/* â•â•â• Document Viewer Modal â•â•â• */

function InvoiceViewer({ invoiceId, onClose }: { invoiceId: number; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const { data: inv } = useQuery<InvoiceDetail>({
    queryKey: ["finance", "invoice-detail", invoiceId],
    queryFn: async () => (await api.get(`/finance/invoices/${invoiceId}`)).data,
  });

  if (!inv) return null;

  const isSales = inv.invoice_type === "SALES";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-3xl bg-white text-gray-900 rounded-xl shadow-2xl overflow-y-auto max-h-[90vh] print:shadow-none" onClick={(e) => e.stopPropagation()}>
        {/* Print / Close bar */}
        <div className="flex items-center justify-between px-8 py-3 bg-gray-100 border-b print:hidden">
          <span className="text-sm font-medium text-gray-500">{isSales ? t.finance.viewer.salesInv : t.finance.viewer.purInv}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <Printer size={16} />
            </button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg transition-colors">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          {/* Header */}
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{inv.company.name}</h2>
              <p className="text-sm text-gray-500 mt-1">{inv.company.address}</p>
              <p className="text-sm text-gray-500">V.D: {inv.company.tax_id}</p>
              <p className="text-sm text-gray-500">{inv.company.phone} Â· {inv.company.email}</p>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold uppercase tracking-wide" style={{ color: isSales ? '#059669' : '#dc2626' }}>
                {isSales ? t.finance.table.sales.toUpperCase() : t.finance.table.purchase.toUpperCase()} {t.finance.table.tax.toUpperCase()}
              </h3>
              <p className="text-lg font-mono font-bold mt-1">{inv.invoice_number}</p>
              <p className="text-sm text-gray-500">{inv.issued_date ? new Date(inv.issued_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}</p>
              <span className={`inline-block mt-2 px-3 py-1 rounded-full text-xs font-bold ${
                inv.status === "PAID" ? "bg-emerald-100 text-emerald-700" : inv.status === "ISSUED" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"
              }`}>
                {inv.status === "PAID" ? t.finance.status.paid : inv.status === "ISSUED" ? t.finance.status.issued : t.finance.status.draft}
              </span>
            </div>
          </div>

          {/* Bill To */}
          <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
            <p className="text-xs text-gray-400 uppercase font-medium mb-1">{isSales ? t.finance.viewer.billTo : t.finance.viewer.from}</p>
            <p className="font-semibold text-gray-900">{inv.customer.name}</p>
            <p className="text-sm text-gray-500">Ref: {inv.customer.order_number}</p>
          </div>

          {/* Line Items Table */}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-2 text-left font-medium text-gray-500">{t.inventory.name}</th>
                <th className="py-2 text-center font-medium text-gray-500">{t.orders.items}</th>
                <th className="py-2 text-right font-medium text-gray-500">{t.finance.viewer.unitPrice}</th>
                <th className="py-2 text-right font-medium text-gray-500">{t.finance.viewer.vatRate}</th>
                <th className="py-2 text-right font-medium text-gray-500">{t.finance.table.tax}</th>
                <th className="py-2 text-right font-medium text-gray-500">{t.finance.table.total}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {inv.line_items.map((li, i) => (
                <tr key={i}>
                  <td className="py-3">
                    <div className="font-medium">{li.description}</div>
                    <div className="text-xs text-gray-400 font-mono">{li.sku}</div>
                  </td>
                  <td className="py-3 text-center">{li.quantity}</td>
                  <td className="py-3 text-right font-mono">₺{li.unit_price.toFixed(2)}</td>
                  <td className="py-3 text-right">%{li.vat_rate}</td>
                  <td className="py-3 text-right font-mono">₺{li.tax.toFixed(2)}</td>
                  <td className="py-3 text-right font-mono font-semibold">₺{li.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Totals */}
          <div className="border-t-2 border-gray-300 pt-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.finance.table.subtotal}</span>
              <span className="font-mono">₺{inv.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">{t.finance.table.tax} (%{(inv.tax_rate * 100).toFixed(0)})</span>
              <span className="font-mono">₺{inv.tax_amount.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-lg font-bold border-t border-gray-200 pt-2">
              <span>{t.finance.viewer.genTotal}</span>
              <span className="font-mono" style={{ color: isSales ? '#059669' : '#dc2626' }}>₺{inv.total_amount.toFixed(2)}</span>
            </div>
          </div>

          {inv.notes && (
            <div className="text-xs text-gray-400 italic border-t border-gray-200 pt-3">
              {t.finance.viewer.notes}: {inv.notes}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function WaybillViewer({ waybillId, onClose }: { waybillId: number; onClose: () => void }) {
  const { t, locale } = useTranslation();
  const { data: wb } = useQuery<WaybillDetail>({
    queryKey: ["finance", "waybill-detail", waybillId],
    queryFn: async () => (await api.get(`/finance/waybills/${waybillId}`)).data,
  });

  if (!wb) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="w-full max-w-2xl bg-white text-gray-900 rounded-xl shadow-2xl overflow-y-auto max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-8 py-3 bg-gray-100 border-b print:hidden">
          <span className="text-sm font-medium text-gray-500">{t.finance.viewer.way}</span>
          <div className="flex items-center gap-2">
            <button onClick={() => window.print()} className="p-2 hover:bg-gray-200 rounded-lg"><Printer size={16} /></button>
            <button onClick={onClose} className="p-2 hover:bg-gray-200 rounded-lg"><X size={16} /></button>
          </div>
        </div>

        <div className="p-8 space-y-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold">{wb.company.name}</h2>
              <p className="text-sm text-gray-500">{wb.company.address}</p>
              <p className="text-sm text-gray-500">V.D: {wb.company.tax_id}</p>
            </div>
            <div className="text-right">
              <h3 className="text-xl font-bold uppercase tracking-wide text-blue-600">{t.finance.tabs.waybills.toUpperCase()}</h3>
              <p className="text-lg font-mono font-bold mt-1">{wb.waybill_number}</p>
              <p className="text-sm text-gray-500">{wb.issue_date ? new Date(wb.issue_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">{t.finance.viewer.recipient}</p>
              <p className="font-semibold">{wb.recipient.name}</p>
              <p className="text-sm text-gray-500">{wb.recipient.address}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
              <p className="text-xs text-gray-400 uppercase font-medium mb-1">{t.logistics.title}</p>
              <p className="text-sm">{t.finance.table.orderNo}: <span className="font-mono font-bold">{wb.order_number}</span></p>
              <p className="text-sm">{t.finance.table.trackingNo}: <span className="font-mono">{wb.tracking_number || "-"}</span></p>
              <p className="text-sm">{t.logistics.courier}: {wb.courier || t.logistics.noShipments}</p>
            </div>
          </div>

          <table className="w-full text-sm">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="py-2 text-left font-medium text-gray-500">{t.inventory.name}</th>
                <th className="py-2 text-left font-medium text-gray-500">{t.inventory.sku}</th>
                <th className="py-2 text-center font-medium text-gray-500">{t.orders.items}</th>
                <th className="py-2 text-right font-medium text-gray-500">{t.inventory.unit}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {wb.line_items.map((li, i) => (
                <tr key={i}>
                  <td className="py-3 font-medium">{li.description}</td>
                  <td className="py-3 font-mono text-gray-500">{li.sku}</td>
                  <td className="py-3 text-center">{li.quantity}</td>
                  <td className="py-3 text-right">{li.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="border-t border-gray-200 pt-4 flex justify-between text-xs text-gray-400">
            <span>{t.inventory.allItems}: {wb.line_items.length}</span>
            <span>{t.finance.table.date}: {wb.shipped_at ? new Date(wb.shipped_at).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* â•â•â• Main Page â•â•â• */

export default function FinancePage() {
  const { t, locale } = useTranslation();
  const { data: summary } = useSummary();
  const [activeTab, setActiveTab] = useState<"invoices" | "waybills" | "ledger" | "provisions">("invoices");
  const [invoiceFilter, setInvoiceFilter] = useState<string>("");
  const [viewInvoiceId, setViewInvoiceId] = useState<number | null>(null);
  const [viewWaybillId, setViewWaybillId] = useState<number | null>(null);

  const { data: invoices } = useInvoices(invoiceFilter || undefined);
  const { data: waybills } = useWaybills();
  const { data: ledger } = useLedger();
  const { data: provisions } = useProvisions();

  const profitPositive = (summary?.net_profit ?? 0) >= 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-3">
          <DollarSign className="text-emerald-500" />
          {t.finance.title}
        </h1>
        <p className="text-sm text-gray-400 mt-1">
          {t.finance.subtitle}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Revenue */}
        <div className="glass-card p-5 border-l-4 border-l-emerald-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase font-medium">{t.finance.totalRev}</p>
            <div className="p-1.5 bg-emerald-500/10 rounded-lg">
              <TrendingUp size={16} className="text-emerald-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-emerald-400 tabular-nums">
            ₺{summary?.total_revenue.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">{summary?.sales_invoice_count ?? 0} {t.finance.salesInvoiceCount}</p>
        </div>

        {/* Expenses */}
        <div className="glass-card p-5 border-l-4 border-l-rose-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase font-medium">{t.finance.totalExp}</p>
            <div className="p-1.5 bg-rose-500/10 rounded-lg">
              <TrendingDown size={16} className="text-rose-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-rose-400 tabular-nums">
            ₺{summary?.total_expenses.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">{summary?.purchase_invoice_count ?? 0} {t.finance.purchaseInvoiceCount}</p>
        </div>

        {/* VAT */}
        <div className="glass-card p-5 border-l-4 border-l-amber-500">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase font-medium">{t.finance.vatLiability}</p>
            <div className="p-1.5 bg-amber-500/10 rounded-lg">
              <Receipt size={16} className="text-amber-400" />
            </div>
          </div>
          <p className="text-2xl font-bold text-amber-400 tabular-nums">
            ₺{summary?.vat_liability.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">
            {t.finance.salesVat}: ₺{summary?.sales_vat.toFixed(2) ?? "0"} â€” {t.finance.purchaseVat}: ₺{summary?.purchase_vat.toFixed(2) ?? "0"}
          </p>
        </div>

        {/* Net Profit */}
        <div className={`glass-card p-5 border-l-4 ${profitPositive ? "border-l-cyan-500" : "border-l-red-500"}`}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-400 uppercase font-medium">{t.finance.netProfit}</p>
            <div className={`p-1.5 rounded-lg ${profitPositive ? "bg-cyan-500/10" : "bg-red-500/10"}`}>
              <Wallet size={16} className={profitPositive ? "text-cyan-400" : "text-red-400"} />
            </div>
          </div>
          <p className={`text-2xl font-bold tabular-nums ${profitPositive ? "text-cyan-400" : "text-red-400"}`}>
            ₺{summary?.net_profit.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 }) ?? "0.00"}
          </p>
          <p className="text-[10px] text-gray-500 mt-1">{t.finance.revenueExcl}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 bg-gray-900 w-fit p-1 rounded-lg border border-gray-800">
        {([
          { key: "invoices", label: t.finance.tabs.invoices, icon: FileText },
          { key: "waybills", label: t.finance.tabs.waybills, icon: Truck },
          { key: "ledger", label: t.finance.tabs.ledger, icon: BookOpen },
          { key: "provisions", label: t.finance.tabs.provisions, icon: Clock },
        ] as const).map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              activeTab === key ? "bg-gray-800 text-white shadow-sm" : "text-gray-400 hover:text-gray-200"
            }`}
          >
            <Icon size={14} /> {label}
            {key === "provisions" && provisions && provisions.count > 0 && (
              <span className="ml-1 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500/20 text-amber-400 rounded-full">
                {provisions.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* â”€â”€ Invoices Tab â”€â”€ */}
      {activeTab === "invoices" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <FileText className="text-blue-500" size={18} /> {t.finance.tabs.invoices}
            </h3>
            <div className="flex items-center gap-2">
              {["", "SALES", "PURCHASE"].map((f) => (
                <button
                  key={f}
                  onClick={() => setInvoiceFilter(f)}
                  className={`px-3 py-1 text-xs rounded-full font-medium transition-colors ${
                    invoiceFilter === f
                      ? "bg-blue-600 text-white"
                      : "bg-gray-800 text-gray-400 hover:text-white"
                  }`}
                >
                  {f === "" ? t.finance.table.all : f === "SALES" ? t.finance.table.sales : t.finance.table.purchase}
                </button>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.no}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.type}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.subtotal}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.tax}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.total}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.status}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.date}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {invoices && invoices.length > 0 ? invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-blue-400">{inv.invoice_number}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        inv.invoice_type === "SALES"
                          ? "bg-emerald-500/15 text-emerald-400"
                          : "bg-rose-500/15 text-rose-400"
                      }`}>
                        {inv.invoice_type === "SALES" ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
                        {inv.invoice_type === "SALES" ? t.finance.table.sales : t.finance.table.purchase}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-mono">₺{inv.subtotal.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono text-amber-400">₺{inv.tax_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right font-mono font-semibold">₺{inv.total_amount.toFixed(2)}</td>
                    <td className="px-5 py-3 text-center">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                        inv.status === "PAID" ? "bg-emerald-500/20 text-emerald-400"
                          : inv.status === "ISSUED" ? "bg-blue-500/20 text-blue-400"
                          : "bg-gray-500/20 text-gray-400"
                      }`}>
                        {inv.status === "PAID" ? t.finance.status.paid : inv.status === "ISSUED" ? t.finance.status.issued : t.finance.status.draft}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-gray-400">
                      {inv.issued_date ? new Date(inv.issued_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setViewInvoiceId(inv.id)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                        title={t.finance.viewer.salesInv}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} className="text-center py-12 text-gray-500">
                      {t.finance.empty.invoices}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* â”€â”€ Waybills Tab â”€â”€ */}
      {activeTab === "waybills" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Truck className="text-blue-500" size={18} /> {t.finance.tabs.waybills}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.no}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.orderNo}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.trackingNo}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.status}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.date}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.action}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {waybills && waybills.length > 0 ? waybills.map((wb) => (
                  <tr key={wb.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 font-mono text-blue-400">{wb.waybill_number}</td>
                    <td className="px-5 py-3 font-mono text-gray-300">{wb.order_number ?? "-"}</td>
                    <td className="px-5 py-3 font-mono text-gray-400">{wb.tracking_number ?? "-"}</td>
                    <td className="px-5 py-3 text-center">
                      <span className="text-xs px-2 py-0.5 rounded-full font-bold bg-blue-500/20 text-blue-400">
                        {wb.status === "ISSUED" ? t.finance.status.way_issued : t.finance.status.draft}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-center text-xs text-gray-400">
                      {wb.issue_date ? new Date(wb.issue_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <button
                        onClick={() => setViewWaybillId(wb.id)}
                        className="p-1.5 hover:bg-gray-700 rounded-lg transition-colors text-gray-400 hover:text-white"
                        title={t.finance.viewer.way}
                      >
                        <Eye size={14} />
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={6} className="text-center py-12 text-gray-500">
                      {t.finance.empty.waybills}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* â”€â”€ Ledger Tab â”€â”€ */}
      {activeTab === "ledger" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <BookOpen className="text-blue-500" size={18} /> {t.finance.tabs.ledger}
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.date}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.type}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.total}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.desc}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.ref}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {ledger && ledger.length > 0 ? ledger.map((tx) => (
                  <tr key={tx.id} className="hover:bg-gray-800/30 transition-colors">
                    <td className="px-5 py-3 text-gray-400 tabular-nums text-xs">
                      {tx.transaction_date ? new Date(tx.transaction_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                        tx.reference_type === "INVOICE" ? "bg-emerald-500/10 text-emerald-400" : "bg-rose-500/10 text-rose-400"
                      }`}>
                        {tx.reference_type === "INVOICE" ? t.finance.tabs?.revenue || "GELİR" : t.finance.tabs?.expense || "GİDER"}
                      </span>
                    </td>
                    <td className={`px-5 py-3 text-right tabular-nums font-mono font-medium ${
                      tx.reference_type === "INVOICE" ? "text-emerald-400" : "text-rose-400"
                    }`}>
                      {tx.reference_type === "INVOICE" ? "+" : "-"}₺{Math.abs(tx.total_amount || 0).toFixed(2)}
                    </td>
                    <td className="px-5 py-3 text-gray-300 max-w-xs truncate" title={tx.description}>
                      {tx.description}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs font-mono">
                      {tx.reference_type} #{tx.reference_id}
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-gray-500">
                      {t.finance.empty.ledger}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Provisions Tab ── */}
      {activeTab === "provisions" && (
        <div className="glass-card overflow-hidden">
          <div className="p-4 border-b border-gray-800 bg-gray-900/50 flex items-center justify-between">
            <h3 className="font-semibold text-lg flex items-center gap-2">
              <Clock className="text-amber-500" size={18} /> {t.finance.tabs.provisions}
            </h3>
            {provisions && (
              <div className="flex items-center gap-4 text-sm">
                <span className="text-gray-400">
                  {provisions.count} sipariş &mdash;
                  <span className="text-amber-400 font-bold font-mono ml-1">
                    ₺{provisions.total_provision.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 })}
                  </span>
                  <span className="text-gray-500 text-xs ml-1">(KDV Hariç)</span>
                </span>
                <span className="px-2.5 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-bold rounded-full">
                  Beklenen Ciro: ₺{provisions.total_with_vat.toLocaleString(locale === "tr" ? "tr-TR" : "en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
            )}
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-800/50">
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.orders.details}</th>
                  <th className="text-left px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.customers.title}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.orders.status}</th>
                  <th className="text-center px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.date}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.subtotal}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.tax}</th>
                  <th className="text-right px-5 py-3 text-xs font-medium text-gray-400 uppercase">{t.finance.table.total}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-800/50">
                {provisions && provisions.orders.length > 0 ? provisions.orders.map((order) => {
                  const statusColors: Record<string, string> = {
                    PENDING: "bg-blue-500/20 text-blue-400",
                    IN_PRODUCTION: "bg-purple-500/20 text-purple-400",
                    READY: "bg-emerald-500/20 text-emerald-400",
                    SHIPPED: "bg-amber-500/20 text-amber-400",
                  };
                  const statusLabels: Record<string, string> = {
                    PENDING: t.dashboard.pending,
                    IN_PRODUCTION: t.dashboard.inProduction,
                    READY: t.dashboard.ready,
                    SHIPPED: t.dashboard.shipped,
                  };
                  return (
                    <tr key={order.id} className="hover:bg-gray-800/30 transition-colors">
                      <td className="px-5 py-3">
                        <div className="font-mono text-blue-400 text-xs">{order.order_number}</div>
                        <div className="text-gray-500 text-xs mt-0.5">{order.item_count} ürün</div>
                      </td>
                      <td className="px-5 py-3 text-gray-300">{order.customer_name}</td>
                      <td className="px-5 py-3 text-center">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ${statusColors[order.status] || "bg-gray-500/20 text-gray-400"}`}>
                          {statusLabels[order.status] || order.status}
                        </span>
                      </td>
                      <td className="px-5 py-3 text-center text-xs text-gray-400">
                        {order.order_date ? new Date(order.order_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US") : "-"}
                      </td>
                      <td className="px-5 py-3 text-right font-mono text-gray-300">₺{order.subtotal.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-mono text-amber-400">₺{order.vat_amount.toFixed(2)}</td>
                      <td className="px-5 py-3 text-right font-mono font-semibold text-white">₺{order.total_with_vat.toFixed(2)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={7} className="text-center py-12 text-gray-500">
                      <div className="flex flex-col items-center gap-2 opacity-50">
                        <Clock size={32} className="text-emerald-500" />
                        Tüm siparişler teslim edildi — bekleyen sipariş yok.
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Document Viewer Modals */}
      {viewInvoiceId && <InvoiceViewer invoiceId={viewInvoiceId} onClose={() => setViewInvoiceId(null)} />}
      {viewWaybillId && <WaybillViewer waybillId={viewWaybillId} onClose={() => setViewWaybillId(null)} />}
    </div>
  );
}
