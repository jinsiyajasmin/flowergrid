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

const DEPLOY_HINT =
  "The API is not running. In Coolify use Base Directory = / and docker-compose.yaml (or Dockerfile), then rebuild.";

/** True when the live site is serving Vite dev or frontend-only (no Express API). */
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

/** Verify API is reachable, then start Google OAuth (avoids silent 500 on wrong deploy). */
export async function startGoogleSignIn() {
  let res;
  try {
    res = await fetch(apiPath("/health"), { credentials: "include" });
  } catch {
    throw new Error(
      "Cannot reach the API. In Coolify use Base Directory = repo root and docker-compose.yaml or Dockerfile, then rebuild."
    );
  }

  const deployMsg = deployMisconfigurationMessage(res);
  if (deployMsg) throw new Error(deployMsg);

  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (!res.ok || !ct.includes("application/json")) {
    throw new Error(DEPLOY_HINT);
  }

  try {
    const statusRes = await fetch(apiPath("/auth/google/status"), {
      credentials: "include",
    });
    if (statusRes.ok) {
      const status = await statusRes.json();
      if (!status.enabled) {
        throw new Error(
          "Google sign-in is not configured on the server. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Coolify."
        );
      }
      if (status.database !== "connected") {
        throw new Error(
          "Sign-in requires the database. Set DATABASE_URL in Coolify and redeploy."
        );
      }
    }
  } catch (e) {
    if (e instanceof Error && e.message.includes("Google")) throw e;
    if (e instanceof Error && e.message.includes("database")) throw e;
    // status endpoint missing on old deploy — still try redirect
  }

  window.location.href = apiPath("/auth/google");
}
