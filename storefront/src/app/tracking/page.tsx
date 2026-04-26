"use client";

import { useState, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Search, Package, Box, Truck, MapPin, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { api, fetchTracking } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import type { ShipmentTracking } from "@/types";

const STAGES = ["PREPARING", "SHIPPED", "IN_TRANSIT", "DELIVERED"];

function useTracking(trackingNumber: string) {
  return useQuery<ShipmentTracking>({
    queryKey: ["tracking", trackingNumber],
    queryFn: () => fetchTracking(trackingNumber),
    enabled: !!trackingNumber,
    retry: false,
    refetchInterval: 10000, // auto-refresh tracking every 10s
  });
}

export default function TrackingPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const initialQuery = searchParams.get("query") || "";
  
  const [searchTerm, setSearchTerm] = useState(initialQuery);
  const [activeQuery, setActiveQuery] = useState(initialQuery);
  
  const { t, locale } = useTranslation();
  const { data: shipment, isLoading, isError } = useTracking(activeQuery);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchTerm.trim()) {
      setActiveQuery(searchTerm.trim());
      router.replace(`/tracking?query=${searchTerm.trim()}`);
    }
  };

  const currentStageIndex = shipment 
    ? (shipment.status === "READY_FOR_PICKUP" ? 0 : STAGES.indexOf(shipment.status)) 
    : -1;

  const getStepConfig = (stage: string, index: number) => {
    const isCompleted = index <= currentStageIndex;
    const isCurrent = index === currentStageIndex;
    
    let Icon = Package;
    if (stage === "READY_FOR_PICKUP") Icon = Box;
    if (stage === "SHIPPED") Icon = Truck;
    if (stage === "IN_TRANSIT") Icon = MapPin;
    if (stage === "DELIVERED") Icon = CheckCircle2;

    return {
      Icon,
      isCompleted,
      isCurrent,
      label: t.tracking[stage as keyof typeof t.tracking] || stage.replace(/_/g, " "),
    };
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 min-h-[80vh]">
      <div className="text-center mb-10">
        <div className="mx-auto w-16 h-16 bg-amber-500/10 text-amber-500 rounded-full flex items-center justify-center mb-6">
          <MapPin size={32} />
        </div>
        <h1 className="text-3xl font-bold mb-3">{t.tracking.title}</h1>
        <p className="text-neutral-400">
          {t.tracking.subtitle}
        </p>
      </div>

      <form onSubmit={handleSearch} className="relative mb-12">
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={t.tracking.placeholder}
          className="w-full pl-12 pr-32 py-4 bg-neutral-900 border border-neutral-800 focus:border-amber-500/50 rounded-2xl focus:outline-none focus:ring-2 focus:ring-amber-500/20 text-lg font-mono placeholder:font-sans transition-all"
        />
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={24} />
        <button
          type="submit"
          disabled={isLoading}
          className="absolute right-2 top-2 bottom-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-semibold px-6 rounded-xl transition-colors"
        >
          {isLoading ? <Loader2 className="animate-spin" size={20} /> : t.tracking.trackBtn}
        </button>
      </form>

      {isLoading && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden animate-pulse">
          <div className="relative mb-12 mt-4 flex justify-between">
            <div className="absolute top-6 left-10 right-10 h-1 bg-neutral-800 rounded-full" />
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="flex flex-col items-center z-10 gap-4">
                <div className="w-12 h-12 rounded-full border-4 border-neutral-900 bg-neutral-800" />
                <div className="w-16 h-3 bg-neutral-800 rounded-full" />
              </div>
            ))}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-950/50 rounded-2xl p-6 border border-neutral-800/50">
            <div className="w-24 h-10 bg-neutral-800 rounded-lg" />
            <div className="w-32 h-10 bg-neutral-800 rounded-lg" />
          </div>
        </div>
      )}

      {isError && (
        <div className="p-6 bg-red-950/20 border border-red-900/50 rounded-2xl text-center">
          <AlertCircle className="mx-auto text-red-500 mb-2" size={32} />
          <p className="text-red-400">{t.tracking.notFound}</p>
        </div>
      )}

      {shipment && !isError && (
        <div className="bg-neutral-900 border border-neutral-800 rounded-3xl p-8 shadow-2xl relative overflow-hidden">
          {/* Timeline */}
          <div className="relative mb-12 mt-4">
            <div className="absolute top-6 left-10 right-10 h-1 bg-neutral-800 rounded-full" />
            <div 
              className="absolute top-6 left-10 h-1 bg-amber-500 rounded-full transition-all duration-1000 ease-out" 
              style={{ width: `${Math.max(0, (currentStageIndex / (STAGES.length - 1)) * 100 - 10)}%` }} 
            />

            <div className="relative flex justify-between">
              {STAGES.map((stage, i) => {
                const { Icon, isCompleted, isCurrent, label } = getStepConfig(stage, i);
                return (
                  <div key={stage} className="flex flex-col items-center">
                    <div 
                      className={`w-12 h-12 rounded-full flex items-center justify-center border-4 border-neutral-900 transition-all duration-500 z-10 ${
                        isCompleted 
                          ? "bg-amber-500 text-black" 
                          : "bg-neutral-800 text-neutral-500"
                      } ${isCurrent ? "scale-110 shadow-[0_0_20px_rgba(245,158,11,0.3)] ring-2 ring-amber-500/50 ring-offset-4 ring-offset-neutral-900" : ""}`}
                    >
                      <Icon size={20} />
                    </div>
                    <div className="mt-4 text-center">
                      <p className={`text-sm font-semibold ${isCompleted ? "text-white" : "text-neutral-500"}`}>
                        {label}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-neutral-950/50 rounded-2xl p-6 border border-neutral-800/50">
            <div>
              <p className="text-sm text-neutral-500 mb-1">{t.tracking.status}</p>
              <p className="text-lg font-medium text-amber-500">
                {t.tracking[shipment.status as keyof typeof t.tracking] || shipment.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-neutral-500 mb-1">{t.tracking.courier}</p>
              <p className="text-lg font-medium">{shipment.courier_name || "Standard Courier"}</p>
            </div>
            {shipment.shipped_at && (
              <div>
                <p className="text-sm text-neutral-500 mb-1">Shipped Date</p>
                <p className="font-medium text-neutral-300">
                  {new Date(shipment.shipped_at).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}
                </p>
              </div>
            )}
            {shipment.estimated_delivery_date && (
              <div>
                <p className="text-sm text-neutral-500 mb-1">{t.tracking.deliveryDate}</p>
                <p className="font-medium text-neutral-300">
                  {new Date(shipment.estimated_delivery_date).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}
                </p>
              </div>
            )}
             {shipment.delivered_at && (
              <div>
                <p className="text-sm text-neutral-500 mb-1">Delivered Date</p>
                <p className="font-medium text-emerald-400">
                  {new Date(shipment.delivered_at).toLocaleString(locale === "tr" ? "tr-TR" : "en-US")}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
