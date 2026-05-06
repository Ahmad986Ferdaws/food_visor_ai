/**
 * Mock API layer — simulates backend responses with realistic timing.
 * Swap to apiClient.ts when backend is live.
 */
import type {
  RecommendationRequest,
  RecommendationQueued,
  RecommendationResult,
  FeedbackRequest,
  FeedbackResponse,
  HealthResponse,
  HistoryItem,
  PipelineStatus,
  RecommendationItem,
} from "@/types/api";

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));
const uuid = () => crypto.randomUUID();

// ── In-memory store for mock state ─────────────────────
const mockStore = new Map<string, {
  request: RecommendationRequest;
  status: PipelineStatus;
  created_at: string;
  items: RecommendationItem[] | null;
}>();

const MOCK_ITEMS: RecommendationItem[] = [
  {
    title: "Mediterranean Quinoa Power Bowl",
    description: "Protein-rich quinoa base with roasted chickpeas, sun-dried tomatoes, kalamata olives, and tahini drizzle. Balanced macros with anti-inflammatory benefits.",
    confidence: 0.94,
    tags: ["High Protein", "Anti-Inflammatory", "Mediterranean"],
    reasoning: "Matches your preference for plant-based proteins and Mediterranean flavors from past selections.",
  },
  {
    title: "Grilled Salmon with Citrus Glaze",
    description: "Wild-caught salmon fillet with orange-ginger glaze, served over sesame bok choy and jasmine rice. Rich in omega-3 fatty acids.",
    confidence: 0.91,
    tags: ["Omega-3", "Lean Protein", "Asian Fusion"],
    reasoning: "Your dietary profile indicates a preference for omega-rich seafood options.",
  },
  {
    title: "Thai Coconut Lentil Curry",
    description: "Creamy red lentil curry in coconut milk with Thai basil, lemongrass, and crispy shallots. Warming, satisfying, and fully plant-based.",
    confidence: 0.87,
    tags: ["Vegan", "High Fiber", "Comfort Food"],
    reasoning: "Aligns with your interest in plant-based comfort meals and Southeast Asian cuisine.",
  },
  {
    title: "Açaí Protein Smoothie Bowl",
    description: "Blended açaí with banana, topped with granola clusters, hemp seeds, coconut flakes, and fresh berries.",
    confidence: 0.82,
    tags: ["Antioxidant", "Post-Workout", "Quick Meal"],
    reasoning: "Suggested as a lighter option based on your morning meal pattern preferences.",
  },
];

// ── Status progression simulation ──────────────────────
const STATUS_SEQUENCE: PipelineStatus[] = [
  "queued",
  "running_agent1",
  "running_agent2",
  "running_agent3",
  "completed",
];

function advanceStatus(requestId: string) {
  const entry = mockStore.get(requestId);
  if (!entry) return;

  const currentIdx = STATUS_SEQUENCE.indexOf(entry.status);
  if (currentIdx < STATUS_SEQUENCE.length - 1) {
    entry.status = STATUS_SEQUENCE[currentIdx + 1];
    if (entry.status === "completed") {
      entry.items = MOCK_ITEMS;
    }
  }
}

// ── Mock API methods ───────────────────────────────────
export const mockApi = {
  async createRecommendation(body: RecommendationRequest): Promise<RecommendationQueued> {
    await delay(400);
    const request_id = uuid();
    mockStore.set(request_id, {
      request: body,
      status: "queued",
      created_at: new Date().toISOString(),
      items: null,
    });

    // Auto-advance through stages
    setTimeout(() => advanceStatus(request_id), 2000);
    setTimeout(() => advanceStatus(request_id), 5000);
    setTimeout(() => advanceStatus(request_id), 9000);
    setTimeout(() => advanceStatus(request_id), 13000);

    return { request_id, status: "queued" };
  },

  async getRecommendation(requestId: string): Promise<RecommendationResult> {
    await delay(200);
    const entry = mockStore.get(requestId);

    if (!entry) {
      // Return a pre-completed demo result for unknown IDs
      return {
        request_id: requestId,
        status: "completed",
        items: MOCK_ITEMS,
        reasoning: "Generated from 12 retrieved knowledge sources and your preference profile.",
        error: null,
        agent_runs: [
          { agent_role: "context_builder", status: "completed", started_at: null, finished_at: null, duration_ms: 1200 },
          { agent_role: "recommender", status: "completed", started_at: null, finished_at: null, duration_ms: 3400 },
          { agent_role: "validator", status: "completed", started_at: null, finished_at: null, duration_ms: 800 },
        ],
        created_at: new Date().toISOString(),
      };
    }

    return {
      request_id: requestId,
      status: entry.status,
      items: entry.items,
      reasoning: entry.items ? "Generated from 12 retrieved knowledge sources and your preference profile." : null,
      error: null,
      agent_runs: [
        {
          agent_role: "context_builder",
          status: ["running_agent1", "running_agent2", "running_agent3", "completed"].includes(entry.status) ? "completed" : "pending",
          started_at: null,
          finished_at: null,
          duration_ms: entry.status !== "queued" ? 1200 : null,
        },
        {
          agent_role: "recommender",
          status: ["running_agent2", "running_agent3", "completed"].includes(entry.status)
            ? (entry.status === "running_agent2" ? "running" : "completed")
            : "pending",
          started_at: null,
          finished_at: null,
          duration_ms: ["running_agent3", "completed"].includes(entry.status) ? 3400 : null,
        },
        {
          agent_role: "validator",
          status: ["running_agent3", "completed"].includes(entry.status)
            ? (entry.status === "running_agent3" ? "running" : "completed")
            : "pending",
          started_at: null,
          finished_at: null,
          duration_ms: entry.status === "completed" ? 800 : null,
        },
      ],
      created_at: entry.created_at,
    };
  },

  async submitFeedback(_requestId: string, body: FeedbackRequest): Promise<FeedbackResponse> {
    await delay(300);
    return { id: uuid(), status: "recorded" };
  },

  async getHealth(): Promise<HealthResponse> {
    await delay(100);
    return { status: "ok", env: "demo", db: "ok", redis: "ok" };
  },

  async getHistory(): Promise<HistoryItem[]> {
    await delay(300);
    const items: HistoryItem[] = [
      { request_id: "demo-1", message: "Healthy lunch ideas for weight management", status: "completed", created_at: new Date(Date.now() - 3600000).toISOString(), items_count: 4 },
      { request_id: "demo-2", message: "High-protein dinner for muscle recovery", status: "completed", created_at: new Date(Date.now() - 7200000).toISOString(), items_count: 3 },
      { request_id: "demo-3", message: "Quick breakfast under 300 calories", status: "completed", created_at: new Date(Date.now() - 86400000).toISOString(), items_count: 4 },
    ];

    // Add any in-progress mock items
    mockStore.forEach((entry, id) => {
      items.unshift({
        request_id: id,
        message: entry.request.message,
        status: entry.status,
        created_at: entry.created_at,
        items_count: entry.items?.length ?? 0,
      });
    });

    return items;
  },
};
