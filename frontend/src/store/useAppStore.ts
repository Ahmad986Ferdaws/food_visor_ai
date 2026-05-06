"use client";
import { create } from "zustand";
import type { PipelineStatus } from "@/types/api";

interface AppState {
  // Pipeline tracking
  activePipelineId: string | null;
  activePipelineStatus: PipelineStatus | null;
  setActivePipeline: (id: string | null, status?: PipelineStatus) => void;
  updatePipelineStatus: (status: PipelineStatus) => void;

  // User preferences (persisted in settings)
  preferences: {
    reducedMotion: boolean;
    lowPerformance: boolean;
    speedMode: boolean;
    defaultRestrictions: string[];
  };
  setPreference: <K extends keyof AppState["preferences"]>(
    key: K,
    value: AppState["preferences"][K]
  ) => void;

  // Demo user
  userId: string;
}

export const useAppStore = create<AppState>((set) => ({
  activePipelineId: null,
  activePipelineStatus: null,
  setActivePipeline: (id, status) =>
    set({ activePipelineId: id, activePipelineStatus: status ?? "queued" }),
  updatePipelineStatus: (status) => set({ activePipelineStatus: status }),

  preferences: {
    reducedMotion: false,
    lowPerformance: false,
    speedMode: false,
    defaultRestrictions: [],
  },
  setPreference: (key, value) =>
    set((s) => ({ preferences: { ...s.preferences, [key]: value } })),

  userId: "550e8400-e29b-41d4-a716-446655440000",
}));
