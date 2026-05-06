"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform } from "framer-motion";
import { ChevronDown } from "lucide-react";

const FRAME_COUNT = 84;
const framePath = (i: number, retina: boolean) =>
  `/hero/frames${retina ? "@2x" : ""}/frame_${String(i + 1).padStart(3, "0")}.jpg`;

function usePrefersReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);
  return reduced;
}

function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const check = () => setMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);
  return mobile;
}

export function ScrollHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [mounted, setMounted] = useState(false);

  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  const tag1Opacity = useTransform(scrollYProgress, [0.0, 0.05, 0.15, 0.2], [0, 1, 1, 0]);
  const tag2Opacity = useTransform(scrollYProgress, [0.25, 0.3, 0.45, 0.5], [0, 1, 1, 0]);
  const tag3Opacity = useTransform(scrollYProgress, [0.55, 0.6, 0.8, 0.85], [0, 1, 1, 0]);
  const tag4Opacity = useTransform(scrollYProgress, [0.9, 0.95, 1.0], [0, 1, 1]);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || reducedMotion || isMobile) return;
    const retina = window.devicePixelRatio >= 1.5;
    const imgs: HTMLImageElement[] = [];
    let count = 0;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = framePath(i, retina);
      img.onload = () => {
        count++;
        setLoaded(count);
        if (i === 0) {
          const canvas = canvasRef.current;
          if (canvas) {
            const ctx = canvas.getContext("2d");
            if (ctx) {
              canvas.width = img.naturalWidth;
              canvas.height = img.naturalHeight;
              ctx.drawImage(img, 0, 0);
            }
          }
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;
  }, [mounted, reducedMotion, isMobile]);

  useEffect(() => {
    if (!mounted || reducedMotion || isMobile) return;
    let rafId = 0;
    const unsubscribe = scrollYProgress.on("change", (p) => {
      const frameIdx = Math.min(FRAME_COUNT - 1, Math.floor(p * FRAME_COUNT));
      const img = imagesRef.current[frameIdx];
      const canvas = canvasRef.current;
      if (!img || !canvas || !img.complete) return;
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(() => {
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        if (canvas.width !== img.naturalWidth) canvas.width = img.naturalWidth;
        if (canvas.height !== img.naturalHeight) canvas.height = img.naturalHeight;
        ctx.drawImage(img, 0, 0);
      });
    });
    return () => {
      cancelAnimationFrame(rafId);
      unsubscribe();
    };
  }, [scrollYProgress, mounted, reducedMotion, isMobile]);

  if (mounted && (reducedMotion || isMobile)) {
    return (
      <section className="relative min-h-screen w-full bg-white dark:bg-black flex flex-col items-center justify-center px-6 py-16">
        <img
          src="/hero/poster.jpg"
          alt="FoodVisor AI"
          className="w-full max-w-3xl rounded-xl shadow-lg"
        />
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Meet FoodVisor AI
          </h1>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">
            Your nutrition, intelligently personalized.
          </p>
          <p className="text-base md:text-lg text-[#4CAF50] font-medium">
            Three agents. One perfect meal.
          </p>
        </div>
      </section>
    );
  }

  return (
    <section ref={containerRef} className="relative w-full" style={{ height: "300vh" }}>
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-white dark:bg-black">
        <canvas
          ref={canvasRef}
          className="absolute inset-0 h-full w-full object-cover"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        {mounted && loaded < 12 && (
          <div className="absolute inset-0 flex items-center justify-center bg-white dark:bg-black">
            <p className="text-sm text-gray-500">
              Loading {loaded}/{FRAME_COUNT}
            </p>
          </div>
        )}

        <motion.div
          style={{ opacity: tag1Opacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <h1 className="text-5xl md:text-7xl font-bold text-gray-900 dark:text-white drop-shadow-lg">
            Meet FoodVisor AI
          </h1>
        </motion.div>

        <motion.div
          style={{ opacity: tag2Opacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none px-6"
        >
          <h2 className="text-3xl md:text-5xl font-semibold text-center text-gray-900 dark:text-white drop-shadow-lg max-w-4xl">
            Your nutrition, intelligently personalized
          </h2>
        </motion.div>

        <motion.div
          style={{ opacity: tag3Opacity }}
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
        >
          <h2 className="text-4xl md:text-6xl font-bold text-[#4CAF50] drop-shadow-lg text-center">
            Three agents. One perfect meal.
          </h2>
        </motion.div>

        <motion.div
          style={{ opacity: tag4Opacity }}
          className="absolute bottom-16 left-0 right-0 flex flex-col items-center gap-3 pointer-events-none"
        >
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300">Scroll to begin</p>
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <ChevronDown className="h-6 w-6 text-[#4CAF50]" />
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
