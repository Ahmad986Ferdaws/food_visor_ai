"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAppStore } from "@/store/useAppStore";
import { recommendationAPI, healthAPI } from "@/lib/api";

export function useCreateRecommendation() {
  const setActivePipeline = useAppStore((s) => s.setActivePipeline);

  return useMutation({
    mutationFn: async (data: {
      message: string;
      context_override?: Record<string, unknown>;
    }) => {
      const res = await recommendationAPI.create(data.message, data.context_override);
      return res.data;
    },
    onSuccess: (result) => {
      setActivePipeline(result.request_id, "queued");
    },
  });
}

export function useRecommendation(requestId: string | undefined, polling = false) {
  const updateStatus = useAppStore((s) => s.updatePipelineStatus);

  return useQuery({
    queryKey: ["recommendation", requestId],
    queryFn: async () => {
      const res = await recommendationAPI.get(requestId!);
      return res.data;
    },
    enabled: !!requestId,
    refetchInterval: (query) => {
      if (!polling) return false;
      const status = (query.state.data as any)?.status;
      // Stop polling once the pipeline reaches a terminal state.
      if (status === "completed" || status === "failed") return false;
      return 1500;
    },
    select: (data: any) => {
      if (data?.status) updateStatus(data.status);
      return data;
    },
  });
}

export function useSubmitFeedback(requestId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (data: { rating: number; comment?: string; liked?: string[]; disliked?: string[] }) => {
      const res = await recommendationAPI.submitFeedback(
        requestId,
        data.rating,
        data.liked ?? [],
        data.disliked ?? [],
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recommendation", requestId] });
    },
  });
}

export function useHistory() {
  return useQuery({
    queryKey: ["history"],
    queryFn: async () => {
      const res = await recommendationAPI.list();
      return (res.data ?? []).map((row: any) => ({
        request_id: row.request_id,
        message: row.message,
        status: row.status,
        created_at: row.created_at,
        items_count: row.items_count ?? 0,
      }));
    },
  });
}

export function useHealth() {
  return useQuery({
    queryKey: ["health"],
    queryFn: async () => {
      const res = await healthAPI.check();
      return res.data;
    },
    refetchInterval: 30000,
  });
}
