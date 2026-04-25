"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import { useStore } from "@/lib/store";
import {
  deleteAdminUserInsecure,
  deleteAdminUserSecure,
  listAdminUsers,
  type AdminUser,
} from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ManageUsersPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingDeleteUser, setPendingDeleteUser] = useState<AdminUser | null>(null);
  const [outcome, setOutcome] = useState<{
    mode: "jwt-only" | "friction";
    userEmail: string;
  } | null>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token || user?.role !== "admin") return;
    const load = async () => {
      setLoadingUsers(true);
      try {
        const { data } = await listAdminUsers();
        setUsers(data);
      } catch {
        toast.error("Could not load users.");
      } finally {
        setLoadingUsers(false);
      }
    };
    void load();
  }, [hasHydrated, token, user?.role]);

  const handleDeleteUser = async (
    target: AdminUser,
    mode: "jwt-only" | "friction"
  ) => {
    setDeletingId(target.id);
    try {
      if (mode === "jwt-only") {
        await deleteAdminUserInsecure(target.id);
      } else {
        await deleteAdminUserSecure(target.id);
      }
      setUsers((prev) => prev.filter((u) => u.id !== target.id));
      setOutcome({ mode, userEmail: target.email });
      toast.success(`Deleted ${target.email}`);
    } catch {
      toast.error("Could not delete user.");
    } finally {
      setDeletingId(null);
    }
  };

  if (!hasHydrated || !user) return null;
  if (user.role !== "admin") {
    return (
      <AppSidebarLayout>
        <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 text-sm text-slate-600">
            Only admins can access Manage Users.
          </div>
        </main>
      </AppSidebarLayout>
    );
  }

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div>
            <h1 className="text-base font-semibold text-slate-900 flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-violet-600" />
              Manage Users
            </h1>
            <p className="text-sm text-slate-500 mt-1">
              Delete user accounts and compare JWT-only vs friction behavior.
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="grid grid-cols-12 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-600">
              <div className="col-span-6">User</div>
              <div className="col-span-2">Role</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2 text-right">Action</div>
            </div>
            {loadingUsers ? (
              <div className="px-4 py-4 text-sm text-slate-500">Loading users…</div>
            ) : (
              <div className="divide-y divide-slate-100">
                {users.map((u) => (
                  <div key={u.id} className="grid grid-cols-12 px-4 py-3 items-center">
                    <div className="col-span-6 min-w-0">
                      <p className="text-sm text-slate-800 truncate">{u.email}</p>
                      <p className="text-xs text-slate-400 font-mono truncate">{u.id}</p>
                    </div>
                    <div className="col-span-2 text-sm capitalize text-slate-600">
                      {u.role}
                    </div>
                    <div className="col-span-2">
                      <Badge
                        variant="secondary"
                        className={
                          u.is_active
                            ? "bg-green-50 text-green-700 border-green-200"
                            : "bg-slate-100 text-slate-600 border-slate-200"
                        }
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="col-span-2 text-right">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setPendingDeleteUser(u)}
                        disabled={deletingId === u.id || u.id === user.id}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                ))}
                {users.length === 0 && (
                  <div className="px-4 py-4 text-sm text-slate-500">No users found.</div>
                )}
              </div>
            )}
          </div>

          {outcome && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${
                outcome.mode === "jwt-only"
                  ? "bg-amber-50 border-amber-200 text-amber-800"
                  : "bg-green-50 border-green-200 text-green-800"
              }`}
            >
              <p className="font-semibold">Deleted {outcome.userEmail}</p>
              <p className="mt-1">
                {outcome.mode === "jwt-only"
                  ? "JWT-only mode: user is not immediately logged out. If they already have a JWT, they can continue activities until token expiry."
                  : "JWT + friction mode: user can no longer perform activities because revocation/active checks block access immediately."}
              </p>
            </div>
          )}
        </div>

        <Dialog
          open={Boolean(pendingDeleteUser)}
          onOpenChange={(open) => {
            if (!open) setPendingDeleteUser(null);
          }}
        >
          <DialogContent className="max-w-lg rounded-2xl">
            <DialogHeader>
              <DialogTitle className="text-base text-slate-900">
                Delete {pendingDeleteUser?.email}
              </DialogTitle>
            </DialogHeader>
            <p className="text-sm text-slate-600">Choose the deletion simulation mode:</p>
            <div className="grid grid-cols-1 gap-3">
              <Button
                disabled={!pendingDeleteUser || deletingId === pendingDeleteUser?.id}
                onClick={async () => {
                  if (!pendingDeleteUser) return;
                  await handleDeleteUser(pendingDeleteUser, "jwt-only");
                  setPendingDeleteUser(null);
                }}
                className="w-full min-h-11 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-semibold whitespace-normal text-center leading-snug px-4"
              >
                Delete with JWT only
              </Button>
              <Button
                disabled={!pendingDeleteUser || deletingId === pendingDeleteUser?.id}
                onClick={async () => {
                  if (!pendingDeleteUser) return;
                  await handleDeleteUser(pendingDeleteUser, "friction");
                  setPendingDeleteUser(null);
                }}
                className="w-full min-h-11 rounded-xl bg-violet-700 hover:bg-violet-800 text-white font-semibold whitespace-normal text-center leading-snug px-4"
              >
                Delete with JWT + friction
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </main>
    </AppSidebarLayout>
  );
}
