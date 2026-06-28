import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

// ── Singleton access-token getter (avoids circular deps with AuthContext) ──

let _getAccessToken: () => string | null = () => null;

export function setTokenGetter(fn: () => string | null) {
  _getAccessToken = fn;
}

// ── Singleton logout handler (R-7) ─────────────────────────────────────────
// AuthContext registers a handler so apiClient can notify it when the
// refresh-token flow has failed and there is no way to recover. The handler
// is responsible for clearing local auth state. We do not import AuthContext
// directly to avoid a circular dependency.

let _logoutHandler: () => void = () => {};

export function setLogoutHandler(fn: () => void) {
  _logoutHandler = fn;
}

// ── Axios instance ──────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
});

// ── Request interceptor: attach Bearer token ───────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Don't overwrite an already-set header (e.g. after a refresh retry)
  if (!config.headers.Authorization) {
    const token = _getAccessToken();
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ── Response interceptor: 401 retry with refresh ────────────────────────────

let _isRefreshing = false;
let _onRefreshed: ((token: string) => void)[] = [];
let _onRefreshFailed: (() => void)[] = [];
// Guards against firing the logout handler more than once per refresh
// cycle when multiple requests are queued behind a single refresh attempt.
let _logoutFiredForCycle = false;

function notifyRefreshed(token: string) {
  _onRefreshed.forEach((cb) => cb(token));
  _onRefreshed = [];
  _onRefreshFailed = [];
  _logoutFiredForCycle = false;
}

function notifyRefreshFailed() {
  _onRefreshFailed.forEach((cb) => cb());
  _onRefreshFailed = [];
  _onRefreshed = [];
  if (!_logoutFiredForCycle) {
    _logoutFiredForCycle = true;
    _logoutHandler();
  }
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    // C3 / R12 — the refresh request itself (issued by the interceptor
    // below) must NOT be retried. It carries the sentinel header
    // `X-Refresh-Request: 1` so a 401 from the refresh endpoint
    // short-circuits straight to the original rejection. Without this
    // guard, routing the refresh through `apiClient.post(...)` (instead
    // of a raw `axios.post`) would cause the interceptor to try to
    // refresh-the-refresh in an infinite loop.
    if (originalRequest?.headers?.["X-Refresh-Request"] === "1") {
      return Promise.reject(error);
    }

    // Only handle 401 and only retry once
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error);
    }

    // If already refreshing, queue this request
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _onRefreshed.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`;
          resolve(apiClient(originalRequest));
        });
        _onRefreshFailed.push(() => reject(error));
      });
    }

    originalRequest._retry = true;
    _isRefreshing = true;

    try {
      // C3 / R12 — Use the configured apiClient (not a raw axios.post) so
      // the refresh call uses the same baseURL and withCredentials as the
      // rest of the app. If VITE_API_URL ends with a trailing slash (or is
      // otherwise misconfigured), a hand-built URL like
      // `${VITE_API_URL}/api/auth/refresh` would produce a double-slash
      // path — the refresh cookie wouldn't be sent on the same path the
      // main client uses, the refresh would fail, and the user would be
      // silently logged out. Routing through apiClient lets axios do the
      // URL-joining against the configured baseURL.
      //
      // The `X-Refresh-Request` sentinel header tells the response
      // interceptor above to NOT attempt to refresh this call if it
      // returns 401 — preventing the infinite refresh-the-refresh loop.
      const { data } = await apiClient.post<{
        accessToken: { token: string; expiresAt: string };
        refreshToken: string;
        refreshTokenExpiresAt: string;
        user: { id: string; email: string; displayName: string };
      }>("/api/auth/refresh", null, {
        headers: { "X-Refresh-Request": "1" },
      });
      const newToken: string = data.accessToken.token;
      notifyRefreshed(newToken);

      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(originalRequest);
    } catch {
      notifyRefreshFailed();
      return Promise.reject(error);
    } finally {
      _isRefreshing = false;
    }
  },
);

export default apiClient;
