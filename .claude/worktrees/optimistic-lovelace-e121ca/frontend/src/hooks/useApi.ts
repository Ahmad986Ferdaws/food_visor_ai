"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { mockApi } from "@/services/mockApi";
import { useAppStore } from "@/store/useAppStore";
import type { RecommendationRequest, FeedbackRequest } from "@/types/api";

// ── Switch point: replace mockApi with apiClient when backend is live ──

export function useCreateRecommendation() {
  const userId = useAppStore((s) => s.userId);
  const setActivePipeline = useAppStore((s) => s.setActivePipeline);

  return useMutation({
    mutationFn: (data: Omit<RecommendationRequest, "user_id">) =>
      mockApi.createRecommendation({ ...data, user_id: userId }),
    onSuccess: (result) => {
      setActivePipeline(result.request_id, "queued");
    },
  });
}

export function useRecommendation(requestId: string | undefined, polling = false) {
  const updateStatus = useAppStore((s) => s.updatePipelineStatus);

  return useQuery({
    queryKey: ["recommendation", requestId],
    queryFn: () => mockApi.getRecommendation(requestId!),
    enabled: !!requestId,
    refetchInterval: polling ? 1500 : false,
    select: (data) => {
      updateStatus(data.status);
      return data;
    },
  });
}

export function useSubmitFeedback(requestId: string) {
  const userId = useAppStore((s) => s.userId);
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Omit<FeedbackRequest, "user_id">) =>
      mockApi.submitFeedback(requestId, { ...data, user_id: userId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendation", requestId] });
    },
  });
}

export function useHistory() {
  return useQuery({
    queryKey: ["history"],
    queryFn: () => mockApi.getHistory(),
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: () => mockApi.getHealth(),
    refetchInterval: 30000,
  });
}
