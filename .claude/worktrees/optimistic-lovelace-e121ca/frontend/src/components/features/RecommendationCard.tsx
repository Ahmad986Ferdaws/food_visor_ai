"use client";
import { motion } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Sparkles, ThumbsUp, ThumbsDown, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { HoverLift } from "@/components/motion/HoverLift";
import type { RecommendationItem } from "@/types/api";
import { useState } from "react";

interface RecommendationCardProps {
  item: RecommendationItem;
  index: number;
  onLike?: () => void;
  onDislike?: () => void;
}

export function RecommendationCard({ item, index, onLike, onDislike }: RecommendationCardProps) {
  const [expanded, setExpanded] = useState(false);
  const confidenceColor = item.confidence >= 0.9
    ? "text-[#4CAF50] bg-[#E8F5E9] border-[#C8E6C9]"
    : item.confidence >= 0.8
    ? "text-[#8BC34A] bg-[#F1F8E9] border-[#DCEDC8]"
    : "text-[#FFC107] bg-amber-50 border-amber-200";

  return (
    <HoverLift>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.1, duration: 0.4 }}>
        <Card className="group relative overflow-hidden border-gray-200 bg-white shadow-md transition-colors hover:border-[#4CAF50]/30">
          <div className="absolute left-0 top-0 h-full w-1 rounded-l-xl bg-gradient-to-b from-[#4CAF50] to-[#8BC34A]" style={{ opacity: item.confidence }} />

          <div className="p-6 pl-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <Sparkles className="h-4 w-4 text-[#4CAF50] shrink-0" />
                  <h3 className="text-base font-semibold tracking-tight text-[#212121] truncate">{item.title}</h3>
                </div>
                <p className="text-sm text-[#424242] leading-relaxed">{item.description}</p>
              </div>
              <Badge variant="outline" className={cn("shrink-0 tabular-nums font-mono text-xs", confidenceColor)}>
                {Math.round(item.confidence * 100)}%
              </Badge>
            </div>

            {item.tags && item.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {item.tags.map((tag) => (
                  <Badge key={tag} variant="outline" className="text-xs font-normal border-gray-200 text-[#9E9E9E]">
                    {tag}
                  </Badge>
                ))}
              </div>
            )}

            {item.reasoning && (
              <div className="mt-3">
                <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs font-medium text-[#4CAF50] hover:text-[#1B5E20] transition-colors">
                  <ChevronDown className={cn("h-3 w-3 transition-transform", expanded && "rotate-180")} />
                  Why this fits you
                </button>
                {expanded && (
                  <motion.p initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                    className="mt-2 text-xs text-[#424242] bg-[#F5F5F5] rounded-lg p-3 leading-relaxed">
                    {item.reasoning}
                  </motion.p>
                )}
              </div>
            )}

            <div className="mt-4 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="sm" onClick={onLike} className="h-8 text-xs text-[#9E9E9E] hover:text-[#4CAF50]">
                <ThumbsUp className="h-3.5 w-3.5 mr-1" /> Helpful
              </Button>
              <Button variant="ghost" size="sm" onClick={onDislike} className="h-8 text-xs text-[#9E9E9E] hover:text-[#F44336]">
                <ThumbsDown className="h-3.5 w-3.5 mr-1" /> Not relevant
              </Button>
            </div>
          </div>
        </Card>
      </motion.div>
    </HoverLift>
  );
}
