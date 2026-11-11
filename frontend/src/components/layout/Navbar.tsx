"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Menu, LogOut, Sun, Moon } from "lucide-react";
import { clearAuthSession, getUser } from "@/lib/auth";
import { useTheme } from "next-themes";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const router = useRouter();
  const user = getUser();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = () => {
    clearAuthSession();
    router.push("/login");
  };

  const roleName = user?.role?.name || "OWNER";

  return (
    <header className="h-16 bg-[var(--bg-surface)] border-b border-[var(--border)] sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 transition-colors duration-200">
      {/* Sisi Kiri: Tombol Menu Mobile */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          aria-label="Buka menu navigasi"
          className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5" aria-hidden="true" />
        </button>
      </div>

      {/* Sisi Kanan: Status Login Minimalis & Aksi */}
      <div className="flex items-center gap-2 sm:gap-3 min-w-0">
        {/* Toggle Tema */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] border border-transparent hover:border-[var(--border)] transition-colors shrink-0"
            title="Ubah Tema Warna"
            aria-label="Ubah tema warna"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" aria-hidden="true" />
            ) : (
              <Moon className="w-4 h-4 text-slate-700" aria-hidden="true" />
            )}
          </button>
        )}

        {/* Status Pengguna & Role Badge Minimalis */}
        <div className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] min-w-0">
          <span className="text-xs font-semibold text-[var(--text-primary)] max-w-[100px] sm:max-w-[180px] truncate">
            {user?.name || "Pengguna"}
          </span>
          <span className="px-2 py-0.5 rounded text-xs font-semibold tracking-wide uppercase bg-[var(--bg-surface)] text-amber-500 border border-[var(--border)] shrink-0">
            {roleName}
          </span>
        </div>

        {/* Tombol Logout */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-colors shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}