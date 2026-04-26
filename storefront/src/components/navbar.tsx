"use client";

import Link from "next/link";
import { ShoppingBag, Armchair, Globe, User } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { useAuthStore } from "@/store/auth";
import { useTranslation } from "@/hooks/useTranslation";

export function Navbar() {
  const totalItems = useCartStore((s) => s.totalItems());
  const toggleCart = useCartStore((s) => s.toggleCart);
  const { isAuthenticated } = useAuthStore();
  const { t, locale, setLocale } = useTranslation();

  return (
    <header className="sticky top-0 z-50 bg-neutral-950/80 backdrop-blur-md border-b border-neutral-800/50">
      <div className="max-w-7xl mx-auto flex items-center justify-between h-16 px-6">
        <Link href="/" className="flex items-center gap-2.5">
          <Armchair className="h-7 w-7 text-amber-500" />
          <span className="text-xl font-bold tracking-tight">
            <span className="text-amber-500">Mobilya</span>
            <span className="text-neutral-400 font-light ml-1">Furniture</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm text-neutral-400">
          <Link href="/" className="hover:text-white transition-colors">{t.nav.collection}</Link>
          <Link href="/tracking" className="hover:text-white transition-colors">{t.nav.trackOrder}</Link>
          <Link href="/checkout" className="hover:text-white transition-colors">{t.nav.checkout}</Link>
        </nav>

        <div className="flex items-center gap-4">
          <button
            onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
            className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 border border-neutral-800 px-2.5 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors"
          >
            <Globe size={14} className="text-amber-500" />
            {locale === "tr" ? "EN" : "TR"}
          </button>

          {isAuthenticated ? (
            <Link href="/account" className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors">
              <User size={14} className="text-amber-500" />
              {t.nav.account}
            </Link>
          ) : (
            <Link href="/login" className="flex items-center gap-1.5 text-xs font-semibold bg-neutral-900 border border-neutral-800 px-3 py-1.5 rounded-lg hover:bg-neutral-800 transition-colors">
              <User size={14} className="text-neutral-400" />
              {t.nav.login}
            </Link>
          )}

          <button
          onClick={toggleCart}
          className="relative p-2 rounded-lg hover:bg-neutral-800 transition-colors"
        >
          <ShoppingBag size={22} className="text-neutral-300" />
          {totalItems > 0 && (
            <span className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center">
              {totalItems}
            </span>
          )}
        </button>
        </div>
      </div>
    </header>
  );
}
