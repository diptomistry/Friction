"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { deleteAccount, getTokenStatus } from "@/lib/api";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Upload,
  UserCircle,
  AlertTriangle,
  Trash2,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const { user, token, logout, hasHydrated } = useStore();
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [checkingToken, setCheckingToken] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) {
      router.push("/login");
    }
  }, [hasHydrated, token, router]);

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account?")) return;
    setDeleteLoading(true);
    try {
      await deleteAccount("secure");
      logout();
      toast.success("Account deleted. You have been logged out.");
      router.push("/login");
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setDeleteLoading(false);
    }
  };

  const handleCheckTokenStatus = async () => {
    setCheckingToken(true);
    try {
      const [{ data: insecure }, { data: secure }] = await Promise.all([
        getTokenStatus("insecure"),
        getTokenStatus("secure"),
      ]);
      toast.message("Token status checked", {
        description: `insecure: ${
          insecure.token_valid ? "valid" : "invalid"
        } | secure: ${secure.token_valid ? "valid" : "invalid"}`,
      });
    } catch {
      toast.error("Could not check token status.");
    } finally {
      setCheckingToken(false);
    }
  };

  const stats = [
    {
      icon: BookOpen,
      label: "Classrooms",
      value: user?.role === "teacher" ? "Manage" : "View",
      href: "/classrooms",
      color: "violet",
    },
    ...(user?.role === "teacher"
      ? [
          {
            icon: Upload,
            label: "Question Files",
            value: "Upload",
            href: "/uploads",
            color: "violet",
          },
        ]
      : []),
    {
      icon: UserCircle,
      label: "Role",
      value: user?.role ?? "—",
      href: "#",
      color: "emerald",
    },
  ];

  if (!hasHydrated || !user) return null;

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Welcome */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h1 className="text-xl font-bold text-slate-900">
                  Good morning
                </h1>
                <Badge
                  variant="secondary"
                  className="capitalize bg-violet-50 text-violet-700 border-violet-200"
                >
                  {user.role}
                </Badge>
              </div>
              <p className="text-slate-500 text-sm">{user.email}</p>
              <p className="text-xs text-slate-400 mt-1">
                Member since {new Date(user.created_at).toLocaleDateString()}
              </p>
              <Button
                size="sm"
                variant="outline"
                onClick={handleCheckTokenStatus}
                disabled={checkingToken}
                className="mt-3 rounded-lg"
              >
                {checkingToken ? "Checking..." : "Check token status"}
              </Button>
            </div>
            <div className="h-12 w-12 rounded-full bg-violet-100 flex items-center justify-center">
              <UserCircle className="h-7 w-7 text-violet-600" />
            </div>
          </div>
        </div>

        {/* Quick nav */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {stats.map(({ icon: Icon, label, value, href, color }) => (
            <Link
              key={label}
              href={href}
              className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md hover:border-${color}-200 transition-all group`}
            >
              <div
                className={`h-10 w-10 rounded-xl flex items-center justify-center bg-${color}-50 group-hover:bg-${color}-100 transition-colors`}
              >
                <Icon className={`h-5 w-5 text-${color}-600`} />
              </div>
              <div>
                <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">
                  {label}
                </p>
                <p className="text-base font-semibold text-slate-800 capitalize">
                  {value}
                </p>
              </div>
            </Link>
          ))}
        </div>

        {/* Danger zone — self-delete should be normal logout flow */}
        <div className="rounded-2xl border border-red-700 bg-red-600 shadow-sm p-6">
          <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-white" />
            Danger Zone
          </h2>
          <p className="text-sm text-white/90 mb-4">
            Permanently delete your account. This action cannot be undone.
          </p>

          <Button
            variant="destructive"
            size="sm"
            disabled={deleteLoading}
            onClick={handleDeleteAccount}
            className="rounded-xl gap-2 bg-white text-red-700 hover:bg-red-50 border border-red-200"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deleteLoading ? "Deleting…" : "Delete my account"}
          </Button>
        </div>

        {/* Footer quote */}
        <p className="text-center text-xs text-slate-400 pb-4">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
