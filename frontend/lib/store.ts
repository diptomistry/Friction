import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { UserProfile } from "./api";

interface Classroom {
  id: string;
  name: string;
  subject: string;
  teacherId: string;
  teacherName: string;
  studentCount: number;
}

interface Mark {
  studentId: string;
  studentEmail: string;
  classroomId: string;
  marks: number;
  updatedAt: string;
}

interface AppState {
  token: string | null;
  user: UserProfile | null;
  classrooms: Classroom[];
  marks: Mark[];

  setToken: (token: string) => void;
  setUser: (user: UserProfile) => void;
  setClassrooms: (classrooms: Classroom[]) => void;
  setMarks: (marks: Mark[]) => void;
  logout: () => void;
}

export const useStore = create<AppState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      classrooms: [],
      marks: [],

      setToken: (token) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("friction_token", token);
        }
        set({ token });
      },

      setUser: (user) => set({ user }),

      setClassrooms: (classrooms) => set({ classrooms }),

      setMarks: (marks) => set({ marks }),

      logout: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("friction_token");
        }
        set({ token: null, user: null, classrooms: [], marks: [] });
      },
    }),
    {
      name: "friction-store",
      partialize: (state) => ({ token: state.token, user: state.user }),
    }
  )
);
