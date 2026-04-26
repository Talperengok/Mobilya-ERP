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

  setAuth: (token: string, user: ERPUser) => void;
  logout: () => void;
  loadProfile: () => Promise<void>;
  hasRole: (allowed: UserRole[]) => boolean;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setAuth: (token, user) => {
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        set({ token, user, isAuthenticated: true });
      },

      logout: () => {
        delete api.defaults.headers.common["Authorization"];
        set({ token: null, user: null, isAuthenticated: false });
      },

      loadProfile: async () => {
        const { token } = get();
        if (!token) return;
        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const { data } = await api.get<ERPUser>("/auth/me");
          set({ user: data, isAuthenticated: true });
        } catch {
          get().logout();
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
