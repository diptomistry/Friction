"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell } from "lucide-react";
import { toast } from "sonner";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ApiLoadingState from "@/components/ApiLoadingState";
import { getNotices, type NoticeRecord } from "@/lib/api";
import { useStore } from "@/lib/store";

export default function NoticesPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();
  const [loading, setLoading] = useState(false);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token || user?.role !== "student") return;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await getNotices();
        setNotices(data);
      } catch {
        toast.error("Could not load notices.");
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [hasHydrated, token, user?.role]);

  const sortedNotices = useMemo(
    () =>
      [...notices].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [notices]
  );

  if (!hasHydrated || !user) return null;

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-violet-600" />
            Student Notices
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">Published notices from admin.</p>
        </div>

        {user.role !== "student" ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-600">
            Notices page is available for students.
          </div>
        ) : loading ? (
          <ApiLoadingState message="Loading notices..." />
        ) : sortedNotices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-500">
            No notices available right now.
          </div>
        ) : (
          <div className="space-y-3">
            {sortedNotices.map((notice) => (
              <div
                key={notice.id}
                className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5"
              >
                <h2 className="text-sm font-semibold text-slate-900">{notice.title}</h2>
                <p className="text-sm text-slate-700 mt-2 whitespace-pre-wrap">{notice.body}</p>
                <p className="text-xs text-slate-400 mt-3">
                  Updated {new Date(notice.updated_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </AppSidebarLayout>
  );
}
