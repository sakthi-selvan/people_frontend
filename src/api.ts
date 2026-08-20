const TOKEN = 'people.token'

export async function api<T = unknown>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN)
  const res = await fetch(`/api${path}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  })
  const data = (await res.json().catch(() => ({}))) as { error?: string }
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data as T
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN, token)
  else localStorage.removeItem(TOKEN)
}

export function getToken() {
  return localStorage.getItem(TOKEN)
}
