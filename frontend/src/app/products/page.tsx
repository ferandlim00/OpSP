"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import {
  Package,
  Search,
  SlidersHorizontal,
  Tag,
  ChevronDown,
  Construction,
  Loader2,
} from "lucide-react";

interface Category {
  ID: number;
  name: string;
}

// Daftar filter ruangan
const ROOM_FILTERS = [
  { label: "Semua Ruangan", value: "" },
  { label: "🛋️ Ruang Tamu", value: "LIVING" },
  { label: "🛏️ Kamar Tidur", value: "BEDROOM" },
  { label: "🍽️ Ruang Makan", value: "DINING" },
  { label: "💼 Ruang Kerja", value: "OFFICE" },
  { label: "📦 Serbaguna", value: "OTHER" },
];

export default function ProductsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loadingCats, setLoadingCats] = useState(true);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.data || []);
    } catch {
      // handled by interceptor
    } finally {
      setLoadingCats(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchCategories();
  }, [router, fetchCategories]);

  if (!mounted) return null;

  const activeFiltersCount = [
    selectedCategory !== null,
    selectedRoom !== "",
    searchQuery !== "",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedRoom("");
    setSearchQuery("");
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                <span>Produk Furniture</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Kelola katalog produk, stok, harga, dan foto.
              </p>
            </div>

            {/* Search + Filter toggle */}
            <div className="flex items-center gap-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama produk, SKU..."
                  className="pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 w-52"
                />
              </div>

              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                  activeFiltersCount > 0
                    ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                    : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-[10px] font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilterPanel ? "rotate-180" : ""}`} />
              </button>

              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all">
                + Tambah Produk
              </button>
            </div>
          </div>

          {/* ── Filter Panel (muncul saat toggle) ── */}
          {showFilterPanel && (
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  Filter Produk
                </h3>
                {activeFiltersCount > 0 && (
                  <button
                    onClick={resetFilters}
                    className="text-[11px] text-rose-500 hover:text-rose-400 transition-colors"
                  >
                    Reset semua filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

                {/* Filter Kategori */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" />
                    Jenis / Kategori
                  </p>
                  {loadingCats ? (
                    <div className="flex items-center gap-2 text-[var(--text-muted)] text-xs">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Memuat kategori...
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      <button
                        onClick={() => setSelectedCategory(null)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          selectedCategory === null
                            ? "bg-amber-500 text-slate-950 border-amber-500"
                            : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-soft)]"
                        }`}
                      >
                        Semua
                      </button>
                      {categories.map((cat) => (
                        <button
                          key={cat.ID}
                          onClick={() =>
                            setSelectedCategory(
                              selectedCategory === cat.ID ? null : cat.ID
                            )
                          }
                          className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                            selectedCategory === cat.ID
                              ? "bg-amber-500 text-slate-950 border-amber-500"
                              : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-soft)]"
                          }`}
                        >
                          {cat.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Filter Ruangan */}
                <div className="space-y-2">
                  <p className="text-[11px] font-semibold text-[var(--text-secondary)]">
                    🏠 Ruangan
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {ROOM_FILTERS.map((rf) => (
                      <button
                        key={rf.value}
                        onClick={() =>
                          setSelectedRoom(
                            selectedRoom === rf.value ? "" : rf.value
                          )
                        }
                        className={`px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${
                          selectedRoom === rf.value
                            ? "bg-amber-500 text-slate-950 border-amber-500"
                            : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:border-[var(--border-soft)]"
                        }`}
                      >
                        {rf.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Produk Placeholder ── */}
          <div className="flex flex-col items-center justify-center py-24 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border-dashed">
            <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
              <Construction className="w-8 h-8 text-amber-500" />
            </div>
            <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">
              Modul Produk Sedang Dikembangkan
            </h2>
            <p className="text-xs text-[var(--text-secondary)] text-center max-w-sm">
              Fitur katalog produk akan segera tersedia. Termasuk multi-foto,
              filter ruangan & kategori, harga modal/jual, dan manajemen stok.
            </p>
            <div className="mt-4 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
              <span className="text-[11px] font-semibold text-amber-500">
                Coming Soon — Bulan 2
              </span>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}
