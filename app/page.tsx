"use client";
import React, { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/AuthProvider";
import { consumeAuthNotice } from "@/lib/AuthProvider";
import { Logo } from "@/components/ui/Logo";

export default function LandingPage() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading } = useAuth();
  const [redirecting, setRedirecting] = useState(false);

  // Show any one-shot auth notice (e.g. "wrong workspace") immediately
  useEffect(() => {
    const notice = consumeAuthNotice();
    if (notice && typeof window !== "undefined") {
      const toast = (window as any).__RELAY_TOAST__;
      if (toast) toast(notice, "error");
    }
  }, []);

  // Route based on authentication state once loading settles
  useEffect(() => {
    if (loading || redirecting) return;

    if (user) {
      if (pathname !== "/chat") {
        setRedirecting(true);
        router.push("/chat");
      }
    } else if (pathname !== "/auth/login") {
      setRedirecting(true);
      router.push("/auth/login");
    }
  }, [user, loading, redirecting, pathname, router]);

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

  return null;
}
