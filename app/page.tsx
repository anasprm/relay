"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { consumeAuthNotice } from "@/lib/AuthProvider";
import { useToast } from "@/components/ui/ToastProvider";
import { Logo } from "@/components/ui/Logo";
import { Lock, Mail, ArrowRight, ShieldCheck, Sparkles } from "lucide-react";

export default function LandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Show any one-shot auth notice (e.g. "wrong workspace") immediately
  useEffect(() => {
    const notice = consumeAuthNotice();
    if (notice) {
      const toast = (window as any).__RELAY_TOAST__;
      if (toast) toast(notice, "error");
    }
  }, []);

  // If already on /login, don't redirect again
  useEffect(() => {
    if (!loading && !redirecting && pathname !== "/auth/login") {
      setRedirecting(true);
      router.push("/auth/login");
    }
  }, [loading, redirecting, pathname, router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] pointer-events-none" />
        <div className="backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl flex flex-col items-center gap-4">
          <Logo className="w-12 h-12 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
          <div className="w-8 h-8 border-2 border-white/30 border-t-cyan-400 rounded-full animate-spin" />
          <p className="text-xs text-slate-400">Initializing Relay…</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#050505] text-slate-100 flex items-center justify-center p-6 relative overflow-hidden">
      {/* Background Aurora Glows */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-indigo-600/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-cyan-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
        <div className="relative h-full w-full">
          <div className="absolute inset-0 opacity-10 animate-[grid_15s_linear_infinite] bg-[linear-gradient(to_right,#1a1a2e_0px,#16213e_50%,#0f3460_100%)]" />
        </div>
      </div>

      <div className="w-full max-w-md backdrop-blur-3xl bg-white/[0.03] border border-white/10 p-8 rounded-3xl shadow-2xl relative z-10">
        <div className="flex flex-col items-center mb-8">
          <Logo className="w-12 h-12 mb-3 text-cyan-400 drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]" />
          <h1 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-slate-400 bg-clip-text text-transparent">
            Relay Messenger Pro
          </h1>
          <p className="text-xs text-slate-400 mt-1 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5 text-cyan-400" /> Secure Spatial Glassmorphic Workspace
          </p>
        </div>

        <form onSubmit={(e) => {
          e.preventDefault();
          setRedirecting(true);
          router.push("/auth/login");
        }} className="space-y-4">
          <button
            type="submit"
            className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white font-medium py-3 rounded-xl shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span>Get Started</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <div className="mt-6 text-center text-xs text-slate-400">
          Already have an account?{" "}
          <button
            onClick={() => router.push("/auth/login")}
            className="text-cyan-400 hover:underline font-medium focus:outline-none"
          >
            Sign in
          </button>
        </div>
      </div>
    </div>
  );
}
