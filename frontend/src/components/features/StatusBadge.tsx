"use client";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, XCircle, Clock, Brain, Search, Shield } from "lucide-react";
import type { PipelineStatus } from "@/types/api";

const statusConfig: Record<PipelineStatus, {
  label: string; className: string; icon: React.ReactNode;
}> = {
  queued: { label: "Queued", className: "border-gray-300 bg-gray-100 text-[#9E9E9E]", icon: <Clock className="h-3 w-3" /> },
  running_agent1: { label: "Building Context", className: "border-[#C8E6C9] bg-[#E8F5E9] text-[#1B5E20]", icon: <Brain className="h-3 w-3 animate-pulse" /> },
  running_agent2: { label: "Generating", className: "border-[#C8E6C9] bg-[#E8F5E9] text-[#4CAF50]", icon: <Search className="h-3 w-3 animate-pulse" /> },
  running_agent3: { label: "Validating", className: "border-[#C8E6C9] bg-[#E8F5E9] text-[#8BC34A]", icon: <Shield className="h-3 w-3 animate-pulse" /> },
  completed: { label: "Completed", className: "border-[#C8E6C9] bg-[#E8F5E9] text-[#4CAF50]", icon: <CheckCircle2 className="h-3 w-3" /> },
  failed: { label: "Failed", className: "border-red-200 bg-red-50 text-[#F44336]", icon: <XCircle className="h-3 w-3" /> },
};

export function StatusBadge({ status, className: extraClass }: { status: PipelineStatus; className?: string }) {
  const config = statusConfig[status];
  return (
    <Badge variant="outline" className={cn("gap-1.5 font-medium", config.className, extraClass)}>
      {config.icon}
      {config.label}
    </Badge>
  );
}
