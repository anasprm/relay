"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Lock,
  ShieldCheck,
} from "lucide-react";

export default function ResetPasswordPage() {
  const [token, setToken] = useState<string | null>(null);
  const [tokenLoaded, setTokenLoaded] = useState(false);
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  useEffect(() => {
    const value = new URLSearchParams(window.location.search).get("token");
    setToken(value?.trim() || null);
    setTokenLoaded(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!token) {
      showToast("This reset link is missing its token.", "error");
      return;
    }

    if (password.length < 6) {
      showToast("Password must be at least 6 characters", "error");
      return;
    }

    if (password !== confirm) {
      showToast("Passwords do not match", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || "Failed to reset password", "error");
        return;
      }

      setDone(true);
      showToast(data.message || "Password updated", "success");
    } catch {
      showToast("Failed to reset password", "error");
    } finally {
      setLoading(false);
    }
  };

  const invalidToken = tokenLoaded && !token;

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/25 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-12 h-12 mb-3 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {done ? "Password Updated" : "Choose a New Password"}
          </h1>
          <p className="text-xs text-[#8E8E93] mt-1 text-center max-w-xs">
            {done
              ? "Your password has been changed. Sign in with your new password."
              : "Create a new password for your Relay account."}
          </p>
        </div>

        {!tokenLoaded ? (
          <div className="flex justify-center py-8">
            <div className="w-6 h-6 border-2 border-white/20 border-t-cyan-400 rounded-full animate-spin" />
          </div>
        ) : invalidToken ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center rounded-2xl border border-red-400/20 bg-red-400/10 p-5">
              <AlertTriangle className="w-10 h-10 text-red-400 mb-3" />
              <p className="text-sm font-medium text-white">Invalid reset link</p>
              <p className="text-xs text-[#8E8E93] mt-1">
                This link is missing a reset token. Request a new link to
                continue.
              </p>
            </div>

            <button
              onClick={() => router.push("/forgot-password")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              Request a New Link
            </button>
          </div>
        ) : done ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 p-5">
              <CheckCircle2 className="w-10 h-10 text-[#25D366] mb-3" />
              <p className="text-sm font-medium text-white">
                You're all set
              </p>
              <p className="text-xs text-[#8E8E93] mt-1">
                Your new password is active. The reset link can no longer be
                used.
              </p>
            </div>

            <button
              onClick={() => router.push("/login")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                New Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-cyan-400 placeholder-slate-400 transition-all"
                  placeholder="At least 6 characters"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Confirm New Password
              </label>
              <div className="relative flex items-center">
                <Lock className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="password"
                  autoComplete="new-password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                  minLength={6}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-cyan-400 placeholder-slate-400 transition-all"
                  placeholder="Repeat your new password"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-2 bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 active:scale-[0.98] text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <span>Update Password</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-[#8E8E93]">
          Back to{" "}
          <a
            href="/login"
            className="text-cyan-400 hover:underline font-medium focus:outline-none"
          >
            Sign in
          </a>
        </div>

        <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] text-[#5f5f66]">
          <ShieldCheck className="w-3 h-3" />
          Reset links are single-use and expire after 1 hour
        </div>
      </div>
    </div>
  );
}
