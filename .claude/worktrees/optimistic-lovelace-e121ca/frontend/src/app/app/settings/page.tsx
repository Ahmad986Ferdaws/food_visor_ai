"use client";
import { Palette, Accessibility, ShieldCheck, Leaf, Fish, Wheat, Milk, Egg, Nut } from "lucide-react";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { FadeIn } from "@/components/motion/FadeIn";
import { useAppStore } from "@/store/useAppStore";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const RESTRICTION_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: <Leaf className="h-4 w-4" /> },
  { id: "vegan", label: "Vegan", icon: <Leaf className="h-4 w-4" /> },
  { id: "pescatarian", label: "Pescatarian", icon: <Fish className="h-4 w-4" /> },
  { id: "gluten-free", label: "Gluten-Free", icon: <Wheat className="h-4 w-4" /> },
  { id: "dairy-free", label: "Dairy-Free", icon: <Milk className="h-4 w-4" /> },
  { id: "egg-free", label: "Egg-Free", icon: <Egg className="h-4 w-4" /> },
  { id: "nut-free", label: "Nut-Free", icon: <Nut className="h-4 w-4" /> },
];

function SettingsSection({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return (
    <Card className="border-gray-200 bg-white shadow-md dark:border-white/10 dark:bg-white/5">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#E8F5E9] text-[#4CAF50]">{icon}</div>
          <div>
            <h2 className="text-base font-semibold text-[#212121] dark:text-white">{title}</h2>
            <p className="text-xs text-[#9E9E9E]">{description}</p>
          </div>
        </div>
        <Separator className="my-4" />
        {children}
      </div>
    </Card>
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
    <div className="mx-auto max-w-2xl px-4 py-12">
      <FadeIn>
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-[#212121] dark:text-white sm:text-3xl">Settings</h1>
          <p className="mt-1 text-[#9E9E9E]">Customize your experience and default preferences.</p>
        </div>
      </FadeIn>

      <div className="space-y-6">
        <FadeIn delay={0.1}>
          <SettingsSection icon={<Palette className="h-4 w-4" />} title="Appearance" description="Theme and visual preferences">
            <div className="flex items-center justify-between">
              <div>
                <Label className="text-sm font-medium text-[#212121] dark:text-white">Dark Mode</Label>
                <p className="text-xs text-[#9E9E9E]">Toggle between dark and light themes</p>
              </div>
              <Switch checked={theme === "dark"} onCheckedChange={(checked) => setTheme(checked ? "dark" : "light")} />
            </div>
          </SettingsSection>
        </FadeIn>

        <FadeIn delay={0.2}>
          <SettingsSection icon={<Accessibility className="h-4 w-4" />} title="Accessibility" description="Motion and performance settings">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-[#212121] dark:text-white">Reduced Motion</Label>
                  <p className="text-xs text-[#9E9E9E]">Minimize animations</p>
                </div>
                <Switch checked={preferences.reducedMotion} onCheckedChange={(v) => setPreference("reducedMotion", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-[#212121] dark:text-white">Low Performance Mode</Label>
                  <p className="text-xs text-[#9E9E9E]">Disable 3D scenes</p>
                </div>
                <Switch checked={preferences.lowPerformance} onCheckedChange={(v) => setPreference("lowPerformance", v)} />
              </div>
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm font-medium text-[#212121] dark:text-white">Speed Mode</Label>
                  <p className="text-xs text-[#9E9E9E]">Fast-forward pipeline demo</p>
                </div>
                <Switch checked={preferences.speedMode} onCheckedChange={(v) => setPreference("speedMode", v)} />
              </div>
            </div>
          </SettingsSection>
        </FadeIn>

        <FadeIn delay={0.3}>
          <SettingsSection icon={<ShieldCheck className="h-4 w-4" />} title="Dietary Defaults" description="Pre-fill restrictions on every new request">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {RESTRICTION_OPTIONS.map((opt) => {
                const active = preferences.defaultRestrictions.includes(opt.id);
                return (
                  <button key={opt.id} onClick={() => toggleDefaultRestriction(opt.id)}
                    className={cn("flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all",
                      active ? "border-[#4CAF50] bg-[#E8F5E9] text-[#1B5E20]" : "border-gray-200 bg-white text-[#424242] hover:border-[#C8E6C9] dark:border-white/10 dark:bg-white/5 dark:text-gray-300"
                    )}>
                    {opt.icon} {opt.label}
                  </button>
                );
              })}
            </div>
          </SettingsSection>
        </FadeIn>

        <FadeIn delay={0.4}>
          <Button onClick={() => toast.success("Settings saved")} className="w-full bg-[#4CAF50] text-white hover:bg-[#1B5E20]">
            Save Settings
          </Button>
        </FadeIn>
      </div>
    </div>
  );
}
