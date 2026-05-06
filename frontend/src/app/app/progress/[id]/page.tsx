"use client";
import { useParams, useRouter } from "next/navigation";
import { useEffect } from "react";
import dynamic from "next/dynamic";
import { motion } from "framer-motion";
import { ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/FadeIn";
import { OrchestrationStepper } from "@/components/features/OrchestrationStepper";
import { StatusBadge } from "@/components/features/StatusBadge";
import { useRecommendation } from "@/hooks/useApi";
import { ErrorState } from "@/components/states/ErrorState";

const Pipeline3DController = dynamic(
  () => import("@/components/three/Pipeline3DController").then((m) => ({ default: m.Pipeline3DController })),
  { ssr: false }
);

export default function ProgressPage() {
  const params = useParams();
  const router = useRouter();
  const requestId = params.id as string;
  const { data, isLoading, isError, refetch } = useRecommendation(requestId, true);
  const status = data?.status ?? "queued";
  const isComplete = status === "completed";
  const isFailed = status === "failed";

  if (isLoading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#4CAF50]" />
      </div>
    );
  }

  if (isError) {
    return <div className="mx-auto max-w-2xl px-4 py-12"><ErrorState onRetry={() => refetch()} /></div>;
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <FadeIn>
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121] dark:text-white">Pipeline Progress</h1>
            <p className="mt-1 text-sm text-[#9E9E9E] font-mono">{requestId.slice(0, 8)}...</p>
          </div>
          <StatusBadge status={status} />
        </div>
      </FadeIn>

      <FadeIn delay={0.1}>
        <div className="mb-8 overflow-hidden rounded-2xl border border-gray-200 bg-gradient-to-br from-[#1B5E20] to-[#212121] dark:border-white/10">
          <Pipeline3DController status={status} />
        </div>
      </FadeIn>

      <FadeIn delay={0.2}>
        <OrchestrationStepper status={status} />
      </FadeIn>

      {/* Progress bar */}
      <FadeIn delay={0.3}>
        <div className="mt-6">
          <div className="h-2 rounded-full bg-gray-200 dark:bg-white/10 overflow-hidden">
            <motion.div className="h-full bg-[#4CAF50] rounded-full" initial={{ width: "0%" }}
              animate={{ width: status === "queued" ? "5%" : status === "running_agent1" ? "30%" : status === "running_agent2" ? "55%" : status === "running_agent3" ? "80%" : status === "completed" ? "100%" : "100%" }}
              transition={{ duration: 0.5 }} />
          </div>
        </div>
      </FadeIn>

      {isComplete && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <Button onClick={() => router.push(`/app/result/${requestId}`)} size="lg"
            className="w-full bg-[#4CAF50] text-white font-semibold hover:bg-[#1B5E20] shadow-lg shadow-[#4CAF50]/20">
            View Recommendations <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </motion.div>
      )}

      {isFailed && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-8">
          <Button onClick={() => router.push("/app/new")} variant="outline" size="lg" className="w-full border-[#F44336] text-[#F44336]">
            Try Again
          </Button>
        </motion.div>
      )}
    </div>
  );
}
