"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import ProductFormModal from "@/components/product/ProductFormModal";
import CategoryManagerModal from "@/components/product/CategoryManagerModal";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import { formatRupiah, formatNumber } from "@/utils/formatters";
import {
  Product,
  ProductCategory,
  PaginationMeta,
  ROOM_OPTIONS,
  roomLabel,
} from "@/types/product";
import {
  Package,
  Search,
  SlidersHorizontal,
  Tag,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Loader2,
  Plus,
  Edit2,
  Trash2,
  ImageOff,
  AlertTriangle,
  CheckCircle2,
  X,
  Settings,
} from "lucide-react";

const PAGE_SIZE = 12;

export default function ProductsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = getUser();
  const role = user?.role?.name || "OWNER";
  const canCreateOrUpdate = role === "OWNER" || role === "ADMIN";
  const canDelete = role === "OWNER";

  // Data
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>({ page: 1, limit: PAGE_SIZE, total: 0, total_pages: 0 });
  const [loading, setLoading] = useState(true);

  // Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedRoom, setSelectedRoom] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [selectedStock, setSelectedStock] = useState("");
  const [page, setPage] = useState(1);
  const [showFilterPanel, setShowFilterPanel] = useState(false);

  // Modal & notifikasi
  const [showModal, setShowModal] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Product | null>(null);
  const [toast, setToast] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  const notify = (type: "success" | "error", msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchCategories = useCallback(async () => {
    try {
      const res = await api.get("/categories");
      setCategories(res.data.data || []);
    } catch {
      // ditangani interceptor
    }
  }, []);

  const fetchProducts = useCallback(async () => {
    try {
      setLoading(true);
      const params: Record<string, string | number> = { page, limit: PAGE_SIZE };
      if (searchQuery) params.search = searchQuery;
      if (selectedCategory) params.category_id = selectedCategory;
      if (selectedRoom) params.room_type = selectedRoom;
      if (selectedStatus) params.status = selectedStatus;
      if (selectedStock) params.stock = selectedStock;

      const res = await api.get("/products", { params });
      setProducts(res.data.data?.items || []);
      setMeta(res.data.data?.meta || { page: 1, limit: PAGE_SIZE, total: 0, total_pages: 0 });
    } catch {
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [page, searchQuery, selectedCategory, selectedRoom, selectedStatus, selectedStock]);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchCategories();
  }, [router, fetchCategories]);

  // Debounce 300ms agar tidak request setiap ketikan
  useEffect(() => {
    if (!mounted) return;
    const t = setTimeout(fetchProducts, 300);
    return () => clearTimeout(t);
  }, [mounted, fetchProducts]);

  // Setiap filter berubah → kembali ke halaman 1
  useEffect(() => {
    setPage(1);
  }, [searchQuery, selectedCategory, selectedRoom, selectedStatus, selectedStock]);

  if (!mounted) return null;

  const activeFiltersCount = [
    selectedCategory !== null,
    selectedRoom !== "",
    selectedStatus !== "",
    selectedStock !== "",
  ].filter(Boolean).length;

  const resetFilters = () => {
    setSelectedCategory(null);
    setSelectedRoom("");
    setSelectedStatus("");
    setSelectedStock("");
    setSearchQuery("");
  };

  const openCreate = () => {
    if (categories.length === 0) {
      notify("error", "Buat minimal 1 kategori terlebih dahulu.");
      return;
    }
    setEditTarget(null);
    setShowModal(true);
  };

  const openEdit = async (p: Product) => {
    try {
      // Ambil detail terbaru (termasuk semua foto)
      const res = await api.get(`/products/${p.ID}`);
      setEditTarget(res.data.data);
      setShowModal(true);
    } catch {
      notify("error", "Gagal memuat detail produk.");
    }
  };

  const handleDelete = async (p: Product) => {
    if (!confirm(`Hapus permanen produk "${p.name}" dari database MySQL?\nFoto dan riwayat mutasi stok produk ini juga akan terhapus permanen.`)) return;
    try {
      await api.delete(`/products/${p.ID}`);
      notify("success", `Produk "${p.name}" berhasil dihapus permanen dari database.`);
      fetchProducts();
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Gagal menghapus produk.");
    }
  };

  const handleSaved = (message: string) => {
    setShowModal(false);
    notify("success", message);
    fetchProducts();
  };

  const chipCls = (active: boolean) =>
    `px-3 py-1 rounded-lg text-xs font-semibold border transition-all ${active
      ? "bg-amber-500 text-slate-950 border-amber-500"
      : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
    }`;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-5">

          {/* ── Header ── */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Package className="w-5 h-5 text-amber-500" />
                <span>Katalog Produk</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                {formatNumber(meta.total)} produk · Kelola katalog, stok, harga, dan foto.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama produk, SKU..."
                  className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <button
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${activeFiltersCount > 0
                  ? "bg-amber-500/10 border-amber-500/30 text-amber-500"
                  : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
              >
                <SlidersHorizontal className="w-3.5 h-3.5" />
                Filter
                {activeFiltersCount > 0 && (
                  <span className="w-4 h-4 rounded-full bg-amber-500 text-slate-950 text-xs font-bold flex items-center justify-center">
                    {activeFiltersCount}
                  </span>
                )}
                <ChevronDown className={`w-3 h-3 transition-transform ${showFilterPanel ? "rotate-180" : ""}`} />
              </button>

              {canCreateOrUpdate && (
                <>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/30 transition-all"
                  >
                    <Settings className="w-4 h-4" />
                    Kelola Kategori
                  </button>

                  <button
                    onClick={openCreate}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Tambah Produk
                  </button>
                </>
              )}
            </div>
          </div>

          {/* ── Filter Panel ── */}
          {showFilterPanel && (
            <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-amber-500" />
                  Filter Produk
                </h3>
                {(activeFiltersCount > 0 || searchQuery) && (
                  <button onClick={resetFilters} className="text-xs text-rose-500 hover:text-rose-600 transition-colors">
                    Reset semua filter
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5" /> Jenis / Kategori
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedCategory(null)} className={chipCls(selectedCategory === null)}>Semua</button>
                    {categories.map((cat) => (
                      <button
                        key={cat.ID}
                        onClick={() => setSelectedCategory(selectedCategory === cat.ID ? null : cat.ID)}
                        className={chipCls(selectedCategory === cat.ID)}
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">🏠 Ruangan</p>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setSelectedRoom("")} className={chipCls(selectedRoom === "")}>Semua</button>
                    {ROOM_OPTIONS.map((r) => (
                      <button
                        key={r.value}
                        onClick={() => setSelectedRoom(selectedRoom === r.value ? "" : r.value)}
                        className={chipCls(selectedRoom === r.value)}
                      >
                        {r.emoji} {r.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">📦 Kondisi Stok</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "", l: "Semua" },
                      { v: "low", l: "⚠️ Menipis" },
                      { v: "out", l: "⛔ Habis" },
                    ].map((o) => (
                      <button key={o.v} onClick={() => setSelectedStock(o.v)} className={chipCls(selectedStock === o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs font-semibold text-[var(--text-secondary)]">🔘 Status</p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { v: "", l: "Semua" },
                      { v: "active", l: "Aktif" },
                      { v: "inactive", l: "Nonaktif" },
                    ].map((o) => (
                      <button key={o.v} onClick={() => setSelectedStatus(o.v)} className={chipCls(selectedStatus === o.v)}>{o.l}</button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Konten ── */}
          {loading ? (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="ml-2 text-[var(--text-secondary)] text-sm">Memuat produk...</span>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 px-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] border-dashed">
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center mb-4">
                <Package className="w-8 h-8 text-amber-500" />
              </div>
              <h2 className="text-sm font-bold text-[var(--text-primary)] mb-1">
                {activeFiltersCount > 0 || searchQuery ? "Tidak ada produk yang cocok" : "Belum ada produk"}
              </h2>
              <p className="text-xs text-[var(--text-secondary)] font-medium text-center max-w-sm">
                {activeFiltersCount > 0 || searchQuery
                  ? "Coba ubah kata kunci atau reset filter."
                  : "Tambahkan produk pertama beserta foto & harga."}
              </p>
              {activeFiltersCount > 0 || searchQuery ? (
                <button onClick={resetFilters} className="mt-4 text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline">Reset filter</button>
              ) : (
                <button onClick={openCreate} className="mt-4 text-xs font-semibold text-amber-500 hover:text-amber-400 hover:underline">+ Tambah produk pertama</button>
              )}
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {products.map((p) => (
                  <ProductCard
                    key={p.ID}
                    product={p}
                    canEdit={canCreateOrUpdate}
                    canDelete={canDelete}
                    onEdit={() => openEdit(p)}
                    onDelete={() => handleDelete(p)}
                  />
                ))}
              </div>

              {/* Pagination */}
              {meta.total_pages > 1 && (
                <div className="flex items-center justify-between pt-2">
                  <p className="text-xs text-[var(--text-muted)]">
                    Halaman {meta.page} dari {meta.total_pages} · {formatNumber(meta.total)} produk
                  </p>
                  <div className="flex gap-2">
                    <button
                      disabled={page <= 1}
                      onClick={() => setPage((p) => p - 1)}
                      className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      disabled={page >= meta.total_pages}
                      onClick={() => setPage((p) => p + 1)}
                      className="p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] disabled:opacity-40"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <ProductFormModal
        open={showModal}
        product={editTarget}
        categories={categories}
        onClose={() => { setShowModal(false); if (editTarget) fetchProducts(); }}
        onSaved={handleSaved}
      />

      <CategoryManagerModal
        open={showCategoryModal}
        categories={categories}
        onClose={() => setShowCategoryModal(false)}
        onChanged={fetchCategories}
      />

      {/* Toast sederhana */}
      {toast && (
        <div className="fixed top-20 right-4 z-[60] flex items-center gap-2 px-4 py-3 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl">
          {toast.type === "success" ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-4 h-4 text-rose-500" />
          )}
          <span className="text-xs font-semibold text-[var(--text-primary)]">{toast.msg}</span>
          <button onClick={() => setToast(null)} className="ml-2 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────
// Kartu Produk
// ─────────────────────────────────────────────
function ProductCard({
  product: p,
  canEdit,
  canDelete,
  onEdit,
  onDelete,
}: {
  product: Product;
  canEdit: boolean;
  canDelete: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const primary = p.images?.find((i) => i.is_primary) || p.images?.[0];
  const imgCount = p.images?.length || 0;
  const isOut = p.stock === 0;
  const isLow = !isOut && p.stock <= p.min_stock;

  return (
    <div className={`rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden flex flex-col hover:border-amber-500/40 transition-colors ${!p.is_active ? "opacity-60" : ""}`}>
      {/* Foto */}
      <div className="relative aspect-[4/3] bg-[var(--bg-sunken)]">
        {primary ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={getImageUrl(primary.image_url)} alt={p.name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center text-[var(--text-muted)]">
            <ImageOff className="w-8 h-8 opacity-40" />
            <span className="text-xs mt-1">Belum ada foto</span>
          </div>
        )}
        <div className="absolute top-2 left-2 flex flex-wrap gap-1">
          {!p.is_active && <span className="px-2 py-0.5 rounded-md bg-slate-700 text-white text-xs font-bold">Nonaktif</span>}
          {isOut && <span className="px-2 py-0.5 rounded-md bg-rose-500 text-white text-xs font-bold">Habis</span>}
          {isLow && <span className="px-2 py-0.5 rounded-md bg-amber-500 text-slate-950 text-xs font-bold">Stok Menipis</span>}
        </div>
        {imgCount > 1 && (
          <span className="absolute bottom-2 right-2 px-2 py-0.5 rounded-md bg-slate-950/70 text-white text-xs font-semibold">
            {imgCount} foto
          </span>
        )}
      </div>

      {/* Info */}
      <div className="p-4 flex-1 flex flex-col gap-2">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-mono text-[var(--text-muted)] truncate">{p.sku}</span>
          <span className="text-xs font-semibold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-md truncate">
            {p.category?.name || "-"}
          </span>
        </div>
        <h3 className="text-sm font-bold text-[var(--text-primary)] leading-snug line-clamp-2">{p.name}</h3>
        <p className="text-xs text-[var(--text-secondary)]">{roomLabel(p.room_type)}</p>

        <div className="mt-auto pt-3 border-t border-[var(--border)] flex items-end justify-between">
          <div>
            <p className="text-base font-bold font-mono tabular-nums text-[var(--text-primary)]">
              {/* JIKA HARGA > 0 TAMPILKAN RUPIAH, JIKA 0 TAMPILKAN TEKS */}
              {p.price_sell > 0 ? formatRupiah(p.price_sell) : (
                <span className="text-xs text-amber-500 italic">Belum Set Harga</span>
              )}
            </p>
            <p className={`text-xs font-semibold ${isOut ? "text-rose-500" : isLow ? "text-amber-500" : "text-[var(--text-secondary)]"}`}>
              Stok: {formatNumber(p.stock)}
            </p>
          </div>
          <div className="flex gap-1.5">
            {canEdit && (
              <button
                onClick={onEdit}
                title="Edit"
                className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/30 transition-colors"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
            )}
            {canDelete && (
              <button
                onClick={onDelete}
                title="Hapus (Khusus Owner)"
                className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}