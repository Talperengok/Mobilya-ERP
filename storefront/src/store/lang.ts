import { create } from "zustand";

export type Locale = "en" | "tr";

interface LangStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLangStore = create<LangStore>((set) => ({
  locale: "tr", // Defaulting to Turkish as specified
  setLocale: (locale) => set({ locale }),
}));
