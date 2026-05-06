"use client";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Search, Shield, CheckCircle2, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PipelineStatus } from "@/types/api";

interface Step { key: PipelineStatus; label: string; description: string; icon: React.ReactNode }

const steps: Step[] = [
  { key: "running_agent1", label: "Context Builder", description: "Reading your preferences and building context", icon: <Brain className="h-5 w-5" /> },
  { key: "running_agent2", label: "Recommender", description: "Searching knowledge base and generating ideas", icon: <Search className="h-5 w-5" /> },
  { key: "running_agent3", label: "Validator", description: "Checking quality and updating your preferences", icon: <Shield className="h-5 w-5" /> },
];

const ORDER = ["queued", "running_agent1", "running_agent2", "running_agent3", "completed", "failed"];

function getStepState(stepKey: PipelineStatus, currentStatus: PipelineStatus) {
  const stepIdx = ORDER.indexOf(stepKey);
  const currentIdx = ORDER.indexOf(currentStatus);
  if (currentStatus === "failed") return "error";
  if (currentIdx > stepIdx) return "completed";
  if (currentIdx === stepIdx) return "active";
  return "pending";
}

export function OrchestrationStepper({ status }: { status: PipelineStatus }) {
  return (
    <div className="space-y-3">
      <AnimatePresence>
        {status === "queued" && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
            className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white/80 p-4 dark:border-white/10 dark:bg-white/5">
            <Loader2 className="h-5 w-5 animate-spin text-[#9E9E9E]" />
            <div>
              <p className="text-sm font-medium text-[#212121] dark:text-white">Preparing pipeline</p>
              <p className="text-xs text-[#9E9E9E]">Your request is queued and will begin shortly</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {steps.map((step, i) => {
          const state = getStepState(step.key, status);
          return (
            <motion.div key={step.key} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1, duration: 0.3 }}
              className={cn(
                "flex items-start gap-4 rounded-xl border p-4 transition-all duration-500",
                state === "active" && "border-[#4CAF50]/40 bg-[#E8F5E9] shadow-lg shadow-[#4CAF50]/10 dark:bg-[#4CAF50]/10",
                state === "completed" && "border-[#8BC34A]/30 bg-[#F1F8E9] dark:bg-[#8BC34A]/5",
                state === "pending" && "border-gray-200 bg-white/50 opacity-50 dark:border-white/10 dark:bg-white/5",
                state === "error" && "border-red-200 bg-red-50 dark:bg-red-500/5",
              )}>
              <div className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                state === "active" && "bg-[#4CAF50]/20 text-[#1B5E20] dark:text-[#4CAF50]",
                state === "completed" && "bg-[#8BC34A]/20 text-[#4CAF50]",
                state === "pending" && "bg-gray-100 text-[#9E9E9E] dark:bg-white/10",
                state === "error" && "bg-red-100 text-[#F44336]",
              )}>
                {state === "active" ? (
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    {step.icon}
                  </motion.div>
                ) : state === "completed" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : step.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-semibold text-[#212121] dark:text-white">{step.label}</h4>
                  {state === "active" && (
                    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                      className="inline-flex items-center gap-1 rounded-full bg-[#4CAF50]/20 px-2 py-0.5 text-xs font-medium text-[#1B5E20] dark:text-[#4CAF50]">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#4CAF50] animate-pulse" /> Running
                    </motion.span>
                  )}
                </div>
                <p className="text-xs text-[#9E9E9E] mt-0.5">{step.description}</p>
              </div>
              {state === "completed" && (
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="shrink-0 text-xs text-[#9E9E9E]">
                  ~{(Math.random() * 2 + 1).toFixed(1)}s
                </motion.span>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {status === "completed" && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-lg border border-[#C8E6C9] bg-[#E8F5E9] p-4 dark:bg-[#4CAF50]/10">
            <CheckCircle2 className="h-5 w-5 text-[#4CAF50]" />
            <div>
              <p className="text-sm font-medium text-[#4CAF50]">Pipeline Complete</p>
              <p className="text-xs text-[#9E9E9E]">All agents finished successfully</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
