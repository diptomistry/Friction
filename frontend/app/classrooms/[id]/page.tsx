"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ExploitHint from "@/components/ExploitHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { secureUpdateMarks } from "@/lib/api";
import {
  Users,
  BookOpen,
  ArrowLeft,
  Lock,
  UserPlus,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";

interface Student {
  id: string;
  email: string;
  marks: number | null;
}

const DEMO_STUDENTS: Student[] = [
  { id: "student-uuid-001", email: "alice@school.edu", marks: 87 },
  { id: "student-uuid-002", email: "bob@school.edu", marks: 72 },
  { id: "student-uuid-003", email: "carol@school.edu", marks: null },
];

const DEMO_CLASSROOMS: Record<
  string,
  { name: string; subject: string; teacherEmail: string }
> = {
  "demo-1": {
    name: "Web Security 101",
    subject: "Computer Science",
    teacherEmail: "prof.smith@school.edu",
  },
  "demo-2": {
    name: "Applied Cryptography",
    subject: "Mathematics",
    teacherEmail: "dr.jones@school.edu",
  },
  "demo-3": {
    name: "Network Protocols",
    subject: "Engineering",
    teacherEmail: "prof.lee@school.edu",
  },
};

function MarksCell({
  student,
  classroomId,
  isTeacher,
  onUpdate,
}: {
  student: Student;
  classroomId: string;
  isTeacher: boolean;
  onUpdate: (studentId: string, marks: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(String(student.marks ?? ""));
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    const marks = parseInt(value, 10);
    if (isNaN(marks) || marks < 0 || marks > 100) {
      toast.error("Marks must be between 0 and 100");
      return;
    }
    setSaving(true);
    try {
      await secureUpdateMarks({
        student_id: student.id,
        classroom_id: classroomId,
        marks,
      });
      onUpdate(student.id, marks);
      setEditing(false);
      toast.success("Marks updated!");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to update marks";
      toast.error(detail);
    } finally {
      setSaving(false);
    }
  };

  if (!isTeacher) {
    return (
      <span
        className={`text-sm font-semibold ${
          student.marks === null
            ? "text-slate-400"
            : student.marks >= 75
            ? "text-green-600"
            : student.marks >= 50
            ? "text-amber-600"
            : "text-red-600"
        }`}
      >
        {student.marks === null ? "—" : `${student.marks}/100`}
      </span>
    );
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <Input
          type="number"
          min={0}
          max={100}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="h-8 w-20 rounded-lg text-sm"
          autoFocus
        />
        <Button
          size="sm"
          disabled={saving}
          onClick={handleSave}
          className="h-8 rounded-lg bg-green-600 hover:bg-green-700 text-white px-2"
        >
          <CheckCircle className="h-3.5 w-3.5" />
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setEditing(false)}
          className="h-8 rounded-lg px-2 text-slate-500"
        >
          ✕
        </Button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className={`text-sm font-semibold hover:opacity-70 transition-opacity ${
        student.marks === null
          ? "text-slate-400"
          : student.marks >= 75
          ? "text-green-600"
          : student.marks >= 50
          ? "text-amber-600"
          : "text-red-600"
      }`}
    >
      {student.marks === null ? "Click to grade" : `${student.marks}/100`}
    </button>
  );
}

export default function ClassroomDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, token } = useStore();

  const [students, setStudents] = useState<Student[]>(DEMO_STUDENTS);
  const [enrollEmail, setEnrollEmail] = useState("");
  const [enrolling, setEnrolling] = useState(false);

  const classroom = DEMO_CLASSROOMS[id] ?? {
    name: "Classroom",
    subject: "Subject",
    teacherEmail: user?.email ?? "teacher@school.edu",
  };

  const isTeacher = user?.role === "teacher";

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!enrollEmail.trim()) return;
    setEnrolling(true);
    setTimeout(() => {
      const newStudent: Student = {
        id: `student-${Date.now()}`,
        email: enrollEmail,
        marks: null,
      };
      setStudents((prev) => [...prev, newStudent]);
      setEnrollEmail("");
      setEnrolling(false);
      toast.success(`${enrollEmail} enrolled!`);
    }, 600);
  };

  const handleMarkUpdate = (studentId: string, marks: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, marks } : s))
    );
  };

  if (!user) return null;

  const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Back + Title */}
        <div>
          <Link
            href="/classrooms"
            className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-violet-600 mb-3 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Classrooms
          </Link>
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-xl font-bold text-slate-900">
                {classroom.name}
              </h1>
              <div className="flex items-center gap-2 mt-1">
                <Badge
                  variant="secondary"
                  className="text-xs bg-violet-50 text-violet-700 border-violet-200"
                >
                  {classroom.subject}
                </Badge>
                <span className="text-xs text-slate-400">
                  {classroom.teacherEmail}
                </span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-violet-600" />
            </div>
          </div>
        </div>

        {/* Enroll students (teacher only) */}
        {isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet-500" />
              Enroll a student
            </h2>
            <form onSubmit={handleEnroll} className="flex gap-2">
              <Input
                type="email"
                placeholder="student@school.edu"
                value={enrollEmail}
                onChange={(e) => setEnrollEmail(e.target.value)}
                required
                className="rounded-xl"
              />
              <Button
                type="submit"
                disabled={enrolling}
                size="sm"
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0"
              >
                {enrolling ? "Enrolling…" : "Enroll"}
              </Button>
            </form>
          </div>
        )}

        {/* Student marks table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <Users className="h-4 w-4 text-slate-500" />
              Students
              <Badge
                variant="secondary"
                className="text-xs bg-slate-50 text-slate-600"
              >
                {students.length}
              </Badge>
            </h2>
            {!isTeacher && (
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3 w-3" />
                <span>Read-only</span>
              </div>
            )}
          </div>

          <div className="divide-y divide-slate-100">
            {students.map((student) => (
              <div
                key={student.id}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium text-slate-800">
                    {student.email}
                  </p>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    {student.id}
                  </p>
                </div>
                <MarksCell
                  student={student}
                  classroomId={id}
                  isTeacher={isTeacher}
                  onUpdate={handleMarkUpdate}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Act 2 — Broken Access Control hint for students */}
        {!isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Marks are read-only for students
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  The edit button is hidden from the UI.
                </p>
              </div>
            </div>

            <ExploitHint
              title="Broken Access Control — Marks"
              description="Students don't see an edit button, but the API endpoint has no role check. Any authenticated user can update any student's marks by calling the insecure endpoint directly."
              hint="Can you REALLY not edit? UI restriction is not security."
              generateInsecureCode={() =>
                `// As a student — no edit button in UI, but:\nconst token = localStorage.getItem("friction_token");\nfetch("${BASE}/api/insecure/marks/update", {\n  method: "PUT",\n  headers: {\n    "Content-Type": "application/json",\n    Authorization: \`Bearer \${token}\`\n  },\n  body: JSON.stringify({\n    student_id: "${students[0]?.id ?? "YOUR_STUDENT_ID"}",\n    classroom_id: "${id}",\n    marks: 100\n  })\n}).then(r => r.json()).then(console.log);`
              }
              generateSecureCode={() =>
                `// With friction: role check enforced on the server\nconst token = localStorage.getItem("friction_token");\nfetch("${BASE}/api/secure/marks/update", {\n  method: "PUT",\n  headers: {\n    "Content-Type": "application/json",\n    Authorization: \`Bearer \${token}\`\n  },\n  body: JSON.stringify({\n    student_id: "${students[0]?.id ?? "YOUR_STUDENT_ID"}",\n    classroom_id: "${id}",\n    marks: 100\n  })\n}).then(r => r.json()).then(console.log);\n// → 403 Only teachers can update marks`
              }
              expectedResult={{
                insecure:
                  "200 OK — marks updated. Any authenticated user can edit any grade.",
                secure:
                  "403 Forbidden — server validates role (teacher only) + classroom ownership + student enrollment.",
              }}
            />
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
