"use client";

import { useState, useEffect } from "react";
import { useTranslation } from "@/hooks/useTranslation";
import { api } from "@/lib/api";
import { UserRole } from "@/store/auth";
import { ShieldCheck, Save, Loader2, AlertCircle } from "lucide-react";

interface RolePermission {
  module: string;
  can_view: boolean;
}

const ALL_ROLES: UserRole[] = [
  "ADMIN",
  "FACTORY_MANAGER",
  "LOGISTICS_OFFICER",
  "SALES_REP",
];

const ALL_MODULES = [
  "dashboard",
  "inventory",
  "orders",
  "customers",
  "production",
  "logistics",
  "rma",
  "hrm",
  "finance",
  "roles",
];

export default function RolesPage() {
  const { t } = useTranslation();
  const [selectedRole, setSelectedRole] = useState<UserRole>("FACTORY_MANAGER");
  const [permissions, setPermissions] = useState<RolePermission[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchPermissions = async (role: UserRole) => {
    setIsLoading(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data } = await api.get<RolePermission[]>(`/permissions?role=${role}`);
      
      // Ensure all modules are represented in the state
      const mapped = ALL_MODULES.map((module) => {
        const existing = data.find((p) => p.module === module);
        return {
          module,
          can_view: existing ? existing.can_view : false,
        };
      });
      setPermissions(mapped);
    } catch (err: any) {
      console.error(err);
      setError(t.roles?.fetchError || "Failed to fetch permissions");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPermissions(selectedRole);
  }, [selectedRole]);

  const handleToggle = (module: string) => {
    setPermissions((prev) =>
      prev.map((p) =>
        p.module === module ? { ...p, can_view: !p.can_view } : p
      )
    );
  };

  const handleSave = async () => {
    setIsSaving(true);
    setError(null);
    setSuccessMsg(null);
    try {
      // Only send permissions that are checked
      const payload = {
        role: selectedRole,
        permissions: permissions.filter((p) => p.can_view),
      };
      await api.put("/permissions/bulk", payload);
      setSuccessMsg(t.roles?.saveSuccess || "Permissions saved successfully!");
      // clear success message after 3 seconds
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setError(t.roles?.saveError || "Failed to save permissions");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <ShieldCheck className="text-blue-500" />
            {t.roles?.title || "Role Management"}
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            {t.roles?.description || "Manage module access permissions for each role."}
          </p>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Roles Sidebar */}
        <div className="w-full md:w-64 bg-gray-900 border border-gray-800 rounded-xl p-4 flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2 px-2">
            {t.roles?.selectRole || "Select Role"}
          </h3>
          {ALL_ROLES.map((role) => (
            <button
              key={role}
              onClick={() => setSelectedRole(role)}
              className={`text-left px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                selectedRole === role
                  ? "bg-blue-600/20 text-blue-400 border border-blue-500/30"
                  : "text-gray-400 hover:text-white hover:bg-gray-800/60 border border-transparent"
              }`}
            >
              {t.roles?.[role.toLowerCase() as keyof typeof t.roles] || role}
            </button>
          ))}
        </div>

        {/* Permissions Panel */}
        <div className="flex-1 bg-gray-900 border border-gray-800 rounded-xl p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-medium text-white">
              {t.roles?.permissionsFor || "Permissions for"}{" "}
              <span className="text-blue-400">
                {t.roles?.[selectedRole.toLowerCase() as keyof typeof t.roles] || selectedRole}
              </span>
            </h2>

            <button
              onClick={handleSave}
              disabled={isLoading || isSaving}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
            >
              {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {t.common?.save || "Save Changes"}
            </button>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3">
              <AlertCircle className="text-red-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {successMsg && (
            <div className="mb-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg flex items-start gap-3">
              <ShieldCheck className="text-green-400 shrink-0 mt-0.5" size={18} />
              <p className="text-sm text-green-400">{successMsg}</p>
            </div>
          )}

          {isLoading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-gray-500" size={32} />
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {permissions.map((perm) => (
                <div
                  key={perm.module}
                  onClick={() => handleToggle(perm.module)}
                  className={`flex items-center justify-between p-4 rounded-xl border cursor-pointer transition-all ${
                    perm.can_view
                      ? "bg-blue-900/10 border-blue-500/30"
                      : "bg-gray-800/30 border-gray-800 hover:border-gray-700"
                  }`}
                >
                  <div>
                    <p className={`font-medium ${perm.can_view ? "text-white" : "text-gray-400"}`}>
                      {t.sidebar?.[perm.module as keyof typeof t.sidebar] || perm.module}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {perm.can_view ? (t.roles?.canView || "Can view page") : (t.roles?.cannotView || "No access")}
                    </p>
                  </div>
                  
                  {/* Custom Toggle Switch */}
                  <div
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      perm.can_view ? "bg-blue-600" : "bg-gray-700"
                    }`}
                  >
                    <span
                      className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                        perm.can_view ? "translate-x-6" : "translate-x-1"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
