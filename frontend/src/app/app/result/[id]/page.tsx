"use client";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Share2, Download, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { RecommendationCard } from "@/components/features/RecommendationCard";
import { FeedbackPanel } from "@/components/features/FeedbackPanel";
import { StatusBadge } from "@/components/features/StatusBadge";
import { ErrorState } from "@/components/states/ErrorState";
import { SkeletonList } from "@/components/states/SkeletonState";
import { useRecommendation, useSubmitFeedback } from "@/hooks/useApi";

export default function ResultPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const { data, isLoading, isError, refetch } = useRecommendation(requestId);
  const feedbackMutation = useSubmitFeedback(requestId);

  if (isLoading) return <div className="mx-auto max-w-3xl px-4 py-12"><SkeletonList count={4} /></div>;
  if (isError || !data) return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState onRetry={() => refetch()} /></div>;

  const handleFeedback = async (fb: { rating: number; comment?: string }) => {
    try {
      await feedbackMutation.mutateAsync(fb);
      setFeedbackSubmitted(true);
      toast.success("Feedback recorded", { description: "Thanks! This helps improve future recommendations." });
    } catch { toast.error("Failed to submit feedback"); }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <FadeIn>
        <div className="mb-8">
          <button onClick={() => router.back()} className="mb-4 flex items-center gap-1 text-sm text-[#9E9E9E] hover:text-[#212121] transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" /> Back
          </button>
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-[#212121] dark:text-white sm:text-3xl">Your Recommendations</h1>
              {data.reasoning && <p className="mt-2 text-sm text-[#9E9E9E]">{data.reasoning}</p>}
            </div>
            <StatusBadge status={data.status} />
          </div>
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mb-6 flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={() => router.push("/app/new")} className="border-gray-300 text-[#424242]">
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> New Request
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon!")} className="border-gray-300 text-[#424242]">
            <Share2 className="h-3.5 w-3.5 mr-1.5" /> Share
          </Button>
          <Button variant="outline" size="sm" onClick={() => toast.info("Coming soon!")} className="border-gray-300 text-[#424242]">
            <Download className="h-3.5 w-3.5 mr-1.5" /> Export
          </Button>
        </div>
      </FadeIn>

      {data.items && data.items.length > 0 ? (
        <Stagger className="space-y-4" staggerDelay={0.1} initialDelay={0.15}>
          {data.items.map((item, i) => (
            <StaggerItem key={i}>
              <RecommendationCard item={item} index={i}
                onLike={() => toast.success(`Marked "${item.title}" as helpful`)}
                onDislike={() => toast.info("Noted — we'll adjust future suggestions")} />
            </StaggerItem>
          ))}
        </Stagger>
      ) : (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-[#9E9E9E]">No recommendations available yet.</div>
      )}

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }} className="mt-8">
        <FeedbackPanel onSubmit={handleFeedback} isSubmitting={feedbackMutation.isPending} isSubmitted={feedbackSubmitted} />
      </motion.div>
    </div>
  );
}
