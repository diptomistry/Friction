"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useStore } from "@/lib/store";
import AppSidebarLayout from "@/components/AppSidebarLayout";
import ExploitHint from "@/components/ExploitHint";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { insecureUploadUrl, secureUploadUrl, insecureFileAccess } from "@/lib/api";
import {
  Upload,
  FileText,
  ExternalLink,
  Clock,
  ShieldCheck,
  ShieldAlert,
  Folder,
} from "lucide-react";

interface FileEntry {
  name: string;
  key: string;
  sessionId?: string;
  uploadedAt: string;
  size: string;
  secure: boolean;
}

const DEMO_FILES: FileEntry[] = [
  {
    name: "homework_week3.pdf",
    key: "submissions/my-user-id/abc123/homework_week3.pdf",
    sessionId: "session-abc123",
    uploadedAt: new Date(Date.now() - 86400000).toISOString(),
    size: "1.2 MB",
    secure: true,
  },
  {
    name: "assignment1.pdf",
    key: "submissions/my-user-id/def456/assignment1.pdf",
    sessionId: "session-def456",
    uploadedAt: new Date(Date.now() - 172800000).toISOString(),
    size: "840 KB",
    secure: true,
  },
];

export default function UploadsPage() {
  const router = useRouter();
  const { user, token } = useStore();
  const fileRef = useRef<HTMLInputElement>(null);

  const [files, setFiles] = useState<FileEntry[]>(DEMO_FILES);
  const [uploading, setUploading] = useState(false);
  const [mode, setMode] = useState<"secure" | "insecure">("secure");

  useEffect(() => {
    if (!token) router.push("/login");
  }, [token, router]);

  const handleUpload = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error("Select a file first.");
      return;
    }
    setUploading(true);
    try {
      if (mode === "secure") {
        const { data } = await secureUploadUrl();
        const newEntry: FileEntry = {
          name: file.name,
          key: data.key,
          sessionId: data.session_id,
          uploadedAt: new Date().toISOString(),
          size: `${(file.size / 1024).toFixed(0)} KB`,
          secure: true,
        };
        setFiles((prev) => [newEntry, ...prev]);
        toast.success("File uploaded securely! (presigned, 5 min expiry)");
      } else {
        const userKey = `submissions/${user?.id ?? "my-user-id"}/${file.name}`;
        const { data } = await insecureUploadUrl(userKey);
        const newEntry: FileEntry = {
          name: file.name,
          key: data.key,
          uploadedAt: new Date().toISOString(),
          size: `${(file.size / 1024).toFixed(0)} KB`,
          secure: false,
        };
        setFiles((prev) => [newEntry, ...prev]);
        toast.warning("Uploaded via insecure endpoint. URL valid for 7 days.");
      }
    } catch {
      toast.error(
        "Upload failed — check if the API server is running. Demo file entry added."
      );
      const newEntry: FileEntry = {
        name: file.name,
        key: `demo/${file.name}`,
        uploadedAt: new Date().toISOString(),
        size: `${(file.size / 1024).toFixed(0)} KB`,
        secure: mode === "secure",
      };
      setFiles((prev) => [newEntry, ...prev]);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  if (!user) return null;

  const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

  return (
    <AppSidebarLayout>
      <main className="mx-auto w-full max-w-4xl px-4 py-8 sm:px-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-slate-900">Uploads</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            Submit homework and assignments
          </p>
        </div>

        {/* Upload card */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6">
          <h2 className="text-sm font-semibold text-slate-800 mb-4">
            Upload a file
          </h2>

          {/* Mode toggle */}
          <div className="flex gap-2 mb-4">
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
                {m === "secure" ? "Secure upload" : "Insecure upload"}
              </button>
            ))}
          </div>

          {mode === "secure" ? (
            <div className="rounded-xl bg-green-50 border border-green-200 px-3 py-2 text-xs text-green-700 mb-4 space-y-0.5">
              <p className="font-medium">🟢 With Friction</p>
              <p>Server-generated key · PDF only · 5 min expiry · 5 MB cap</p>
            </div>
          ) : (
            <div className="rounded-xl bg-red-50 border border-red-200 px-3 py-2 text-xs text-red-700 mb-4 space-y-0.5">
              <p className="font-medium">🔴 No Friction</p>
              <p>
                You control the key (path traversal!) · Any file type · 7-day
                URL
              </p>
            </div>
          )}

          <div
            onClick={() => fileRef.current?.click()}
            className="border-2 border-dashed border-slate-200 hover:border-blue-400 rounded-xl py-10 text-center cursor-pointer transition-colors group"
          >
            <Upload className="h-8 w-8 text-slate-300 group-hover:text-blue-400 mx-auto mb-2 transition-colors" />
            <p className="text-sm text-slate-500 group-hover:text-violet-500 transition-colors">
              Click to select a file
            </p>
            <p className="text-xs text-slate-400 mt-1">
              {mode === "secure" ? "PDF only, max 5 MB" : "Any file type"}
            </p>
          </div>
          <input ref={fileRef} type="file" className="hidden" />

          <Button
            onClick={handleUpload}
            disabled={uploading}
            className="mt-4 w-full rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
          >
            {uploading ? "Uploading…" : "Upload"}
          </Button>
        </div>

        {/* File list */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
            <Folder className="h-4 w-4 text-slate-500" />
            <h2 className="text-sm font-semibold text-slate-800">Your Files</h2>
            <Badge
              variant="secondary"
              className="text-xs bg-slate-50 text-slate-600 ml-auto"
            >
              {files.length} files
            </Badge>
          </div>

          <div className="divide-y divide-slate-100">
            {files.map((file, i) => (
              <div
                key={i}
                className="px-5 py-3.5 flex items-center justify-between hover:bg-slate-50/50 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-9 w-9 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center flex-shrink-0">
                    <FileText className="h-4 w-4 text-slate-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 truncate">
                      {file.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-slate-400">{file.size}</span>
                      <span className="text-xs text-slate-300">·</span>
                      <span className="flex items-center gap-0.5 text-xs text-slate-400">
                        <Clock className="h-2.5 w-2.5" />
                        {new Date(file.uploadedAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-4">
                  {file.secure ? (
                    <Badge className="text-[10px] px-1.5 py-0 bg-green-50 text-green-700 border-green-200">
                      <ShieldCheck className="h-2.5 w-2.5 mr-1" />
                      Secure
                    </Badge>
                  ) : (
                    <Badge className="text-[10px] px-1.5 py-0 bg-red-50 text-red-700 border-red-200">
                      <ShieldAlert className="h-2.5 w-2.5 mr-1" />
                      Insecure
                    </Badge>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-xs text-slate-500 hover:text-violet-600"
                    onClick={async () => {
                      try {
                        const { data } = await insecureFileAccess(file.key);
                        window.open(data.download_url, "_blank");
                      } catch {
                        toast.error(
                          "Could not get download URL — API may be offline."
                        );
                      }
                    }}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Act 3 — File Access Exploit Hint */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-slate-800 mb-1">
            You can only see your own files… right?
          </h2>
          <p className="text-xs text-slate-500 mb-1">
            The UI filters files by your account. The backend tells the truth.
          </p>

          <ExploitHint
            title="File Access Abuse — IDOR"
            description="The insecure file endpoint accepts any key and signs a URL for it — no ownership check. You can read any file in the bucket by guessing or enumerating keys."
            hint="What if you try another user's file key? What if we skip the UI?"
            generateInsecureCode={() =>
              `// Access another user's file with an arbitrary key\nconst token = localStorage.getItem("friction_token");\nconst otherUserKey = "submissions/other-user-id/secret.pdf";\nfetch(\`${BASE}/api/insecure/file-url?key=\${encodeURIComponent(otherUserKey)}\`, {\n  headers: { Authorization: \`Bearer \${token}\` }\n}).then(r => r.json()).then(data => {\n  console.log("Download URL:", data.download_url);\n  // 7-day valid URL for someone else's file!\n});`
            }
            generateSecureCode={() =>
              `// Secure: only session_id accepted, ownership enforced\nconst token = localStorage.getItem("friction_token");\nconst sessionId = "someone-elses-session-id";\nfetch(\`${BASE}/api/secure/file-url?session_id=\${sessionId}\`, {\n  headers: { Authorization: \`Bearer \${token}\` }\n}).then(r => r.json()).then(console.log);\n// → 403 You do not have access to this file`
            }
            expectedResult={{
              insecure:
                "200 OK — returns a 7-day pre-signed URL for any file in the bucket. No ownership check.",
              secure:
                "403 Forbidden — session ownership validated; key is never exposed to the client.",
            }}
          />
        </div>

        <p className="text-center text-xs text-slate-400">
          &ldquo;Friction is not a UX bug. It is a security boundary.&rdquo;
        </p>
      </main>
    </AppSidebarLayout>
  );
}
