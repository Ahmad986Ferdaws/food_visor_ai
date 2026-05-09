"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowLeft, RotateCcw, Share2, Download, Clock, Flame, Beef, Wheat, Droplets,
  CheckCircle2, AlertCircle, Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FadeIn } from "@/components/motion/FadeIn";
import { FeedbackPanel } from "@/components/features/FeedbackPanel";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonList } from "@/components/states/SkeletonState";
import { useRecommendation, useSubmitFeedback } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

const GLASS = "rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

interface Ingredient { item: string; quantity?: string | number; unit?: string }
interface Nutrition { calories?: number; protein?: number; carbs?: number; fat?: number }
interface MealRecommendation {
  meal_name?: string;
  description?: string;
  ingredients?: Ingredient[];
  nutrition?: Nutrition;
  preparation?: string;
  prep_time_minutes?: number;
  tags?: string[];
}

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const { data, isLoading, isError, refetch } = useRecommendation(requestId);
  const feedbackMutation = useSubmitFeedback(requestId);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-12"><SkeletonList count={4} /></div>;
  if (isError || !data) return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState onRetry={() => refetch()} /></div>;

  // Backend returns: data.result = { decision, verdict_reason, final_recommendation, validation_result, changes_made, confidence_score }
  const result = (data as any).result ?? {};
  const meal: MealRecommendation = result.final_recommendation ?? result.recommendation ?? result ?? {};
  const validationResult: string | undefined = result.validation_result;
  const changesMade: string[] = result.changes_made ?? [];
  const confidence: number | undefined = result.confidence_score;
  const decision: "can_eat" | "cannot_eat" | "try_alternative" | undefined = result.decision;
  const verdictReason: string | undefined = result.verdict_reason || meal.description;
  const uploadedSummary: string | undefined = result.uploaded_food_summary || (meal as any).uploaded_food_summary;

  const handleFeedback = async (fb: { rating: number; comment?: string }) => {
    try {
      await feedbackMutation.mutateAsync(fb);
      setFeedbackSubmitted(true);
      toast.success("Feedback recorded", { description: "Thanks! This helps improve future recommendations." });
    } catch { toast.error("Failed to submit feedback"); }
  };

  const prepSteps = (meal.preparation ?? "")
    .split(/\n+|(?=\d+[.)])/)
    .map((s) => s.trim())
    .filter(Boolean);

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      {/* ── Header ── */}
      <FadeIn>
        <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 transition-colors">
          <ArrowLeft className="h-3.5 w-3.5" /> Back
        </button>
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 sm:text-4xl">{meal.meal_name ?? "Your Recommendation"}</h1>
            {meal.description && <p className="mt-2 text-base text-slate-600">{meal.description}</p>}
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            {validationResult && (
              <Badge className={cn(
                "text-xs font-semibold border",
                validationResult === "approved" ? "bg-[#E8F5E9] text-[#1B5E20] border-[#C8E6C9]" :
                validationResult === "corrected" ? "bg-amber-50 text-amber-800 border-amber-200" :
                "bg-red-50 text-red-700 border-red-200",
              )}>
                {validationResult === "approved" && <CheckCircle2 className="h-3 w-3 mr-1 inline" />}
                {validationResult === "corrected" && <AlertCircle className="h-3 w-3 mr-1 inline" />}
                {validationResult.toUpperCase()}
              </Badge>
            )}
            {confidence !== undefined && (
              <span className="text-xs tabular-nums text-slate-500">
                Confidence: <span className="font-bold text-[#1B5E20]">{Math.round(confidence * 100)}%</span>
              </span>
            )}
          </div>
        </div>
      </FadeIn>

      {/* ── Verdict banner ── */}
      {decision && (
        <FadeIn delay={0.03}>
          <div className={cn(
            "mb-6 flex items-start gap-4 rounded-2xl border p-5",
            decision === "can_eat"
              ? "border-[#C8E6C9] bg-[#E8F5E9]"
              : decision === "cannot_eat"
              ? "border-red-200 bg-red-50"
              : "border-amber-200 bg-amber-50",
          )}>
            <div className={cn(
              "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-2xl text-2xl",
              decision === "can_eat" ? "bg-[#4CAF50]/15" :
              decision === "cannot_eat" ? "bg-red-500/15" :
              "bg-amber-500/15",
            )}>
              {decision === "can_eat" ? "✅" : decision === "cannot_eat" ? "❌" : "🔄"}
            </div>
            <div className="min-w-0 flex-1">
              <p className={cn(
                "text-sm font-bold uppercase tracking-wider",
                decision === "can_eat" ? "text-[#1B5E20]" :
                decision === "cannot_eat" ? "text-red-700" :
                "text-amber-800",
              )}>
                {decision === "can_eat" ? "Can eat" : decision === "cannot_eat" ? "Cannot eat" : "Try this instead"}
              </p>
              <p className="mt-1 text-base text-slate-800 leading-relaxed">{verdictReason}</p>
              {uploadedSummary && (
                <p className="mt-2 text-xs text-slate-500">
                  Detected on plate: <span className="font-medium text-slate-700">{uploadedSummary}</span>
                </p>
              )}
            </div>
          </div>
        </FadeIn>
      )}

      {/* ── Action bar ── */}
      <FadeIn delay={0.05}>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/app/new")}>
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Request
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon!")}>
            <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon!")}>
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </FadeIn>

      {/* ── Tags ── */}
      {meal.tags && meal.tags.length > 0 && (
        <FadeIn delay={0.1}>
          <div className="mb-6 flex flex-wrap gap-2">
            {meal.tags.map((t) => (
              <Badge key={t} variant="outline" className="border-[#C8E6C9] bg-[#F1F8E9] text-[#1B5E20] font-normal">
                <Sparkles className="h-3 w-3 mr-1" />{t}
              </Badge>
            ))}
          </div>
        </FadeIn>
      )}

      {/* ── Macros ── */}
      {meal.nutrition && (
        <FadeIn delay={0.15}>
          <div className={cn(GLASS, "mb-6 p-6")}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Nutrition</h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { icon: Flame,    label: "Calories", value: meal.nutrition.calories, suffix: " kcal", color: "#F44336" },
                { icon: Beef,     label: "Protein",  value: meal.nutrition.protein,  suffix: "g",      color: "#4CAF50" },
                { icon: Wheat,    label: "Carbs",    value: meal.nutrition.carbs,    suffix: "g",      color: "#FF9800" },
                { icon: Droplets, label: "Fat",      value: meal.nutrition.fat,      suffix: "g",      color: "#2196F3" },
              ].map(({ icon: Icon, label, value, suffix, color }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${color}18` }}>
                    <Icon className="h-5 w-5" style={{ color }} />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-slate-800">{value ?? "—"}{value !== undefined && suffix}</p>
                    <p className="text-xs text-slate-500">{label}</p>
                  </div>
                </div>
              ))}
            </div>
            {meal.prep_time_minutes !== undefined && (
              <div className="mt-4 flex items-center gap-2 text-sm text-slate-500">
                <Clock className="h-3.5 w-3.5" />
                Prep time: <span className="font-semibold text-slate-700">{meal.prep_time_minutes} minutes</span>
              </div>
            )}
          </div>
        </FadeIn>
      )}

      {/* ── Ingredients ── */}
      {meal.ingredients && meal.ingredients.length > 0 && (
        <FadeIn delay={0.2}>
          <div className={cn(GLASS, "mb-6 p-6")}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Ingredients</h2>
            <ul className="space-y-2">
              {meal.ingredients.map((ing, i) => (
                <motion.li key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                  className="flex items-center justify-between border-b border-slate-100 pb-2 last:border-0 last:pb-0">
                  <span className="font-medium text-slate-800">{ing.item}</span>
                  <span className="tabular-nums text-sm text-slate-500">
                    {ing.quantity}{ing.unit ? ` ${ing.unit}` : ""}
                  </span>
                </motion.li>
              ))}
            </ul>
          </div>
        </FadeIn>
      )}

      {/* ── Preparation ── */}
      {prepSteps.length > 0 && (
        <FadeIn delay={0.25}>
          <div className={cn(GLASS, "mb-6 p-6")}>
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-slate-500">Preparation</h2>
            <ol className="space-y-3">
              {prepSteps.map((step, i) => (
                <motion.li key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 * i }}
                  className="flex gap-3">
                  <span className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full bg-[#4CAF50] text-xs font-bold text-white">
                    {i + 1}
                  </span>
                  <p className="pt-0.5 text-slate-700 leading-relaxed">{step.replace(/^\d+[.)]\s*/, "")}</p>
                </motion.li>
              ))}
            </ol>
          </div>
        </FadeIn>
      )}

      {/* ── Validator changes (if any) ── */}
      {changesMade.length > 0 && (
        <FadeIn delay={0.3}>
          <div className={cn(GLASS, "mb-6 border-amber-200/80 bg-amber-50/60 p-6")}>
            <h2 className="mb-3 flex items-center gap-1.5 text-sm font-semibold uppercase tracking-wide text-amber-800">
              <AlertCircle className="h-4 w-4" /> Validator Adjustments
            </h2>
            <ul className="space-y-1.5 text-sm text-amber-900">
              {changesMade.map((c, i) => <li key={i}>• {c}</li>)}
            </ul>
          </div>
        </FadeIn>
      )}

      {/* ── Feedback ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <FeedbackPanel onSubmit={handleFeedback} isSubmitting={feedbackMutation.isPending} isSubmitted={feedbackSubmitted} />
      </motion.div>
    </div>
  );
}
