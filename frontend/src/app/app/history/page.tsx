"use client";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { motion } from "framer-motion";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { StatusBadge } from "@/components/features/StatusBadge";
import { HoverLift } from "@/components/motion/HoverLift";
import { EmptyState } from "@/components/states/EmptyState";
import { SkeletonList } from "@/components/states/SkeletonState";
import { ErrorState } from "@/components/states/ErrorState";
import { useHistory } from "@/hooks/useApi";
import { cn } from "@/lib/utils";

const GLASS = "rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

export default function HistoryPage() {
  const router = useRouter();
  const { data: history, isLoading, isError, refetch } = useHistory();

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6 flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Request History</h1>
          <p className="mt-1 text-sm text-slate-500">
            Your previous recommendations and pipeline runs.
          </p>
        </div>
        <Link href="/app/new">
          <Button size="sm" className="bg-[#4CAF50] text-white hover:bg-[#43A047] shadow-sm shadow-[#4CAF50]/30">
            <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New Request
          </Button>
        </Link>
      </motion.div>

      {isLoading && <SkeletonList count={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {history && history.length === 0 && (
        <div className={cn(GLASS, "p-12")}>
          <EmptyState
            title="No requests yet"
            description="Start your first recommendation to see it here."
            action={
              <Link href="/app/new">
                <Button className="bg-[#4CAF50] text-white hover:bg-[#43A047]">
                  <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Get Started
                </Button>
              </Link>
            }
          />
        </div>
      )}

      {history && history.length > 0 && (
        <Stagger className="space-y-3" staggerDelay={0.06}>
          {history.map((item) => (
            <StaggerItem key={item.request_id}>
              <HoverLift>
                <button
                  onClick={() =>
                    router.push(
                      item.status === "completed" || item.status === "failed"
                        ? `/app/result/${item.request_id}`
                        : `/app/progress/${item.request_id}`,
                    )
                  }
                  className={cn(
                    GLASS,
                    "w-full p-5 text-left hover:bg-white/80 hover:border-[#4CAF50]/40 transition-all",
                  )}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium text-slate-800">{item.message}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {new Date(item.created_at).toLocaleString()}
                        </span>
                        {item.items_count > 0 && <span>{item.items_count} recommendations</span>}
                      </div>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={item.status} />
                      <ArrowRight className="h-4 w-4 text-slate-400" />
                    </div>
                  </div>
                </button>
              </HoverLift>
            </StaggerItem>
          ))}
        </Stagger>
      )}
    </div>
  );
}
