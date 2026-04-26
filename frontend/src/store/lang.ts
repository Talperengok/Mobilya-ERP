import { create } from "zustand";

export type Locale = "en" | "tr";

interface LangStore {
  locale: Locale;
  setLocale: (l: Locale) => void;
}

export const useLangStore = create<LangStore>((set) => ({
  locale: "tr",
  setLocale: (locale) => set({ locale }),
}));
