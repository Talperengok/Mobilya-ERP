"use client";
import { useTranslation } from "@/hooks/useTranslation";

export function Footer() {
  const { t } = useTranslation();
  return (
    <footer className="border-t border-neutral-800 py-8 text-center text-sm text-neutral-500">
      © {new Date().getFullYear()} {t.footer.rights}
    </footer>
  );
}
