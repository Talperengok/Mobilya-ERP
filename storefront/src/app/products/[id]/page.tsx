"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { useCartStore } from "@/store/cart";
import { formatCurrency, getProductImage } from "@/lib/utils";
import type { Product } from "@/types";
import { ShoppingBag, ArrowLeft, Package, CheckCircle } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/useTranslation";

export default function ProductDetailPage() {
  const params = useParams();
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [added, setAdded] = useState(false);
  const addItem = useCartStore((s) => s.addItem);
  const { t } = useTranslation();

  useEffect(() => {
    if (params.id) {
      api.get(`/storefront/catalog/${params.id}`).then((res) => {
        setProduct(res.data);
        setLoading(false);
      });
    }
  }, [params.id]);

  const handleAdd = () => {
    if (!product) return;
    addItem({ id: product.id, name: product.name, sku: product.sku, price: product.selling_price, available_stock: product.available_stock || 0 });
    setAdded(true);
    setTimeout(() => setAdded(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-32">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500" />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="max-w-7xl mx-auto px-6 py-20 text-center">
        <p className="text-neutral-400">{t.product.notFound}</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-12">
      <Link href="/" className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white mb-8 transition-colors">
        <ArrowLeft size={16} /> {t.product.backToCollection}
      </Link>

      <div className="grid md:grid-cols-2 gap-12">
        {/* Image */}
        <div className="aspect-square bg-neutral-900 border border-neutral-800 rounded-3xl overflow-hidden group">
          <img 
            src={getProductImage(product)} 
            alt={product.name} 
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
          />
        </div>

        {/* Details */}
        <div className="space-y-6">
          <div>
            <p className="text-sm text-neutral-500 font-mono">{product.sku}</p>
            <h1 className="text-3xl font-bold mt-2">{product.name}</h1>
          </div>

          <p className="text-4xl font-bold text-amber-400">
            {formatCurrency(product.selling_price)}
          </p>

          <div className="space-y-3 text-sm text-neutral-400">
            <div className="flex justify-between py-2 border-b border-neutral-800">
              <span>{t.product.category}</span>
              <span className="text-neutral-200">{product.category}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-neutral-800">
              <span>{t.product.inStock}</span>
              <span className="text-neutral-200">{product.available_stock} {product.unit}</span>
            </div>
          </div>

          <button
            onClick={handleAdd}
            disabled={product.available_stock <= 0}
            className="w-full flex items-center justify-center gap-3 py-4 bg-amber-500 hover:bg-amber-400 disabled:bg-neutral-700 disabled:text-neutral-500 text-black font-semibold rounded-xl text-lg transition-colors"
          >
            {added ? (
              <>
                <CheckCircle size={22} /> {t.product.added}
              </>
            ) : (
              <>
                <ShoppingBag size={22} /> {t.product.addToCart}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
