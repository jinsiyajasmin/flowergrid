const isLocalhost =
  typeof window !== "undefined" &&
  (window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1");

export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (isLocalhost ? "http://localhost:4000" : "https://flowergrid-7mw2.vercel.app");
