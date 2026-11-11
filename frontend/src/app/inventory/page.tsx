"use client";

import React, { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import { InventoryMovement, MovementType } from "@/types/inventory";
import { Product } from "@/types/product";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import {
  Boxes,
  ArrowDownLeft,
  ArrowUpRight,
  RefreshCw,
  Search,
  Plus,
  Loader2,
  X,
  Camera,
  ImagePlus,
  Trash2,
} from "lucide-react";

export default function InventoryPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = getUser();
  const role = user?.role?.name || "OWNER";
  const canCreateOrUpdate = role === "OWNER" || role === "ADMIN";

  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedType, setSelectedType] = useState<string>("ALL");

  // Modal Form Mutasi + Foto Bukti (Opsional)
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState<{
    product_id: string;
    type: MovementType;
    quantity: number;
    notes: string;
  }>({
    product_id: "",
    type: "INBOUND",
    quantity: 1,
    notes: "",
  });
  const [proofFile, setProofFile] = useState<File | null>(null);
  const [proofPreview, setProofPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [movRes, prodRes] = await Promise.all([
        api.get("/inventory/movements"),
        api.get("/products?limit=100"),
      ]);

      if (movRes.data.success && movRes.data.data) {
        setMovements(movRes.data.data);
      } else {
        setMovements([]);
      }

      if (prodRes.data.success && prodRes.data.data?.items) {
        setProducts(prodRes.data.data.items);
      } else {
        setProducts([]);
      }
    } catch (error) {
      console.error("Gagal memuat inventori:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [router, fetchData]);

  const clearPhoto = () => {
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(null);
    setProofPreview("");
  };

  const handleSelectPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (proofPreview) URL.revokeObjectURL(proofPreview);
    setProofFile(file);
    setProofPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleRecordMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.product_id) {
      alert("Silakan pilih produk terlebih dahulu");
      return;
    }
    if (form.type === "INBOUND" && !proofFile) {
      alert("Setiap Barang Masuk (INBOUND) wajib melampirkan Foto Bukti Barang Masuk sesuai aturan bisnis!");
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("product_id", String(form.product_id));
      fd.append("type", form.type);
      fd.append("quantity", String(form.quantity));
      fd.append("notes", form.notes.trim());
      if (proofFile) {
        fd.append("photo", proofFile);
      }

      await api.post("/inventory/movements", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearPhoto();
      setIsModalOpen(false);
      setForm({ product_id: "", type: "INBOUND", quantity: 1, notes: "" });
      await fetchData();
    } catch (error: any) {
      alert(error.response?.data?.message || "Gagal mencatat mutasi stok");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredMovements = movements.filter((m) => {
    const q = searchQuery.toLowerCase();
    const productName = m.product?.name?.toLowerCase() || "";
    const notes = m.notes?.toLowerCase() || "";
    const matchQuery = productName.includes(q) || notes.includes(q);
    const matchType = selectedType === "ALL" || m.type === selectedType;
    return matchQuery && matchType;
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Boxes className="w-5 h-5 text-amber-500" />
                <span>Kartu Stok & Mutasi Inventori</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-2xl">
                Riwayat barang masuk (dilengkapi lampiran foto bukti surat jalan/barang), barang keluar, dan penyesuaian stok gudang.
              </p>
            </div>

            {canCreateOrUpdate && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Catat Mutasi Stok
                </button>
              </div>
            )}
          </div>

          {/* Ringkasan Total Stok per Produk (Sesuai PLAN.md Baris 14) */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider">
                Ringkasan Total Stok per Produk
              </h2>
              <span className="text-xs font-mono font-bold text-amber-500">
                Total Keseluruhan Stok Gudang:{" "}
                {products.reduce((acc, p) => acc + (p.stock || 0), 0)} Unit
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5 max-h-48 overflow-y-auto pr-1">
              {products.map((p) => (
                <div
                  key={p.ID}
                  className="p-2.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-between gap-2"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                      {p.name}
                    </p>
                    <p className="text-xs font-mono text-[var(--text-muted)]">
                      {p.sku}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-mono font-bold shrink-0 ${
                      p.stock <= (p.min_stock || 0)
                        ? "bg-rose-500/10 text-rose-500 border border-rose-500/20"
                        : "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20"
                    }`}
                  >
                    {p.stock} Unit
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <span className="text-xs text-[var(--text-secondary)] font-medium">Status Stok:</span>
              <div className="flex flex-wrap items-center gap-1">
                {["ALL", "INBOUND", "PENDING", "OUTBOUND", "ADJUSTMENT"].map((t) => (
                  <button
                    key={t}
                    onClick={() => setSelectedType(t)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${
                      selectedType === t
                        ? "bg-amber-500 text-black font-semibold"
                        : "bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                    }`}
                  >
                    {t === "ALL"
                      ? "Semua"
                      : t === "INBOUND"
                      ? "Masuk"
                      : t === "PENDING"
                      ? "Pending (Ditahan)"
                      : t === "OUTBOUND"
                      ? "Keluar"
                      : "Penyesuaian"}
                  </button>
                ))}
              </div>
            </div>

            <div className="relative min-w-[220px]">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari nama produk, catatan..."
                className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Tabel Riwayat Stok */}
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat riwayat stok...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                      <th className="px-6 py-4">Waktu</th>
                      <th className="px-6 py-4">Produk</th>
                      <th className="px-6 py-4">Tipe Mutasi</th>
                      <th className="px-6 py-4 text-right">Kuantitas</th>
                      <th className="px-6 py-4">Bukti Foto</th>
                      <th className="px-6 py-4">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredMovements.map((mov) => {
                      const dateStr = new Date(mov.CreatedAt).toLocaleString("id-ID", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      });

                      return (
                        <tr key={mov.ID} className="hover:bg-[var(--bg-sunken)]/50 transition-colors">
                          <td className="px-6 py-4 text-[var(--text-secondary)] font-mono text-xs whitespace-nowrap">
                            {dateStr}
                          </td>

                          <td className="px-6 py-4">
                            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                              {mov.product?.name || "Produk tidak ditemukan"}
                              {mov.product?.DeletedAt && (
                                <span className="px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                  Dihapus
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[var(--text-secondary)] font-mono">
                              SKU: {mov.product?.sku || "-"}
                            </span>
                          </td>

                          <td className="px-6 py-4">
                            {mov.type === "INBOUND" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <ArrowDownLeft className="w-3.5 h-3.5" />
                                Barang Masuk
                              </span>
                            )}
                            {mov.type === "PENDING" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <RefreshCw className="w-3.5 h-3.5" />
                                Pending (Ditahan)
                              </span>
                            )}
                            {mov.type === "OUTBOUND" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                                <ArrowUpRight className="w-3.5 h-3.5" />
                                Barang Keluar
                              </span>
                            )}
                            {mov.type === "ADJUSTMENT" && (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <RefreshCw className="w-3.5 h-3.5" />
                                Penyesuaian
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-right font-mono font-bold text-sm">
                            {mov.type === "INBOUND" && (
                              <span className="text-emerald-500">+{mov.quantity}</span>
                            )}
                            {mov.type === "PENDING" && (
                              <span className="text-amber-500">Ditahan {mov.quantity}</span>
                            )}
                            {mov.type === "OUTBOUND" && (
                              <span className="text-rose-500">-{mov.quantity}</span>
                            )}
                            {mov.type === "ADJUSTMENT" && (
                              <span className="text-amber-500">
                                {mov.quantity > 0 ? `+${mov.quantity}` : mov.quantity}
                              </span>
                            )}
                          </td>

                          <td className="px-6 py-4">
                            {mov.photo_url ? (
                              <a
                                href={getImageUrl(mov.photo_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] hover:border-amber-500/50 transition-colors"
                                title="Klik untuk melihat foto bukti ukuran penuh"
                              >
                                <img
                                  src={getImageUrl(mov.photo_url)}
                                  alt="Bukti Mutasi"
                                  className="w-8 h-8 rounded object-cover border border-[var(--border)]"
                                />
                                <span className="text-xs font-semibold text-amber-500">
                                  Lihat Bukti
                                </span>
                              </a>
                            ) : (
                              <span className="text-xs text-[var(--text-secondary)]">-</span>
                            )}
                          </td>

                          <td className="px-6 py-4 text-[var(--text-secondary)] text-xs">
                            {mov.notes || "-"}
                          </td>
                        </tr>
                      );
                    })}

                    {filteredMovements.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-6 py-16 text-center text-xs text-[var(--text-secondary)]">
                          Belum ada catatan mutasi inventori.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </main>
      </div>

      {/* Modal Catat Mutasi Manual + Foto Bukti (Opsional) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <Boxes className="w-4 h-4 text-amber-500" />
                Catat Mutasi Stok Gudang
              </h2>
              <button
                onClick={() => {
                  clearPhoto();
                  setIsModalOpen(false);
                }}
                className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleRecordMovement} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Pilih Produk *
                </label>
                <select
                  value={form.product_id}
                  onChange={(e) => setForm({ ...form, product_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Pilih Produk --</option>
                  {products.map((p) => (
                    <option key={p.ID} value={p.ID}>
                      {p.name} (Stok saat ini: {p.stock})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Jenis Pergerakan *
                </label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as MovementType })}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="INBOUND">Barang Masuk / Restock Supplier (Stok +)</option>
                  <option value="OUTBOUND">Barang Keluar Manual (Stok -)</option>
                  <option value="ADJUSTMENT">Penyesuaian / Opname Gudang (Koreksi)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Kuantitas *
                </label>
                <input
                  type="number"
                  min="1"
                  value={form.quantity}
                  onChange={(e) => setForm({ ...form, quantity: Number(e.target.value) })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {/* Upload Foto Bukti Barang Masuk (Wajib untuk INBOUND sesuai PLAN.md Baris 23) */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1.5">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>
                      {form.type === "INBOUND"
                        ? "Foto Bukti Barang Masuk / Surat Jalan Supplier *"
                        : "Foto Bukti Fisik / Opname"}
                    </span>
                  </label>
                  <span className="text-xs font-semibold text-amber-500">
                    {form.type === "INBOUND" ? "Wajib Diunggah *" : "Opsional"}
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleSelectPhoto}
                  className="hidden"
                />

                {proofPreview ? (
                  <div className="relative w-full h-36 rounded-xl overflow-hidden border border-[var(--border)] bg-[var(--bg-sunken)]">
                    <img
                      src={proofPreview}
                      alt="Preview Bukti Mutasi"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearPhoto}
                      className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-slate-950/85 text-rose-500 hover:bg-slate-950 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      Hapus Foto
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="w-full py-4 px-3 rounded-xl border border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-1 text-amber-500 transition-colors"
                  >
                    <ImagePlus className="w-5 h-5" />
                    <span className="text-xs font-semibold">
                      Ambil / Pilih Foto Bukti Barang (JPG, PNG, WebP)
                    </span>
                    <span className="text-xs text-[var(--text-muted)]">
                      Bisa dikosongkan jika tidak ada dokumentasi foto
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan / Keterangan
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  rows={2}
                  placeholder="Contoh: Restock dari Supplier Jepara (No. SJ-091), kondisi barang mulus."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearPhoto();
                    setIsModalOpen(false);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Mutasi
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
