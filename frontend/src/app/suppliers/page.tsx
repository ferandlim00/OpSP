"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { Building2, Construction } from "lucide-react";

export default function SuppliersPage() {
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
              <Building2 className="w-5 h-5 text-amber-400" />
              <span>Supplier / Pemasok</span>
            </h1>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Kelola data supplier furniture dan riwayat Purchase Order.
            </p>
          </div>

          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border-dashed">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-amber-400" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">Modul Sedang Dikembangkan</h2>
            <p className="text-xs text-[var(--text-muted)] text-center max-w-xs">
              Fitur Supplier akan segera tersedia. Termasuk data kontak pemasok,
              riwayat pembelian, dan Purchase Order.
            </p>
            <div className="mt-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-400">Coming Soon — Bulan 2</span>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
