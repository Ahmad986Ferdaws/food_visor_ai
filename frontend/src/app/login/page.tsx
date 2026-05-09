"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { authAPI } from "@/lib/api";
import { useUserStore } from "@/store/userStore";

const loginSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
});

type LoginForm = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const router = useRouter();
  const { setUser, setToken } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginForm>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      const response = await authAPI.login(data.email, data.password);
      const { token, user } = response.data;
      console.info("[login] success — token len:", token?.length, "user:", user);
      setToken(token);
      setUser(user);
      toast.success("Welcome back!");
      // Full reload instead of router.push so the dashboard renders against the
      // persisted localStorage token without any hydration race window.
      if (typeof window !== "undefined") {
        window.location.assign("/app/dashboard");
      } else {
        router.push("/app/dashboard");
      }
    } catch (error: any) {
      const detail = error?.response?.data?.detail;
      const status = error?.response?.status;
      console.error("[login] failed", { status, detail, error });
      toast.error(detail || `Login failed${status ? ` (${status})` : ""}. Is the backend running?`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F5F5F5] to-[#E8F5E9] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        <Card className="border-gray-200 bg-white/95 p-8 shadow-xl backdrop-blur">
          {/* Logo */}
          <div className="mb-8 flex justify-center">
            <div className="relative h-16 w-40">
              <Image src="/logo.png" alt="FoodVisor AI" fill className="object-contain" priority />
            </div>
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold text-[#212121]">Welcome Back</h1>
          <p className="mb-8 text-center text-sm text-[#9E9E9E]">Sign in to your FoodVisor account</p>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <Label htmlFor="email" className="text-[#424242]">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                className="mt-1.5 border-gray-300 bg-white text-[#212121] focus:border-[#4CAF50] focus:ring-[#4CAF50]"
                {...register("email")}
              />
              {errors.email && <p className="mt-1 text-xs text-[#F44336]">{errors.email.message}</p>}
            </div>

            <div>
              <Label htmlFor="password" className="text-[#424242]">Password</Label>
              <div className="relative mt-1.5">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  className="border-gray-300 bg-white pr-10 text-[#212121] focus:border-[#4CAF50] focus:ring-[#4CAF50]"
                  {...register("password")}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9E9E9E] hover:text-[#424242]"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {errors.password && <p className="mt-1 text-xs text-[#F44336]">{errors.password.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4CAF50] font-semibold text-white hover:bg-[#1B5E20]"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#9E9E9E]">
            Don&apos;t have an account?{" "}
            <Link href="/signup" className="font-medium text-[#4CAF50] hover:text-[#1B5E20]">
              Sign up
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
