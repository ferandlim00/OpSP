"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
// 1. Import ikon Sun dan Moon dari lucide-react
import { Menu, LogOut, Shield, Sun, Moon } from "lucide-react";
import { clearAuthSession, getUser } from "@/lib/auth";
// 2. Import useTheme dari next-themes
import { useTheme } from "next-themes";

interface NavbarProps {
  onToggleSidebar: () => void;
}

export default function Navbar({ onToggleSidebar }: NavbarProps) {
  const router = useRouter();
  const user = getUser();
  // 3. Ambil fungsi theme dari next-themes
  const { theme, setTheme } = useTheme();
  // 4. Mencegah Hydration Mismatch
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
    // 5. Ganti warna background hardcode bg-[var(--bg-surface)] menjadi var(--bg-surface)
    <header className="h-16 bg-[var(--bg-surface)] backdrop-blur-md border-b border-[var(--border)] sticky top-0 z-30 flex items-center justify-between px-4 lg:px-8 transition-colors duration-200">

      {/* Left Area: Mobile Menu & Welcome text */}
      <div className="flex items-center gap-3">
        <button
          onClick={onToggleSidebar}
          // Ganti warna hover menjadi var(--bg-sunken)
          className="p-2 rounded-xl text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] lg:hidden transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div>
          <h2 className="text-xs sm:text-sm font-medium text-[var(--text-secondary)]">
            Selamat datang kembali,{" "}
            <span className="text-[var(--text-primary)] font-semibold">{user?.name || "Owner"}</span>
          </h2>
          <p className="hidden sm:block text-[11px] text-[var(--text-muted)]">
            Sistem Manajemen Toko Furniture — World Furniture
          </p>
        </div>
      </div>

      {/* Right Area: Theme Toggle, Role Badge & Logout */}
      <div className="flex items-center gap-2 sm:gap-3">

        {/* 6. Tombol Toggle Tema */}
        {mounted && (
          <button
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="p-1.5 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] transition-colors"
            title="Ubah Tema Warna"
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-400" />
            ) : (
              <Moon className="w-4 h-4 text-indigo-500" />
            )}
          </button>
        )}

        {/* Role Badge */}
        <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[11px] text-[var(--text-secondary)]">
          <Shield className="w-3.5 h-3.5 text-amber-500" />
          <span className="font-bold text-[var(--text-primary)] uppercase">{roleName}</span>
        </div>

        {/* Logout Button */}
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition-all"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Keluar</span>
        </button>
      </div>
    </header>
  );
}