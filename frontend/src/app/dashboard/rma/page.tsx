"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useTranslation } from "@/hooks/useTranslation";
import { useState } from "react";
import { RotateCcw, Plus, Check, X, CheckCircle } from "lucide-react";
import { useAuthStore } from "@/store/auth";

interface RMATicket {
  id: number;
  order_id: number;
  order_number: string;
  defective_item: string;
  sku: string;
  issue_description: string;
  status: "SUBMITTED" | "APPROVED" | "REPAIR_IN_PROGRESS" | "RESOLVED" | "REJECTED";
  created_at: string;
  resolution_production_order_id: number | null;
}

export default function RMAPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [formData, setFormData] = useState({ order_id: "", defective_item_id: "", issue_description: "" });
  const hasRole = useAuthStore((s) => s.hasRole);
  const isAdmin = hasRole(["ADMIN"]);

  const { data: tickets } = useQuery<RMATicket[]>({
    queryKey: ["rma", "tickets"],
    queryFn: async () => (await api.get("/rma")).data,
  });

  const submitRma = useMutation({
    mutationFn: async (data: typeof formData) => {
      await api.post("/rma", {
        order_id: parseInt(data.order_id),
        defective_item_id: parseInt(data.defective_item_id),
        issue_description: data.issue_description,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rma", "tickets"] });
      setIsFormOpen(false);
      setFormData({ order_id: "", defective_item_id: "", issue_description: "" });
    },
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, action }: { id: number; action: "approve" | "reject" | "resolve" }) => {
      await api.patch(`/rma/${id}/${action}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["rma", "tickets"] }),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-3xl font-bold tracking-tight">{t.rma.title}</h1>
          <p className="text-gray-400">{t.rma.subtitle}</p>
        </div>
        <button
          onClick={() => setIsFormOpen(!isFormOpen)}
          className="flex items-center gap-2 bg-cyan-600 hover:bg-cyan-500 text-white px-4 py-2 rounded-lg font-medium transition-colors"
        >
          {isFormOpen ? <X className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
          {t.rma.submit}
        </button>
      </div>

      {isFormOpen && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 shadow-lg shadow-black/20">
          <h3 className="text-lg font-medium text-gray-200 mb-4">{t.rma.submit}</h3>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              submitRma.mutate(formData);
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-400">{t.rma.order} ID</label>
                <input
                  type="number"
                  required
                  value={formData.order_id}
                  onChange={(e) => setFormData({ ...formData, order_id: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. 1"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-400">{t.rma.defectiveItem} ID</label>
                <input
                  type="number"
                  required
                  value={formData.defective_item_id}
                  onChange={(e) => setFormData({ ...formData, defective_item_id: e.target.value })}
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500"
                  placeholder="Item ID"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-gray-400">{t.rma.issue}</label>
              <textarea
                required
                value={formData.issue_description}
                onChange={(e) => setFormData({ ...formData, issue_description: e.target.value })}
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-white focus:outline-none focus:border-cyan-500 h-24 resize-none"
                placeholder="Describe the defect..."
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                disabled={submitRma.isPending}
                className="bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white px-6 py-2 rounded-lg font-medium transition-colors"
              >
                {submitRma.isPending ? "Submitting..." : t.rma.submit}
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-gray-300">
            <thead className="bg-gray-950/50 text-xs uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">{t.rma.id}</th>
                <th className="px-4 py-3">{t.rma.order}</th>
                <th className="px-4 py-3">{t.rma.defectiveItem}</th>
                <th className="px-4 py-3 min-w-[200px]">{t.rma.issue}</th>
                <th className="px-4 py-3">{t.rma.status}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-800">
              {tickets?.map((tkt) => (
                <tr key={tkt.id} className="hover:bg-gray-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium text-gray-400">#{tkt.id}</td>
                  <td className="px-4 py-3 text-gray-300">{tkt.order_number}</td>
                  <td className="px-4 py-3">
                    <div className="flex justify-start items-center gap-2">
                      <RotateCcw className="h-4 w-4 text-cyan-500" />
                      <div className="flex flex-col">
                        <span>{tkt.defective_item}</span>
                        <span className="text-xs text-gray-500">{tkt.sku}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400 text-sm">{tkt.issue_description}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${
                      tkt.status === "SUBMITTED" ? "bg-blue-500/10 text-blue-400" :
                      tkt.status === "APPROVED" ? "bg-amber-500/10 text-amber-400" :
                      tkt.status === "REPAIR_IN_PROGRESS" ? "bg-purple-500/10 text-purple-400" :
                      tkt.status === "RESOLVED" ? "bg-emerald-500/10 text-emerald-400" :
                      "bg-rose-500/10 text-rose-400"
                    }`}>
                      {tkt.status.replace(/_/g, " ")}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {isAdmin && tkt.status === "SUBMITTED" && (
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => updateStatus.mutate({ id: tkt.id, action: "approve" })}
                          className="p-1.5 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 rounded-md transition-colors"
                          title={t.rma.approve}
                        >
                          <Check className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => updateStatus.mutate({ id: tkt.id, action: "reject" })}
                          className="p-1.5 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 rounded-md transition-colors"
                          title={t.rma.reject}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                    {isAdmin && tkt.status === "REPAIR_IN_PROGRESS" && (
                      <button
                        onClick={() => updateStatus.mutate({ id: tkt.id, action: "resolve" })}
                        className="text-xs flex items-center gap-1.5 ml-auto bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-md transition-colors"
                      >
                        <CheckCircle className="h-3.5 w-3.5" />
                        {t.rma.resolve}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {tickets?.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-500">
                    No RMA tickets found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
