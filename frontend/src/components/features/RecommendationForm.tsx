"use client";
import { useRef, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Sparkles, AlertCircle, Leaf, Fish, Wheat, Milk, Egg, Nut, Camera, X, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const formSchema = z.object({
  message: z.string().min(5, "Please describe what you're looking for (at least 5 characters)").max(2000),
  goal: z.string().optional(),
  restrictions: z.array(z.string()).optional(),
  preferences: z.record(z.string(), z.boolean()).optional(),
  photo_data_url: z.string().optional(),
  photo_filename: z.string().optional(),
});

export type RecommendationFormData = z.infer<typeof formSchema>;

interface RecommendationFormProps {
  onSubmit: (data: RecommendationFormData) => void;
  isSubmitting?: boolean;
  defaultRestrictions?: string[];
}

const DIETARY_OPTIONS = [
  { id: "vegetarian", label: "Vegetarian", icon: <Leaf className="h-4 w-4" /> },
  { id: "vegan", label: "Vegan", icon: <Leaf className="h-4 w-4" /> },
  { id: "pescatarian", label: "Pescatarian", icon: <Fish className="h-4 w-4" /> },
  { id: "gluten-free", label: "Gluten-Free", icon: <Wheat className="h-4 w-4" /> },
  { id: "dairy-free", label: "Dairy-Free", icon: <Milk className="h-4 w-4" /> },
  { id: "egg-free", label: "Egg-Free", icon: <Egg className="h-4 w-4" /> },
  { id: "nut-free", label: "Nut-Free", icon: <Nut className="h-4 w-4" /> },
];

// Resize on the client to keep payload reasonable. Max edge 1024 px, JPEG q≈0.85.
async function fileToResizedDataURL(file: File, maxEdge = 1024, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new window.Image();
    img.onload = () => {
      const scale = Math.min(1, maxEdge / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("Canvas context unavailable"));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", quality));
    };
    img.onerror = () => reject(new Error("Failed to read image"));
    img.src = URL.createObjectURL(file);
  });
}

export function RecommendationForm({ onSubmit, isSubmitting, defaultRestrictions = [] }: RecommendationFormProps) {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<RecommendationFormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      message: "",
      goal: "",
      restrictions: defaultRestrictions,
      preferences: { high_protein: false, low_calorie: false, quick_prep: false },
      photo_data_url: "",
      photo_filename: "",
    },
  });

  const restrictions = watch("restrictions") ?? [];
  const preferences = watch("preferences") ?? {};
  const photoDataUrl = watch("photo_data_url");
  const photoFilename = watch("photo_filename");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);
  const [processing, setProcessing] = useState(false);

  const toggleRestriction = (id: string) => {
    const next = restrictions.includes(id) ? restrictions.filter((r) => r !== id) : [...restrictions, id];
    setValue("restrictions", next);
  };

  const togglePreference = (key: string) => {
    setValue("preferences", { ...preferences, [key]: !preferences[key] });
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Image must be under 10 MB");
      return;
    }
    setProcessing(true);
    try {
      const dataUrl = await fileToResizedDataURL(file);
      setValue("photo_data_url", dataUrl);
      setValue("photo_filename", file.name);
    } catch (err) {
      toast.error("Couldn't process that image");
    } finally {
      setProcessing(false);
    }
  };

  const clearPhoto = () => {
    setValue("photo_data_url", "");
    setValue("photo_filename", "");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* ── Photo Upload ── */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="space-y-2">
        <Label className="text-base font-semibold text-[#212121]">Reference Photo <span className="text-[#9E9E9E] font-normal text-sm">(optional)</span></Label>
        <p className="text-sm text-[#9E9E9E]">Snap your fridge, a meal you loved, or a recipe from a magazine — our agents will match the vibe.</p>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {!photoDataUrl ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
            onDragLeave={() => setDragActive(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragActive(false);
              handleFile(e.dataTransfer.files?.[0]);
            }}
            className={cn(
              "flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 cursor-pointer transition-all",
              dragActive
                ? "border-[#4CAF50] bg-[#E8F5E9]"
                : "border-[#C8E6C9] bg-[#F1F8E9]/50 hover:border-[#4CAF50] hover:bg-[#E8F5E9]/60",
            )}
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[#4CAF50]/10">
              {processing ? (
                <Upload className="h-5 w-5 text-[#4CAF50] animate-pulse" />
              ) : (
                <Camera className="h-5 w-5 text-[#4CAF50]" />
              )}
            </div>
            <p className="text-sm font-medium text-[#212121]">
              {processing ? "Processing…" : "Drop a photo here or click to upload"}
            </p>
            <p className="text-xs text-[#9E9E9E]">JPEG, PNG, or HEIC · up to 10 MB</p>
          </div>
        ) : (
          <div className="relative inline-block rounded-xl overflow-hidden border border-[#C8E6C9] shadow-sm">
            <Image
              src={photoDataUrl}
              alt={photoFilename || "Uploaded reference"}
              width={320}
              height={240}
              className="object-cover"
              unoptimized
            />
            <button
              type="button"
              onClick={clearPhoto}
              className="absolute top-2 right-2 flex h-8 w-8 items-center justify-center rounded-full bg-black/70 text-white hover:bg-black/85 transition-colors"
              aria-label="Remove photo"
            >
              <X className="h-4 w-4" />
            </button>
            {photoFilename && (
              <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-3 py-2">
                <p className="text-xs text-white truncate">{photoFilename}</p>
              </div>
            )}
          </div>
        )}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="space-y-2">
        <Label htmlFor="message" className="text-base font-semibold text-[#212121]">What are you looking for?</Label>
        <p className="text-sm text-[#9E9E9E]">Describe your ideal meal, dietary goals, or any specific cravings.</p>
        <Textarea id="message" placeholder="e.g., I want a high-protein lunch that's easy to prep..." className={cn("min-h-[120px] resize-none border-gray-300 bg-white text-base text-[#212121]", errors.message && "border-[#F44336]")} {...register("message")} />
        {errors.message && <p className="flex items-center gap-1 text-xs text-[#F44336]"><AlertCircle className="h-3 w-3" />{errors.message.message}</p>}
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
        <Label htmlFor="goal" className="text-sm font-semibold text-[#212121]">Goal <span className="text-[#9E9E9E] font-normal">(optional)</span></Label>
        <Input id="goal" placeholder="e.g., Weight loss, Muscle gain, General wellness" className="border-gray-300 bg-white text-[#212121]" {...register("goal")} />
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3">
        <Label className="text-sm font-semibold text-[#212121]">Dietary Restrictions</Label>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
          {DIETARY_OPTIONS.map((opt) => {
            const active = restrictions.includes(opt.id);
            return (
              <button key={opt.id} type="button" onClick={() => toggleRestriction(opt.id)}
                className={cn("flex items-center gap-2 rounded-lg border p-3 text-left text-sm transition-all",
                  active ? "border-[#4CAF50] bg-[#E8F5E9] text-[#1B5E20]" : "border-gray-200 bg-white text-[#424242] hover:border-[#C8E6C9] hover:bg-[#F1F8E9]"
                )}>
                {opt.icon} {opt.label}
              </button>
            );
          })}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="space-y-3">
        <Label className="text-sm font-semibold text-[#212121]">Preferences</Label>
        <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
          {[
            { key: "high_protein", label: "High Protein", desc: "Prioritize protein-rich options" },
            { key: "low_calorie", label: "Low Calorie", desc: "Focus on lighter, lower-calorie meals" },
            { key: "quick_prep", label: "Quick Prep", desc: "Under 30 minutes preparation time" },
          ].map((pref) => (
            <div key={pref.key} className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-[#212121]">{pref.label}</p>
                <p className="text-xs text-[#9E9E9E]">{pref.desc}</p>
              </div>
              <Switch checked={preferences[pref.key] ?? false} onCheckedChange={() => togglePreference(pref.key)} />
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <Button type="submit" disabled={isSubmitting} size="lg" className="w-full bg-[#4CAF50] text-white font-semibold hover:bg-[#1B5E20] shadow-lg shadow-[#4CAF50]/20">
          <Sparkles className="h-4 w-4 mr-2" />
          {isSubmitting ? "Starting Pipeline..." : "Get Recommendations"}
        </Button>
        <p className="mt-2 text-center text-xs text-[#9E9E9E]">Our 3-agent pipeline will analyze your needs and generate personalized recommendations.</p>
      </motion.div>
    </form>
  );
}
