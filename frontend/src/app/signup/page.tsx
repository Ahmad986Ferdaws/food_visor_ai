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

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignupForm = z.infer<typeof signupSchema>;

export default function SignupPage() {
  const router = useRouter();
  const { setUser, setToken } = useUserStore();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SignupForm>({ resolver: zodResolver(signupSchema) });

  const onSubmit = async (data: SignupForm) => {
    setLoading(true);
    try {
      const response = await authAPI.signup(data.email, data.password);
      const { token, user } = response.data;
      setToken(token);
      setUser(user);
      toast.success("Account created!", { description: "Welcome to FoodVisor AI" });
      router.push("/app/dashboard");
    } catch (error: any) {
      toast.error(error.response?.data?.detail || "Signup failed. Is the backend running?");
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
          <div className="mb-8 flex justify-center">
            <div className="relative h-16 w-40">
              <Image src="/logo.png" alt="FoodVisor AI" fill className="object-contain" priority />
            </div>
          </div>

          <h1 className="mb-1 text-center text-2xl font-bold text-[#212121]">Create Account</h1>
          <p className="mb-8 text-center text-sm text-[#9E9E9E]">Start your personalized nutrition journey</p>

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
                  placeholder="Min. 8 characters"
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

            <div>
              <Label htmlFor="confirmPassword" className="text-[#424242]">Confirm Password</Label>
              <Input
                id="confirmPassword"
                type="password"
                placeholder="Re-enter your password"
                className="mt-1.5 border-gray-300 bg-white text-[#212121] focus:border-[#4CAF50] focus:ring-[#4CAF50]"
                {...register("confirmPassword")}
              />
              {errors.confirmPassword && <p className="mt-1 text-xs text-[#F44336]">{errors.confirmPassword.message}</p>}
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#4CAF50] font-semibold text-white hover:bg-[#1B5E20]"
            >
              {loading ? "Creating account..." : "Create Account"}
            </Button>
          </form>

          <p className="mt-6 text-center text-sm text-[#9E9E9E]">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-[#4CAF50] hover:text-[#1B5E20]">
              Sign in
            </Link>
          </p>
        </Card>
      </motion.div>
    </div>
  );
}
