"use client";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Moon, Sun, Menu, LogOut, Sparkles } from "lucide-react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useUserStore } from "@/store/userStore";

const navLinks = [
  { href: "/app/dashboard", label: "Dashboard" },
  { href: "/app/new", label: "New Request" },
  { href: "/app/history", label: "History" },
  { href: "/app/about", label: "About Me" },
  { href: "/app/settings", label: "Settings" },
];

export function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const logout = useUserStore((s) => s.logout);

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <motion.header
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="fixed top-0 z-50 w-full border-b border-white/60 bg-white/70 backdrop-blur-xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/app/dashboard" className="flex items-center gap-2 transition-opacity hover:opacity-80">
          <div className="relative h-8 w-28">
            <Image src="/logo.png" alt="FoodVisor AI" fill className="object-contain" />
          </div>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href}>
                <Button
                  variant="ghost"
                  size="sm"
                  className={cn(
                    "relative text-sm text-slate-600",
                    isActive && "text-[#1B5E20]"
                  )}
                >
                  {link.label}
                  {isActive && (
                    <motion.div
                      layoutId="nav-indicator"
                      className="absolute -bottom-px left-2 right-2 h-0.5 rounded-full bg-[#4CAF50]"
                      transition={{ type: "spring", stiffness: 400, damping: 30 }}
                    />
                  )}
                </Button>
              </Link>
            );
          })}
        </nav>

        {/* Right actions */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label="Toggle theme"
            className="text-[#9E9E9E] hover:text-[#212121] dark:hover:text-white"
          >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          </Button>

          <Link href="/app/new" className="hidden md:block">
            <Button size="sm" className="bg-[#4CAF50] text-white hover:bg-[#43A047]">
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              New Request
            </Button>
          </Link>

          <Button
            variant="ghost"
            size="icon"
            onClick={handleLogout}
            className="hidden text-[#9E9E9E] hover:text-[#F44336] md:flex"
            aria-label="Logout"
          >
            <LogOut className="h-4 w-4" />
          </Button>

          {/* Mobile menu */}
          <Sheet>
            <SheetTrigger asChild className="md:hidden">
              <Button variant="ghost" size="icon" aria-label="Open menu">
                <Menu className="h-5 w-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <nav className="mt-8 flex flex-col gap-2">
                {navLinks.map((link) => (
                  <Link key={link.href} href={link.href}>
                    <Button variant={pathname.startsWith(link.href) ? "secondary" : "ghost"} className="w-full justify-start">
                      {link.label}
                    </Button>
                  </Link>
                ))}
                <Link href="/app/new" className="mt-4">
                  <Button className="w-full bg-[#4CAF50] text-white hover:bg-[#43A047]">
                    <Sparkles className="mr-1.5 h-3.5 w-3.5" />
                    New Request
                  </Button>
                </Link>
                <Button variant="ghost" onClick={handleLogout} className="w-full justify-start text-[#F44336]">
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </Button>
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </motion.header>
  );
}
