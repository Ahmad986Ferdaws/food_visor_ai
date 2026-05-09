"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, HeartPulse, Salad, Target, ThumbsUp, ThumbsDown,
  Gauge, X, Plus, Save, Sparkles, Loader2, Check, Compass, MessageCircleHeart,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { profileAPI, advisorAPI, type UserProfile, type UserProfileUpdate, type AboutSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const GLASS = "rounded-2xl border border-white/60 bg-white/80 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

const LIMIT_FIELDS: { key: keyof NonNullable<UserProfile["daily_limits"]>; label: string; suffix: string }[] = [
  { key: "calories",  label: "Calories",  suffix: "kcal" },
  { key: "protein_g", label: "Protein",   suffix: "g"    },
  { key: "carbs_g",   label: "Carbs",     suffix: "g"    },
  { key: "fat_g",     label: "Fat",       suffix: "g"    },
  { key: "sugar_g",   label: "Sugar",     suffix: "g"    },
  { key: "sodium_mg", label: "Sodium",    suffix: "mg"   },
  { key: "water_l",   label: "Water",     suffix: "L"    },
];

function ChipList({
  values,
  onChange,
  placeholder,
  tone = "green",
}: {
  values: string[];
  onChange: (next: string[]) => void;
  placeholder: string;
  tone?: "green" | "red" | "amber";
}) {
  const [draft, setDraft] = useState("");
  const palette = {
    green: "bg-[#E8F5E9] text-[#1B5E20] border-[#A5D6A7]",
    red:   "bg-red-50 text-red-700 border-red-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
  }[tone];

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    if (values.includes(v)) { setDraft(""); return; }
    onChange([...values, v]);
    setDraft("");
  };
  const remove = (v: string) => onChange(values.filter((x) => x !== v));

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {values.length === 0 && (
          <span className="text-xs italic text-slate-400">None added yet.</span>
        )}
        {values.map((v) => (
          <span key={v} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", palette)}>
            {v}
            <button onClick={() => remove(v)} className="rounded-full p-0.5 hover:bg-black/5" aria-label={`Remove ${v}`}>
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
      </div>
      <div className="flex gap-2">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder={placeholder}
          className="h-9 text-sm"
        />
        <Button onClick={add} size="sm" variant="outline" className="h-9 border-[#4CAF50] text-[#1B5E20] hover:bg-[#E8F5E9]">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>
    </div>
  );
}

function Section({
  icon, title, description, tone = "green", children,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  tone?: "green" | "red" | "amber";
  children: React.ReactNode;
}) {
  const iconBg = {
    green: "bg-[#F1F8E9] text-[#1B5E20]",
    red:   "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
  }[tone];
  return (
    <div className={cn(GLASS, "p-6")}>
      <div className="mb-1 flex items-center gap-3">
        <div className={cn("flex h-9 w-9 items-center justify-center rounded-lg", iconBg)}>{icon}</div>
        <div>
          <h2 className="text-base font-semibold text-slate-800">{title}</h2>
          <p className="text-xs text-slate-500">{description}</p>
        </div>
      </div>
      <Separator className="my-4 bg-slate-200/60" />
      {children}
    </div>
  );
}

export default function AboutMePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [draft, setDraft] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // "How much do you know about me?" feature
  const [advisorOpen, setAdvisorOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisor, setAdvisor] = useState<AboutSummary | null>(null);

  const openAdvisor = async () => {
    setAdvisorOpen(true);
    setAdvisor(null);
    setAdvisorLoading(true);
    try {
      const res = await advisorAPI.aboutSummary();
      setAdvisor(res.data);
    } catch {
      toast.error("Couldn't load your summary right now — try again in a moment.");
      setAdvisorOpen(false);
    } finally {
      setAdvisorLoading(false);
    }
  };

  useEffect(() => {
    let alive = true;
    profileAPI.get()
      .then((res) => {
        if (!alive) return;
        setProfile(res.data);
        setDraft(res.data);
      })
      .catch(() => toast.error("Could not load your profile"))
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const dirty = profile && draft && JSON.stringify(profile) !== JSON.stringify(draft);

  const update = <K extends keyof UserProfile>(key: K, value: UserProfile[K]) => {
    setDraft((d) => (d ? { ...d, [key]: value } : d));
  };
  const updateLimit = (key: string, value: number | undefined) => {
    setDraft((d) => {
      if (!d) return d;
      const next = { ...d.daily_limits };
      if (value === undefined || Number.isNaN(value)) delete next[key];
      else next[key] = value;
      return { ...d, daily_limits: next };
    });
  };

  const onSave = async () => {
    if (!draft) return;
    setSaving(true);
    try {
      const patch: UserProfileUpdate = {
        display_name: draft.display_name,
        dietary_constraints: draft.dietary_constraints,
        allergies: draft.allergies,
        medical_conditions: draft.medical_conditions,
        goals: draft.goals,
        liked_items: draft.liked_items,
        disliked_items: draft.disliked_items,
        daily_limits: draft.daily_limits,
      };
      const res = await profileAPI.update(patch);
      setProfile(res.data);
      setDraft(res.data);
      toast.success("Profile updated — your AI assistant will use these values on every request.");
    } catch {
      toast.error("Save failed. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const onReset = () => setDraft(profile);

  if (loading || !draft) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#4CAF50] border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">About Me</h1>
          <p className="mt-1 text-sm text-slate-500">
            The single source of truth your AI assistant reads <em>before</em> every recommendation. Keep this accurate.
          </p>
          <p className="mt-1 font-mono text-xs text-slate-400">{draft.email}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onReset} disabled={!dirty || saving}>Reset</Button>
          <Button onClick={onSave} disabled={!dirty || saving} className="bg-[#4CAF50] text-white hover:bg-[#43A047]">
            <Save className="mr-1.5 h-4 w-4" />
            {saving ? "Saving…" : dirty ? "Save Changes" : "Saved"}
          </Button>
        </div>
      </motion.div>

      <div className="space-y-4">
        {/* Identity */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Section icon={<Salad className="h-4 w-4" />} title="Identity" description="What we should call you">
            <div>
              <Label htmlFor="display_name" className="text-sm">Display name</Label>
              <Input
                id="display_name"
                value={draft.display_name ?? ""}
                onChange={(e) => update("display_name", e.target.value || null)}
                placeholder="e.g. Maria"
                className="mt-1.5"
              />
            </div>
          </Section>
        </motion.div>

        {/* Allergies — life-critical */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 }}>
          <Section
            icon={<AlertTriangle className="h-4 w-4" />}
            title="Allergies & intolerances"
            description="Hard fail — the AI will never recommend a meal that contains any of these."
            tone="red"
          >
            <ChipList
              values={draft.allergies}
              onChange={(v) => update("allergies", v)}
              placeholder="Add an allergen (e.g. peanuts, gluten)"
              tone="red"
            />
          </Section>
        </motion.div>

        {/* Medical conditions */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <Section
            icon={<HeartPulse className="h-4 w-4" />}
            title="Medical conditions"
            description="Conditions the AI must factor into every meal (e.g. type 2 diabetes, hypertension)."
            tone="amber"
          >
            <ChipList
              values={draft.medical_conditions}
              onChange={(v) => update("medical_conditions", v)}
              placeholder="Add a condition (e.g. type_2_diabetes)"
              tone="amber"
            />
          </Section>
        </motion.div>

        {/* Dietary constraints */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.14 }}>
          <Section
            icon={<Salad className="h-4 w-4" />}
            title="Dietary constraints"
            description="Diet style or pattern (e.g. gluten-free, vegetarian, low-sodium)."
          >
            <ChipList
              values={draft.dietary_constraints}
              onChange={(v) => update("dietary_constraints", v)}
              placeholder="Add a constraint (e.g. gluten-free)"
            />
          </Section>
        </motion.div>

        {/* Goals */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.17 }}>
          <Section
            icon={<Target className="h-4 w-4" />}
            title="Goals"
            description="What success looks like (e.g. weight_maintenance_70kg, blood_sugar_under_140)."
          >
            <ChipList
              values={draft.goals}
              onChange={(v) => update("goals", v)}
              placeholder="Add a goal"
            />
          </Section>
        </motion.div>

        {/* Allowed (likes) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.20 }}>
          <Section
            icon={<ThumbsUp className="h-4 w-4" />}
            title="Allowed / liked foods"
            description="Foods to favour in recommendations."
          >
            <ChipList
              values={draft.liked_items}
              onChange={(v) => update("liked_items", v)}
              placeholder="Add a food (e.g. salmon, quinoa)"
            />
          </Section>
        </motion.div>

        {/* Restricted (dislikes) */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.23 }}>
          <Section
            icon={<ThumbsDown className="h-4 w-4" />}
            title="Restricted / disliked foods"
            description="Foods the AI should avoid (separate from allergies — these are preferences, not safety)."
            tone="amber"
          >
            <ChipList
              values={draft.disliked_items}
              onChange={(v) => update("disliked_items", v)}
              placeholder="Add a food to avoid"
              tone="amber"
            />
          </Section>
        </motion.div>

        {/* Daily limits */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.26 }}>
          <Section
            icon={<Gauge className="h-4 w-4" />}
            title="Daily limits"
            description="Max nutrient targets per day. Recommendations must fit within remaining budget."
          >
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {LIMIT_FIELDS.map(({ key, label, suffix }) => {
                const value = draft.daily_limits?.[key];
                return (
                  <div key={key as string}>
                    <Label htmlFor={`limit-${key}`} className="text-xs text-slate-500">
                      {label} <span className="text-slate-400">({suffix})</span>
                    </Label>
                    <Input
                      id={`limit-${key}`}
                      type="number"
                      step="any"
                      value={value ?? ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        updateLimit(key as string, raw === "" ? undefined : Number(raw));
                      }}
                      className="mt-1"
                      placeholder="—"
                    />
                  </div>
                );
              })}
            </div>
          </Section>
        </motion.div>

        {/* "How much do you know about me?" — bottom of page */}
        <motion.div
          initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="pt-4"
        >
          <button
            onClick={openAdvisor}
            className={cn(
              GLASS,
              "group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#F1F8E9] via-white to-[#E8F5E9] p-5 text-left transition-all hover:-translate-y-0.5 hover:shadow-lg",
            )}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#4CAF50] text-white shadow-md shadow-[#4CAF50]/30">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <p className="font-semibold text-slate-800">How much do you know about me?</p>
                <p className="text-xs text-slate-500">Ask the FoodVisor advisor to recap your profile and what they're focused on.</p>
              </div>
            </div>
            <span className="rounded-full bg-[#4CAF50] px-3 py-1 text-xs font-semibold text-white opacity-90 transition-opacity group-hover:opacity-100">
              Ask the advisor →
            </span>
          </button>
        </motion.div>

        {dirty && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="sticky bottom-4 z-10"
          >
            <div className={cn(GLASS, "flex items-center justify-between gap-3 p-4")}>
              <p className="text-sm text-slate-700">You have unsaved changes.</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onReset} disabled={saving}>Discard</Button>
                <Button onClick={onSave} disabled={saving} className="bg-[#4CAF50] text-white hover:bg-[#43A047]">
                  <Save className="mr-1.5 h-4 w-4" />
                  {saving ? "Saving…" : "Save Changes"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      <Dialog open={advisorOpen} onOpenChange={(o) => { if (!o) { setAdvisorOpen(false); } }}>
        <DialogContent className="max-w-2xl border-white/60 bg-white/95 backdrop-blur">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-[#1B5E20]">
              <Sparkles className="h-4 w-4" />
              Here's what I know about you
            </DialogTitle>
          </DialogHeader>

          {advisorLoading && (
            <div className="flex flex-col items-center justify-center py-10 text-slate-500">
              <Loader2 className="mb-2 h-6 w-6 animate-spin text-[#4CAF50]" />
              <p className="text-sm">Reading your profile and recent meals…</p>
            </div>
          )}

          {!advisorLoading && advisor && (
            <div className="max-h-[70vh] space-y-5 overflow-y-auto pr-1">
              <p className="rounded-2xl bg-gradient-to-r from-[#F1F8E9] to-[#E8F5E9] p-4 text-sm leading-relaxed text-slate-800">
                {advisor.greeting}
              </p>

              {advisor.i_know.length > 0 && (
                <SummaryBlock
                  icon={<Check className="h-4 w-4" />}
                  title="What I have on you"
                  items={advisor.i_know}
                />
              )}

              {advisor.recent_observations.length > 0 && (
                <SummaryBlock
                  icon={<MessageCircleHeart className="h-4 w-4" />}
                  title="What I've noticed lately"
                  items={advisor.recent_observations}
                />
              )}

              {advisor.safe_favorites.length > 0 && (
                <SummaryBlock
                  icon={<ThumbsUp className="h-4 w-4" />}
                  title="Foods that work great for you"
                  items={advisor.safe_favorites}
                  tone="green"
                />
              )}

              {advisor.things_to_explore.length > 0 && (
                <SummaryBlock
                  icon={<Compass className="h-4 w-4" />}
                  title="Some new ideas you might enjoy"
                  items={advisor.things_to_explore}
                  tone="green"
                />
              )}

              <p className="rounded-2xl border border-[#A5D6A7] bg-[#E8F5E9] p-4 text-sm font-medium leading-relaxed text-[#1B5E20]">
                {advisor.encouragement}
              </p>

              {advisor.meta?.model && (
                <p className="text-center text-[10px] text-slate-400">
                  Generated by {advisor.meta.model}
                  {advisor.meta.meal_log_count !== undefined && ` · ${advisor.meta.meal_log_count} recent meals reviewed`}
                </p>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SummaryBlock({
  icon, title, items, tone = "default",
}: { icon: React.ReactNode; title: string; items: string[]; tone?: "default" | "green" }) {
  const titleColor = tone === "green" ? "text-[#1B5E20]" : "text-slate-800";
  return (
    <div>
      <h3 className={cn("mb-2 flex items-center gap-2 text-sm font-semibold", titleColor)}>
        {icon} {title}
      </h3>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="flex gap-2 text-sm leading-relaxed text-slate-700">
            <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-[#4CAF50]" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
