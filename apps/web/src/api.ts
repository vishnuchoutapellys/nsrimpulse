const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

export const apiBase = (
  configuredApiUrl ||
  (import.meta.env.DEV
    ? `http://${window.location.hostname}:4000`
    : window.location.origin)
).replace(/\/+$/, "");