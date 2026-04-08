const API = `${window.location.origin}/api`;

export function useApi() {
  async function get<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`);
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function post<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'unknown error' }));
      throw new Error(err.error || `API error: ${res.status}`);
    }
    return res.json();
  }

  async function put<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function patch<T = any>(path: string, body?: any): Promise<T> {
    const res = await fetch(`${API}${path}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  async function del<T = any>(path: string): Promise<T> {
    const res = await fetch(`${API}${path}`, { method: 'DELETE' });
    if (!res.ok) throw new Error(`API error: ${res.status}`);
    return res.json();
  }

  return { get, post, put, patch, del };
}
