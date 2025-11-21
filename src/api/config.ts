const DEV = import.meta.env.DEV as boolean
const RAW = import.meta.env.VITE_API_BASE_URL as string | undefined

export const API_BASE = DEV ? '' : (RAW ?? '')

export function apiUrl(path: string): string {
  if (!API_BASE) return path
  const base = API_BASE.replace(/\/$/, '')
  return `${base}${path.startsWith('/') ? '' : '/'}${path}`
}
