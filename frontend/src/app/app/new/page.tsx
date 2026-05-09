"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { motion } from "framer-motion";
import { Sparkles } from "lucide-react";
import { RecommendationForm, type RecommendationFormData } from "@/components/features/RecommendationForm";
import { useCreateRecommendation } from "@/hooks/useApi";
import { useAppStore } from "@/store/useAppStore";
import { cn } from "@/lib/utils";

const GLASS = "rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

export default function NewRecommendationPage() {
  const router = useRouter();
  const mutation = useCreateRecommendation();
  const defaultRestrictions = useAppStore((s) => s.preferences.defaultRestrictions);

  const handleSubmit = async (data: RecommendationFormData) => {
    try {
      const result = await mutation.mutateAsync({
        message: data.message,
        context_override: {
          goal: data.goal,
          restrictions: data.restrictions,
          preferences: data.preferences,
          ...(data.photo_data_url
            ? { photo_data_url: data.photo_data_url, photo_filename: data.photo_filename }
            : {}),
        },
      });
      toast.success("Pipeline started!", { description: "Your recommendation request is being processed." });
      router.push(`/app/progress/${result.request_id}`);
    } catch {
      toast.error("Failed to start pipeline", { description: "Please try again." });
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">New Recommendation</h1>
          <p className="mt-1 text-sm text-slate-500">
            Tell our three agents what you&apos;re craving — they&apos;ll handle the rest.
          </p>
        </div>
        <div className="hidden h-12 w-12 items-center justify-center rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.08)] sm:flex">
          <Sparkles className="h-5 w-5 text-[#4CAF50]" />
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className={cn(GLASS, "p-6 sm:p-8")}
      >
        <RecommendationForm
          onSubmit={handleSubmit}
          isSubmitting={mutation.isPending}
          defaultRestrictions={defaultRestrictions}
        />
      </motion.div>
    </div>
  );
}
