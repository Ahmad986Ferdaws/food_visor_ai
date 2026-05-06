/**
 * Real API client — swap in when backend is live.
 *
 * Usage:
 *   1. Set NEXT_PUBLIC_API_URL in .env.local
 *   2. Replace `mockApi` imports with `apiClient` in hooks/useApi.ts
 */
import type {
  RecommendationRequest,
  RecommendationQueued,
  RecommendationResult,
  FeedbackRequest,
  FeedbackResponse,
  HealthResponse,
} from "@/types/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "Content-Type": "application/json" },
    ...options,
  });
  if (!res.ok) {
    throw new Error(`API error: ${res.status} ${res.statusText}`);
  }
  return res.json() as Promise<T>;
}

export const apiClient = {
  createRecommendation: (body: RecommendationRequest) =>
    request<RecommendationQueued>("/v1/recommendations", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getRecommendation: (id: string) =>
    request<RecommendationResult>(`/v1/recommendations/${id}`),

  submitFeedback: (id: string, body: FeedbackRequest) =>
    request<FeedbackResponse>(`/v1/recommendations/${id}/feedback`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  getHealth: () => request<HealthResponse>("/health"),
};
