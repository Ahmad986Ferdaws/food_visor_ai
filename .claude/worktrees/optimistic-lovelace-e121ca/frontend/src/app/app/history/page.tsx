"use client";
import { useRouter } from "next/navigation";
import { Clock, ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FadeIn } from "@/components/motion/FadeIn";
import { Stagger, StaggerItem } from "@/components/motion/Stagger";
import { StatusBadge } from "@/components/features/StatusBadge";
import { HoverLift } from "@/components/motion/HoverLift";
import { EmptyState } from "@/components/states/EmptyState";
import { SkeletonList } from "@/components/states/SkeletonState";
import { ErrorState } from "@/components/states/ErrorState";
import { useHistory } from "@/hooks/useApi";
import Link from "next/link";

export default function HistoryPage() {
  const router = useRouter();
  const { data: history, isLoading, isError, refetch } = useHistory();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12">
      <FadeIn>
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-[#212121] dark:text-white sm:text-3xl">Request History</h1>
            <p className="mt-1 text-[#9E9E9E]">Your previous recommendation requests and their status.</p>
          </div>
          <Link href="/app/new">
            <Button size="sm" className="bg-[#4CAF50] text-white hover:bg-[#1B5E20]">
              <Sparkles className="h-3.5 w-3.5 mr-1.5" /> New Request
            </Button>
          </Link>
        </div>
      </FadeIn>

      {isLoading && <SkeletonList count={3} />}
      {isError && <ErrorState onRetry={() => refetch()} />}

      {history && history.length === 0 && (
        <EmptyState title="No requests yet" description="Start your first recommendation to see it here."
          action={<Link href="/app/new"><Button className="bg-[#4CAF50] text-white hover:bg-[#1B5E20]"><Sparkles className="h-3.5 w-3.5 mr-1.5" /> Get Started</Button></Link>} />
      )}

      {history && history.length > 0 && (
        <Stagger className="space-y-3" staggerDelay={0.08}>
          {history.map((item) => (
            <StaggerItem key={item.request_id}>
              <HoverLift>
                <button
                  onClick={() => router.push(item.status === "completed" || item.status === "failed" ? `/app/result/${item.request_id}` : `/app/progress/${item.request_id}`)}
                  className="w-full rounded-xl border border-gray-200 bg-white p-5 text-left shadow-sm transition-colors hover:border-[#4CAF50]/30 hover:shadow-md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-[#212121] truncate">{item.message}</p>
                      <div className="mt-2 flex items-center gap-3 text-xs text-[#9E9E9E]">
                        <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{new Date(item.created_at).toLocaleString()}</span>
                        {item.items_count > 0 && <span>{item.items_count} recommendations</span>}
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <StatusBadge status={item.status} />
                      <ArrowRight className="h-4 w-4 text-[#9E9E9E]" />
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
