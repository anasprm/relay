"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface Toast {
  id: string;
  message: string;
  type?: "info" | "success" | "error";
}

interface ToastContextType {
  showToast: (message: string, type?: "info" | "success" | "error") => void;
}

const ToastContext = createContext<ToastContextType>({ showToast: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: "info" | "success" | "error" = "info") => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2 pointer-events-none">
        {toasts.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto px-4 py-3 rounded-xl backdrop-blur-xl border text-sm shadow-2xl transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 ${
              t.type === "success"
                ? "bg-emerald-500/20 border-emerald-500/30 text-emerald-200"
                : t.type === "error"
                ? "bg-rose-500/20 border-rose-500/30 text-rose-200"
                : "bg-slate-900/80 border-white/10 text-white"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export const useToast = () => useContext(ToastContext);
