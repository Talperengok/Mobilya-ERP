"use client";

import { useEffect } from "react";
import { AlertTriangle, ChevronLeft, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/useTranslation";

export default function ErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string; response?: { status?: number } };
  reset: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();

  useEffect(() => {
    console.error("Dashboard caught error:", error);
  }, [error]);

  const isForbidden = error.message.includes("403") || error.response?.status === 403;
  const isUnauthorized = error.message.includes("401") || error.response?.status === 401;

  if (isForbidden || isUnauthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
        <div className="bg-red-500/10 p-4 rounded-full mb-6">
          <AlertTriangle className="h-10 w-10 text-red-400" />
        </div>
        <h2 className="text-2xl font-bold text-gray-200 mb-2">
          {t.forbidden?.title || "Access Denied"}
        </h2>
        <p className="text-gray-400 max-w-md mx-auto mb-8">
          {t.forbidden?.message || "You do not have permission to access this module or your token has expired. Contact your administrator if you believe this is an error."}
        </p>
        <button
          onClick={() => {
            if (typeof window !== "undefined") {
              window.history.length > 2 ? router.back() : router.replace("/dashboard");
            }
          }}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 text-white px-5 py-2.5 rounded-lg font-medium transition-colors border border-gray-700 mx-auto"
        >
          <ChevronLeft size={18} />
          <span>{t.logistics?.goBack || "Geri Dön"}</span>
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] px-4 text-center">
      <h2 className="text-xl font-bold text-red-400 mb-2">Something went wrong!</h2>
      <p className="text-sm text-gray-500 max-w-md mx-auto mb-6 break-all">
        {error.message || "An unexpected application error occurred."}
      </p>
      <div className="flex items-center gap-4">
        <button
          onClick={() => reset()}
          className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white px-5 py-2 rounded-lg text-sm font-medium transition-colors"
        >
          <RefreshCw size={16} /> Try again
        </button>
      </div>
    </div>
  );
}
