"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { ShoppingBag, Search, Filter, ArrowRight, Star, Heart, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { formatCurrency, getProductImage } from "@/lib/utils";
import type { Product } from "@/types";

export default function CatalogPage() {
  const { t, locale } = useTranslation();
  const [activeCategory, setActiveCategory] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["catalog"],
    queryFn: async () => (await api.get("/storefront/catalog")).data,
  });

  const categories = ["all", "tables", "chairs", "storage"];

  const filteredProducts = products?.filter(p => {
    let matchesCategory = activeCategory === "all";
    if (activeCategory === "tables") matchesCategory = p.sku.toLowerCase().includes("table") || p.sku.toLowerCase().includes("nightstand");
    if (activeCategory === "chairs") matchesCategory = p.sku.toLowerCase().includes("chair");
    if (activeCategory === "storage") matchesCategory = p.sku.toLowerCase().includes("shelf") || p.sku.toLowerCase().includes("stand") || p.sku.toLowerCase().includes("nightstand");
    
    const matchesSearch = p.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         p.sku.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4">
        <Loader2 className="animate-spin text-amber-500" size={48} />
        <p className="text-neutral-500 font-medium animate-pulse">Curating your collection...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-950">
      {/* Hero Section */}
      <section className="relative h-[80vh] flex items-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-950 via-neutral-950/80 to-transparent z-10" />
          <img 
            src="/images/products/dining_table.png" 
            alt="Hero" 
            className="w-full h-full object-cover scale-110 blur-[2px] opacity-40"
          />
        </div>
        
        <div className="container mx-auto px-6 relative z-20 max-w-7xl">
          <div className="max-w-2xl">
            <span className="inline-block px-3 py-1 bg-amber-500/10 text-amber-500 text-xs font-bold tracking-widest uppercase rounded-full mb-6">
              New Collection 2026
            </span>
            <h1 className="text-6xl md:text-7xl font-bold text-white mb-6 leading-tight">
              {t.home.hero.title}
            </h1>
            <p className="text-xl text-neutral-400 mb-10 leading-relaxed max-w-lg">
              {t.home.hero.subtitle}
            </p>
            <div className="flex items-center gap-4">
              <button 
                onClick={() => document.getElementById("collection")?.scrollIntoView({ behavior: "smooth" })}
                className="bg-amber-500 hover:bg-amber-400 text-black font-bold px-8 py-4 rounded-2xl transition-all flex items-center gap-2 group"
              >
                {t.home.hero.cta} <ArrowRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Collection Section */}
      <section id="collection" className="py-24 max-w-7xl mx-auto px-6">
        <div className="flex flex-col md:flex-row justify-between items-end gap-8 mb-16">
          <div className="space-y-4">
            <h2 className="text-4xl font-bold text-white">Our Collection</h2>
            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={`px-5 py-2 rounded-xl text-sm font-semibold transition-all ${
                    activeCategory === cat 
                      ? "bg-white text-black" 
                      : "bg-neutral-900 text-neutral-400 hover:bg-neutral-800"
                  }`}
                >
                  {t.home.filters[cat as keyof typeof t.home.filters]}
                </button>
              ))}
            </div>
          </div>

          <div className="relative w-full md:w-80">
            <input 
              type="text"
              placeholder="Search products..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-2xl py-3 pl-12 pr-4 focus:border-amber-500/50 outline-none transition-all"
            />
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={18} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          {filteredProducts?.map((product) => (
            <Link 
              key={product.id} 
              href={`/products/${product.id}`}
              className="group bg-neutral-900/40 border border-neutral-800/50 rounded-3xl overflow-hidden hover:border-amber-500/30 transition-all duration-500 flex flex-col"
            >
              <div className="aspect-[4/5] relative overflow-hidden bg-neutral-900">
                <img 
                  src={getProductImage(product)} 
                  alt={product.name}
                  className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                />
                <button className="absolute top-4 right-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white/50 hover:text-red-500 transition-colors">
                  <Heart size={20} />
                </button>
                {product.available_stock <= 0 && (
                  <div className="absolute inset-0 bg-black/60 flex items-center justify-center backdrop-blur-sm">
                    <span className="px-4 py-2 bg-neutral-800 text-white text-xs font-bold rounded-full uppercase tracking-widest">
                      Out of Stock
                    </span>
                  </div>
                )}
              </div>

              <div className="p-6 space-y-4">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="text-[10px] font-bold text-amber-500 uppercase tracking-widest mb-1">
                      {product.category}
                    </p>
                    <h3 className="text-lg font-bold text-white group-hover:text-amber-500 transition-colors">
                      {product.name}
                    </h3>
                  </div>
                  <div className="flex items-center gap-1 text-amber-500">
                    <Star size={14} fill="currentColor" />
                    <span className="text-xs font-bold text-white">4.8</span>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-neutral-800/50">
                  <p className="text-xl font-bold text-white">
                    {formatCurrency(product.selling_price)}
                  </p>
                  <div className="p-2 bg-amber-500 rounded-xl text-black group-hover:scale-110 transition-transform">
                    <ShoppingBag size={18} />
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>

        {filteredProducts?.length === 0 && (
          <div className="py-20 text-center space-y-4">
            <div className="w-16 h-16 bg-neutral-900 rounded-full flex items-center justify-center mx-auto text-neutral-600">
              <Search size={32} />
            </div>
            <p className="text-neutral-500">No products found matching your criteria.</p>
          </div>
        )}
      </section>
    </div>
  );
}
