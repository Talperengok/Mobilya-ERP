import { useLangStore } from "@/store/lang";
import { en } from "@/locales/en";
import { tr } from "@/locales/tr";

export function useTranslation() {
  const { locale, setLocale } = useLangStore();
  const t = locale === "tr" ? tr : en;
  return { t, locale, setLocale };
}
