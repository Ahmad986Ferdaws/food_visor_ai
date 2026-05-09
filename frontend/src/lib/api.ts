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

// ── User profile / About Me ─────────────────────────────
export interface UserProfile {
  id: string;
  email: string;
  display_name: string | null;
  dietary_constraints: string[];
  allergies: string[];
  medical_conditions: string[];
  goals: string[];
  liked_items: string[];
  disliked_items: string[];
  daily_limits: {
    calories?: number;
    protein_g?: number;
    carbs_g?: number;
    fat_g?: number;
    sugar_g?: number;
    sodium_mg?: number;
    water_l?: number;
    [k: string]: number | undefined;
  };
}

export type UserProfileUpdate = Partial<Omit<UserProfile, "id" | "email">>;

export const profileAPI = {
  get: () => api.get<UserProfile>("/users/me/profile"),
  update: (patch: UserProfileUpdate) => api.put<UserProfile>("/users/me/profile", patch),
};

// ── Meals (Activity Overview) ───────────────────────────
export interface MealEntry {
  id: string;
  meal_name: string;
  meal_type: string | null;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  eaten_at: string;
  source: string;
  extra: Record<string, unknown>;
}

export interface DayAggregate {
  date: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  sugar_g: number;
  sodium_mg: number;
  meal_count: number;
}

export interface DayDetail {
  date: string;
  totals: DayAggregate;
  meals: MealEntry[];
}

export const mealsAPI = {
  byDate: (date: string) =>
    api.get<DayDetail>("/users/me/meals/by-date", { params: { date } }),
  range: (start: string, end: string) =>
    api.get<DayAggregate[]>("/users/me/meals/range", { params: { start, end } }),
};

// ── Advisor (How much do you know about me?) ────────────
export interface AboutSummary {
  greeting: string;
  i_know: string[];
  recent_observations: string[];
  safe_favorites: string[];
  things_to_explore: string[];
  encouragement: string;
  meta?: {
    generated_at?: string;
    meal_log_count?: number;
    model?: string;
  };
}

export const advisorAPI = {
  aboutSummary: () => api.get<AboutSummary>("/users/me/about-summary"),
};
