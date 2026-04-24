"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { login } from "@/lib/api";
import { useStore } from "@/lib/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Lock } from "lucide-react";

function TextLogo() {
  return (
    <span className="inline-flex items-center gap-[5px] select-none font-sans">
      <span className="text-slate-800 font-semibold tracking-tight text-[1.05rem] leading-none">
        Classroom
      </span>
      <span
        className="text-white font-extrabold italic leading-none"
        style={{
          background: "#6d28d9",
          fontSize: "0.76rem",
          padding: "2px 6px 2px 5px",
          borderRadius: "5px",
          letterSpacing: "0.04em",
          fontFamily: "Georgia, serif",
        }}
      >
        X
      </span>
    </span>
  );
}

export default function LoginPage() {
  const router = useRouter();
  const { setToken, setUser, token, hasHydrated } = useStore();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (hasHydrated && token) {
      router.replace("/dashboard");
    }
  }, [hasHydrated, token, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data } = await login(email, password);
      setToken(data.access_token);
      localStorage.setItem("friction_remember_me", String(rememberMe));
      const { getMe } = await import("@/lib/api");
      const { data: me } = await getMe("secure");
      setUser(me);
      toast.success("Welcome back!");
      router.push("/dashboard");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail ?? "Login failed";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f8fafc] px-4">
      <div className="w-full max-w-sm">
        {/* Text logo */}
        <div className="flex flex-col items-center mb-8">
          <TextLogo />
          <p className="text-sm text-slate-500 mt-2">Sign in to continue</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-slate-700">
                Email address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoFocus
                className="h-10 rounded-xl border-slate-200 focus-visible:ring-violet-500"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-slate-700">
                Password
              </Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="h-10 rounded-xl border-slate-200 pr-10 focus-visible:ring-violet-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? (
                    <EyeOff className="h-4 w-4" />
                  ) : (
                    <Eye className="h-4 w-4" />
                  )}
                </button>
              </div>
            </div>

            <label className="flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="h-4 w-4 rounded border-violet-300 accent-violet-600 focus-visible:ring-2 focus-visible:ring-violet-500"
              />
              Remember me
            </label>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-10 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-medium transition-colors"
            >
              {loading ? "Signing in…" : "Sign in"}
            </Button>
          </form>

          <div className="mt-4 flex items-center gap-2">
            <div className="flex-1 h-px bg-slate-100" />
            <span className="text-xs text-slate-400">or</span>
            <div className="flex-1 h-px bg-slate-100" />
          </div>

          <p className="mt-4 text-center text-sm text-slate-500">
            No account?{" "}
            <Link
              href="/register"
              className="font-medium text-violet-600 hover:text-violet-700"
            >
              Create one
            </Link>
          </p>
        </div>

        {/* Security note — Act 1 */}
        <div className="mt-4 flex items-center justify-center gap-2">
          <Lock className="h-3.5 w-3.5 text-slate-400" />
          <p className="text-xs text-slate-400">
            JWT secured · Looks safe… right?
          </p>
        </div>
      </div>
    </div>
  );
}
