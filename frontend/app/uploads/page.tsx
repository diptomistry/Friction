"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ApiLoadingState from "@/components/ApiLoadingState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  getClassrooms,
  insecureFilesConfirm,
  insecureFilesUploadUrl,
  secureFilesSchedule,
  secureFilesUploadConfirm,
  secureFilesUploadRequest,
  type ClassroomRecord,
} from "@/lib/api";
import { Upload, ShieldCheck, ShieldAlert } from "lucide-react";

const getMinFutureDateTime = () => {
  const date = new Date(Date.now() + 60_000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const toUtcIsoString = (localDateTimeValue: string) => {
  // datetime-local has no timezone; JS parses it as local time.
  // Convert to explicit UTC ISO string for backend scheduling.
  return new Date(localDateTimeValue).toISOString();
};

export default function UploadsPage() {
  const router = useRouter();
  const { user, token, hasHydrated } = useStore();
  const teacherFileRef = useRef<HTMLInputElement>(null);

  const [mode, setMode] = useState<"secure" | "insecure">("secure");
  const [uploading, setUploading] = useState(false);
  const [classroomId, setClassroomId] = useState("");
  const [classrooms, setClassrooms] = useState<ClassroomRecord[]>([]);
  const [classroomsLoading, setClassroomsLoading] = useState(false);
  const [publishAt, setPublishAt] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [recentTeacherActions, setRecentTeacherActions] = useState<string[]>([]);

  useEffect(() => {
    if (hasHydrated && !token) router.push("/login");
  }, [hasHydrated, token, router]);

  useEffect(() => {
    if (!hasHydrated || user?.role !== "teacher") return;
    const loadClassrooms = async () => {
      setClassroomsLoading(true);
      try {
        const { data } = await getClassrooms();
        setClassrooms(data);
        setClassroomId((prev) => prev || data[0]?.id || "");
      } catch {
        toast.error("Failed to load classrooms.");
      } finally {
        setClassroomsLoading(false);
      }
    };
    void loadClassrooms();
  }, [hasHydrated, user?.role]);

  const handleTeacherUpload = async () => {
    const file = teacherFileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    if (!classroomId.trim()) {
      toast.error("Select a classroom.");
      return;
    }
    if (publishAt.trim()) {
      const selected = new Date(publishAt).getTime();
      if (Number.isNaN(selected) || selected <= Date.now()) {
        toast.error("Publish date must be in the future.");
        return;
      }
    }
    setUploading(true);
    try {
      if (mode === "secure") {
        const { data: uploadRequest } = await secureFilesUploadRequest(
          classroomId.trim(),
          file.name
        );
        const putRes = await fetch(uploadRequest.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");

        await secureFilesUploadConfirm(uploadRequest.file_id);
        if (publishAt.trim()) {
          await secureFilesSchedule(uploadRequest.file_id, toUtcIsoString(publishAt));
        }
        toast.success("Question uploaded with friction controls.");
        setRecentTeacherActions((prev) => [
          `Secure upload: ${file.name} -> file_id ${uploadRequest.file_id}`,
          ...prev,
        ]);
      } else {
        const key = file.name.trim();
        if (!key) return;
        const { data: uploadMeta } = await insecureFilesUploadUrl(key);
        const putRes = await fetch(uploadMeta.upload_url, {
          method: "PUT",
          headers: { "Content-Type": file.type || "application/pdf" },
          body: file,
        });
        if (!putRes.ok) throw new Error("Upload to storage failed");
        const { data: confirmData } = await insecureFilesConfirm(key, classroomId.trim());
        if (publishAt.trim()) {
          await secureFilesSchedule(confirmData.file_id, toUtcIsoString(publishAt));
        }
        toast.warning("Question uploaded without friction safeguards.");
        setRecentTeacherActions((prev) => [
          `Insecure upload: ${file.name} -> key ${key}`,
          ...prev,
        ]);
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Upload flow failed.";
      toast.error(msg);
    } finally {
      setUploading(false);
      if (teacherFileRef.current) teacherFileRef.current.value = "";
      setSelectedFileName("");
    }
  };

  if (!hasHydrated || !user) return null;
  const isTeacher = user.role === "teacher";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Question Files</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {isTeacher ? "Upload exam/question papers for classrooms" : "Teacher only"}
          </p>
        </div>

        {isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
            <h2 className="text-sm font-semibold text-slate-800">Upload Question Paper</h2>

            {classroomsLoading && (
              <ApiLoadingState compact message="Fetching classrooms..." />
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <select
                value={classroomId}
                onChange={(e) => setClassroomId(e.target.value)}
                className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-violet-500"
                disabled={classroomsLoading}
              >
                {classrooms.length === 0 ? (
                  <option value="">
                    {classroomsLoading ? "Loading classrooms..." : "No classrooms found"}
                  </option>
                ) : (
                  classrooms.map((classroom) => (
                    <option key={classroom.id} value={classroom.id}>
                      {classroom.name}
                    </option>
                  ))
                )}
              </select>
              <Input
                type="datetime-local"
                value={publishAt}
                onChange={(e) => setPublishAt(e.target.value)}
                min={getMinFutureDateTime()}
                className="rounded-xl"
              />
            </div>

            <div className="flex gap-2">
              {(["secure", "insecure"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    mode === m
                      ? m === "secure"
                        ? "bg-green-50 border-green-300 text-green-700"
                        : "bg-red-50 border-red-300 text-red-700"
                      : "border-slate-200 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {m === "secure" ? (
                    <ShieldCheck className="h-3.5 w-3.5" />
                  ) : (
                    <ShieldAlert className="h-3.5 w-3.5" />
                  )}
                  {m === "secure" ? "With friction" : "Without friction"}
                </button>
              ))}
            </div>

            <div
              onClick={() => teacherFileRef.current?.click()}
              className="border-2 border-dashed border-slate-200 hover:border-violet-400 rounded-xl py-8 text-center cursor-pointer transition-colors"
            >
              <Upload className="h-7 w-7 text-slate-300 mx-auto mb-2" />
              <p className="text-sm text-slate-600">Select question file</p>
            </div>
            <input
              ref={teacherFileRef}
              type="file"
              className="hidden"
              onChange={(e) =>
                setSelectedFileName(e.target.files?.[0]?.name ?? "")
              }
            />

            {selectedFileName ? (
              <p className="text-xs text-slate-600">
                Selected file: <span className="font-medium">{selectedFileName}</span>
              </p>
            ) : null}

            <Button
              onClick={handleTeacherUpload}
              disabled={uploading}
              className="w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
            >
              {uploading ? "Uploading…" : "Upload question"}
            </Button>

            {recentTeacherActions.length > 0 && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <p className="text-xs font-semibold text-slate-600 mb-1">Recent actions</p>
                <ul className="space-y-1">
                  {recentTeacherActions.slice(0, 4).map((a, i) => (
                    <li key={i} className="text-xs text-slate-600">
                      {a}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {!isTeacher && (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 text-sm text-slate-600">
            Upload module is available for teachers only.
          </div>
        )}

        <p className="text-center text-xs text-slate-400">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
