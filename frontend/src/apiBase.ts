/** In production, set VITE_API_BASE_URL to your Express API origin (no trailing slash), e.g. https://your-api.railway.app */
export function apiPath(path: string): string {
  const raw = import.meta.env.VITE_API_BASE_URL as string | undefined
  const base = raw?.replace(/\/$/, '') ?? ''
  const p = path.startsWith('/') ? path : `/${path}`
  return base ? `${base}${p}` : p
}
