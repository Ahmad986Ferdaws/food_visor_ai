"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface GlowPulseProps {
  children: React.ReactNode;
  className?: string;
  color?: string;
  active?: boolean;
}

export function GlowPulse({ children, className, color = "rgba(99,102,241,0.4)", active = true }: GlowPulseProps) {
  return (
    <motion.div
      className={cn("relative", className)}
      animate={active ? { boxShadow: [`0 0 20px 0 ${color}`, `0 0 40px 8px ${color}`, `0 0 20px 0 ${color}`] } : {}}
      transition={active ? { duration: 2, repeat: Infinity, ease: "easeInOut" } : {}}
    >
      {children}
    </motion.div>
  );
}
