"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Lock, User, AlertCircle, Loader2 } from "lucide-react";
import api from "@/lib/api";
import { setAuthSession, isAuthenticated } from "@/lib/auth";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  // Cek sesi JWT di tab baru: jika sudah login (token aktif di localStorage), langsung lempar ke /dashboard
  useEffect(() => {
    if (isAuthenticated()) {
      router.replace("/dashboard");
      return;
    }
    setCheckingSession(false);
  }, [router]);

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
        router.replace("/dashboard");
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

  if (checkingSession) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)]">
        <div className="w-6 h-6 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center bg-[var(--bg-base)] px-4 py-12">
      <div className="max-w-md w-full space-y-6 bg-[var(--bg-surface)] p-8 rounded-xl shadow-sm border border-[var(--border)]">

        {/* Brand Header — Bersih tanpa kotak logo / efek glow */}
        <header className="text-center space-y-1.5">
          <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
            Properti<span className="text-amber-500">ERP</span>
          </h1>
          <p className="text-xs text-[var(--text-secondary)] font-medium">
            Sistem Terpadu POS, Stok, Logistik & Keuangan
          </p>
        </header>

        {/* Error Alert */}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs font-medium"
          >
            <AlertCircle className="w-4 h-4 shrink-0" aria-hidden="true" />
            <p>{errorMessage}</p>
          </div>
        )}

        {/* Form Login */}
        <form className="space-y-4" onSubmit={handleLogin}>
          <div>
            <label
              htmlFor="username-input"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Username
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <User className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="username-input"
                type="text"
                required
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Masukkan username Anda"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="password-input"
              className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-[var(--text-muted)]">
                <Lock className="h-4 w-4" aria-hidden="true" />
              </div>
              <input
                id="password-input"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="block w-full pl-10 pr-3.5 py-2.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 focus:border-amber-500 transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center items-center py-2.5 px-4 rounded-lg text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" aria-hidden="true" />
                Memverifikasi...
              </>
            ) : (
              "Masuk ke Sistem"
            )}
          </button>
        </form>

      </div>
    </main>
  );
}
