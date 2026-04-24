"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  BookOpen,
  LayoutDashboard,
  LogOut,
  ShieldAlert,
  Upload,
  UserCircle,
} from "lucide-react";
import { useStore } from "@/lib/store";
import { logout as apiLogout } from "@/lib/api";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
} from "@/components/ui/sidebar";

const navByRole = {
  student: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/classrooms", label: "Classrooms", icon: BookOpen },
    { href: "/uploads", label: "Uploads", icon: Upload },
  ],
  teacher: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/classrooms", label: "Classrooms", icon: BookOpen },
  ],
  admin: [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/dashboard/users", label: "Manage Users", icon: ShieldAlert },
    { href: "/classrooms", label: "Classrooms", icon: BookOpen },
  ],
} as const;

function TextLogo() {
  return (
    <span className="inline-flex items-center gap-[5px] select-none font-sans">
      <span className="text-slate-800 font-semibold tracking-tight text-[1.05rem] leading-none group-data-[collapsible=icon]:hidden">
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

export default function AppSidebarLayout({
  children,
}: {
  children: React.ReactNode;
}) {
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

  const initials =
    user?.email
      ?.split("@")[0]
      .split(/[._-]/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join("") || "CX";

  const navLinks = user ? navByRole[user.role] : navByRole.student;

  return (
    <SidebarProvider>
      <Sidebar variant="inset" collapsible="icon" className="border-r-0">
        <SidebarHeader className="px-3 py-4">
          <Link href="/dashboard" className="inline-flex items-center">
            <TextLogo />
          </Link>
        </SidebarHeader>
        <SidebarSeparator />
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupContent>
              <SidebarMenu>
                {navLinks.map(({ href, label, icon: Icon }) => (
                  <SidebarMenuItem key={href}>
                    {(() => {
                      const isActive =
                        href === "/dashboard"
                          ? pathname === "/dashboard"
                          : pathname.startsWith(href);
                      return (
                    <SidebarMenuButton
                      isActive={isActive}
                      className="h-10 rounded-xl data-[active=true]:bg-violet-50 data-[active=true]:text-violet-700"
                      render={
                        <Link href={href}>
                          <Icon className="h-4 w-4" />
                          <span>{label}</span>
                        </Link>
                      }
                    >
                      <Icon className="h-4 w-4" />
                      <span>{label}</span>
                    </SidebarMenuButton>
                      );
                    })()}
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter className="p-3" />
      </Sidebar>
      <SidebarInset className="bg-[#f8fafc]">
        <header className="sticky top-0 z-20 border-b border-slate-200/70 bg-white/80 px-4 py-2 backdrop-blur-sm md:px-6">
          <div className="flex items-center justify-between gap-2">
            <SidebarTrigger className="text-slate-600" />
            <DropdownMenu>
              <DropdownMenuTrigger className="inline-flex h-9 w-9 items-center justify-center rounded-full p-0 hover:bg-violet-50">
                <Avatar className="h-8 w-8 border border-slate-200">
                  <AvatarFallback className="bg-violet-100 text-violet-700 text-xs font-semibold">
                    {initials}
                  </AvatarFallback>
                </Avatar>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 rounded-xl">
                <DropdownMenuGroup>
                  <DropdownMenuLabel className="flex flex-col gap-0.5">
                    <span className="truncate text-sm font-medium text-slate-900">
                      {user?.email ?? "Guest"}
                    </span>
                    <span className="text-xs font-normal capitalize text-slate-500">
                      {user?.role ?? "user"}
                    </span>
                  </DropdownMenuLabel>
                </DropdownMenuGroup>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push("/dashboard/profile")}
                  className="cursor-pointer rounded-lg"
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Profile
                </DropdownMenuItem>
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer rounded-lg text-red-600 focus:text-red-600"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>
        {children}
      </SidebarInset>
    </SidebarProvider>
  );
}
