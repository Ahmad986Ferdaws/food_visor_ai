"use client";
import { cn } from "@/lib/utils";

function SkeletonPulse({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded-md bg-muted", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="space-y-3 rounded-xl border border-border/50 bg-card p-6">
      <SkeletonPulse className="h-5 w-3/4" />
      <SkeletonPulse className="h-4 w-full" />
      <SkeletonPulse className="h-4 w-5/6" />
      <div className="flex gap-2 pt-2">
        <SkeletonPulse className="h-6 w-16 rounded-full" />
        <SkeletonPulse className="h-6 w-20 rounded-full" />
      </div>
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-4">
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
