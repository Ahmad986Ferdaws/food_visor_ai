"use client";
import { motion } from "framer-motion";
import { Palette, Accessibility, ShieldCheck, Leaf, Fish, Wheat, Milk, Egg, Nut } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const GLASS = "rounded-2xl border border-white/60 bg-white/60 backdrop-blur-md shadow-[0_8px_32px_rgba(46,125,50,0.06)]";

const RESTRICTION_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: <Leaf className="h-4 w-4" /> },
  { id: "vegan", label: "Vegan", icon: <Leaf className="h-4 w-4" /> },
  { id: "pescatarian", label: "Pescatarian", icon: <Fish className="h-4 w-4" /> },
  { id: "gluten-free", label: "Gluten-Free", icon: <Wheat className="h-4 w-4" /> },
  { id: "dairy-free", label: "Dairy-Free", icon: <Milk className="h-4 w-4" /> },
  { id: "egg-free", label: "Egg-Free", icon: <Egg className="h-4 w-4" /> },
  { id: "nut-free", label: "Nut-Free", icon: <Nut className="h-4 w-4" /> },
];

function SettingsSection({
  icon, title, description, children,
}: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <div className={cn(GLASS, "p-6")}>
      <div className="mb-1 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#F1F8E9] text-[#1B5E20]">{icon}</div>
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

export default function SettingsPage() {
  const { theme, setTheme } = useTheme();
  const preferences = useAppStore((s) => s.preferences);
  const setPreference = useAppStore((s) => s.setPreference);

  const toggleDefaultRestriction = (id: string) => {
    const current = preferences.defaultRestrictions;
    const next = current.includes(id) ? current.filter((r) => r !== id) : [...current, id];
    setPreference("defaultRestrictions", next);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <motion.div
        initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}
        className="mb-6"
      >
        <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Customize your experience and default preferences.</p>
      </motion.div>

      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <SettingsSection icon={<Palette className="h-4 w-4" />} title="Appearance" description="Theme and visual preferences">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-slate-700">Dark Mode</Label>
                <p className="text-xs text-slate-500">Toggle between dark and light themes</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>
          </SettingsSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <SettingsSection icon={<Accessibility className="h-4 w-4" />} title="Accessibility" description="Motion and performance settings">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Reduced Motion</Label>
                  <p className="text-xs text-slate-500">Minimize animations</p>
                </div>
                <Switch checked={preferences.reducedMotion} onCheckedChange={(v) => setPreference("reducedMotion", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Low Performance Mode</Label>
                  <p className="text-xs text-slate-500">Disable 3D scenes</p>
                </div>
                <Switch checked={preferences.lowPerformance} onCheckedChange={(v) => setPreference("lowPerformance", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-slate-700">Speed Mode</Label>
                  <p className="text-xs text-slate-500">Fast-forward pipeline demo</p>
                </div>
                <Switch checked={preferences.speedMode} onCheckedChange={(v) => setPreference("speedMode", v)} />
              </div>
            </div>
          </SettingsSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <SettingsSection icon={<ShieldCheck className="h-4 w-4" />} title="Dietary Defaults" description="Pre-fill restrictions on every new request">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RESTRICTION_OPTIONS.map((opt) => {
                const active = preferences.defaultRestrictions.includes(opt.id);
                return (
                  <button
                    key={opt.id}
                    onClick={() => toggleDefaultRestriction(opt.id)}
                    className={cn(
                      "flex items-center gap-2 rounded-xl border p-3 text-left text-sm transition-all",
                      active
                        ? "border-[#4CAF50] bg-[#F1F8E9] text-[#1B5E20]"
                        : "border-white/60 bg-white/40 text-slate-600 hover:border-[#A5D6A7] hover:bg-white/70",
                    )}
                  >
                    {opt.icon} {opt.label}
                  </button>
                );
              })}
            </div>
          </SettingsSection>
        </motion.div>

        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
          <Button
            onClick={() => toast.success("Settings saved")}
            className="w-full bg-[#4CAF50] text-white hover:bg-[#43A047] shadow-sm shadow-[#4CAF50]/30"
          >
            Save Settings
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
