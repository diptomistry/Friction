"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ApiLoadingState from "@/components/ApiLoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  createNotice,
  deleteNotice,
  getNotices,
  updateNotice,
  type NoticeRecord,
} from "@/lib/api";
import { useStore } from "@/lib/store";

export default function ManageNoticesPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notices, setNotices] = useState<NoticeRecord[]>([]);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [isPublished, setIsPublished] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  const loadNotices = async () => {
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

  useEffect(() => {
    if (!hasHydrated || !token || user?.role !== "admin") return;
    void loadNotices();
  }, [hasHydrated, token, user?.role]);

  const sortedNotices = useMemo(
    () =>
      [...notices].sort(
        (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime()
      ),
    [notices]
  );

  const resetForm = () => {
    setTitle("");
    setBody("");
    setIsPublished(true);
    setEditingId(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !body.trim()) {
      toast.error("Title and body are required.");
      return;
    }
    setSaving(true);
    try {
      if (editingId) {
        await updateNotice(editingId, {
          title: title.trim(),
          body: body.trim(),
          is_published: isPublished,
        });
        toast.success("Notice updated.");
      } else {
        await createNotice({
          title: title.trim(),
          body: body.trim(),
          is_published: isPublished,
        });
        toast.success("Notice created.");
      }
      resetForm();
      await loadNotices();
    } catch {
      toast.error(editingId ? "Could not update notice." : "Could not create notice.");
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (notice: NoticeRecord) => {
    setEditingId(notice.id);
    setTitle(notice.title);
    setBody(notice.body);
    setIsPublished(notice.is_published);
  };

  const handleDelete = async (noticeId: string) => {
    setDeletingId(noticeId);
    try {
      await deleteNotice(noticeId);
      setNotices((prev) => prev.filter((n) => n.id !== noticeId));
      toast.success("Notice deleted.");
      if (editingId === noticeId) resetForm();
    } catch {
      toast.error("Could not delete notice.");
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
            Only admins can manage notices.
          </div>
        </main>
      </AppSidebarLayout>
    );
  }

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Bell className="h-5 w-5 text-violet-600" />
            Manage Notices
          </h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Create and manage global notices for students.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3"
        >
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Notice title"
            className="rounded-xl"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Notice body"
            rows={4}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
          />
          <label className="inline-flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={isPublished}
              onChange={(e) => setIsPublished(e.target.checked)}
              className="h-4 w-4 rounded border-violet-300 accent-violet-600"
            />
            Published
          </label>
          <div className="flex gap-2">
            <Button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
            >
              {saving ? "Saving..." : editingId ? "Update Notice" : "Create Notice"}
            </Button>
            {editingId ? (
              <Button type="button" variant="ghost" className="rounded-xl" onClick={resetForm}>
                Cancel Edit
              </Button>
            ) : null}
          </div>
        </form>

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 text-sm font-semibold text-slate-800">
            Existing Notices
          </div>
          {loading ? (
            <div className="p-4">
              <ApiLoadingState compact message="Loading notices..." />
            </div>
          ) : sortedNotices.length === 0 ? (
            <div className="px-5 py-4 text-sm text-slate-500">No notices yet.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {sortedNotices.map((notice) => (
                <div key={notice.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900">{notice.title}</p>
                      <p className="text-sm text-slate-700 mt-1 whitespace-pre-wrap">{notice.body}</p>
                      <p className="text-xs text-slate-400 mt-2">
                        {notice.is_published ? "Published" : "Draft"} · Updated{" "}
                        {new Date(notice.updated_at).toLocaleString()}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="outline"
                        className="rounded-lg"
                        onClick={() => handleEdit(notice)}
                      >
                        <Pencil className="h-3.5 w-3.5 mr-1" />
                        Edit
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50"
                        disabled={deletingId === notice.id}
                        onClick={() => handleDelete(notice.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 mr-1" />
                        {deletingId === notice.id ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </AppSidebarLayout>
  );
}
