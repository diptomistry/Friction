"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { api } from "@/lib/api";
import {
  BookOpen,
  Plus,
  Users,
  ChevronRight,
  GraduationCap,
} from "lucide-react";
import Link from "next/link";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacher_email: string;
  student_count: number;
  created_at: string;
}

const DEMO_CLASSROOMS: Classroom[] = [
  {
    id: "demo-1",
    name: "Web Security 101",
    subject: "Computer Science",
    teacher_email: "prof.smith@school.edu",
    student_count: 24,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-2",
    name: "Applied Cryptography",
    subject: "Mathematics",
    teacher_email: "dr.jones@school.edu",
    student_count: 18,
    created_at: new Date().toISOString(),
  },
  {
    id: "demo-3",
    name: "Network Protocols",
    subject: "Engineering",
    teacher_email: "prof.lee@school.edu",
    student_count: 31,
    created_at: new Date().toISOString(),
  },
];

export default function ClassroomsPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();

  const [classrooms, setClassrooms] = useState<Classroom[]>(DEMO_CLASSROOMS);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newSubject, setNewSubject] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;
    setLoading(true);
    try {
      // Attempt real API call; fall back to demo if not implemented
      const res = await api
        .post("/api/classrooms", { name: newName, subject: newSubject })
        .catch(() => null);

      const newRoom: Classroom = res?.data ?? {
        id: `demo-${Date.now()}`,
        name: newName,
        subject: newSubject || "General",
        teacher_email: user?.email ?? "you@school.edu",
        student_count: 0,
        created_at: new Date().toISOString(),
      };

      setClassrooms((prev) => [newRoom, ...prev]);
      setNewName("");
      setNewSubject("");
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
              <Input
                placeholder="Subject (e.g. Computer Science)"
                value={newSubject}
                onChange={(e) => setNewSubject(e.target.value)}
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
                    <p className="text-xs text-slate-500 mt-0.5">
                      {room.subject} ·{" "}
                      <span className="inline-flex items-center gap-1">
                        <GraduationCap className="h-3 w-3" />
                        {room.teacher_email}
                      </span>
                    </p>
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
