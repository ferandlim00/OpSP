"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, Loader2, Sparkles, Building2 } from "lucide-react";
import api from "@/lib/api";
import { setAuthSession } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMessage("");

    try {
      const response = await api.post("/auth/login", {
        username,
        password,
      });

      if (response.data.success) {
        const { token, user } = response.data.data;
        setAuthSession(token, user);
        router.push("/dashboard");
      }
    } catch (err: any) {
      const message =
        err.response?.data?.message ||
        "Gagal terhubung ke backend. Pastikan server Go Fiber di port 8080 menyala.";
      setErrorMessage(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12 relative overflow-hidden">
      
      {/* Background Subtle Ambient Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-96 h-96 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="max-w-md w-full space-y-6 bg-[var(--bg-surface)] p-8 rounded-2xl shadow-2xl border border-[var(--border)] relative z-10">
        
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-xl bg-amber-500 text-slate-950 mb-3 shadow-lg shadow-amber-500/20 font-bold text-2xl">
            P
          </div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">
            PropertiERP
          </h2>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Sistem Terpadu POS, Stok, Logistik & Keuangan Properti
          </p>
        </div>

        {/* Error Alert */}
        {errorMessage && (
          <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-400 text-xs">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Form Login */}
        <form className="space-y-4" onSubmit={handleLogin}>
          
          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <User className="h-4 w-4" />
              </div>
              <input
                type="text"
                required
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-sunken)]/80 border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <Lock className="h-4 w-4" />
              </div>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-sunken)]/80 border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-all"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-xl text-xs font-bold text-slate-950 bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-amber-500/20"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                Memverifikasi...
              </>
            ) : (
              "Masuk ke Sistem"
            )}
          </button>
        </form>

        {/* Demo Hint */}
        <div className="pt-2 border-t border-[var(--border)]/80 text-center">
          <p className="text-[11px] text-[var(--text-muted)]">
            Akun Default: <span className="text-amber-400 font-mono">Index</span> · Sandi: <span className="text-amber-400 font-mono">kelinciputih7788</span>
          </p>
        </div>

      </div>
    </div>
  );
}