"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/AppShell";
import { useUserStore } from "@/store/userStore";

type AuthState = "checking" | "authed" | "unauthed";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const setToken = useUserStore((s) => s.setToken);
  const [authState, setAuthState] = useState<AuthState>("checking");

  useEffect(() => {
    if (typeof window === "undefined") return;
    // Single source of truth for "am I logged in?" — the JWT in localStorage.
    // setToken on login writes here synchronously, so this check is always
    // up-to-date by the time the dashboard mounts.
    const token = localStorage.getItem("auth_token");
    console.info("[auth-guard] localStorage token:", token ? `present (len=${token.length})` : "ABSENT");
    if (!token) {
      setAuthState("unauthed");
      router.replace("/login");
      return;
    }
    // Make sure zustand mirrors localStorage so other components (TopNav, dashboard greeting)
    // see the token even if the persist middleware hasn't rehydrated yet.
    setToken(token);
    setAuthState("authed");
  }, [router, setToken]);

  if (authState === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-[#F1F8E9] via-white to-[#E8F5E9]">
        <div className="h-8 w-8 rounded-full border-2 border-[#4CAF50] border-t-transparent animate-spin" />
      </div>
    );
  }
  if (authState === "unauthed") return null;

  return <AppShell>{children}</AppShell>;
}
