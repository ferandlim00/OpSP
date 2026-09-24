"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import {
  Tag,
  Plus,
  Edit2,
  Trash2,
  Loader2,
  X,
  Package,
} from "lucide-react";

interface Category {
  ID: number;
  name: string;
}

export default function CategoriesPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Category | null>(null);
  const [catName, setCatName] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const fetchCategories = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/categories");
      setCategories(res.data.data || []);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchCategories();
  }, [router, fetchCategories]);

  if (!mounted) return null;

  const openCreate = () => {
    setEditTarget(null);
    setCatName("");
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (c: Category) => {
    setEditTarget(c);
    setCatName(c.name);
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!catName.trim()) {
      setFormError("Nama kategori wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      if (editTarget) {
        await api.put(`/categories/${editTarget.ID}`, { name: catName });
      } else {
        await api.post("/categories", { name: catName });
      }
      setShowModal(false);
      fetchCategories();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Category) => {
    if (!confirm(`Hapus kategori "${c.name}"?`)) return;
    try {
      await api.delete(`/categories/${c.ID}`);
      fetchCategories();
    } catch (err: any) {
      alert(err?.response?.data?.message || "Gagal menghapus kategori.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-500" />
                <span>Kategori Produk</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Kelola kategori produk furniture (Sofa, Lemari, Meja, dll).
              </p>
            </div>

            <button
              onClick={openCreate}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all self-start sm:self-auto"
            >
              <Plus className="w-4 h-4" />
              Tambah Kategori
            </button>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="ml-2 text-[var(--text-secondary)] text-sm">Memuat data...</span>
            </div>
          ) : categories.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
              <Tag className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Belum ada kategori.</p>
              <button onClick={openCreate} className="mt-3 text-xs text-amber-500 hover:underline">
                + Tambah kategori pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {categories.map((cat) => (
                <div
                  key={cat.ID}
                  className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex flex-col justify-between gap-4 hover:border-[var(--border-soft)] transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Package className="w-5 h-5 text-amber-500" />
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-sm font-bold text-[var(--text-primary)] truncate">{cat.name}</h3>
                      <span className="text-[10px] font-mono text-[var(--text-muted)]">ID: {cat.ID}</span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-1.5 pt-2 border-t border-[var(--border)]">
                    <button
                      onClick={() => openEdit(cat)}
                      className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/30 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cat)}
                      className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                      title="Hapus"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-sunken)]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {editTarget ? "Edit Kategori" : "Tambah Kategori Baru"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-[var(--text-secondary)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {formError && (
                <p className="text-xs text-rose-400 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}
              <div>
                <label className="block text-xs text-[var(--text-secondary)] mb-1">Nama Kategori *</label>
                <input
                  type="text"
                  value={catName}
                  onChange={(e) => setCatName(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSave()}
                  placeholder="cth: Sofa, Lemari, Meja..."
                  autoFocus
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-sunken)] border border-[var(--border)] hover:bg-[var(--bg-sunken)] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editTarget ? "Simpan" : "Tambah"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}