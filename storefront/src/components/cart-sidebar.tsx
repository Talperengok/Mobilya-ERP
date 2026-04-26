"use client";

import { X, Plus, Minus, Trash2, ShoppingBag } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

export function CartSidebar() {
  const { items, isOpen, closeCart, updateQuantity, removeItem, totalPrice } =
    useCartStore();
  const { t } = useTranslation();

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 z-40" onClick={closeCart} />

      {/* Sidebar */}
      <div className="fixed right-0 top-0 h-full w-full max-w-md bg-neutral-900 border-l border-neutral-800 z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-neutral-800">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <ShoppingBag size={20} className="text-amber-500" />
            {t.nav.cart}
          </h2>
          <button onClick={closeCart} className="p-1 hover:bg-neutral-800 rounded-lg transition-colors">
            <X size={20} className="text-neutral-400" />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {items.length === 0 ? (
            <div className="text-center py-12 text-neutral-500">
              <ShoppingBag className="mx-auto mb-3 opacity-30" size={48} />
              <p>{t.cart.empty}</p>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.id} className="flex items-center gap-4 bg-neutral-800/50 rounded-xl p-4">
                <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-amber-900/40 to-amber-700/20 flex items-center justify-center flex-shrink-0">
                  <ShoppingBag size={20} className="text-amber-500/60" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.name}</p>
                  <p className="text-xs text-neutral-500">{item.sku}</p>
                  <p className="text-sm font-semibold text-amber-400 mt-1">
                    {formatCurrency(item.price)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity - 1)}
                    className="p-1 rounded-md bg-neutral-700 hover:bg-neutral-600 transition-colors"
                  >
                    <Minus size={14} />
                  </button>
                  <span className="text-sm font-medium w-6 text-center">{item.quantity}</span>
                  <button
                    onClick={() => updateQuantity(item.id, item.quantity + 1)}
                    disabled={item.quantity >= item.available_stock}
                    className="p-1 rounded-md bg-neutral-700 hover:bg-neutral-600 disabled:opacity-50 disabled:hover:bg-neutral-700 transition-colors"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    onClick={() => removeItem(item.id)}
                    className="p-1 text-red-400 hover:bg-red-500/10 rounded-md ml-1 transition-colors"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="border-t border-neutral-800 p-6 space-y-4">
            <div className="flex justify-between text-lg font-semibold">
              <span>{t.cart.total}</span>
              <span className="text-amber-400">{formatCurrency(totalPrice())}</span>
            </div>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="block w-full text-center py-3 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-xl transition-colors"
            >
              {t.cart.checkout}
            </Link>
          </div>
        )}
      </div>
    </>
  );
}
