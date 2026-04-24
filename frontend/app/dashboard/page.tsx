"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useStore } from "@/lib/store";
import { deleteAccount, getMe } from "@/lib/api";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ExploitHint from "@/components/ExploitHint";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  BookOpen,
  Upload,
  UserCircle,
  AlertTriangle,
  Trash2,
  RefreshCw,
} from "lucide-react";
import Link from "next/link";

export default function DashboardPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, token } = useStore();
  const [deletedAt, setDeletedAt] = useState<string | null>(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [ghostUser, setGhostUser] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      router.push("/login");
    }
  }, [token, router]);

  const handleDeleteAccount = async () => {
    if (!confirm("Are you sure you want to delete your account?")) return;
    setDeleteLoading(true);
    try {
      await deleteAccount("insecure");
      const timestamp = new Date().toLocaleTimeString();
      setDeletedAt(timestamp);
      toast.success("Account deleted.");
      // Do NOT clear local state — the insecure mode doesn't revoke the token
    } catch {
      toast.error("Failed to delete account.");
    } finally {
      setDeleteLoading(false);
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
    {
      icon: Upload,
      label: "Uploads",
      value: "Files",
      href: "/uploads",
      color: "violet",
    },
    {
      icon: UserCircle,
      label: "Role",
      value: user?.role ?? "—",
      href: "#",
      color: "emerald",
    },
  ];

  if (!user) return null;
  const showProfilePanel = searchParams.get("panel") === "profile";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {showProfilePanel && (
          <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">Profile</h2>
                <p className="text-sm text-slate-500 mt-1">
                  Your account information is shown here.
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push("/dashboard")}
                className="text-slate-500 hover:text-slate-700"
              >
                Close
              </Button>
            </div>
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
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
                <p className="text-xs uppercase tracking-wide text-slate-500">Member Since</p>
                <p className="mt-1 text-sm font-medium text-slate-900">
                  {new Date(user.created_at).toLocaleString()}
                </p>
              </div>
            </div>
          </div>
        )}

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

        {/* Danger zone — Act 2: delete + JWT still valid */}
        <div className="rounded-2xl border border-red-700 bg-red-600 shadow-sm p-6">
          <h2 className="text-base font-semibold text-white mb-1 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-white" />
            Danger Zone
          </h2>
          <p className="text-sm text-white/90 mb-4">
            Permanently delete your account. This action cannot be undone.
          </p>

          {deletedAt ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700 font-medium">
                ✓ Account deleted at {deletedAt}
              </div>

              {/* Act 2 — subtle doubt */}
              <p className="text-xs text-white/90 italic">
                Your session says &ldquo;deleted&rdquo;&hellip; but is your access really gone?
              </p>

              {/* Ghost request button */}
              <Button
                variant="outline"
                size="sm"
                className="rounded-xl border-amber-200 text-amber-700 hover:bg-amber-50 gap-2"
                onClick={async () => {
                  try {
                    const { data } = await getMe("insecure");
                    setGhostUser(data.email);
                    toast.warning(
                      "The deleted account token still works on insecure endpoints!"
                    );
                  } catch {
                    toast.success(
                      "Access denied — secure endpoint blocked the revoked token."
                    );
                  }
                }}
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Test if token still works
              </Button>

              {ghostUser && (
                <div className="rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
                  🔴 Token still authenticated as{" "}
                  <strong>{ghostUser}</strong> — account was deleted but JWT
                  lives on.
                </div>
              )}

              {/* Exploit Hint — Act 3 */}
              <ExploitHint
                title="JWT Never Logout"
                description="Deleting an account doesn't revoke the JWT. Any request with the old token still works on insecure endpoints — the backend has no memory of the logout."
                hint='Is your access really gone? The UI says "deleted" but the token disagrees.'
                generateInsecureCode={() =>
                  `// After "deleting" your account, your token still works:\nconst token = localStorage.getItem("friction_token");\nfetch("${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}/api/auth/me?mode=insecure", {\n  headers: { Authorization: \`Bearer \${token}\` }\n}).then(r => r.json()).then(console.log);`
                }
                generateSecureCode={() =>
                  `// With friction: token is blacklisted on delete\nconst token = localStorage.getItem("friction_token");\nfetch("${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000"}/api/auth/me?mode=secure", {\n  headers: { Authorization: \`Bearer \${token}\` }\n}).then(r => r.json()).then(console.log);\n// → 401 Token has been revoked`
                }
                expectedResult={{
                  insecure:
                    "Returns your full profile — deleted account still authenticates.",
                  secure:
                    "401 Unauthorized — token is blacklisted on delete, access immediately revoked.",
                }}
              />
            </div>
          ) : (
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
          )}
        </div>

        {/* Footer quote */}
        <p className="text-center text-xs text-slate-400 pb-4">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
