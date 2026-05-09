"use client";

import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Calendar, Flame, X, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { mealsAPI, type DayAggregate, type DayDetail } from "@/lib/api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const GLASS =
  "rounded-2xl border border-white/60 bg-white/70 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

type Props = {
  /** ISO date string for "today". Used to highlight + cap the visible month. */
  today: Date;
  /** Optional calorie target — used to colour the heatmap. Default 2000. */
  calorieTarget?: number;
};

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function isoDay(d: Date) {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function intakeTone(pct: number): { bg: string; ring: string; label: string } {
  if (pct === 0) return { bg: "bg-slate-50", ring: "ring-slate-100", label: "no log" };
  if (pct < 0.5) return { bg: "bg-[#E8F5E9]", ring: "ring-[#C8E6C9]", label: "light" };
  if (pct < 0.85) return { bg: "bg-[#A5D6A7]", ring: "ring-[#81C784]", label: "on track" };
  if (pct <= 1.05) return { bg: "bg-[#4CAF50]", ring: "ring-[#43A047]", label: "on goal" };
  return { bg: "bg-amber-300", ring: "ring-amber-400", label: "over" };
}

export function ActivityOverview({ today, calorieTarget = 2000 }: Props) {
  const [cursor, setCursor] = useState<Date>(new Date(today.getFullYear(), today.getMonth(), 1));
  const [aggregates, setAggregates] = useState<Record<string, DayAggregate>>({});
  const [loading, setLoading] = useState(false);
  const [openDate, setOpenDate] = useState<string | null>(null);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [dayLoading, setDayLoading] = useState(false);

  const monthLabel = `${MONTH_NAMES[cursor.getMonth()]} ${cursor.getFullYear()}`;

  // Build the 6-week grid for the visible month.
  const { gridStart, daysInMonth, leadBlanks } = useMemo(() => {
    const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const last = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    return {
      gridStart: first,
      daysInMonth: last.getDate(),
      leadBlanks: first.getDay(),
    };
  }, [cursor]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const start = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
    const end = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
    mealsAPI
      .range(isoDay(start), isoDay(end))
      .then((res) => {
        if (!alive) return;
        const map: Record<string, DayAggregate> = {};
        for (const a of res.data) map[a.date] = a;
        setAggregates(map);
      })
      .catch(() => toast.error("Couldn't load activity history"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [cursor]);

  const openDay = async (date: string) => {
    setOpenDate(date);
    setDayDetail(null);
    setDayLoading(true);
    try {
      const res = await mealsAPI.byDate(date);
      setDayDetail(res.data);
    } catch {
      toast.error("Couldn't load that day");
    } finally {
      setDayLoading(false);
    }
  };

  const todayIso = isoDay(today);
  const cells: { date: string; pct: number; calories: number; meal_count: number }[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const d = new Date(gridStart.getFullYear(), gridStart.getMonth(), day);
    const iso = isoDay(d);
    const agg = aggregates[iso];
    const calories = agg?.calories ?? 0;
    const pct = calorieTarget > 0 ? calories / calorieTarget : 0;
    cells.push({ date: iso, pct, calories, meal_count: agg?.meal_count ?? 0 });
  }

  const blanks = Array.from({ length: leadBlanks });

  // Roll-up summary for the visible month.
  const summary = useMemo(() => {
    const days = Object.values(aggregates);
    const logged = days.filter((d) => d.meal_count > 0);
    const totalCal = logged.reduce((s, d) => s + d.calories, 0);
    return {
      logged_days: logged.length,
      avg_calories: logged.length ? Math.round(totalCal / logged.length) : 0,
      total_meals: days.reduce((s, d) => s + d.meal_count, 0),
    };
  }, [aggregates]);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
        className={cn(GLASS, "p-5")}
      >
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#1B5E20]" />
            <h2 className="font-semibold text-slate-800">Activity Overview</h2>
            <span className="ml-2 rounded-lg bg-[#F1F8E9] px-3 py-1 text-xs font-medium text-[#1B5E20]">
              {monthLabel}
            </span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() - 1, 1))}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
              aria-label="Previous month"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => setCursor((c) => new Date(c.getFullYear(), c.getMonth() + 1, 1))}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-[#F1F8E9] hover:text-[#1B5E20]"
              aria-label="Next month"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Summary stats */}
        <div className="mb-4 grid grid-cols-3 gap-3">
          <div className="rounded-xl bg-[#F1F8E9] p-3">
            <p className="text-[11px] text-slate-500">Days logged</p>
            <p className="text-lg font-bold text-[#1B5E20]">{summary.logged_days}</p>
          </div>
          <div className="rounded-xl bg-[#F1F8E9] p-3">
            <p className="text-[11px] text-slate-500">Avg calories/day</p>
            <p className="text-lg font-bold text-[#1B5E20]">{summary.avg_calories.toLocaleString()}</p>
          </div>
          <div className="rounded-xl bg-[#F1F8E9] p-3">
            <p className="text-[11px] text-slate-500">Meals logged</p>
            <p className="text-lg font-bold text-[#1B5E20]">{summary.total_meals}</p>
          </div>
        </div>

        {/* Day labels */}
        <div className="mb-1.5 grid grid-cols-7 gap-1.5 text-center">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[10px] font-medium text-slate-400">{d}</div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-1.5">
          {blanks.map((_, i) => <div key={`b-${i}`} className="h-12" />)}
          {cells.map((c) => {
            const tone = intakeTone(c.pct);
            const isToday = c.date === todayIso;
            const dayNum = parseInt(c.date.split("-")[2], 10);
            const hasData = c.meal_count > 0;
            return (
              <button
                key={c.date}
                onClick={() => openDay(c.date)}
                className={cn(
                  "group relative flex h-12 flex-col items-center justify-center rounded-xl text-sm font-semibold ring-1 transition-all hover:scale-[1.05] hover:shadow-md",
                  tone.bg, tone.ring,
                  hasData ? "text-slate-800" : "text-slate-400",
                  isToday && "outline outline-2 outline-offset-1 outline-[#4CAF50]",
                )}
                title={hasData ? `${c.calories} kcal · ${c.meal_count} meals` : "No data"}
              >
                <span>{dayNum}</span>
                {hasData && (
                  <span className="text-[9px] font-normal opacity-70">{Math.round(c.calories / 100) * 100}</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-[10px] text-slate-500">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-slate-50 ring-1 ring-slate-100" /> No log
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#E8F5E9] ring-1 ring-[#C8E6C9]" /> Light
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#A5D6A7] ring-1 ring-[#81C784]" /> On track
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-[#4CAF50] ring-1 ring-[#43A047]" /> On goal
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-md bg-amber-300 ring-1 ring-amber-400" /> Over
          </span>
          {loading && <span className="ml-auto inline-flex items-center gap-1 text-slate-400"><Loader2 className="h-3 w-3 animate-spin" /> loading…</span>}
        </div>
      </motion.div>

      <Dialog open={!!openDate} onOpenChange={(o) => { if (!o) { setOpenDate(null); setDayDetail(null); } }}>
        <DialogContent className="max-w-lg border-white/60 bg-white/95 backdrop-blur">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1B5E20]">
              <Calendar className="h-4 w-4" />
              {openDate ? prettyDate(openDate) : ""}
            </DialogTitle>
          </DialogHeader>

          {dayLoading && (
            <div className="flex items-center justify-center py-8 text-slate-400">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading meals…
            </div>
          )}

          {!dayLoading && dayDetail && dayDetail.meals.length === 0 && (
            <div className="py-8 text-center">
              <p className="text-sm text-slate-500">No meals logged for this day.</p>
            </div>
          )}

          {!dayLoading && dayDetail && dayDetail.meals.length > 0 && (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <Stat label="Calories" value={`${dayDetail.totals.calories} kcal`} icon={<Flame className="h-3.5 w-3.5" />} />
                <Stat label="Protein"  value={`${Math.round(dayDetail.totals.protein_g)} g`} />
                <Stat label="Carbs"    value={`${Math.round(dayDetail.totals.carbs_g)} g`} />
                <Stat label="Fat"      value={`${Math.round(dayDetail.totals.fat_g)} g`} />
              </div>

              <div className="mt-2 max-h-72 space-y-2 overflow-y-auto pr-1">
                {dayDetail.meals.map((m) => (
                  <div key={m.id} className="rounded-xl border border-slate-100 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{m.meal_name}</p>
                        <p className="text-[11px] uppercase tracking-wider text-slate-400">
                          {m.meal_type ?? "meal"} · {new Date(m.eaten_at).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                        </p>
                      </div>
                      <span className="rounded-full bg-[#F1F8E9] px-2 py-0.5 text-xs font-semibold text-[#1B5E20]">
                        {m.calories} kcal
                      </span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] text-slate-500">
                      <span className="rounded bg-slate-50 px-1.5 py-0.5">P {Math.round(m.protein_g)}g</span>
                      <span className="rounded bg-slate-50 px-1.5 py-0.5">C {Math.round(m.carbs_g)}g</span>
                      <span className="rounded bg-slate-50 px-1.5 py-0.5">F {Math.round(m.fat_g)}g</span>
                      <span className="rounded bg-slate-50 px-1.5 py-0.5">Sugar {Math.round(m.sugar_g)}g</span>
                      {typeof m.extra?.sodium_mg === "number" && (
                        <span className="rounded bg-slate-50 px-1.5 py-0.5">Na {Math.round(m.extra.sodium_mg as number)}mg</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function Stat({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-[#F1F8E9] p-2.5">
      <div className="flex items-center gap-1 text-[10px] uppercase tracking-wider text-slate-500">
        {icon} {label}
      </div>
      <p className="mt-0.5 text-sm font-bold text-[#1B5E20]">{value}</p>
    </div>
  );
}

function prettyDate(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return dt.toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}
