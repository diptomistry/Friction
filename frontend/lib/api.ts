import axios from "axios";

const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://127.0.0.1:8000";

export const api = axios.create({ baseURL: BASE });

// Attach JWT from localStorage on every request
api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const token = localStorage.getItem("friction_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
  }
  return config;
});

// ─── Auth ────────────────────────────────────────────────────────────────────

export interface AuthResponse {
  access_token: string;
  token_type: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: "student" | "teacher" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface AdminUser {
  id: string;
  email: string;
  role: "student" | "teacher" | "admin";
  is_active: boolean;
  created_at: string;
}

export interface ClassroomStudent {
  id: string;
  email: string;
  role?: "student" | "teacher" | "admin";
  is_active?: boolean;
  created_at?: string;
}

export interface ClassroomRecord {
  id: string;
  name: string;
  teacher_id?: string;
  created_at?: string;
  student_count?: number;
}

export interface MarkRecord {
  id: string;
  student_id: string;
  classroom_id: string;
  file_id: string;
  marks: number;
  updated_at: string;
}

export interface InsecureUploadUrlResponse {
  upload_url: string;
  key: string;
  expires_in: number;
}

export interface InsecureUploadConfirmResponse {
  detail: string;
  file_id: string;
}

export interface SecureUploadRequestResponse {
  file_id: string;
  upload_url: string;
  key: string;
  expires_in: number;
}

export interface ClassroomFileRecord {
  file_id: string;
  classroom_id?: string;
  filename?: string;
  file_name?: string;
  key?: string;
  status?: string;
  mode?: "secure" | "insecure";
  publish_at?: string;
  created_at?: string;
}

export interface FileAccessResponse {
  file_id?: string;
  download_url: string;
  expires_in?: number;
}

export interface NoticeRecord {
  id: string;
  title: string;
  body: string;
  created_by: string;
  is_published: boolean;
  created_at: string;
  updated_at: string;
}

export interface TokenStatusResponse {
  token_valid: boolean;
}

export const login = (email: string, password: string) =>
  api.post<AuthResponse>("/api/auth/login", { email, password });

export const register = (
  email: string,
  password: string,
  role: "student" | "teacher"
) => api.post<AuthResponse>("/api/auth/register", { email, password, role });

export const getMe = (mode: "insecure" | "secure" = "secure") =>
  api.get<UserProfile>(`/api/auth/me?mode=${mode}`);

export const getTokenStatus = (mode: "insecure" | "secure" = "insecure") =>
  api.get<TokenStatusResponse>(`/api/auth/token-status?mode=${mode}`);

export const logout = (mode: "insecure" | "secure" = "insecure") =>
  api.post(`/api/auth/logout?mode=${mode}`);

export const deleteAccount = (mode: "insecure" | "secure" = "insecure") =>
  api.delete(`/api/auth/me?mode=${mode}`);

// ─── Admin ───────────────────────────────────────────────────────────────────

export const listAdminUsers = () => api.get<AdminUser[]>("/api/admin/users");

export const deleteAdminUserInsecure = (userId: string) =>
  api.delete(`/api/insecure/admin/users/${encodeURIComponent(userId)}`);

export const deleteAdminUserSecure = (userId: string) =>
  api.delete(`/api/secure/admin/users/${encodeURIComponent(userId)}`);

// ─── Classrooms ───────────────────────────────────────────────────────────────

export const createClassroom = (name: string) =>
  api.post("/api/classrooms", { name });

export const getClassrooms = () => api.get<ClassroomRecord[]>("/api/classrooms");

export const enrollStudent = (classroomId: string, studentId: string) =>
  api.post(`/api/classrooms/${encodeURIComponent(classroomId)}/students`, {
    student_id: studentId,
  });

export const getClassroomStudents = (classroomId: string) =>
  api.get<ClassroomStudent[]>(
    `/api/classrooms/${encodeURIComponent(classroomId)}/students`
  );

export const getAllStudents = () =>
  api.get<ClassroomStudent[]>("/api/classrooms/students/all");

export const getMarks = () => api.get<MarkRecord[]>("/api/marks");

// ─── Marks ───────────────────────────────────────────────────────────────────

export interface MarkPayload {
  student_id: string;
  classroom_id: string;
  file_id: string;
  marks: number;
}

export const insecureUpdateMarks = (payload: MarkPayload) =>
  api.put("/api/insecure/marks/update", payload);

export const secureUpdateMarks = (payload: MarkPayload) =>
  api.put("/api/secure/marks/update", payload);

// ─── File Access ─────────────────────────────────────────────────────────────

export const insecureFileAccess = (key: string) =>
  api.get(`/api/insecure/files/file-url?key=${encodeURIComponent(key)}`);

export const secureFileAccess = (sessionId: string) =>
  api.get(`/api/secure/file-url?session_id=${encodeURIComponent(sessionId)}`);

export const insecureFilesUploadUrl = (key: string) =>
  api.post<InsecureUploadUrlResponse>("/api/insecure/files/upload-url", { key });

export const insecureFilesConfirm = (key: string, classroomId: string) =>
  api.post<InsecureUploadConfirmResponse>("/api/insecure/files/confirm", {
    key,
    classroom_id: classroomId,
  });

export const secureFilesUploadRequest = (
  classroomId: string,
  filename: string
) =>
  api.post<SecureUploadRequestResponse>("/api/secure/files/upload-request", {
    classroom_id: classroomId,
    filename,
  });

export const secureFilesUploadConfirm = (fileId: string) =>
  api.post("/api/secure/files/upload-confirm", { file_id: fileId });

export const secureFilesSchedule = (fileId: string, publishAt: string) =>
  api.post("/api/files/schedule", {
    file_id: fileId,
    publish_at: publishAt,
  });

export const getClassroomFiles = (classroomId: string) =>
  api.get<ClassroomFileRecord[]>(
    `/api/files/classroom/${encodeURIComponent(classroomId)}`
  );

export const getFileDownload = (fileId: string) =>
  api.get<FileAccessResponse>(`/api/files/${encodeURIComponent(fileId)}`);

export const getNotices = () => api.get<NoticeRecord[]>("/api/notices");

export const createNotice = (payload: {
  title: string;
  body: string;
  is_published: boolean;
}) => api.post<NoticeRecord>("/api/notices", payload);

export const updateNotice = (
  noticeId: string,
  payload: Partial<Pick<NoticeRecord, "title" | "body" | "is_published">>
) => api.patch<NoticeRecord>(`/api/notices/${encodeURIComponent(noticeId)}`, payload);

export const deleteNotice = (noticeId: string) =>
  api.delete(`/api/notices/${encodeURIComponent(noticeId)}`);

export const secureUploadUrl = (classroomId?: string) =>
  api.get(
    `/api/secure/upload-url${classroomId ? `?classroom_id=${classroomId}` : ""}`
  );
