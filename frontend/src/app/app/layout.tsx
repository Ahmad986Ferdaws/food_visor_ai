"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useUserStore } from "@/store/userStore";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const token = useUserStore((s) => s.token);

  useEffect(() => {
    // Auth guard: redirect to login if no token
    if (!token) {
      router.replace("/login");
    }
  }, [token, router]);

  if (!token) return null;

  return <AppShell>{children}</AppShell>;
}
