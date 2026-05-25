const LIVE_SITE_URL = "https://luna.flowergrid.co.uk";

/** All backend routes are under /api (same host as the SPA in production). */
export const API_PREFIX = "/api";

/**
 * - `npm run dev` (import.meta.env.DEV): direct Express URL
 * - Production build (import.meta.env.PROD): relative /api (nginx → Express)
 */
function resolveApiBase() {
  if (import.meta.env.DEV) {
    const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
    return envBase || "http://localhost:4000/api";
  }
  return API_PREFIX;
}

export const API_BASE = resolveApiBase();

export function apiPath(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export const FRONTEND_URL = import.meta.env.DEV
  ? "http://localhost:5173"
  : typeof window !== "undefined"
    ? window.location.origin
    : LIVE_SITE_URL;
