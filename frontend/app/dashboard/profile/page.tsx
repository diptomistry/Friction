"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import { useStore } from "@/lib/store";
import { Badge } from "@/components/ui/badge";

export default function DashboardProfilePage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();

  useEffect(() => {
    if (hasHydrated && !token) {
      router.push("/login");
    }
  }, [hasHydrated, token, router]);

  if (!hasHydrated || !user) return null;

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-xl font-semibold text-slate-900">Profile</h1>
              <p className="text-sm text-slate-500 mt-1">
                Your account information.
              </p>
            </div>
            <Badge className="capitalize bg-violet-50 text-violet-700 border-violet-200">
              {user.role}
            </Badge>
          </div>

          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
              <p className="mt-1 text-sm font-medium text-slate-900">{user.email}</p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-xs uppercase tracking-wide text-slate-500">Role</p>
              <p className="mt-1 text-sm font-medium capitalize text-slate-900">
                {user.role}
              </p>
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 sm:col-span-2">
              <p className="text-xs uppercase tracking-wide text-slate-500">
                Member Since
              </p>
              <p className="mt-1 text-sm font-medium text-slate-900">
                {new Date(user.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      </main>
    </AppSidebarLayout>
  );
}
