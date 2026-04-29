import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";

export type UserRole =
  | "ADMIN"
  | "FACTORY_MANAGER"
  | "LOGISTICS_OFFICER"
  | "SALES_REP"
  | "CUSTOMER";

export interface ERPUser {
  id: number;
  email: string;
  full_name: string;
  role: UserRole;
  customer_id: number | null;
}

interface AuthStore {
  token: string | null;
  user: ERPUser | null;
  isAuthenticated: boolean;
  permissions: string[];

  setAuth: (token: string, user: ERPUser) => void;
  logout: () => void;
  loadProfile: () => Promise<void>;
  loadPermissions: () => Promise<void>;
  hasRole: (allowed: UserRole[]) => boolean;
  hasPermission: (module: string) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      permissions: [],

      setAuth: async (token, user) => {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        set({ token, user, isAuthenticated: true });
        await get().loadPermissions();
      },

      logout: () => {
        delete api.defaults.headers.common["Authorization"];
        set({ token: null, user: null, isAuthenticated: false, permissions: [] });
      },

      loadProfile: async () => {
        const { token } = get();
        if (!token) return;
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const { data } = await api.get<ERPUser>("/auth/me");
          set({ user: data, isAuthenticated: true });
          await get().loadPermissions();
        } catch {
          get().logout();
        }
      },

      loadPermissions: async () => {
        const { user } = get();
        if (!user) return;
        try {
          const { data } = await api.get<{ module: string; can_view: boolean }[]>("/permissions");
          const perms = data.filter((p) => p.can_view).map((p) => p.module);
          set({ permissions: perms });
        } catch (error) {
          console.error("Failed to load permissions", error);
        }
      },

      /**
       * Check if the current user has one of the allowed roles.
       * ADMIN always passes.
       */
      hasRole: (allowed) => {
        const { user } = get();
        if (!user) return false;
        if (user.role === "ADMIN") return true;
        return allowed.includes(user.role);
      },

      hasPermission: (module) => {
        const { user, permissions } = get();
        if (!user) return false;
        if (user.role === "ADMIN") return true;
        return permissions.includes(module);
      },
    }),
    {
      name: "erp-auth",
      partialize: (state) => ({ token: state.token }),
      onRehydrateStorage: () => (state) => {
        if (state?.token) {
          state.loadProfile();
        }
      },
    }
  )
);
