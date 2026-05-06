import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/v1";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

// Attach JWT token to every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("auth_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// Auto-redirect on 401
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("auth_token");
      window.location.href = "/login";
    }
    return Promise.reject(error);
  }
);

// ── Auth ────────────────────────────────────────────────
export const authAPI = {
  login: (email: string, password: string) =>
    api.post("/auth/login", { email, password }),
  signup: (email: string, password: string) =>
    api.post("/auth/signup", { email, password }),
  me: () => api.get("/auth/me"),
};

// ── Recommendations ─────────────────────────────────────
export const recommendationAPI = {
  create: (message: string, contextOverride?: Record<string, unknown>) =>
    api.post("/recommendations/", { message, context_override: contextOverride }),
  get: (requestId: string) => api.get(`/recommendations/${requestId}`),
  list: () => api.get("/recommendations/"),
  submitFeedback: (requestId: string, rating: number, liked: string[] = [], disliked: string[] = []) =>
    api.post(`/recommendations/${requestId}/feedback`, {
      rating,
      liked_items: liked,
      disliked_items: disliked,
    }),
};

// ── Health ──────────────────────────────────────────────
export const healthAPI = {
  check: () => api.get("/health"),
};
