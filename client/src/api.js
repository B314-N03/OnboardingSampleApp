// In dev, requests go through the Vite proxy (relative path).
// In the built app (e.g. GitHub Pages) there is no proxy, so target the
// backend directly. Override with VITE_API_BASE for a hosted backend.
export const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? 'http://localhost:3001' : '');

// Same signature as fetch(), but prefixes the API base so relative
// /api/... paths resolve to the backend instead of the static host.
export const apiFetch = (path, init) => fetch(`${API_BASE}${path}`, init);
