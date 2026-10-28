const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export type ApiEnvelope<T> = {
  success: true;
  data: T;
  timestamp: string;
};

export type ApiError = {
  statusCode: number;
  message: string;
  details?: unknown;
};

export class ApiClientError extends Error {
  statusCode: number;
  details?: unknown;

  constructor(error: ApiError) {
    super(error.message);
    this.name = 'ApiClientError';
    this.statusCode = error.statusCode;
    this.details = error.details;
  }
}

/**
 * Thin fetch wrapper that understands the API response envelope.
 * Credentials are included so httpOnly auth cookies flow automatically.
 */
async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {},
): Promise<T> {
  const { token, headers, ...rest } = options;
  const response = await fetch(`${API_BASE}/api/v1${path}`, {
    ...rest,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...headers,
    },
  });

  const text = await response.text();
  const json = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const error = new ApiClientError(
      json ?? { statusCode: response.status, message: 'خطای ناشناخته در ارتباط با سرور' },
    );
    // Mandatory-2FA gate: let the console shell redirect to the enrolment page.
    const code = (error.details as { code?: string } | undefined)?.code;
    if (code === 'TWO_FACTOR_SETUP_REQUIRED' && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('bp:two-factor-required'));
    }
    throw error;
  }

  return (json as ApiEnvelope<T>).data;
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET', token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, token }),
  patch: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PATCH', body: body ? JSON.stringify(body) : undefined, token }),
  put: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'PUT', body: body ? JSON.stringify(body) : undefined, token }),
  delete: <T>(path: string, token?: string | null) =>
    request<T>(path, { method: 'DELETE', token }),
};

export { API_BASE };
