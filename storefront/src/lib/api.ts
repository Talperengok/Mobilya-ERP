import axios from "axios";
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api/v1";
export const api = axios.create({ baseURL: API_BASE_URL, headers: { "Content-Type": "application/json" }, timeout: 15000 });

// Ensure every request carries the JWT if available (fixes race condition with zustand rehydration)
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined" && !config.headers["Authorization"]) {
    try {
      const raw = localStorage.getItem("auth-storage");
      if (raw) {
        const parsed = JSON.parse(raw);
        const token = parsed?.state?.token;
        if (token) {
          config.headers["Authorization"] = `Bearer ${token}`;
        }
      }
    } catch { /* ignore parse errors */ }
  }
  return config;
});

export const fetchTracking = async (trackingNumber: string) => {
  if (!trackingNumber) return null;
  const uppercaseTracking = trackingNumber.trim().toUpperCase();
  try {
    const response = await api.get(`/shipments/${uppercaseTracking}`);
    return response.data;
  } catch (error: any) {
    if (error.response?.status === 404) {
      throw new Error("NOT_FOUND");
    }
    throw error;
  }
};
