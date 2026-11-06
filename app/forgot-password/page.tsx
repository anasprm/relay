"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Mail,
  ShieldCheck,
} from "lucide-react";

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const { showToast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) {
      showToast("Please enter your email or username", "error");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        showToast(data.error || "Failed to send reset link", "error");
        return;
      }

      setDevResetUrl(
        typeof data.devResetUrl === "string" ? data.devResetUrl : null,
      );
      setSuccessMessage(
        typeof data.message === "string" ? data.message : null,
      );
      setSent(true);
      showToast(data.message || "Reset link sent", "success");
    } catch {
      showToast("Failed to send reset link", "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/25 rounded-full blur-[128px] pointer-events-none" />

      <div className="w-full max-w-md backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-12 h-12 mb-3 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            {sent ? "Reset Link Sent" : "Reset Password"}
          </h1>
          <p className="text-xs text-[#8E8E93] mt-1 text-center max-w-xs">
            {sent
              ? "Follow the instructions in the email to choose a new password."
              : "Enter your email or username and we'll send you a secure reset link."}
          </p>
        </div>

        {sent ? (
          <div className="space-y-5">
            <div className="flex flex-col items-center text-center rounded-2xl border border-[#25D366]/20 bg-[#25D366]/10 p-5">
              <CheckCircle2 className="w-10 h-10 text-[#25D366] mb-3" />
              <p className="text-sm font-medium text-white">
                Check your inbox
              </p>
              <p className="text-xs text-[#8E8E93] mt-1">
                {successMessage ||
                  `We sent a reset link for ${identifier}.`}
              </p>
              <p className="text-[11px] text-[#5f5f66] mt-2">
                The link expires in 1 hour and can only be used once.
              </p>
            </div>

            {devResetUrl ? (
              <div className="rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-center">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-300">
                  Development mode
                </p>
                <p className="text-xs text-amber-100/80 mt-1">
                  Email is not configured, so the reset link was logged on the
                  server. You can open it directly here.
                </p>
                <a
                  href={devResetUrl}
                  className="mt-3 inline-flex items-center justify-center gap-2 rounded-xl bg-amber-400 px-4 py-2 text-xs font-semibold text-black hover:bg-amber-300 transition-colors"
                >
                  Open reset link
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            ) : null}

            <button
              onClick={() => router.push("/login")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              Back to Sign In
            </button>

            <button
              type="button"
              onClick={() => {
                setSent(false);
                setDevResetUrl(null);
                setSuccessMessage(null);
              }}
              className="w-full text-center text-xs text-[#8E8E93] hover:text-slate-300 transition-colors"
            >
              Use a different email or username
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-slate-300 mb-1.5">
                Email or Username
              </label>
              <div className="relative flex items-center">
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
                <input
                  type="text"
                  autoComplete="username"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  required
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-cyan-400 placeholder-slate-400 transition-all"
                  placeholder="alex@relay.pro or alex"
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
                  <span>Send Reset Link</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        <div className="mt-6 text-center text-xs text-[#8E8E93]">
          Remember your password?{" "}
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
