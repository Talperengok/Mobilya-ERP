"use client";

import { ShoppingBag, Eye } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import type { Product } from "@/types";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

const gradients = [
  "from-amber-900/30 to-orange-800/20",
  "from-emerald-900/30 to-teal-800/20",
  "from-blue-900/30 to-indigo-800/20",
  "from-rose-900/30 to-pink-800/20",
  "from-violet-900/30 to-purple-800/20",
  "from-cyan-900/30 to-sky-800/20",
  "from-lime-900/30 to-green-800/20",
];

export function ProductCard({ product, index }: { product: Product; index: number }) {
  const addItem = useCartStore((s) => s.addItem);
  const { t } = useTranslation();
  const gradient = gradients[index % gradients.length];

  return (
    <div className="group bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden hover:border-neutral-700 transition-all duration-300 hover:shadow-xl hover:shadow-amber-500/5">
      {/* Image placeholder */}
      <div className={`relative h-56 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
        <ShoppingBag size={48} className="text-white/10 group-hover:text-white/20 transition-all duration-300 group-hover:scale-110" />
        {((product.available_stock || 0) <= 0) && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <span className="text-sm font-medium text-red-400 bg-red-500/20 px-3 py-1 rounded-full">{t.product.outOfStock}</span>
          </div>
        )}
      </div>

      {/* Info */}
      <div className="p-5 space-y-3">
        <div>
          <p className="text-xs text-neutral-500 font-mono">{product.sku}</p>
          <h3 className="text-lg font-semibold mt-1 group-hover:text-amber-400 transition-colors">
            {product.name}
          </h3>
        </div>

        <div className="flex items-end justify-between">
          <div>
            <p className="text-2xl font-bold text-amber-400">{formatCurrency(product.selling_price)}</p>
            <p className="text-xs text-neutral-500 mt-0.5">
              {(product.available_stock || 0) > 0 ? `${product.available_stock || 0} ${t.product.inStock}` : t.product.outOfStock}
            </p>
          </div>
        </div>

        <div className="flex gap-2 pt-1">
          <Link
            href={`/products/${product.id}`}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 border border-neutral-700 hover:border-neutral-500 rounded-xl text-sm font-medium transition-colors"
          >
            <Eye size={16} /> {t.product.details}
          </Link>
          <button
            onClick={() => addItem({ id: product.id, name: product.name, sku: product.sku, price: product.selling_price, available_stock: product.available_stock || 0 })}
            disabled={product.available_stock <= 0}
            className="flex-1 flex items-center justify-center gap-2 py-2.5 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-medium rounded-xl text-sm transition-colors"
          >
            <ShoppingBag size={16} /> {t.product.add}
          </button>
        </div>
      </div>
    </div>
  );
}
