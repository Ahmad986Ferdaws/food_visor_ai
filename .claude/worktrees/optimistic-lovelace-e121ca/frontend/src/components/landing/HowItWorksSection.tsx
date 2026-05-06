"use client";

import { motion } from "framer-motion";

const steps = [
  { n: "01", title: "Tell us about you", desc: "Goals, allergies, what you love and hate." },
  { n: "02", title: "We analyze", desc: "The pipeline runs in seconds, not hours." },
  { n: "03", title: "You eat well", desc: "Personalized meals, recipes, and grocery lists." },
];

export function HowItWorksSection() {
  return (
    <section className="relative min-h-screen w-full bg-white dark:bg-black flex items-center justify-center px-6 py-24">
      <div className="max-w-5xl w-full">
        <motion.h2
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6 }}
          className="text-4xl md:text-6xl font-bold text-center text-gray-900 dark:text-white mb-20"
        >
          How It Works
        </motion.h2>
        <div className="space-y-16">
          {steps.map((s, i) => (
            <motion.div
              key={s.n}
              initial={{ opacity: 0, x: i % 2 === 0 ? -40 : 40 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, amount: 0.4 }}
              transition={{ duration: 0.6 }}
              className="flex flex-col md:flex-row items-start md:items-center gap-6 md:gap-12"
            >
              <div className="text-6xl md:text-8xl font-bold text-[#4CAF50]/20">{s.n}</div>
              <div>
                <h3 className="text-2xl md:text-3xl font-semibold text-gray-900 dark:text-white mb-2">
                  {s.title}
                </h3>
                <p className="text-lg text-gray-600 dark:text-gray-400">{s.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
