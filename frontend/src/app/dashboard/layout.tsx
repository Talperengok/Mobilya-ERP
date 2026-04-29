"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Factory,
  ChevronLeft,
  Menu,
  Boxes,
  Globe,
  Truck,
  FileText,
  LogOut,
  ShieldAlert,
  User,
  DollarSign,
  Users,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import { useAuthStore, UserRole } from "@/store/auth";

// ── Navigation with RBAC ──
interface NavItem {
  href: string;
  key: string;
  icon: typeof LayoutDashboard;
}

const navItems: NavItem[] = [
  {
    href: "/dashboard",
    key: "dashboard",
    icon: LayoutDashboard,
  },
  {
    href: "/dashboard/inventory",
    key: "inventory",
    icon: Package,
  },
  {
    href: "/dashboard/orders",
    key: "orders",
    icon: ShoppingCart,
  },
  {
    href: "/dashboard/customers",
    key: "customers",
    icon: Users,
  },
  {
    href: "/dashboard/production",
    key: "production",
    icon: Factory,
  },
  {
    href: "/dashboard/logistics",
    key: "logistics",
    icon: Truck,
  },
  {
    href: "/dashboard/rma",
    key: "rma",
    icon: RotateCcw,
  },
  {
    href: "/dashboard/hrm",
    key: "hrm",
    icon: Users,
  },
  {
    href: "/dashboard/finance",
    key: "finance",
    icon: DollarSign,
  },
  {
    href: "/dashboard/roles",
    key: "roles",
    icon: ShieldCheck,
  },
];

// ── Role badge labels (localized via t.roles) ──
const roleBadgeColors: Record<UserRole, { bg: string; key: "admin" | "manager" | "logistics" | "sales" }> = {
  ADMIN: { bg: "bg-blue-600/20 text-blue-400 border-blue-500/30", key: "admin" },
  FACTORY_MANAGER: { bg: "bg-emerald-600/20 text-emerald-400 border-emerald-500/30", key: "manager" },
  LOGISTICS_OFFICER: { bg: "bg-amber-600/20 text-amber-400 border-amber-500/30", key: "logistics" },
  SALES_REP: { bg: "bg-purple-600/20 text-purple-400 border-purple-500/30", key: "sales" },
  CUSTOMER: { bg: "bg-gray-600/20 text-gray-400 border-gray-500/30", key: "sales" }, // fallback to sales label or customer
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const { t, locale, setLocale } = useTranslation();
  const { user, isAuthenticated, hasPermission, logout } = useAuthStore();

  // ── Auth gate: redirect to /login if not authenticated ──
  useEffect(() => {
    if (!isAuthenticated && typeof window !== "undefined") {
      // Allow a tick for rehydration
      const timeout = setTimeout(() => {
        const { isAuthenticated: recheck } = useAuthStore.getState();
        if (!recheck) router.replace("/login?callbackUrl=" + encodeURIComponent(pathname));
      }, 300);
      return () => clearTimeout(timeout);
    }
  }, [isAuthenticated, router]);

  if (!isAuthenticated || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-950">
        <div className="animate-pulse text-gray-600 text-sm">{t.common.loading}</div>
      </div>
    );
  }

  // ── Filter nav items by permissions ──
  const visibleNav = navItems.filter((item) =>
    hasPermission(item.key)
  );

  // ── Route guard: check if current path is allowed ──
  const isRouteAllowed = visibleNav.some((item) =>
    item.href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(item.href)
  );

  const badge = roleBadgeColors[user.role] || roleBadgeColors.CUSTOMER;
  const roleLabel = t.roles[badge.key as keyof typeof t.roles];

  const handleLogout = () => {
    logout();
    router.replace("/login");
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* ── Sidebar ── */}
      <aside
        className={cn(
          "flex flex-col bg-gray-900 border-r border-gray-800 transition-all duration-300",
          collapsed ? "w-16" : "w-64"
        )}
      >
        {/* Logo */}
        <div className="flex items-center justify-between h-16 px-4 border-b border-gray-800">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <Boxes className="h-7 w-7 text-blue-500" />
              <span className="text-lg font-bold bg-gradient-to-r from-blue-400 to-cyan-400 bg-clip-text text-transparent">
                {t.sidebar.title}
              </span>
            </div>
          )}
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-800 text-gray-400 hover:text-white transition-colors"
          >
            {collapsed ? <Menu size={18} /> : <ChevronLeft size={18} />}
          </button>
        </div>

        {/* Navigation — filtered by role */}
        <nav className="flex-1 py-4 px-2 space-y-1">
          {visibleNav.map((item) => {
            const isActive =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href);

            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                    : "text-gray-400 hover:text-white hover:bg-gray-800/60"
                )}
              >
                <item.icon size={20} />
                {!collapsed && <span>{t.sidebar[item.key as keyof typeof t.sidebar]}</span>}
              </Link>
            );
          })}
        </nav>

        {/* User / Logout */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-800 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-gray-800 flex items-center justify-center">
                <User size={14} className="text-gray-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">{user.full_name}</p>
                <span className={`inline-block text-[10px] px-1.5 py-0.5 rounded border ${badge.bg}`}>
                  {roleLabel}
                </span>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-red-400 hover:bg-red-950/30 border border-transparent hover:border-red-900/50 transition-colors"
            >
              <LogOut size={14} />
              {t.topbar.logout || "Logout"}
            </button>
          </div>
        )}
      </aside>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-auto bg-gray-950">
        {/* Top bar */}
        <header className="sticky top-0 z-10 flex items-center justify-between h-16 px-6 bg-gray-950/80 backdrop-blur-md border-b border-gray-800/50">
          <div>
            <h2 className="text-sm font-medium text-gray-400">
              {visibleNav.find((n) =>
                n.href === "/dashboard"
                  ? pathname === "/dashboard"
                  : pathname.startsWith(n.href)
              )
                ? t.sidebar[
                    visibleNav.find((n) =>
                      n.href === "/dashboard"
                        ? pathname === "/dashboard"
                        : pathname.startsWith(n.href)
                    )!.key as keyof typeof t.sidebar
                  ]
                : t.sidebar.dashboard}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setLocale(locale === "tr" ? "en" : "tr")}
              className="flex items-center gap-1.5 text-xs font-semibold bg-gray-900 border border-gray-800 px-2.5 py-1.5 rounded-lg hover:bg-gray-800 transition-colors mr-2"
            >
              <Globe size={14} className="text-blue-500" />
              {locale === "tr" ? "EN" : "TR"}
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
              </span>
              {t.topbar.online}
            </div>
          </div>
        </header>

        {/* Page content — or 403 if route not allowed */}
        <div className="p-6">
          {isRouteAllowed ? (
            children
          ) : (
            <div className="flex flex-col items-center justify-center py-32 text-center">
              <div className="w-20 h-20 bg-red-950/30 border border-red-900/40 rounded-2xl flex items-center justify-center mb-6">
                <ShieldAlert className="text-red-500" size={40} />
              </div>
              <h2 className="text-2xl font-bold text-red-500 mb-2">
                {t.forbidden?.title || "403 — Forbidden"}
              </h2>
              <p className="text-gray-400 max-w-md">
                {t.forbidden?.message || "You do not have permission to access this module. Contact your administrator if you believe this is an error."}
              </p>
              <button
                onClick={() => {
                  if (typeof window !== "undefined") {
                    window.history.length > 2 ? router.back() : router.replace("/dashboard");
                  }
                }}
                className="mt-6 px-6 py-2.5 bg-gray-800 hover:bg-gray-700 rounded-lg text-sm text-gray-300 transition-colors flex items-center gap-2"
              >
                <ChevronLeft size={16} />
                {t.logistics?.goBack}
              </button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
