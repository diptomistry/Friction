"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import { logout as apiLogout } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { BookOpen, LayoutDashboard, Upload, LogOut } from "lucide-react";

const navLinks = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/classrooms", label: "Classrooms", icon: BookOpen },
  { href: "/uploads", label: "Uploads", icon: Upload },
];

function TextLogo() {
  return (
    <span className="inline-flex items-center gap-[5px] select-none font-sans">
  <span className="text-slate-800 font-semibold tracking-tight text-[1.05rem] leading-none">
    Classroom
  </span>
  <span
    className="text-white font-extrabold italic leading-none"
    style={{
      background: "#6d28d9",
      fontSize: "0.76rem",
      padding: "2px 6px 2px 5px",
      borderRadius: "5px",
      letterSpacing: "0.04em",
      fontFamily: "Georgia, serif",
    }}
  >
    X
  </span>
</span>
  );
}

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useStore();

  const handleLogout = async () => {
    try {
      await apiLogout("insecure");
    } catch {
      // Ignore network errors — still clear local state
    }
    logout();
    router.push("/login");
  };

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex h-14 items-center justify-between">
          {/* Brand */}
          <Link href="/dashboard" className="flex items-center">
            <TextLogo />
          </Link>

          {/* Nav links */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon }) => {
              const active = pathname.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
                    active
                      ? "bg-violet-50 text-violet-700"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </Link>
              );
            })}
          </nav>

          {/* User / Logout */}
          <div className="flex items-center gap-3">
            {user && (
              <div className="hidden sm:flex flex-col items-end">
                <span className="text-xs font-medium text-slate-900">
                  {user.email}
                </span>
                <span className="text-[10px] text-slate-500 capitalize">
                  {user.role}
                </span>
              </div>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="text-slate-500 hover:text-red-600 hover:bg-red-50 h-8 px-2"
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">Logout</span>
            </Button>
          </div>
        </div>
      </div>
    </header>
  );
}
