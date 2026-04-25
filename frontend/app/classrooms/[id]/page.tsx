"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ApiLoadingState from "@/components/ApiLoadingState";
import ExploitHint from "@/components/ExploitHint";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import {
  enrollStudent,
  getAllStudents,
  getClassroomFiles,
  getClassrooms,
  getClassroomStudents,
  getFileDownload,
  getMarks,
  type ClassroomStudent,
  type ClassroomRecord,
  type ClassroomFileRecord,
  secureUpdateMarks,
  type MarkRecord,
} from "@/lib/api";
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

const formatCountdown = (targetMs: number, nowMs: number) => {
  const diff = targetMs - nowMs;
  if (diff <= 0) return "publishing now";
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `publishes in ${pad(hours)}h ${pad(minutes)}m ${pad(seconds)}s`;
};

function MarksCell({
  student,
  classroomId,
  fileId,
  isTeacher,
  onUpdate,
}: {
  student: Student;
  classroomId: string;
  fileId: string | null;
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
      if (!fileId) {
        toast.error("Select a file first.");
        return;
      }
      await secureUpdateMarks({
        student_id: student.id,
        classroom_id: classroomId,
        file_id: fileId,
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

  if (!fileId) {
    return <span className="text-xs text-slate-400">Select file</span>;
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
  const { user, token, hasHydrated } = useStore();

  const [students, setStudents] = useState<Student[]>([]);
  const [marksRecords, setMarksRecords] = useState<MarkRecord[]>([]);
  const [availableStudents, setAvailableStudents] = useState<ClassroomStudent[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [enrolling, setEnrolling] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);
  const [classroomMeta, setClassroomMeta] = useState<ClassroomRecord | null>(null);
  const [classroomFiles, setClassroomFiles] = useState<ClassroomFileRecord[]>([]);
  const [selectedMarkFileId, setSelectedMarkFileId] = useState<string | null>(null);
  const [openingFileId, setOpeningFileId] = useState<string | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const isTeacher = user?.role === "teacher";

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  const loadClassroomData = useCallback(async () => {
    if (!token || !user) return;
    setLoadingStudents(true);
    try {
      const [studentsRes, marksRes] = await Promise.all([
        getClassroomStudents(id),
        getMarks(),
      ]);
      setMarksRecords(marksRes.data);

      const markIndex = marksRes.data
        .filter(
          (m: MarkRecord) =>
            m.classroom_id === id &&
            (!selectedMarkFileId || m.file_id === selectedMarkFileId)
        )
        .reduce<Record<string, number>>((acc, mark) => {
          acc[mark.student_id] = mark.marks;
          return acc;
        }, {});

      const mappedStudents: Student[] = studentsRes.data
        .filter((s) => s.role !== "teacher" && s.role !== "admin")
        .map((s) => ({
          id: s.id,
          email: s.email,
          marks: markIndex[s.id] ?? null,
        }));
      setStudents(mappedStudents);

      try {
        const { data: classrooms } = await getClassrooms();
        const found = classrooms.find((room) => room.id === id) ?? null;
        setClassroomMeta(found);
      } catch {
        // Non-blocking metadata fetch
      }
    } catch {
      if (user.role === "student") {
        try {
          const { data: marks } = await getMarks();
          setMarksRecords(marks);
          const selfMark = marks.find(
            (m) => m.classroom_id === id && m.student_id === user.id
          );
          setStudents([
            {
              id: user.id,
              email: user.email,
              marks: selfMark?.marks ?? null,
            },
          ]);
        } catch {
          toast.error("Could not load classroom data.");
        }
      } else {
        toast.error("Could not load classroom data.");
      }
    } finally {
      setLoadingStudents(false);
    }
  }, [id, token, user, selectedMarkFileId]);

  useEffect(() => {
    if (!hasHydrated || !token || !user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadClassroomData();
  }, [hasHydrated, token, user, loadClassroomData]);

  useEffect(() => {
    if (!hasHydrated || !token || !isTeacher) return;
    const loadAllStudents = async () => {
      try {
        const { data } = await getAllStudents();
        setAvailableStudents(data);
      } catch {
        toast.error("Could not load student list.");
      }
    };
    void loadAllStudents();
  }, [hasHydrated, token, isTeacher]);

  useEffect(() => {
    if (!hasHydrated || !token || !user) return;
    const loadClassroomFiles = async () => {
      setLoadingFiles(true);
      try {
        const { data } = await getClassroomFiles(id);
        const files = Array.isArray(data) ? data : [];
        setClassroomFiles(files);
        setSelectedMarkFileId((prev) => prev ?? files[0]?.file_id ?? null);
      } catch {
        setClassroomFiles([]);
      } finally {
        setLoadingFiles(false);
      }
    };
    void loadClassroomFiles();
  }, [hasHydrated, token, user, id]);

  useEffect(() => {
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const handleOpenFile = async (fileId: string) => {
    setOpeningFileId(fileId);
    try {
      const { data } = await getFileDownload(fileId);
      window.open(data.download_url, "_blank", "noopener,noreferrer");
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Failed to open file.";
      toast.error(detail);
    } finally {
      setOpeningFileId(null);
    }
  };

  const handleEnroll = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStudentIds.length) return;
    setEnrolling(true);
    try {
      const results = await Promise.allSettled(
        selectedStudentIds.map((studentId) => enrollStudent(id, studentId))
      );
      const successCount = results.filter((r) => r.status === "fulfilled").length;
      const failCount = results.length - successCount;
      if (successCount > 0) {
        toast.success(
          failCount > 0
            ? `${successCount} student(s) enrolled, ${failCount} failed.`
            : `${successCount} student(s) enrolled.`
        );
      } else {
        toast.error("Could not enroll selected students.");
      }
      setSelectedStudentIds([]);
      await loadClassroomData();
    } catch (err: unknown) {
      const detail =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Could not enroll student.";
      toast.error(detail);
    } finally {
      setEnrolling(false);
    }
  };

  const handleMarkUpdate = (studentId: string, marks: number) => {
    setStudents((prev) =>
      prev.map((s) => (s.id === studentId ? { ...s, marks } : s))
    );
  };

  const enrolledIds = new Set(students.map((s) => s.id));
  const selectableStudents = availableStudents.filter((s) => !enrolledIds.has(s.id));
  const currentUserId = user?.id;
  const studentFileMarks = !isTeacher
    ? classroomFiles
        .map((file) => {
          const mark = marksRecords.find(
            (m) =>
              m.classroom_id === id &&
              m.student_id === currentUserId &&
              m.file_id === file.file_id
          );
          return mark
            ? {
                fileId: file.file_id,
                fileName: file.filename ?? file.file_name ?? file.key ?? file.file_id,
                marks: mark.marks,
                updatedAt: mark.updated_at,
              }
            : null;
        })
        .filter(Boolean) as Array<{
        fileId: string;
        fileName: string;
        marks: number;
        updatedAt: string;
      }>
    : [];

  if (!hasHydrated || !user) return null;

  const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
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
                {classroomMeta?.name ?? "Classroom"}
              </h1>
              <p className="text-xs text-slate-500 mt-1">Classroom details</p>
            </div>
            <div className="h-10 w-10 rounded-xl bg-violet-50 flex items-center justify-center">
              <BookOpen className="h-5 w-5 text-violet-600" />
            </div>
          </div>
        </div>

        {isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <h2 className="text-sm font-semibold text-slate-800 mb-3 flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-violet-500" />
              Enroll a student
            </h2>
            <form onSubmit={handleEnroll} className="flex gap-2 items-center">
              <DropdownMenu>
                <DropdownMenuTrigger className="inline-flex h-9 min-w-[240px] items-center justify-between rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-700 hover:bg-slate-50">
                  {selectedStudentIds.length
                    ? `${selectedStudentIds.length} student(s) selected`
                    : "Select students"}
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-80 max-h-80 overflow-y-auto rounded-xl">
                  {selectableStudents.length === 0 ? (
                    <div className="px-2 py-2 text-xs text-slate-500">
                      No available students to enroll.
                    </div>
                  ) : (
                    selectableStudents.map((student) => (
                      <DropdownMenuCheckboxItem
                        key={student.id}
                        checked={selectedStudentIds.includes(student.id)}
                        onCheckedChange={(checked) => {
                          setSelectedStudentIds((prev) => {
                            if (checked) return [...prev, student.id];
                            return prev.filter((id) => id !== student.id);
                          });
                        }}
                      >
                        {student.email}
                      </DropdownMenuCheckboxItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
              <Button
                type="submit"
                disabled={enrolling || selectedStudentIds.length === 0}
                size="sm"
                className="rounded-xl bg-violet-600 hover:bg-violet-700 text-white shrink-0"
              >
                {enrolling ? "Enrolling…" : "Enroll"}
              </Button>
            </form>
          </div>
        )}

        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
              <BookOpen className="h-4 w-4 text-slate-500" />
              Question Files
              <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
                {classroomFiles.length}
              </Badge>
            </h2>
          </div>
          <div className="divide-y divide-slate-100">
            {loadingFiles && (
              <div className="px-5 py-4">
                <ApiLoadingState message="Loading classroom files..." compact />
              </div>
            )}
            {classroomFiles.map((file) => (
              <div
                key={file.file_id}
                className="px-5 py-3.5 flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-slate-800 truncate">
                    {file.filename ?? file.file_name ?? file.key ?? file.file_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    Uploaded{" "}
                    {file.created_at
                      ? new Date(file.created_at).toLocaleString()
                      : "recently"}
                  </p>
                  {file.publish_at ? (
                    <>
                      <p className="text-xs text-slate-500 mt-0.5">
                        Scheduled publish: {new Date(file.publish_at).toLocaleString()}
                      </p>
                      {new Date(file.publish_at).getTime() > nowMs ? (
                        <p className="text-xs text-amber-700 mt-0.5">
                          {formatCountdown(new Date(file.publish_at).getTime(), nowMs)}
                        </p>
                      ) : null}
                    </>
                  ) : null}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {file.publish_at ? (
                    <Badge
                      variant="secondary"
                      className={
                        new Date(file.publish_at).getTime() > Date.now()
                          ? "bg-amber-50 text-amber-700 border-amber-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }
                    >
                      {new Date(file.publish_at).getTime() > Date.now()
                        ? "scheduled"
                        : "published"}
                    </Badge>
                  ) : null}
                  <Badge
                    variant="secondary"
                    className={
                      (file.status ?? file.mode) === "secure"
                        ? "bg-green-50 text-green-700 border-green-200"
                        : (file.status ?? file.mode) === "insecure"
                          ? "bg-red-50 text-red-700 border-red-200"
                          : "bg-slate-100 text-slate-700 border-slate-200"
                    }
                  >
                    {(file.status ?? file.mode) === "secure"
                      ? "with friction"
                      : (file.status ?? file.mode) === "insecure"
                        ? "without friction"
                        : "file"}
                  </Badge>
                  <Button
                    size="sm"
                    variant="outline"
                    className="rounded-lg"
                    disabled={openingFileId === file.file_id}
                    onClick={() => handleOpenFile(file.file_id)}
                  >
                    {openingFileId === file.file_id ? "Opening..." : "Open"}
                  </Button>
                </div>
              </div>
            ))}
            {!loadingFiles && classroomFiles.length === 0 && (
              <div className="px-5 py-4 text-sm text-slate-500">
                No question files uploaded for this classroom yet.
              </div>
            )}
          </div>
        </div>

        {isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 space-y-3">
            <h2 className="text-sm font-semibold text-slate-800">Marks Scope</h2>
            <p className="text-xs text-slate-500">
              Marks are now linked to classroom + file. Select a file to view/update corresponding marks.
            </p>
            <select
              value={selectedMarkFileId ?? ""}
              onChange={(e) => setSelectedMarkFileId(e.target.value || null)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
              disabled={classroomFiles.length === 0}
            >
              {classroomFiles.length === 0 ? (
                <option value="">No files available</option>
              ) : (
                classroomFiles.map((file) => (
                  <option key={file.file_id} value={file.file_id}>
                    {file.filename ?? file.file_name ?? file.key ?? file.file_id}
                  </option>
                ))
              )}
            </select>
          </div>
        )}

        {isTeacher ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Students
                <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
                  {students.length}
                </Badge>
              </h2>
            </div>

            <div className="divide-y divide-slate-100">
              {loadingStudents && (
                <div className="px-5 py-4">
                  <ApiLoadingState message="Loading students..." compact />
                </div>
              )}
              {students.map((student) => (
                <div
                  key={student.id}
                  className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium text-slate-800">{student.email}</p>
                  </div>
                  <MarksCell
                    student={student}
                    classroomId={id}
                    fileId={selectedMarkFileId}
                    isTeacher
                    onUpdate={handleMarkUpdate}
                  />
                </div>
              ))}
              {!loadingStudents && students.length === 0 && (
                <div className="px-5 py-4 text-sm text-slate-500">
                  No students enrolled in this classroom.
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800 flex items-center gap-2">
                <Users className="h-4 w-4 text-slate-500" />
                Your Marks
                <Badge variant="secondary" className="text-xs bg-slate-50 text-slate-600">
                  {studentFileMarks.length}
                </Badge>
              </h2>
              <div className="flex items-center gap-1.5 text-xs text-slate-400">
                <Lock className="h-3 w-3" />
                <span>Read-only</span>
              </div>
            </div>
            <div className="divide-y divide-slate-100">
              {studentFileMarks.map((row) => (
                <div
                  key={row.fileId}
                  className="px-5 py-3.5 flex items-center justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {row.fileName}
                    </p>
                    <p className="text-xs text-slate-500">
                      Updated {new Date(row.updatedAt).toLocaleString()}
                    </p>
                  </div>
                  <span className="text-sm font-semibold text-violet-700">
                    {row.marks}/100
                  </span>
                </div>
              ))}
              {studentFileMarks.length === 0 && (
                <div className="px-5 py-4 text-sm text-slate-500">
                  No marks published for your files yet.
                </div>
              )}
            </div>
          </div>
        )}

        {!isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <Lock className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">Marks are read-only for students</p>
                <p className="text-xs text-slate-500 mt-0.5">The edit button is hidden from the UI.</p>
              </div>
            </div>

            <ExploitHint
              title="Broken Access Control — Marks"
              description="Students don't see an edit button, but the API endpoint has no role check. Any authenticated user can update any student's marks by calling the insecure endpoint directly."
              hint="Can you REALLY not edit? UI restriction is not security."
              generateInsecureCode={() =>
                `// As a student — no edit button in UI, but:
const token = localStorage.getItem("friction_token");
fetch("${BASE}/api/insecure/marks/update", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`
  },
  body: JSON.stringify({
    student_id: "${students[0]?.id ?? "YOUR_STUDENT_ID"}",
    classroom_id: "${id}",
    file_id: "${selectedMarkFileId ?? "YOUR_FILE_ID"}",
    marks: 100
  })
}).then(r => r.json()).then(console.log);`
              }
              generateSecureCode={() =>
                `// With friction: role check enforced on the server
const token = localStorage.getItem("friction_token");
fetch("${BASE}/api/secure/marks/update", {
  method: "PUT",
  headers: {
    "Content-Type": "application/json",
    Authorization: \`Bearer \${token}\`
  },
  body: JSON.stringify({
    student_id: "${students[0]?.id ?? "YOUR_STUDENT_ID"}",
    classroom_id: "${id}",
    file_id: "${selectedMarkFileId ?? "YOUR_FILE_ID"}",
    marks: 100
  })
}).then(r => r.json()).then(console.log);
// → 403 Only teachers can update marks`
              }
              expectedResult={{
                insecure:
                  "200 OK — marks updated. Any authenticated user can edit any grade.",
                secure:
                  "403 Forbidden — server validates role (teacher only) + classroom ownership + student enrollment.",
              }}
            />

            <ExploitHint
              title="Presigned URL Misuse — File Overwrite"
              description="Students do not see overwrite controls in UI, but a leaked pre-signed PUT URL can still be used directly from terminal."
              hint="Can you REALLY not overwrite? UI restriction is not security."
              actionLabel="Try in Terminal"
              runIn="terminal"
              showSecureSection={false}
              generateInsecureCode={() =>
                `# Replace both placeholders, then run in terminal
curl -X PUT "<PRESIGNED_PUT_URL>" \\
  -H "Content-Type: application/pdf" \\
  --upload-file "/absolute/path/to/replacement.pdf"`
              }
              expectedResult={{
                insecure:
                  "Upload may succeed if leaked URL is still valid, enabling unauthorized overwrite.",
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
