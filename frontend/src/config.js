const LIVE_SITE_URL = "https://luna.flowergrid.co.uk";

export const API_PREFIX = "/api";

function isBrowserLocalhost() {
  if (typeof window === "undefined") return false;
  const host = window.location.hostname.toLowerCase();
  return (
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "[::1]"
  );
}

/** True when the app is served on flowergrid production (luna, etc.). */
function isLiveFlowergrid() {
  if (typeof window === "undefined") return false;
  return window.location.hostname.toLowerCase().endsWith("flowergrid.co.uk");
}

/**
 * API base URL for fetch() calls.
 * Live flowergrid: always https://luna.flowergrid.co.uk/api (never localhost, never VITE_*).
 * Local: http://localhost:4000/api
 * Other hosts: same-origin /api
 */
export function getApiBase() {
  if (typeof window !== "undefined") {
    if (isBrowserLocalhost()) {
      return "http://localhost:4000/api";
    }
    if (isLiveFlowergrid()) {
      return `${LIVE_SITE_URL}/api`;
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

/**
 * Google OAuth entry URL — use this for Sign up (not the callback URL).
 * Production is fixed so signup never points at localhost or /auth/ without /api.
 */
export function getGoogleSignInUrl() {
  if (typeof window !== "undefined" && isBrowserLocalhost()) {
    return "http://localhost:4000/api/auth/google";
  }
  return `${LIVE_SITE_URL}/api/auth/google`;
}

/** @deprecated Use getApiBase() or apiPath() */
export function getFrontendUrl() {
  if (typeof window !== "undefined" && !isBrowserLocalhost()) {
    if (isLiveFlowergrid()) return LIVE_SITE_URL;
    return window.location.origin;
  }
  if (isBrowserLocalhost()) {
    return "http://localhost:5173";
  }
  return LIVE_SITE_URL;
}

export const FRONTEND_URL = LIVE_SITE_URL;

const DEPLOY_HINT =
  "The API is not running. In Coolify use Base Directory = / and docker-compose.yaml (or Dockerfile), then rebuild.";

export function isWrongProductionDeploy(response) {
  if (!response) return false;
  const ct = (response.headers.get("content-type") || "").toLowerCase();
  if (response.status === 500 && !ct.includes("application/json")) return true;
  if (response.status === 404 && ct.includes("text/html")) return true;
  return false;
}

export function deployMisconfigurationMessage(response) {
  if (isWrongProductionDeploy(response)) return DEPLOY_HINT;
  return null;
}

/** Redirect to Google sign-in (production URL is hardcoded for flowergrid.co.uk). */
export async function startGoogleSignIn() {
  const fallbackUrl = getGoogleSignInUrl();

  try {
    const statusRes = await fetch(apiPath("/auth/google/status"), {
      credentials: "include",
    });
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (!status.enabled) {
        throw new Error(
          "Google sign-in is not configured. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Coolify."
        );
      }
      if (status.callbackUrl && !status.callbackUrl.includes("/api/auth/google/callback")) {
        throw new Error(
          `Wrong callback URL on server: ${status.callbackUrl}. Set GOOGLE_CALLBACK_URL=https://luna.flowergrid.co.uk/api/auth/google/callback in Coolify and redeploy.`
        );
      }
      if (status.database !== "connected") {
        const hint =
          status.databaseHint ||
          (status.databaseConfigured
            ? "Database URL is set but the server cannot connect. For Neon use: ?sslmode=require on DATABASE_URL, then redeploy."
            : "Set DATABASE_URL in Coolify (Neon connection string), then redeploy.");
        throw new Error(hint);
      }
      if (status.clientId && status.callbackUrl) {
        console.info("Google OAuth clientId:", status.clientId);
        console.info("Add redirect URI in Google Console:", status.callbackUrl);
      }
      const url =
        typeof status.startUrl === "string" && status.startUrl.includes("/api/auth/google")
          ? status.startUrl
          : fallbackUrl;
      window.location.assign(url);
      return;
    }
    const deployMsg = deployMisconfigurationMessage(statusRes);
    if (deployMsg) throw new Error(deployMsg);
  } catch (e) {
    if (e instanceof Error && !e.message.includes("fetch")) throw e;
  }

  window.location.assign(fallbackUrl);
}
