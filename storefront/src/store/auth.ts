import { create } from "zustand";
import { persist } from "zustand/middleware";
import { api } from "@/lib/api";
import type { UserProfile } from "@/types";

interface AuthStore {
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;

  setToken: (token: string) => void;
  setUser: (user: UserProfile) => void;
  logout: () => void;
  loadProfile: () => Promise<void>;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      isAuthenticated: false,

      setToken: (token) => {
        set({ token, isAuthenticated: !!token });
        // Set default Authorization header globally for axios
        if (token) {
          api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        } else {
          delete api.defaults.headers.common["Authorization"];
        }
      },

      setUser: (user) => set({ user }),

      logout: () => {
        set({ token: null, user: null, isAuthenticated: false });
        delete api.defaults.headers.common["Authorization"];
      },

      loadProfile: async () => {
        const { token } = get();
        if (!token) return;

        api.defaults.headers.common["Authorization"] = `Bearer ${token}`;
        try {
          const { data } = await api.get<UserProfile>("/auth/me");
          set({ user: data, isAuthenticated: true });
        } catch (error) {
          console.error("Failed to load profile:", error);
          get().logout();
        }
      },
    }),
    {
      name: "auth-storage",
      partialize: (state) => ({ token: state.token }), // Only persist token
      onRehydrateStorage: () => (state) => {
        // Run after rehydration to load profile
        if (state?.token) {
          state.loadProfile();
        }
      },
    }
  )
);
