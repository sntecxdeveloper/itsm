import axios from 'axios';

// Auth is now httpOnly cookies (set by the backend on login/refresh), not a
// token this code can read or attach itself - see DECISIONS.md. withCredentials
// makes the browser send those cookies automatically; xsrfCookieName/
// xsrfHeaderName make axios read Spring's (non-httpOnly, by design) CSRF
// cookie and echo it back as a header on every unsafe-method request, which
// is required once CSRF protection is enabled alongside cookie-based auth.
const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || '/api/v1',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
  xsrfCookieName: 'XSRF-TOKEN',
  xsrfHeaderName: 'X-XSRF-TOKEN',
});

// Flag to prevent multiple refresh attempts
let isRefreshing = false;
let failedQueue: Array<{
  resolve: () => void;
  reject: (error: unknown) => void;
}> = [];

const processQueue = (error: unknown) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve();
  });
  failedQueue = [];
};

// Response interceptor — handle 401 with auto token refresh. No tokens pass
// through this code at all: /auth/refresh reads the refresh cookie itself and
// sets a new access-token cookie in its response, so retrying the original
// request just needs the browser to have that new cookie - nothing to attach
// manually.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      if (isRefreshing) {
        return new Promise<void>((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => api(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await api.post('/auth/refresh');
        processQueue(null);
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError);
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
