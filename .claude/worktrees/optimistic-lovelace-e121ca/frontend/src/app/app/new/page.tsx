"use client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { FadeIn } from "@/components/motion/FadeIn";
import { RecommendationForm, type RecommendationFormData } from "@/components/features/RecommendationForm";
import { useCreateRecommendation } from "@/hooks/useApi";
import { useAppStore } from "@/store/useAppStore";

export default function NewRecommendationPage() {
  const router = useRouter();
  const mutation = useCreateRecommendation();
  const defaultRestrictions = useAppStore((s) => s.preferences.defaultRestrictions);

  const handleSubmit = async (data: RecommendationFormData) => {
    try {
      const result = await mutation.mutateAsync({
        message: data.message,
        context_override: { goal: data.goal, restrictions: data.restrictions, preferences: data.preferences },
      });
      toast.success("Pipeline started!", { description: "Your recommendation request is being processed." });
      router.push(`/app/progress/${result.request_id}`);
    } catch {
      toast.error("Failed to start pipeline", { description: "Please try again." });
    }
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#212121] dark:text-white sm:text-3xl">New Recommendation</h1>
          <p className="mt-2 text-[#9E9E9E]">Tell us what you&apos;re looking for, and our AI agents will find the perfect options for you.</p>
        </div>
      </FadeIn>
      <RecommendationForm onSubmit={handleSubmit} isSubmitting={mutation.isPending} defaultRestrictions={defaultRestrictions} />
    </div>
  );
}
