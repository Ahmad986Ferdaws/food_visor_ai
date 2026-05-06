"use client";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface HoverLiftProps {
  children: React.ReactNode;
  className?: string;
  lift?: number;
}

export function HoverLift({ children, className, lift = -4 }: HoverLiftProps) {
  return (
    <motion.div
      whileHover={{ y: lift, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={cn(className)}
    >
      {children}
    </motion.div>
  );
}
