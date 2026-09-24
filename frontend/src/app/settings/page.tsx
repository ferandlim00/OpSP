"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Settings, Construction } from "lucide-react";

export default function SettingsPage() {
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
              <Settings className="w-5 h-5 text-amber-400" />
              <span>Pengaturan Sistem</span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Konfigurasi toko, GPS absensi, fitur aktif/nonaktif, dan tampilan.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border-dashed">
            <div className="w-16 h-16 rounded-2xl bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-[var(--text-secondary)]" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Modul Sedang Dikembangkan</h2>
            <p className="text-xs text-[var(--text-muted)] text-center max-w-xs">
              Pengaturan sistem akan segera tersedia. Termasuk toggle Dark/Light mode,
              konfigurasi GPS absensi, dan pengaturan fitur penggajian.
            </p>
            <div className="mt-4 px-3 py-1 rounded-full bg-[var(--bg-sunken)] border border-[var(--border)]">
              <span className="text-[11px] font-semibold text-[var(--text-secondary)]">Coming Soon — Bulan 4</span>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
