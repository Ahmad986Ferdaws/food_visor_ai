"use client";

import { useEffect, useRef, useState } from "react";
import { motion, useScroll, useTransform, MotionValue } from "framer-motion";
import {
  Brain,
  Sparkles,
  Utensils,
  ChevronDown,
  ArrowRight,
} from "lucide-react";
import Link from "next/link";

const FRAME_COUNT = 191;
const SCROLL_VH = 750;

const avifPath = (i: number) =>
  `/hero/frames/${String(i + 1).padStart(3, "0")}.avif`;
const jpgPath = (i: number) =>
  `/hero/frames-jpg/${String(i + 1).padStart(3, "0")}.jpg`;

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
  const [m, setM] = useState(false);
  useEffect(() => {
    const c = () => setM(window.innerWidth < 768);
    c();
    window.addEventListener("resize", c);
    return () => window.removeEventListener("resize", c);
  }, []);
  return m;
}

async function detectAvif(): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src =
      "data:image/avif;base64,AAAAIGZ0eXBhdmlmAAAAAGF2aWZtaWYxbWlhZk1BMUIAAADybWV0YQAAAAAAAAAoaGRscgAAAAAAAAAAcGljdAAAAAAAAAAAAAAAAGxpYmF2aWYAAAAADnBpdG0AAAAAAAEAAAAeaWxvYwAAAABEAAABAAEAAAABAAABGgAAAB0AAAAoaWluZgAAAAAAAQAAABppbmZlAgAAAAABAABhdjAxQ29sb3IAAAAAamlwcnAAAABLaXBjbwAAABRpc3BlAAAAAAAAAAIAAAACAAAAEHBpeGkAAAAAAwgICAAAAAxhdjFDgQ0MAAAAABNjb2xybmNseAACAAIAAYAAAAAXaXBtYQAAAAAAAAABAAEEAQKDBAAAACVtZGF0EgAKCBgANogQEAwgMg8f8D///8WfhwB8+ErK42A=";
  });
}

interface NarrativeOverlayProps {
  scrollYProgress: MotionValue<number>;
}

function HeroOverlay({ scrollYProgress }: NarrativeOverlayProps) {
  const opacity = useTransform(
    scrollYProgress,
    [0.0, 0.03, 0.12, 0.16],
    [0, 1, 1, 0],
  );
  const y = useTransform(scrollYProgress, [0.0, 0.16], [0, -40]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
    >
      <h1 className="text-6xl md:text-8xl font-bold text-gray-900 dark:text-white tracking-tight text-center drop-shadow-[0_2px_24px_rgba(255,255,255,0.4)]">
        Meet FoodVisor AI
      </h1>
      <p className="mt-6 text-lg md:text-2xl text-gray-700 dark:text-gray-300 text-center max-w-2xl">
        Three intelligent agents. One perfectly personalized plate.
      </p>
    </motion.div>
  );
}

function Tagline2({ scrollYProgress }: NarrativeOverlayProps) {
  const opacity = useTransform(
    scrollYProgress,
    [0.16, 0.2, 0.27, 0.31],
    [0, 1, 1, 0],
  );
  const y = useTransform(scrollYProgress, [0.16, 0.31], [40, -40]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none"
    >
      <h2 className="text-4xl md:text-6xl font-semibold text-center text-gray-900 dark:text-white max-w-5xl tracking-tight drop-shadow-[0_2px_24px_rgba(255,255,255,0.35)]">
        Your nutrition,
        <span className="text-[#4CAF50]"> intelligently personalized.</span>
      </h2>
    </motion.div>
  );
}

function Tagline3({ scrollYProgress }: NarrativeOverlayProps) {
  const opacity = useTransform(
    scrollYProgress,
    [0.31, 0.35, 0.4, 0.44],
    [0, 1, 1, 0],
  );
  const y = useTransform(scrollYProgress, [0.31, 0.44], [40, -40]);
  return (
    <motion.div
      style={{ opacity, y }}
      className="absolute inset-0 flex items-center justify-center px-6 pointer-events-none"
    >
      <h2 className="text-5xl md:text-7xl font-bold text-center tracking-tight">
        <span className="text-gray-900 dark:text-white">Three agents.</span>
        <br />
        <span className="text-[#4CAF50]">One perfect meal.</span>
      </h2>
    </motion.div>
  );
}

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
    desc: "Composes balanced, delicious meals tailored to what's in your kitchen.",
  },
];

function FeaturesOverlay({ scrollYProgress }: NarrativeOverlayProps) {
  const dim = useTransform(
    scrollYProgress,
    [0.44, 0.48, 0.6, 0.64],
    [0, 0.55, 0.55, 0],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0.44, 0.49, 0.6, 0.64],
    [0, 1, 1, 0],
  );
  const y = useTransform(scrollYProgress, [0.44, 0.64], [50, -50]);

  return (
    <>
      <motion.div
        style={{ opacity: dim }}
        className="absolute inset-0 bg-black pointer-events-none"
      />
      <motion.div
        style={{ opacity, y }}
        className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white text-center mb-3 tracking-tight">
          Three Agents, One Pipeline
        </h2>
        <p className="text-base md:text-lg text-gray-300 text-center max-w-2xl mb-10">
          A coordinated team of specialists, each focused on what it does best.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-5xl">
          {agents.map((a) => {
            const Icon = a.icon;
            return (
              <div
                key={a.title}
                className="rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 p-6 shadow-2xl"
              >
                <div className="h-11 w-11 rounded-xl bg-[#4CAF50]/25 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-[#4CAF50]" />
                </div>
                <h3 className="text-xl font-semibold text-white mb-1.5">
                  {a.title}
                </h3>
                <p className="text-sm text-gray-300 leading-relaxed">{a.desc}</p>
              </div>
            );
          })}
        </div>
      </motion.div>
    </>
  );
}

const steps = [
  { n: "01", title: "Tell us about you", desc: "Goals, allergies, what you love and what you don't." },
  { n: "02", title: "We analyze", desc: "The pipeline runs in seconds, not hours." },
  { n: "03", title: "You eat well", desc: "Personalized meals, recipes, and grocery lists." },
];

function HowItWorksOverlay({ scrollYProgress }: NarrativeOverlayProps) {
  const dim = useTransform(
    scrollYProgress,
    [0.64, 0.68, 0.8, 0.84],
    [0, 0.6, 0.6, 0],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0.64, 0.69, 0.8, 0.84],
    [0, 1, 1, 0],
  );
  const y = useTransform(scrollYProgress, [0.64, 0.84], [50, -50]);

  return (
    <>
      <motion.div
        style={{ opacity: dim }}
        className="absolute inset-0 bg-black pointer-events-none"
      />
      <motion.div
        style={{ opacity, y }}
        className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-none"
      >
        <h2 className="text-3xl md:text-5xl font-bold text-white text-center mb-10 tracking-tight">
          How It Works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-5xl w-full">
          {steps.map((s) => (
            <div key={s.n} className="text-center md:text-left">
              <div className="text-5xl md:text-7xl font-bold text-[#4CAF50]/40 mb-2">
                {s.n}
              </div>
              <h3 className="text-xl md:text-2xl font-semibold text-white mb-2">
                {s.title}
              </h3>
              <p className="text-sm md:text-base text-gray-300">{s.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </>
  );
}

function CTAOverlay({ scrollYProgress }: NarrativeOverlayProps) {
  const gradient = useTransform(
    scrollYProgress,
    [0.84, 0.88, 1.0],
    [0, 1, 1],
  );
  const opacity = useTransform(
    scrollYProgress,
    [0.84, 0.9, 1.0],
    [0, 1, 1],
  );
  const y = useTransform(scrollYProgress, [0.84, 1.0], [60, 0]);

  return (
    <>
      <motion.div
        style={{ opacity: gradient }}
        className="absolute inset-0 pointer-events-none bg-gradient-to-br from-[#1B5E20]/90 via-[#212121]/85 to-black/90"
      />
      <motion.div
        style={{ opacity, y }}
        className="absolute inset-0 flex flex-col items-center justify-center px-6 pointer-events-auto"
      >
        <h2 className="text-5xl md:text-7xl font-bold text-white text-center mb-5 tracking-tight">
          Ready to eat smarter?
        </h2>
        <p className="text-lg md:text-xl text-gray-300 text-center max-w-2xl mb-10">
          Join FoodVisor AI and let three agents handle the hard part of nutrition.
        </p>
        <div className="flex flex-col sm:flex-row gap-4">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4CAF50] hover:bg-[#43A047] text-white px-8 py-4 text-lg font-semibold transition-colors shadow-xl shadow-[#4CAF50]/30"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/25 hover:bg-white/10 text-white px-8 py-4 text-lg font-semibold transition-colors backdrop-blur-sm"
          >
            Sign In
          </Link>
        </div>
      </motion.div>
    </>
  );
}

function ProgressIndicator({ scrollYProgress }: NarrativeOverlayProps) {
  const fadeOut = useTransform(scrollYProgress, [0.0, 0.1, 0.9, 1.0], [1, 1, 1, 0]);
  const width = useTransform(scrollYProgress, [0, 1], ["0%", "100%"]);
  return (
    <motion.div
      style={{ opacity: fadeOut }}
      className="absolute top-0 left-0 right-0 h-[3px] bg-black/10 dark:bg-white/10 pointer-events-none z-50"
    >
      <motion.div style={{ width }} className="h-full bg-[#4CAF50]" />
    </motion.div>
  );
}

function ScrollHint({ scrollYProgress }: NarrativeOverlayProps) {
  const opacity = useTransform(scrollYProgress, [0.0, 0.05, 0.1], [1, 1, 0]);
  return (
    <motion.div
      style={{ opacity }}
      className="absolute bottom-10 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-none z-30"
    >
      <span className="text-xs uppercase tracking-[0.2em] text-gray-600 dark:text-gray-400">
        Scroll
      </span>
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
      >
        <ChevronDown className="h-5 w-5 text-[#4CAF50]" />
      </motion.div>
    </motion.div>
  );
}

export function ScrollNarrativeLanding() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imagesRef = useRef<HTMLImageElement[]>([]);
  const [loaded, setLoaded] = useState(0);
  const [mounted, setMounted] = useState(false);
  const [useAvif, setUseAvif] = useState<boolean | null>(null);

  const reducedMotion = usePrefersReducedMotion();
  const isMobile = useIsMobile();

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"],
  });

  useEffect(() => {
    setMounted(true);
    detectAvif().then(setUseAvif);
  }, []);

  useEffect(() => {
    if (!mounted || useAvif === null || reducedMotion || isMobile) return;
    const path = useAvif ? avifPath : jpgPath;
    const imgs: HTMLImageElement[] = [];
    let count = 0;
    for (let i = 0; i < FRAME_COUNT; i++) {
      const img = new Image();
      img.src = path(i);
      img.onload = () => {
        count++;
        setLoaded(count);
        if (i === 0 && canvasRef.current) {
          const ctx = canvasRef.current.getContext("2d");
          if (ctx) {
            canvasRef.current.width = img.naturalWidth;
            canvasRef.current.height = img.naturalHeight;
            ctx.drawImage(img, 0, 0);
          }
        }
      };
      imgs.push(img);
    }
    imagesRef.current = imgs;
  }, [mounted, useAvif, reducedMotion, isMobile]);

  useEffect(() => {
    if (!mounted || reducedMotion || isMobile) return;
    let rafId = 0;
    let lastIdx = -1;
    const unsub = scrollYProgress.on("change", (p) => {
      const idx = Math.min(FRAME_COUNT - 1, Math.max(0, Math.floor(p * FRAME_COUNT)));
      if (idx === lastIdx) return;
      lastIdx = idx;
      const img = imagesRef.current[idx];
      const canvas = canvasRef.current;
      if (!img || !canvas || !img.complete || img.naturalWidth === 0) return;
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
      unsub();
    };
  }, [scrollYProgress, mounted, reducedMotion, isMobile]);

  if (mounted && (reducedMotion || isMobile)) {
    return <StaticFallbackLanding />;
  }

  return (
    <div
      ref={containerRef}
      className="relative w-full bg-white dark:bg-black"
      style={{ height: `${SCROLL_VH}vh` }}
    >
      <div className="sticky top-0 h-screen w-full overflow-hidden bg-white dark:bg-black">
        <canvas
          ref={canvasRef}
          className="absolute inset-0"
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />

        <ProgressIndicator scrollYProgress={scrollYProgress} />

        {mounted && loaded < 20 && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white dark:bg-black z-40">
            <div className="text-sm text-gray-500 mb-3">
              Loading {loaded}/{FRAME_COUNT}
            </div>
            <div className="h-1 w-48 bg-gray-200 dark:bg-gray-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#4CAF50] transition-[width] duration-200"
                style={{ width: `${(loaded / FRAME_COUNT) * 100}%` }}
              />
            </div>
          </div>
        )}

        <HeroOverlay scrollYProgress={scrollYProgress} />
        <Tagline2 scrollYProgress={scrollYProgress} />
        <Tagline3 scrollYProgress={scrollYProgress} />
        <FeaturesOverlay scrollYProgress={scrollYProgress} />
        <HowItWorksOverlay scrollYProgress={scrollYProgress} />
        <CTAOverlay scrollYProgress={scrollYProgress} />
        <ScrollHint scrollYProgress={scrollYProgress} />
      </div>
    </div>
  );
}

function StaticFallbackLanding() {
  return (
    <main className="w-full">
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 py-16 bg-white dark:bg-black">
        <img
          src="/hero/poster.jpg"
          alt="FoodVisor AI"
          className="w-full max-w-3xl rounded-xl shadow-lg"
        />
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white">
            Meet FoodVisor AI
          </h1>
          <p className="text-lg md:text-xl text-gray-700 dark:text-gray-300 max-w-xl">
            Your nutrition, intelligently personalized.
          </p>
          <p className="text-base md:text-lg text-[#4CAF50] font-medium">
            Three agents. One perfect meal.
          </p>
        </div>
      </section>
      <section className="px-6 py-20 bg-gray-50 dark:bg-[#0a0a0a]">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-5xl font-bold text-center mb-12 text-gray-900 dark:text-white">
            Three Agents, One Pipeline
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {agents.map((a) => {
              const Icon = a.icon;
              return (
                <div
                  key={a.title}
                  className="rounded-2xl bg-white dark:bg-[#161616] p-6 border border-gray-100 dark:border-gray-800"
                >
                  <div className="h-11 w-11 rounded-xl bg-[#4CAF50]/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-[#4CAF50]" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-1.5">
                    {a.title}
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-400">{a.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>
      <section className="px-6 py-20 bg-gradient-to-br from-[#1B5E20] via-[#212121] to-black text-center">
        <h2 className="text-4xl md:text-6xl font-bold text-white mb-5">
          Ready to eat smarter?
        </h2>
        <p className="text-lg text-gray-300 mb-8 max-w-xl mx-auto">
          Join FoodVisor AI and let three agents handle the hard part.
        </p>
        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Link
            href="/signup"
            className="inline-flex items-center justify-center gap-2 rounded-full bg-[#4CAF50] hover:bg-[#43A047] text-white px-8 py-4 text-lg font-semibold"
          >
            Get Started <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-full border border-white/25 text-white px-8 py-4 text-lg font-semibold"
          >
            Sign In
          </Link>
        </div>
      </section>
    </main>
  );
}
