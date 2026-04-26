"use client";

import { useState, useEffect } from "react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import { formatCurrency } from "@/lib/utils";
import type { CheckoutResponse } from "@/types";
import {
  CreditCard,
  Loader2,
  CheckCircle,
  Package,
  Factory,
  ShoppingBag,
  AlertCircle,
  FileText,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function CheckoutPage() {
  const { items, totalPrice, clearCart } = useCartStore();
  const { user } = useAuthStore();
  const [form, setForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CheckoutResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    if (items.length === 0 && !result) {
      router.replace("/");
    }
  }, [items.length, result, router]);

  useEffect(() => {
    if (user) {
      setForm(prev => ({
        ...prev,
        name: user.full_name || prev.name,
        email: user.email || prev.email,
      }));
    }
  }, [user]);

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let val = e.target.value.replace(/\D/g, "");
    if (val.length > 10) val = val.slice(0, 10);
    
    let formatted = val;
    if (val.length > 0) formatted = "(" + val.substring(0, 3);
    if (val.length >= 4) formatted += ") " + val.substring(3, 6);
    if (val.length >= 7) formatted += " " + val.substring(6, 8);
    if (val.length >= 9) formatted += " " + val.substring(8, 10);
    
    setForm(prev => ({ ...prev, phone: formatted }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setError(t.checkout.invalidEmail || "Invalid email address format.");
      return;
    }
    if (!form.phone.trim()) {
      setError(t.checkout.requiredPhone || "Please enter your phone number.");
      return;
    }
    if (!form.address.trim()) {
      setError(t.checkout.requiredAddress || "Please enter your delivery address.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const { data } = await api.post<CheckoutResponse>("/storefront/checkout", {
        customer_name: form.name,
        customer_email: form.email,
        customer_phone: form.phone.replace(/\D/g, ""),
        customer_address: form.address,
        items: items.map((i) => ({ item_id: i.id, quantity: i.quantity })),
      });
      setResult(data);
      clearCart();
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      setError(typeof detail === "string" ? detail : detail?.message || "Checkout failed");
    } finally {
      setLoading(false);
    }
  };

  // Order confirmation view
  if (result) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20">
        <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-8 text-center space-y-6">
          <div className="w-16 h-16 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
            <CheckCircle className="text-emerald-400" size={32} />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t.checkout.orderConfirmed}</h1>
            <p className="text-neutral-400 mt-2">{result.message}</p>
          </div>

          <div className="bg-neutral-800/50 rounded-xl p-5 text-left space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">{t.checkout.orderNumber}</span>
              <span className="font-mono font-bold text-amber-400">{result.order.order_number}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">{t.checkout.status}</span>
              <span className="font-medium">{result.order.status.replace(/_/g, " ")}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-neutral-400">{t.checkout.orderTotal}</span>
              <span className="font-medium">{formatCurrency(result.order.total_amount)}</span>
            </div>
          </div>

          {result.invoice && (
            <div className="bg-neutral-800/50 rounded-xl p-5 text-left space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2 text-neutral-300">
                <FileText size={14} /> {t.checkout.invoice}
              </h3>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">Invoice #</span>
                <span className="font-mono">{result.invoice.invoice_number}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">{t.checkout.subtotal}</span>
                <span>{formatCurrency(result.invoice.subtotal)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">{t.checkout.tax}</span>
                <span>{formatCurrency(result.invoice.tax_amount)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold border-t border-neutral-700 pt-2">
                <span>{t.checkout.totalWithTax}</span>
                <span className="text-amber-400">{formatCurrency(result.invoice.total_amount)}</span>
              </div>
            </div>
          )}

          {result.mrp_summary.production_triggered && (
            <div className="bg-blue-950/30 border border-blue-900/40 rounded-xl p-4 text-left text-sm">
              <p className="font-medium text-blue-300 flex items-center gap-2">
                <Factory size={14} /> {t.checkout.manufacturingTriggered}
              </p>
              <p className="text-neutral-400 mt-1">
                {result.mrp_summary.production_orders} {t.checkout.productionOrders}
                {result.mrp_summary.purchase_orders_created > 0 && (
                  <> {result.mrp_summary.purchase_orders_created} {t.checkout.poCreated}</>
                )}
              </p>
            </div>
          )}

          {/* Track Shipment Action */}
          <div className="pt-4 mt-6 border-t border-neutral-800">
            <Link
              href={`/tracking?query=${result.order.order_number}`}
              className="w-full flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-400 text-black py-4 rounded-xl font-bold transition-all"
            >
              <Package size={20} />
              {t.checkout.trackNow || "Track Shipment"}
            </Link>
          </div>
          
          <div className="pt-4 text-center">
            <Link href="/" className="text-amber-500 hover:underline">
              {t.checkout.continueShopping}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (items.length === 0) return null;

  // Empty cart
  if (items.length === 0) {
    return (
      <div className="max-w-2xl mx-auto px-6 py-20 text-center">
        <ShoppingBag className="mx-auto text-neutral-600 mb-4" size={48} />
        <h1 className="text-2xl font-bold">{t.checkout.emptyTitle}</h1>
        <p className="text-neutral-400 mt-2 mb-6">{t.checkout.addSome}</p>
        <Link href="/" className="text-amber-500 hover:underline">{t.checkout.browse}</Link>
      </div>
    );
  }

  // Checkout form
  return (
    <div className="max-w-5xl mx-auto px-6 py-12">
      <h1 className="text-2xl font-bold mb-8 flex items-center gap-3">
        <CreditCard className="text-amber-500" />
        {t.checkout.title}
      </h1>

      <div className="grid md:grid-cols-5 gap-8">
        {/* Form */}
        <form onSubmit={handleSubmit} className="md:col-span-3 space-y-5">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 space-y-4">
            <h2 className="font-semibold text-lg mb-2">{t.checkout.yourDetails}</h2>
            {(["name", "email", "phone", "address"] as const).map((field) => (
              <div key={field}>
                <label className="block text-sm text-neutral-400 mb-1 capitalize">{t.checkout[field as keyof typeof t.checkout]}</label>
                <input
                  type={field === "email" ? "email" : "text"}
                  required
                  value={form[field]}
                  onChange={field === "phone" ? handlePhoneChange : (e) => setForm((prev) => ({ ...prev, [field]: e.target.value }))}
                  placeholder={
                    field === "name" ? t.checkout.name :
                    field === "email" ? "email@example.com" :
                    field === "phone" ? "(555) 123 45 67" :
                    t.checkout.address
                  }
                  className="w-full px-4 py-3 bg-neutral-800 border border-neutral-700 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 placeholder-neutral-500"
                />
              </div>
            ))}
          </div>

          {error && (
            <div className="bg-red-950/30 border border-red-900/40 rounded-xl p-4 text-sm text-red-400 flex items-center gap-2">
              <AlertCircle size={16} /> {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 text-black font-semibold rounded-xl text-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <CreditCard size={20} />}
            {loading ? t.checkout.processing : `${t.checkout.pay} ${formatCurrency(totalPrice())}`}
          </button>
        </form>

        {/* Order Summary */}
        <div className="md:col-span-2">
          <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 sticky top-24">
            <h2 className="font-semibold text-lg mb-4 flex items-center gap-2">
              <Package size={18} /> {t.checkout.summary}
            </h2>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className="flex justify-between text-sm">
                  <span className="text-neutral-300">
                    {item.name} <span className="text-neutral-500">×{item.quantity}</span>
                  </span>
                  <span className="text-neutral-200">{formatCurrency(item.price * item.quantity)}</span>
                </div>
              ))}
            </div>
            <div className="border-t border-neutral-800 mt-4 pt-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">{t.checkout.subtotal}</span>
                <span>{formatCurrency(totalPrice())}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-neutral-400">{t.checkout.tax}</span>
                <span>{formatCurrency(totalPrice() * 0.18)}</span>
              </div>
              <div className="flex justify-between text-lg font-bold pt-2 border-t border-neutral-800">
                <span>{t.cart.total}</span>
                <span className="text-amber-400">{formatCurrency(totalPrice() * 1.18)}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
