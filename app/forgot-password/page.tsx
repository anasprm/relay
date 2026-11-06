"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import { Mail, ArrowLeft, ShieldCheck } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const { showToast } = useToast();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      showToast("Please enter your email or username", "error");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) {
        showToast(data.error || "Failed to send reset link", "error");
        return;
      }
      setSent(true);
      showToast(data.message || "Reset link sent", "success");
    } catch {
      showToast("Failed to send reset link", "error");
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/25 rounded-full blur-[128px] pointer-events-none" />

        <div className="w-full max-w-md backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
          <div className="flex flex-col items-center mb-8">
            <Logo className="w-12 h-12 mb-3 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
            <ShieldCheck className="w-12 h-12 bg-[#25D366]/20 text-[#25D366] rounded-full flex items-center justify-center mb-4" />
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Reset Link Sent
            </h1>
            <p className="text-xs text-[#8E8E93] mt-1 max-w-xs text-center">
              We've sent a password reset link to <strong>{email}</strong>. Please check your inbox and follow the instructions to reset your password.
            </p>
          </div>

          <div className="mt-8 text-center">
            <button
              onClick={() => router.push("/login")}
              className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 transition-all"
            >
              Back to Sign In
            </button>
          </div>
        </div>
      </div>
  );
}

return (
  <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
    <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/25 rounded-full blur-[128px] pointer-events-none" />
    <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/25 rounded-full blur-[128px] pointer-events-none" />

    <div className="w-full max-w-md backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
      <div className="flex flex-col items-center mb-8">
        <Logo className="w-12 h-12 mb-3 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
        <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
          Reset Password
        </h1>
        <p className="text-xs text-[#8E8E93] mt-1">
          Enter your email or username and we'll send you a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-xs font-medium text-slate-300 mb-1.5">Email or Username</label>
          <div className="relative flex items-center">
            <Mail className="absolute left-3.5 w-4 h-4 text-slate-500 pointer-events-none" />
            <input
              type="text"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 pl-11 text-white focus:outline-none focus:border-accent placeholder-slate-400 transition-all"
              placeholder="alex@relay.pro or alexmercer"
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
              <ArrowLeft className="w-4 h-4" />
            </>
          )}
        </button>
      </form>

      <div className="mt-6 text-center text-xs text-[#8E8E93]">
        Remember your password?{" "}
        <a href="/login" className="text-cyan-400 hover:underline font-medium focus:outline-none">
          Sign in
        </a>
      </div>
    </div>
  </div>
  );
}
