import axios from "axios";

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || "/api/v1",
  withCredentials: true,
  timeout: 20000,
  headers: { Accept: "application/json" }
});

let csrfPromise = null;
let refreshPromise = null;

function readCookie(name) {
  const prefix = `${encodeURIComponent(name)}=`;
  const item = document.cookie.split("; ").find((entry) => entry.startsWith(prefix));
  return item ? decodeURIComponent(item.slice(prefix.length)) : "";
}

export async function ensureCsrfToken(force = false) {
  const existing = readCookie("ls_csrf");
  if (existing && !force) return existing;

  if (!csrfPromise) {
    csrfPromise = api.get("/auth/csrf")
      .then((response) => response.data.data.csrfToken)
      .finally(() => {
        csrfPromise = null;
      });
  }
  return csrfPromise;
}

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    const token = await ensureCsrfToken();
    config.headers["X-CSRF-Token"] = token;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const request = error.config || {};
    const status = error.response?.status;
    const code = error.response?.data?.error?.code;
    const isRefresh = request.url?.includes("/auth/refresh");

    if (status === 403 && code === "CSRF_INVALID" && !request._csrfRetry) {
      request._csrfRetry = true;
      request.headers["X-CSRF-Token"] = await ensureCsrfToken(true);
      return api(request);
    }

    if (status === 401 && !isRefresh && !request._authRetry) {
      request._authRetry = true;
      if (!refreshPromise) {
        refreshPromise = api.post("/auth/refresh")
          .finally(() => {
            refreshPromise = null;
          });
      }
      try {
        await refreshPromise;
        return api(request);
      } catch {
        window.dispatchEvent(new CustomEvent("legalsphere:session-expired"));
      }
    }

    return Promise.reject(error);
  }
);

export function apiErrorMessage(error, fallback = "Something went wrong.") {
  return error.response?.data?.error?.message || error.message || fallback;
}

export default api;
