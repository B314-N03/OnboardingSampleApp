// Base URL for the backend API, used by every fetch in the app.
// - Dev: empty string, so requests hit the Vite proxy (see vite.config.js).
// - Production build (e.g. GitHub Pages): there is no proxy, so target the
//   backend directly. Set VITE_API_BASE (wired as a repo variable in the
//   deploy workflow); otherwise it defaults to http://localhost:3001.
const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (import.meta.env.PROD ? 'http://localhost:3001' : '');

export function apiUrl(path) {
  return `${API_BASE}${path}`;
}
