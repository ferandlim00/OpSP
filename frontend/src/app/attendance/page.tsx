"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Clock, Construction } from "lucide-react";

export default function AttendancePage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

          <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
              <Clock className="w-5 h-5 text-amber-400" />
              <span>Presensi Karyawan</span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Rekap absensi harian, verifikasi GPS, dan laporan kehadiran.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border-dashed">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-emerald-400" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Modul Sedang Dikembangkan</h2>
            <p className="text-xs text-[var(--text-muted)] text-center max-w-xs">
              Fitur Presensi akan segera tersedia. Termasuk absensi berbasis GPS,
              rekap harian, dan laporan kehadiran bulanan.
            </p>
            <div className="mt-4 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[11px] font-semibold text-emerald-400">Coming Soon — Bulan 2</span>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
