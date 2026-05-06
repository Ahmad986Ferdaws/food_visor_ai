"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function CTASection() {
  return (
    <section className="relative min-h-screen w-full bg-gradient-to-br from-[#1B5E20] via-[#212121] to-black flex items-center justify-center px-6 py-24">
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        transition={{ duration: 0.7 }}
        className="text-center max-w-3xl"
      >
        <h2 className="text-5xl md:text-7xl font-bold text-white mb-6">Ready to eat smarter?</h2>
        <p className="text-lg md:text-xl text-gray-300 mb-12">
          Join FoodVisor AI and let three agents handle the hard part of nutrition.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4CAF50] hover:bg-[#43A047] text-white px-8 py-4 text-lg font-semibold transition-colors"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/20 hover:bg-white/5 text-white px-8 py-4 text-lg font-semibold transition-colors"
          >
            Sign In
          </Link>
        </div>
      </motion.div>
    </section>
  );
}
