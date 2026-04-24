"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ApiLoadingState from "@/components/ApiLoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  createClassroom,
  getClassrooms,
  getMarks,
  type ClassroomRecord,
  type MarkRecord,
} from "@/lib/api";
import {
  BookOpen,
  Plus,
  Users,
  ChevronRight,
} from "lucide-react";
import Link from "next/link";

interface Classroom {
  id: string;
  name: string;
  student_count: number;
  marks_count: number;
}

export default function ClassroomsPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();

  const [classrooms, setClassrooms] = useState<Classroom[]>([]);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [loadingClassrooms, setLoadingClassrooms] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || !token) return;
    const loadClassrooms = async () => {
      setLoadingClassrooms(true);
      try {
        const [{ data: classroomsData }, { data: marks }] = await Promise.all([
          getClassrooms(),
          getMarks(),
        ]);
        const grouped = marks.reduce<Record<string, MarkRecord[]>>((acc, row) => {
          acc[row.classroom_id] = acc[row.classroom_id] ?? [];
          acc[row.classroom_id].push(row);
          return acc;
        }, {});

        const liveClassrooms: Classroom[] = (classroomsData as ClassroomRecord[]).map(
          (room) => {
            const rows = grouped[room.id] ?? [];
            const uniqueStudents = new Set(rows.map((r) => r.student_id)).size;
            return {
              id: room.id,
              name: room.name,
              student_count: room.student_count ?? uniqueStudents,
              marks_count: rows.length,
            };
          }
        );
        setClassrooms(liveClassrooms);
      } catch {
        toast.error("Could not load classrooms from API.");
      } finally {
        setLoadingClassrooms(false);
      }
    };
    void loadClassrooms();
  }, [hasHydrated, token]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      const res = await createClassroom(newName);
      const newId =
        (res.data as { id?: string; classroom_id?: string })?.id ??
        (res.data as { id?: string; classroom_id?: string })?.classroom_id ??
        `new-${Date.now()}`;
      const newRoom: Classroom = {
        id: String(newId),
        name: newName,
        student_count: 0,
        marks_count: 0,
      };

      setClassrooms((prev) => [newRoom, ...prev]);
      setNewName("");
      setCreating(false);
      toast.success("Classroom created!");
    } catch {
      toast.error("Could not create classroom.");
    } finally {
      setLoading(false);
    }
  };

  if (!hasHydrated || !user) return null;

  const isTeacher = user.role === "teacher";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-slate-900">Classrooms</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              {isTeacher
                ? "Manage your classrooms and student marks"
                : "View your enrolled classrooms"}
            </p>
          </div>
          {isTeacher && (
            <Button
              onClick={() => setCreating(true)}
              className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white gap-2"
              size="sm"
            >
              <Plus className="h-4 w-4" />
              New Classroom
            </Button>
          )}
        </div>

        {/* Create classroom form */}
        {creating && isTeacher && (
          <div className="bg-white rounded-2xl border border-violet-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3">
              Create a new classroom
            </h2>
            <form onSubmit={handleCreate} className="flex flex-col gap-3">
              <Input
                placeholder="Classroom name (e.g. Web Security 101)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                required
                className="rounded-xl"
              />
              <div className="flex gap-2">
                <Button
                  type="submit"
                  disabled={loading}
                  className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  size="sm"
                >
                  {loading ? "Creating…" : "Create"}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="rounded-xl"
                  onClick={() => setCreating(false)}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </div>
        )}

        {/* Classroom list */}
        <div className="space-y-3">
          {loadingClassrooms && <ApiLoadingState message="Loading classrooms..." />}
          {classrooms.map((room) => (
            <Link
              key={room.id}
              href={`/classrooms/${room.id}`}
              className="block bg-white rounded-2xl border border-slate-200 shadow-sm p-5 hover:shadow-md hover:border-violet-200 transition-all group"
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4">
                  <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0 group-hover:bg-violet-100 transition-colors">
                    <BookOpen className="h-5 w-5 text-violet-600" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900">{room.name}</h3>
                    <p className="text-xs text-slate-500 mt-0.5">Classroom</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge
                    variant="secondary"
                    className="text-xs gap-1 bg-slate-50 text-slate-600 border-slate-200"
                  >
                    <Users className="h-3 w-3" />
                    {room.student_count}
                  </Badge>
                  <Badge
                    variant="secondary"
                    className="text-xs gap-1 bg-violet-50 text-violet-700 border-violet-200"
                  >
                    Marks {room.marks_count}
                  </Badge>
                  <ChevronRight className="h-4 w-4 text-slate-400 group-hover:text-violet-500 transition-colors" />
                </div>
              </div>
            </Link>
          ))}
        </div>

        {classrooms.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <BookOpen className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No classrooms yet.</p>
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
