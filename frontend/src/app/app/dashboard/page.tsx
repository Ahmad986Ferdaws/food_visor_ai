"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import {
  Bell, Droplets, Flame, Beef, Sparkles,
} from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/userStore";
import { recommendationAPI, profileAPI } from "@/lib/api";
import { toast } from "sonner";
import { ActivityOverview } from "@/components/features/ActivityOverview";

// ─── Glass card token ────────────────────────────────────────────────────────
const GLASS = "rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

// ─── Mock Data ───────────────────────────────────────────────────────────────

const WEEKLY_ACTIVITY = [
  { day: "Sun", pct: 65, calories: 1300 },
  { day: "Mon", pct: 80, calories: 1600 },
  { day: "Tue", pct: 55, calories: 1100 },
  { day: "Wed", pct: 90, calories: 1800 },
  { day: "Thu", pct: 70, calories: 1400 },
  { day: "Sat", pct: 45, calories: 900  },
  { day: "Mon", pct: 60, calories: 1200 },
];
const TODAY_IDX = 3;

const OVERVIEW = {
  pct: 78,
  rows: [
    { dot: "#2E7D32", label: "Calories Burn", value: "2,340", change: "+2.1%" },
    { dot: "#4CAF50", label: "Protein",       value: "94g",   change: "+4.2%" },
    { dot: "#A5D6A7", label: "Carbs",         value: "210g",  change: "+1.8%" },
  ],
};

const METRICS = [
  { icon: Flame,    label: "Calories", value: "1,840 kcal", color: "#4CAF50" },
  { icon: Beef,     label: "Protein",  value: "94g",        color: "#2E7D32" },
  { icon: Droplets, label: "Water",    value: "2.1L",       color: "#66BB6A" },
];

const GOALS = [
  { label: "Hit 120g protein today", current: "94g",  target: "120g", pct: 78,  status: "ongoing"  },
  { label: "Drink 2.5L water",       current: "2.5L", target: "2.5L", pct: 100, status: "complete" },
  { label: "Log all 3 meals",        current: "2/3",  target: "3",    pct: 66,  status: "ongoing"  },
];

const QUICK_PROMPTS = [
  "High-protein breakfast for muscle gain",
  "Quick healthy lunch under 500 calories",
  "Anti-inflammatory dinner, no dairy",
  "Post-workout snack with complex carbs",
  "Mediterranean dinner with seafood",
];

// ─── Donut SVG ───────────────────────────────────────────────────────────────

function DonutRing({ pct }: { pct: number }) {
  const r    = 50;
  const circ = 2 * Math.PI * r;
  const segs = [
    { color: "#2E7D32", share: 0.5 },
    { color: "#4CAF50", share: 0.3 },
    { color: "#A5D6A7", share: 0.2 },
  ];
  let cum = 0;
  return (
    <div className="relative flex h-[128px] w-[128px] flex-shrink-0 items-center justify-center">
      <svg width={128} height={128} viewBox="0 0 128 128" className="-rotate-90">
        <circle cx={64} cy={64} r={r} fill="none" stroke="#F1F8E9" strokeWidth={14} />
        {segs.map((s, i) => {
          const len = s.share * pct / 100 * circ;
          const gap = circ - len;
          const off = -(cum / 100 * circ);
          cum += s.share * pct;
          return (
            <circle
              key={i} cx={64} cy={64} r={r}
              fill="none" stroke={s.color} strokeWidth={14}
              strokeDasharray={`${len} ${gap}`}
              strokeDashoffset={off} strokeLinecap="round"
            />
          );
        })}
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="text-xl font-bold text-slate-800">{pct}%</span>
        <span className="text-[10px] text-slate-400">1,840 kcal</span>
      </div>
    </div>
  );
}

function MiniRing({ pct, done }: { pct: number; done: boolean }) {
  const r = 13;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={34} height={34} className="-rotate-90 flex-shrink-0">
      <circle cx={17} cy={17} r={r} fill="none" stroke="#F1F8E9" strokeWidth={3} />
      <circle
        cx={17} cy={17} r={r} fill="none"
        stroke={done ? "#4CAF50" : "#A5D6A7"}
        strokeWidth={3}
        strokeDasharray={`${(pct / 100) * circ} ${circ}`}
        strokeLinecap="round"
      />
      {done && <circle cx={17} cy={17} r={7} fill="#4CAF50" />}
    </svg>
  );
}

function BarPctLabel({ x, y, width, value }: any) {
  return (
    <text x={x + width / 2} y={y - 5} textAnchor="middle" fontSize={10} fill="#94A3B8">{value}%</text>
  );
}

// ─── Hero Banner ─────────────────────────────────────────────────────────────

function HeroBanner({ name }: { name: string }) {
  const [hasImage, setHasImage] = useState(false);
  // Probe the optional banner client-side. If `/dashboard-hero.jpg` exists, render it as a
  // background layer; otherwise stay on the green gradient. Done with a plain Image() probe
  // so we never hand a missing path to next/image (which 500s under strict optimization).
  useEffect(() => {
    const probe = new window.Image();
    probe.onload = () => setHasImage(true);
    probe.onerror = () => setHasImage(false);
    probe.src = "/dashboard-hero.jpg";
  }, []);

  return (
    <div className="relative mb-6 overflow-hidden rounded-3xl">
      <div className="relative h-[180px] w-full sm:h-[220px]">
        <div className="absolute inset-0 bg-gradient-to-br from-[#1B5E20] via-[#2E7D32] to-[#4CAF50]" />
        {hasImage && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src="/dashboard-hero.jpg"
            alt=""
            className="absolute inset-0 h-full w-full object-cover"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
        <div className="relative z-10 flex h-full flex-col justify-end p-6 sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
            Welcome back, {name} 👋
          </h1>
          <p className="mt-1 text-sm text-white/80 sm:text-base">
            Your personalized nutrition pipeline, ready when you are.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const router      = useRouter();
  const user        = useUserStore((s) => s.user);
  const [profileName, setProfileName] = useState<string | null>(null);
  const [calorieTarget, setCalorieTarget] = useState<number>(2000);
  const displayName = profileName ?? user?.email?.split("@")[0] ?? "there";
  const [loading,   setLoading]   = useState(false);

  useEffect(() => {
    let alive = true;
    profileAPI.get()
      .then((res) => {
        if (!alive) return;
        if (res.data.display_name) setProfileName(res.data.display_name);
        const cal = res.data.daily_limits?.calories;
        if (typeof cal === "number" && cal > 0) setCalorieTarget(cal);
      })
      .catch(() => {/* silent — falls back to email prefix + 2000 kcal target */});
    return () => { alive = false; };
  }, []);

  const fireRequest = async (msg: string) => {
    setLoading(true);
    try {
      const res = await recommendationAPI.create(msg);
      toast.success("AI agent started!");
      router.push(`/app/progress/${res.data.request_id}`);
    } catch {
      toast.error("Failed to start request");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <HeroBanner name={displayName} />

      {/* Header row */}
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-5 flex items-center justify-between"
      >
        <div>
          <h2 className="text-xl font-bold tracking-tight text-slate-900">Today at a glance</h2>
          <p className="text-sm text-slate-500">Live nutrition overview</p>
        </div>
        <div className="flex items-center gap-3">
          <button className={cn(GLASS, "relative p-2.5 hover:bg-white/80 transition-colors")}>
            <Bell className="h-5 w-5 text-slate-500" />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[#4CAF50]" />
          </button>
          <div className="flex h-10 w-10 items-center justify-center rounded-xl border-2 border-[#4CAF50] bg-[#F1F8E9] text-sm font-bold uppercase text-[#1B5E20]">
            {displayName[0]}
          </div>
        </div>
      </motion.div>

      {/* Quick prompts — horizontal scroll on mobile */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.05 }}
        className="mb-5 -mx-4 px-4 sm:mx-0 sm:px-0"
      >
        <div className="flex gap-2 overflow-x-auto pb-2 sm:flex-wrap sm:overflow-x-visible scrollbar-hide">
          {QUICK_PROMPTS.map((p) => (
            <button
              key={p}
              onClick={() => fireRequest(p)}
              disabled={loading}
              className={cn(
                GLASS,
                "flex-shrink-0 px-4 py-2 text-sm text-slate-700 hover:bg-white/80 hover:border-[#4CAF50]/40 transition-all disabled:opacity-60",
              )}
            >
              <Sparkles className="mr-1.5 inline h-3 w-3 text-[#4CAF50]" />
              {p}
            </button>
          ))}
        </div>
      </motion.div>

      {/* Top grid */}
      <div className="mb-4 grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Activity */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className={cn(GLASS, "col-span-1 p-5 lg:col-span-5")}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Activity</h2>
            <span className="rounded-lg bg-[#F1F8E9] px-3 py-1 text-xs font-medium text-[#1B5E20]">Weekly ▾</span>
          </div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={WEEKLY_ACTIVITY} barSize={26} margin={{ top: 18, right: 4, left: -28, bottom: 0 }}>
              <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94A3B8" }} />
              <YAxis hide />
              <Tooltip cursor={false} contentStyle={{ borderRadius: 12, border: "1px solid #C8E6C9", fontSize: 12 }}
                formatter={(_v: any, _n: any, { payload }: any) => [`${payload.calories} kcal`, "Intake"]} />
              <Bar dataKey="pct" radius={[8, 8, 8, 8]} label={<BarPctLabel />}>
                {WEEKLY_ACTIVITY.map((_, i) => (
                  <Cell key={i} fill={i === TODAY_IDX ? "#4CAF50" : "#C8E6C9"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Metrics */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="col-span-1 flex flex-col gap-3 lg:col-span-3">
          {METRICS.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={cn(GLASS, "flex items-center gap-3 px-4 py-3")}>
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl"
                style={{ backgroundColor: `${color}18` }}>
                <Icon className="h-5 w-5" style={{ color }} />
              </div>
              <div>
                <p className="text-lg font-bold text-slate-800">{value}</p>
                <p className="text-xs text-slate-400">{label}</p>
              </div>
            </div>
          ))}
        </motion.div>

        {/* Donut */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className={cn(GLASS, "col-span-1 p-5 lg:col-span-4")}>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Overview</h2>
            <span className="rounded-lg bg-[#F1F8E9] px-3 py-1 text-xs font-medium text-[#1B5E20]">Today ▾</span>
          </div>
          <div className="flex items-center gap-4">
            <DonutRing pct={OVERVIEW.pct} />
            <div className="flex flex-col gap-3">
              {OVERVIEW.rows.map((row) => (
                <div key={row.label} className="flex items-start gap-2">
                  <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: row.dot }} />
                  <div>
                    <p className="text-[10px] text-slate-400">{row.label}</p>
                    <p className="text-sm font-bold text-slate-800">{row.value}</p>
                    <p className="text-[10px] font-medium text-[#1B5E20]">{row.change}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Bottom grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className={cn(GLASS, "col-span-1 p-5 lg:col-span-7")}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="font-semibold text-slate-800">Nutrition Goals</h2>
            <button
              onClick={() => fireRequest("Suggest a high-protein meal to hit my remaining protein goal today")}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl bg-[#4CAF50] px-3 py-1.5 text-xs font-semibold text-white shadow-sm shadow-[#4CAF50]/30 hover:bg-[#43A047] disabled:opacity-60 transition-colors"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {loading ? "Starting…" : "AI Suggest"}
            </button>
          </div>
          <div className="space-y-5">
            {GOALS.map((g) => (
              <div key={g.label} className="flex items-center gap-3">
                <MiniRing pct={g.pct} done={g.status === "complete"} />
                <div className="min-w-0 flex-1">
                  <p className="mb-1.5 truncate text-sm font-medium text-slate-700">{g.label}</p>
                  <div className="h-1.5 w-full rounded-full bg-[#F1F8E9]">
                    <motion.div initial={{ width: 0 }} animate={{ width: `${g.pct}%` }}
                      transition={{ delay: 0.4, duration: 0.8, ease: "easeOut" }}
                      className="h-full rounded-full bg-[#4CAF50]" />
                  </div>
                </div>
                <span className="flex-shrink-0 text-xs text-slate-400">{g.current}/{g.target}</span>
                <span className={cn(
                  "flex-shrink-0 rounded-full px-3 py-1 text-xs font-semibold",
                  g.status === "complete" ? "bg-[#4CAF50] text-white" : "bg-amber-50 text-amber-700",
                )}>
                  {g.status === "complete" ? "Complete" : "On Going"}
                </span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Activity Overview — interactive 30-day calendar */}
        <div className="col-span-1 lg:col-span-5">
          <ActivityOverview today={new Date()} calorieTarget={calorieTarget} />
        </div>
      </div>
    </div>
  );
}
