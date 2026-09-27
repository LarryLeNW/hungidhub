import { getTokens, setTokens, type StoredTokens } from "./token-store";

/** Base URL of the NestJS backend, without trailing slash (e.g. http://localhost:4000/api). */
export const API_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api").replace(
  /\/+$/,
  "",
);

/**
 * Older uploads were persisted with the backend's private localhost URL.
 * Turn only those upload links back into same-origin public paths; external URLs
 * and all other API strings are deliberately left untouched.
 */
const LOCAL_UPLOAD_URL = /https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/uploads\//gi;

export function normalizeUploadedMedia<T>(value: T): T {
  if (typeof value === "string") {
    return value.replace(LOCAL_UPLOAD_URL, "/uploads/") as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => normalizeUploadedMedia(item)) as T;
  }
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, normalizeUploadedMedia(item)]),
    ) as T;
  }
  return value;
}

export class ApiError extends Error {
  readonly status: number;
  readonly details: unknown;

  constructor(status: number, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }

  /** True when the request never reached the server (offline, CORS, DNS…). */
  get isNetworkError() {
    return this.status === 0;
  }
}

export type ApiRequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  /** JSON-serialised automatically. */
  body?: unknown;
  /** Attach the access token and auto-refresh on 401. Default: true. */
  auth?: boolean;
  headers?: Record<string, string>;
  signal?: AbortSignal;
};

/**
 * Thin fetch wrapper for the backend:
 * - prefixes `API_URL`, sends/receives JSON
 * - attaches `Authorization: Bearer` when a session exists
 * - on 401 refreshes the token pair once (single-flight) and retries the request
 * - normalises Nest error bodies into `ApiError`
 */
export function apiFetch<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  return request<T>(path, options, true);
}

async function request<T>(
  path: string,
  options: ApiRequestOptions,
  allowRetry: boolean,
): Promise<T> {
  const { method = "GET", body, auth = true, headers = {}, signal } = options;
  const tokens = auth ? getTokens() : null;
  // Multipart bodies (file uploads) go through untouched; the browser sets the boundary header.
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: "application/json",
        ...(body !== undefined && !isForm ? { "Content-Type": "application/json" } : {}),
        ...(tokens ? { Authorization: `Bearer ${tokens.accessToken}` } : {}),
        ...headers,
      },
      body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
      signal,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") throw error;
    throw new ApiError(0, "Không kết nối được máy chủ. Vui lòng thử lại sau.");
  }

  if (response.status === 401 && auth && tokens?.refreshToken && allowRetry) {
    if (await refreshSession()) {
      return request<T>(path, options, false);
    }
  }

  if (!response.ok) {
    throw await toApiError(response);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  return normalizeUploadedMedia((text ? JSON.parse(text) : undefined) as T);
}

let refreshInFlight: Promise<boolean> | null = null;

/**
 * Exchanges the stored refresh token for a new pair. Concurrent callers share one request.
 * Resolves `true` on success; on a rejected token the session is cleared and `false` returned.
 */
export function refreshSession(): Promise<boolean> {
  if (!refreshInFlight) {
    refreshInFlight = doRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function doRefresh(): Promise<boolean> {
  const tokens = getTokens();
  if (!tokens?.refreshToken) return false;

  try {
    const next = await request<StoredTokens>(
      "/auth/refresh",
      { method: "POST", body: { refreshToken: tokens.refreshToken }, auth: false },
      false,
    );
    setTokens({ accessToken: next.accessToken, refreshToken: next.refreshToken });
    return true;
  } catch (error) {
    // Offline: keep the session so it can be retried; any HTTP rejection ends the session.
    if (!(error instanceof ApiError && error.isNetworkError)) {
      setTokens(null);
    }
    return false;
  }
}

async function toApiError(response: Response) {
  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = undefined;
  }
  return new ApiError(
    response.status,
    extractMessage(payload) ?? defaultMessage(response.status),
    payload,
  );
}

function extractMessage(payload: unknown) {
  if (payload && typeof payload === "object" && "message" in payload) {
    const message = (payload as { message?: unknown }).message;
    if (Array.isArray(message)) return message.map(String).join("\n");
    if (typeof message === "string" && message) return message;
  }
  return null;
}

function defaultMessage(status: number) {
  switch (status) {
    case 400:
      return "Dữ liệu gửi lên không hợp lệ.";
    case 401:
      return "Phiên đăng nhập không hợp lệ hoặc đã hết hạn.";
    case 403:
      return "Bạn không có quyền thực hiện thao tác này.";
    case 404:
      return "Không tìm thấy dữ liệu.";
    case 409:
      return "Dữ liệu đã tồn tại.";
    default:
      return status >= 500 ? "Máy chủ gặp sự cố. Vui lòng thử lại sau." : `Lỗi ${status}`;
  }
}
