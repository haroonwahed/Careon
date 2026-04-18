/**
 * Careon API client — CSRF-aware fetch wrapper for Django session auth.
 *
 * Django sets a `csrftoken` cookie on the first page load. All mutating
 * requests must include it as a header. GET requests don't need it.
 */

function getCsrfToken(): string {
  const match = document.cookie.match(/csrftoken=([^;]+)/);
  return match ? match[1] : '';
}

interface RequestOptions extends RequestInit {
  params?: Record<string, string | number | string[]>;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { params, headers, ...rest } = options;

  // Build URL with query params
  const url = new URL(path, window.location.origin);
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach(v => url.searchParams.append(key, v));
      } else {
        url.searchParams.set(key, String(value));
      }
    });
  }

  const method = (rest.method ?? 'GET').toUpperCase();
  const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);

  const response = await fetch(url.toString(), {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(isMutating ? { 'X-CSRFToken': getCsrfToken() } : {}),
      ...headers,
    },
    ...rest,
  });

  if (response.status === 401 || response.status === 403) {
    // Session expired — redirect to login
    window.location.href = `/login/?next=${encodeURIComponent(window.location.pathname)}`;
    throw new Error('Niet geautoriseerd');
  }

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`API fout ${response.status}: ${text}`);
  }

  return response.json() as Promise<T>;
}

export const apiClient = {
  get: <T>(path: string, params?: Record<string, string | number | string[]>) =>
    request<T>(path, { method: 'GET', params }),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) =>
    request<T>(path, { method: 'DELETE' }),
};
