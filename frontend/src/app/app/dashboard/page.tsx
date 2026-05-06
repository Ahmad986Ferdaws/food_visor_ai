"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Sparkles, Heart, Dumbbell, AlertTriangle, TrendingUp, Utensils, Clock, ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { HoverLift } from "@/components/motion/HoverLift";
import { useUserStore } from "@/store/userStore";
import { recommendationAPI } from "@/lib/api";

const QUICK_PROMPTS = [
  "High-protein breakfast for muscle gain",
  "Quick healthy lunch under 500 calories",
  "Anti-inflammatory dinner, no dairy",
  "Post-workout snack with complex carbs",
];

export default function DashboardPage() {
  const router = useRouter();
  const user = useUserStore((s) => s.user);
  const preferences = useUserStore((s) => s.preferences);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (msg?: string) => {
    const finalMsg = msg || message;
    if (!finalMsg.trim()) {
      toast.error("Please describe what you're looking for");
      return;
    }

    setLoading(true);
    try {
      const res = await recommendationAPI.create(finalMsg);
      toast.success("Request submitted!");
      setDialogOpen(false);
      setMessage("");
      router.push(`/app/progress/${res.data.request_id}`);
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Failed to submit");
    } finally {
      setLoading(false);
    }
  };

  const displayName = user?.email?.split("@")[0] || "there";

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#F5F5F5] to-[#E8F5E9] px-4 py-8 sm:px-6">
      <div className="mx-auto max-w-7xl">
        {/* Header */}
        <FadeIn>
          <div className="mb-8">
            <h1 className="text-2xl font-bold tracking-tight text-[#212121] sm:text-3xl">
              Welcome back, {displayName}!
            </h1>
            <p className="mt-1 text-[#9E9E9E]">Your personalized nutrition hub</p>
          </div>
        </FadeIn>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Left column */}
          <div className="space-y-6 lg:col-span-2">
            {/* Progress card */}
            <FadeIn delay={0.1}>
              <Card className="border-gray-200 bg-white p-6 shadow-md">
                <div className="mb-4 flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-[#2196F3]" />
                  <h2 className="text-lg font-semibold text-[#212121]">Progress & Goals</h2>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-lg bg-blue-50 p-4 text-center">
                    <p className="text-2xl font-bold text-[#2196F3]">12</p>
                    <p className="text-xs text-[#9E9E9E]">Meals This Week</p>
                  </div>
                  <div className="rounded-lg bg-[#E8F5E9] p-4 text-center">
                    <p className="text-2xl font-bold text-[#4CAF50]">1,850</p>
                    <p className="text-xs text-[#9E9E9E]">Avg. Calories</p>
                  </div>
                  <div className="rounded-lg bg-[#F1F8E9] p-4 text-center">
                    <p className="text-2xl font-bold text-[#8BC34A]">92%</p>
                    <p className="text-xs text-[#9E9E9E]">Goal Match</p>
                  </div>
                </div>
              </Card>
            </FadeIn>

            {/* Track cards */}
            <Stagger className="grid gap-4 sm:grid-cols-2" staggerDelay={0.1} initialDelay={0.2}>
              <StaggerItem>
                <HoverLift>
                  <Card className="border-[#C8E6C9] bg-gradient-to-br from-[#C8E6C9]/30 to-white p-5 shadow-md">
                    <div className="mb-3 flex items-center gap-2">
                      <Heart className="h-5 w-5 text-[#4CAF50]" />
                      <h3 className="font-semibold text-[#212121]">Health Track</h3>
                    </div>
                    {preferences?.goals?.length ? (
                      <div className="space-y-1.5">
                        {preferences.goals.map((goal, i) => (
                          <p key={i} className="text-sm text-[#424242]">• {goal}</p>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#9E9E9E]">Set your health goals in Settings</p>
                    )}
                  </Card>
                </HoverLift>
              </StaggerItem>

              <StaggerItem>
                <HoverLift>
                  <Card className="border-[#C8E6C9] bg-gradient-to-br from-[#C8E6C9]/30 to-white p-5 shadow-md">
                    <div className="mb-3 flex items-center gap-2">
                      <Dumbbell className="h-5 w-5 text-[#4CAF50]" />
                      <h3 className="font-semibold text-[#212121]">Fitness Track</h3>
                    </div>
                    <p className="text-sm text-[#9E9E9E]">Track your fitness nutrition goals</p>
                  </Card>
                </HoverLift>
              </StaggerItem>

              <StaggerItem>
                <HoverLift>
                  <Card className="border-red-200 bg-red-50 p-5 shadow-md sm:col-span-2">
                    <div className="mb-3 flex items-center gap-2">
                      <AlertTriangle className="h-5 w-5 text-[#F44336]" />
                      <h3 className="font-semibold text-[#212121]">Allergy Watch</h3>
                    </div>
                    {preferences?.allergies?.length ? (
                      <div className="flex flex-wrap gap-2">
                        {preferences.allergies.map((allergy, i) => (
                          <span key={i} className="rounded-full border border-red-200 bg-red-100 px-3 py-1 text-xs font-medium text-[#F44336]">
                            ⚠️ {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-[#9E9E9E]">No allergies registered — update in Settings</p>
                    )}
                  </Card>
                </HoverLift>
              </StaggerItem>
            </Stagger>

            {/* Recent activity */}
            <FadeIn delay={0.4}>
              <Card className="border-gray-200 bg-white p-5 shadow-md">
                <div className="mb-4 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-5 w-5 text-[#9E9E9E]" />
                    <h3 className="font-semibold text-[#212121]">Recent Requests</h3>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => router.push("/app/history")} className="text-xs text-[#9E9E9E]">
                    View All <ArrowRight className="ml-1 h-3 w-3" />
                  </Button>
                </div>
                <p className="text-sm text-[#9E9E9E]">Your recent recommendation requests will appear here</p>
              </Card>
            </FadeIn>
          </div>

          {/* Right column */}
          <div className="space-y-6">
            <FadeIn delay={0.2}>
              <Card className="border-gray-200 bg-white p-5 shadow-md">
                <div className="mb-4 flex items-center gap-2">
                  <Utensils className="h-5 w-5 text-[#4CAF50]" />
                  <h3 className="font-semibold text-[#212121]">Quick Requests</h3>
                </div>
                <div className="space-y-2">
                  {QUICK_PROMPTS.map((prompt) => (
                    <button
                      key={prompt}
                      onClick={() => handleSubmit(prompt)}
                      disabled={loading}
                      className="w-full rounded-lg border border-gray-200 bg-[#F5F5F5] p-3 text-left text-sm text-[#424242] transition-colors hover:border-[#4CAF50] hover:bg-[#E8F5E9] hover:text-[#1B5E20]"
                    >
                      {prompt}
                    </button>
                  ))}
                </div>
              </Card>
            </FadeIn>

            <FadeIn delay={0.3}>
              <Button
                onClick={() => setDialogOpen(true)}
                size="lg"
                className="w-full bg-[#4CAF50] py-6 text-base font-semibold text-white shadow-lg shadow-[#4CAF50]/20 hover:bg-[#1B5E20]"
              >
                <Sparkles className="mr-2 h-5 w-5" />
                Make a Request
              </Button>
            </FadeIn>

            <FadeIn delay={0.35}>
              <Button
                variant="outline"
                onClick={() => router.push("/app/new")}
                className="w-full border-[#4CAF50] text-[#4CAF50] hover:bg-[#C8E6C9]"
              >
                Detailed Request Form
              </Button>
            </FadeIn>
          </div>
        </div>
      </div>

      {/* Quick request dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="border-gray-200 bg-white text-[#212121] sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-[#212121]">What are you looking for?</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea
              placeholder="E.g., High-protein lunch for weight management, no shellfish..."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="min-h-[120px] border-gray-300 bg-white text-[#212121]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)} className="border-gray-300 text-[#424242]">
                Cancel
              </Button>
              <Button onClick={() => handleSubmit()} disabled={loading} className="bg-[#4CAF50] text-white hover:bg-[#1B5E20]">
                {loading ? "Submitting..." : "Submit Request"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
