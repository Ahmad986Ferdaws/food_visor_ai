"use client";
import { TopNav } from "./TopNav";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-screen bg-background">
      <TopNav />
      <main className="pt-16">{children}</main>
    </div>
  );
}
