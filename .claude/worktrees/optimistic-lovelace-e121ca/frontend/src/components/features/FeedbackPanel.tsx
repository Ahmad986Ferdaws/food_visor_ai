"use client";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, MessageSquare, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface FeedbackPanelProps {
  onSubmit: (data: { rating: number; comment?: string }) => void;
  isSubmitting?: boolean;
  isSubmitted?: boolean;
}

export function FeedbackPanel({ onSubmit, isSubmitting, isSubmitted }: FeedbackPanelProps) {
  const [rating, setRating] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [comment, setComment] = useState("");
  const [showComment, setShowComment] = useState(false);

  if (isSubmitted) {
    return (
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-2 rounded-lg border border-[#C8E6C9] bg-[#E8F5E9] p-4">
        <CheckCircle2 className="h-4 w-4 text-[#4CAF50]" />
        <p className="text-sm text-[#4CAF50]">Thanks for your feedback!</p>
      </motion.div>
    );
  }

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-5 shadow-md">
      <p className="text-sm font-medium text-[#212121]">How helpful were these recommendations?</p>
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <button key={star} onMouseEnter={() => setHoveredStar(star)} onMouseLeave={() => setHoveredStar(0)} onClick={() => setRating(star)}
            className="p-0.5 transition-transform hover:scale-110" aria-label={`Rate ${star} stars`}>
            <Star className={cn("h-6 w-6 transition-colors", (hoveredStar || rating) >= star ? "fill-[#4CAF50] text-[#4CAF50]" : "text-gray-300")} />
          </button>
        ))}
        {rating > 0 && <span className="ml-2 text-xs text-[#9E9E9E]">{rating === 5 ? "Excellent!" : rating === 4 ? "Great" : rating === 3 ? "Good" : rating === 2 ? "Fair" : "Poor"}</span>}
      </div>

      <AnimatePresence>
        {!showComment && rating > 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <Button variant="ghost" size="sm" onClick={() => setShowComment(true)} className="text-xs text-[#9E9E9E]">
              <MessageSquare className="h-3 w-3 mr-1" /> Add a comment
            </Button>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showComment && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}>
            <Textarea placeholder="Tell us more..." value={comment} onChange={(e) => setComment(e.target.value)}
              className="min-h-[80px] resize-none border-gray-300 bg-white text-[#212121]" />
          </motion.div>
        )}
      </AnimatePresence>

      {rating > 0 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button onClick={() => onSubmit({ rating, comment: comment || undefined })} disabled={isSubmitting} size="sm"
            className="bg-[#4CAF50] text-white hover:bg-[#1B5E20]">
            <Send className="h-3.5 w-3.5 mr-1.5" />
            {isSubmitting ? "Submitting..." : "Submit Feedback"}
          </Button>
        </motion.div>
      )}
    </div>
  );
}
