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

export const login = (email: string, password: string) =>
  api.post<AuthResponse>("/api/auth/login", { email, password });

export const register = (
  email: string,
  password: string,
  role: "student" | "teacher"
) => api.post<AuthResponse>("/api/auth/register", { email, password, role });

export const getMe = (mode: "insecure" | "secure" = "secure") =>
  api.get<UserProfile>(`/api/auth/me?mode=${mode}`);

export const logout = (mode: "insecure" | "secure" = "insecure") =>
  api.post(`/api/auth/logout?mode=${mode}`);

export const deleteAccount = (mode: "insecure" | "secure" = "insecure") =>
  api.delete(`/api/auth/me?mode=${mode}`);

// ─── Marks ───────────────────────────────────────────────────────────────────

export interface MarkPayload {
  student_id: string;
  classroom_id: string;
  marks: number;
}

export const insecureUpdateMarks = (payload: MarkPayload) =>
  api.put("/api/insecure/marks/update", payload);

export const secureUpdateMarks = (payload: MarkPayload) =>
  api.put("/api/secure/marks/update", payload);

// ─── File Access ─────────────────────────────────────────────────────────────

export const insecureFileAccess = (key: string) =>
  api.get(`/api/insecure/file-url?key=${encodeURIComponent(key)}`);

export const secureFileAccess = (sessionId: string) =>
  api.get(`/api/secure/file-url?session_id=${encodeURIComponent(sessionId)}`);

export const insecureUploadUrl = (key: string) =>
  api.get(`/api/insecure/upload-url?key=${encodeURIComponent(key)}`);

export const secureUploadUrl = (classroomId?: string) =>
  api.get(
    `/api/secure/upload-url${classroomId ? `?classroom_id=${classroomId}` : ""}`
  );
