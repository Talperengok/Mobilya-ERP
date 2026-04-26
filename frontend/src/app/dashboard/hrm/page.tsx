"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { User, Monitor, CheckCircle, AlertCircle } from "lucide-react";

import { Employee } from "@/types";

interface Workstation {
  id: number;
  name: string;
  station_type: string;
  is_available: boolean;
}

export default function HRMPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: employees } = useQuery<Employee[]>({
    queryKey: ["hrm", "employees"],
    queryFn: async () => (await api.get("/hrm/employees")).data,
  });

  const { data: workstations } = useQuery<Workstation[]>({
    queryKey: ["hrm", "workstations"],
    queryFn: async () => (await api.get("/hrm/workstations")).data,
  });



  const toggleWs = useMutation({
    mutationFn: async ({ id, is_available }: { id: number; is_available: boolean }) => {
      await api.patch(`/hrm/workstations/${id}/availability?is_available=${is_available}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hrm", "workstations"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight">{t.hrm.title}</h1>
        <p className="text-gray-400">{t.hrm.subtitle}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* Employees Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-medium flex items-center gap-2 border-b border-gray-800 pb-2">
            <User className="h-5 w-5 text-cyan-400" />
            {t.hrm.employees}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {employees?.map((emp) => (
              <div key={emp.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-200">{emp.name}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">{emp.role.replace("_", " ")}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${
                    emp.status === 'AVAILABLE' ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                  }`}>
                    {emp.status === 'AVAILABLE' ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {emp.status === 'AVAILABLE' ? t.hrm.available : emp.status}
                  </div>
                  {emp.status === 'BUSY' && emp.current_production_id && (
                     <div className="text-xs px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded font-semibold flex items-center">
                       Working on Order #{emp.current_production_id}
                     </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Workstations Section */}
        <div className="space-y-4">
          <h3 className="text-xl font-medium flex items-center gap-2 border-b border-gray-800 pb-2">
            <Monitor className="h-5 w-5 text-fuchsia-400" />
            {t.hrm.workstations}
          </h3>
          <div className="grid grid-cols-1 gap-3">
            {workstations?.map((ws) => (
              <div key={ws.id} className="bg-gray-900 border border-gray-800 rounded-lg p-4 flex items-center justify-between shadow-sm">
                <div className="flex flex-col">
                  <span className="font-medium text-gray-200">{ws.name}</span>
                  <span className="text-xs text-gray-500 uppercase tracking-widest mt-1">{ws.station_type}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded ${
                    ws.is_available ? "text-emerald-400 bg-emerald-500/10" : "text-amber-400 bg-amber-500/10"
                  }`}>
                    {ws.is_available ? <CheckCircle className="h-3.5 w-3.5" /> : <AlertCircle className="h-3.5 w-3.5" />}
                    {ws.is_available ? t.hrm.available : t.hrm.busy}
                  </div>
                  <button
                    onClick={() => toggleWs.mutate({ id: ws.id, is_available: !ws.is_available })}
                    className="text-xs px-3 py-1.5 bg-gray-800 hover:bg-gray-700 rounded text-gray-300 transition-colors"
                  >
                    {ws.is_available ? t.hrm.makeBusy : t.hrm.makeAvailable}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}
