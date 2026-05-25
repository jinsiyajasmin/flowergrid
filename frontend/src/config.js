const LIVE_SITE_URL = "https://luna.flowergrid.co.uk";

export const API_PREFIX = "/api";

function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/**
 * Live: https://luna.flowergrid.co.uk/api
 * Local: http://localhost:4000/api
 * Never uses VITE_API_BASE on the live site (avoids baked-in localhost from Coolify).
 */
export function getApiBase() {
  if (typeof window !== "undefined") {
    if (isBrowserLocalhost()) {
      return "http://localhost:4000/api";
    }
    return `${window.location.origin}${API_PREFIX}`;
  }
  return API_PREFIX;
}

/** Full URL for an API route, e.g. apiPath('/chat') → https://luna.flowergrid.co.uk/api/chat */
export function apiPath(path) {
  const base = getApiBase().replace(/\/$/, "");
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

/** @deprecated Use getApiBase() or apiPath() — evaluated per call */
export function getFrontendUrl() {
  if (typeof window !== "undefined" && !isBrowserLocalhost()) {
    return window.location.origin;
  }
  if (isBrowserLocalhost()) {
    return "http://localhost:5173";
  }
  return LIVE_SITE_URL;
}

export const FRONTEND_URL = LIVE_SITE_URL;
