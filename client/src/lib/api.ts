export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'

type RequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  token?: string
}

export async function apiRequest(path: string, options: RequestOptions = {}) {
  const { method = 'GET', body, token } = options

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = res.status === 204 ? undefined : await res.json()

  if (!res.ok) {
    throw new Error(data.message || 'Something went wrong')
  }

  return data
}

export async function apiUpload(path: string, body: FormData, token?: string) {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body,
  })

  const data = await res.json()
  if (!res.ok) throw new Error(data.message || 'Upload failed')
  return data
}




