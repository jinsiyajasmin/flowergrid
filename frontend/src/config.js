const LIVE_FRONTEND_URL = "https://luna.flowergrid.co.uk";
const LIVE_API_URL = "https://api.flowergrid.co.uk";

const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

const isFlowergridLive =
  typeof window !== "undefined" &&
  (window.location.hostname === "luna.flowergrid.co.uk" ||
    window.location.hostname.endsWith(".flowergrid.co.uk"));

function isLocalApiUrl(url) {
  return Boolean(url && /localhost|127\.0\.0\.1/i.test(url));
}

function resolveApiBase() {
  const envBase = import.meta.env.VITE_API_BASE?.replace(/\/$/, "");

  if (isLocalhost) {
    return envBase || "http://localhost:4000";
  }

  // Non-localhost: only trust env when it is not a dev URL (stale Docker builds)
  if (envBase && !isLocalApiUrl(envBase)) {
    return envBase;
  }

  return LIVE_API_URL;
}

export const API_BASE = resolveApiBase();

export const FRONTEND_URL =
  typeof window !== "undefined" && isFlowergridLive
    ? window.location.origin
    : isLocalhost
      ? "http://localhost:5173"
      : LIVE_FRONTEND_URL;
