const LIVE_SITE_URL = "https://luna.flowergrid.co.uk";

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const isLunaLive =
  typeof window !== "undefined" &&
  window.location.hostname === "luna.flowergrid.co.uk";

/** All backend routes are under /api in production (same host as the SPA). */
export const API_PREFIX = "/api";

/**
 * API base for fetch()/navigation.
 * - Local dev: http://localhost:4000 (separate Vite + Express)
 * - Production: /api → nginx proxies to Express
 */
function resolveApiBase() {
  if (isLocalhost) {
    const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");
    return envBase || "http://localhost:4000/api";
  }
  return API_PREFIX;
}

export const API_BASE = resolveApiBase();

/** Build an API path (handles empty API_BASE for same-origin deploys). */
export function apiPath(path) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export const FRONTEND_URL =
  typeof window !== "undefined" && isLunaLive
    ? window.location.origin
    : isLocalhost
      ? "http://localhost:5173"
      : LIVE_SITE_URL;
