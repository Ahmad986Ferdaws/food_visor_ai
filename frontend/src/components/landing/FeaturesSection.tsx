"use client";

import { motion } from "framer-motion";
import { Brain, Sparkles, Utensils } from "lucide-react";

const agents = [
  {
    icon: Brain,
    title: "The Analyst",
    desc: "Reads your goals, allergies, and history to build a precise nutritional profile.",
  },
  {
    icon: Sparkles,
    title: "The Curator",
    desc: "Searches thousands of recipes, scoring each against your unique requirements.",
  },
  {
    icon: Utensils,
    title: "The Chef",
    desc: "Composes balanced, delicious meals tailored to what's in your kitchen right now.",
  },
];

export function FeaturesSection() {
  return (
    <section className="relative min-h-screen w-full bg-gray-50 dark:bg-[#0a0a0a] flex items-center justify-center px-6 py-24">
      <div className="max-w-6xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold text-center text-gray-900 dark:text-white mb-4"
        >
          Three Agents, Working Together
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="text-lg md:text-xl text-center text-gray-600 dark:text-gray-400 mb-16 max-w-2xl mx-auto"
        >
          FoodVisor AI orchestrates a pipeline of specialists, each focused on what it does best.
        </motion.p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {agents.map((a, i) => {
            const Icon = a.icon;
            return (
              <motion.div
                key={a.title}
                initial={{ opacity: 0, y: 32 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, amount: 0.3 }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="rounded-2xl bg-white dark:bg-[#161616] p-8 shadow-sm border border-gray-100 dark:border-gray-800"
              >
                <div className="h-12 w-12 rounded-xl bg-[#4CAF50]/10 flex items-center justify-center mb-5">
                  <Icon className="h-6 w-6 text-[#4CAF50]" />
                </div>
                <h3 className="text-2xl font-semibold text-gray-900 dark:text-white mb-2">
                  {a.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400">{a.desc}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
