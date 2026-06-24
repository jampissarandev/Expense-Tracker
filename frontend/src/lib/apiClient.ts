import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios"

// ── Singleton access-token getter (avoids circular deps with AuthContext) ──

let _getAccessToken: () => string | null = () => null

export function setTokenGetter(fn: () => string | null) {
  _getAccessToken = fn
}

// ── Axios instance ──────────────────────────────────────────────────────────

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL as string,
  withCredentials: true,
  headers: { "Content-Type": "application/json" },
})

// ── Request interceptor: attach Bearer token ───────────────────────────────

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  // Don't overwrite an already-set header (e.g. after a refresh retry)
  if (!config.headers.Authorization) {
    const token = _getAccessToken()
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
  }
  return config
})

// ── Response interceptor: 401 retry with refresh ────────────────────────────

let _isRefreshing = false
let _onRefreshed: ((token: string) => void)[] = []
let _onRefreshFailed: (() => void)[] = []

function notifyRefreshed(token: string) {
  _onRefreshed.forEach((cb) => cb(token))
  _onRefreshed = []
  _onRefreshFailed = []
}

function notifyRefreshFailed() {
  _onRefreshFailed.forEach((cb) => cb())
  _onRefreshFailed = []
  _onRefreshed = []
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean
    }

    // Only handle 401 and only retry once
    if (error.response?.status !== 401 || originalRequest._retry) {
      return Promise.reject(error)
    }

    // If already refreshing, queue this request
    if (_isRefreshing) {
      return new Promise((resolve, reject) => {
        _onRefreshed.push((token: string) => {
          originalRequest.headers.Authorization = `Bearer ${token}`
          resolve(apiClient(originalRequest))
        })
        _onRefreshFailed.push(() => reject(error))
      })
    }

    originalRequest._retry = true
    _isRefreshing = true

    try {
      const { data } = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
        null,
        { withCredentials: true },
      )
      const newToken: string = data.accessToken.token
      notifyRefreshed(newToken)

      originalRequest.headers.Authorization = `Bearer ${newToken}`
      return apiClient(originalRequest)
    } catch {
      notifyRefreshFailed()
      return Promise.reject(error)
    } finally {
      _isRefreshing = false
    }
  },
)

export default apiClient
