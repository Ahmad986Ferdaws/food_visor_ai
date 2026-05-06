// ── Pipeline status enum matching backend exactly ──────
export type PipelineStatus =
  | "queued"
  | "running_agent1"
  | "running_agent2"
  | "running_agent3"
  | "completed"
  | "failed";

export const PIPELINE_STAGES: { status: PipelineStatus; label: string; agent?: string }[] = [
  { status: "queued", label: "Queued" },
  { status: "running_agent1", label: "Building Context", agent: "Context Builder" },
  { status: "running_agent2", label: "Generating Recommendations", agent: "Recommender" },
  { status: "running_agent3", label: "Validating & Learning", agent: "Validator" },
  { status: "completed", label: "Completed" },
];

// ── DTOs matching backend schemas ──────────────────────
export interface RecommendationRequest {
  user_id: string;
  message: string;
  context_override?: Record<string, unknown> | null;
  goal?: string;
  restrictions?: string[];
  preferences?: Record<string, boolean>;
}

export interface RecommendationQueued {
  request_id: string;
  status: "queued";
}

export interface AgentRunOut {
  agent_role: string;
  status: string;
  started_at: string | null;
  finished_at: string | null;
  duration_ms: number | null;
}

export interface RecommendationItem {
  title: string;
  description: string;
  confidence: number;
  tags?: string[];
  reasoning?: string;
  sources?: string[];
}

export interface RecommendationResult {
  request_id: string;
  status: PipelineStatus;
  items: RecommendationItem[] | null;
  reasoning: string | null;
  error: string | null;
  agent_runs: AgentRunOut[];
  created_at: string | null;
}

export interface FeedbackRequest {
  user_id: string;
  rating: number;
  liked?: string[];
  disliked?: string[];
  comment?: string;
}

export interface FeedbackResponse {
  id: string;
  status: "recorded";
}

export interface HealthResponse {
  status: string;
  env: string;
  db: string;
  redis: string;
}

// ── History item (frontend-enriched) ───────────────────
export interface HistoryItem {
  request_id: string;
  message: string;
  status: PipelineStatus;
  created_at: string;
  items_count: number;
}
