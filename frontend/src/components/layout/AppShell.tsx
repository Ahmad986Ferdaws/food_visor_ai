"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { LayoutDashboard, Clock, BarChart2, Settings, User } from "lucide-react";
import { TopNav } from "./TopNav";
import { cn } from "@/lib/utils";

interface AppShellProps {
  children: React.ReactNode;
}

const NAV = [
  { href: "/app/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/app/history",   icon: Clock,           label: "History"   },
  { href: "/app/new",       icon: BarChart2,       label: "New"       },
  { href: "/app/about",     icon: User,            label: "About Me"  },
  { href: "/app/settings",  icon: Settings,        label: "Settings"  },
];

function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="fixed left-4 top-1/2 z-40 hidden -translate-y-1/2 flex-col gap-3 rounded-2xl border border-white/60 bg-white/70 p-3 shadow-[0_8px_32px_rgba(46,125,50,0.10)] backdrop-blur-md lg:flex">
      {NAV.map(({ href, icon: Icon, label }) => {
        const active = pathname === href;
        return (
          <Link key={href} href={href} aria-label={label}>
            <motion.div
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.95 }}
              className={cn(
                "flex h-11 w-11 items-center justify-center rounded-xl transition-colors",
                active
                  ? "bg-[#4CAF50] text-white shadow-md shadow-[#4CAF50]/30"
                  : "text-slate-400 hover:bg-[#E8F5E9] hover:text-[#1B5E20]",
              )}
            >
              <Icon className="h-5 w-5" />
            </motion.div>
          </Link>
        );
      })}
    </aside>
  );
}

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="relative min-h-screen bg-gradient-to-br from-[#F1F8E9] via-white to-[#E8F5E9]">
      <TopNav />
      <Sidebar />
      <main className="pt-16 lg:pl-24">{children}</main>
    </div>
  );
}
