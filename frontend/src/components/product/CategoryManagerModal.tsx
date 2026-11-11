"use client";

import React, { useState } from "react";
import api from "@/lib/api";
import { ProductCategory } from "@/types/product";
import { X, Plus, Trash2, Loader2, Tags } from "lucide-react";

interface Props {
  open: boolean;
  categories: ProductCategory[];
  onClose: () => void;
  onChanged: () => void; // Dipanggil saat ada kategori yang ditambah/dihapus agar parent me-refresh data
}

export default function CategoryManagerModal({ open, categories, onClose, onChanged }: Props) {
  const [newCategory, setNewCategory] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  if (!open) return null;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCategory.trim();
    if (!name) return;

    try {
      setLoading(true);
      setError("");
      setSuccessMsg("");
      await api.post("/categories", { name });
      setNewCategory("");
      setSuccessMsg(`Kategori "${name}" berhasil ditambahkan.`);
      onChanged(); // Refresh data di parent
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal menambahkan kategori.");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Hapus permanen kategori "${name}" dari database MySQL?\nPastikan tidak ada produk yang menggunakan kategori ini.`)) return;
    
    try {
      setLoading(true);
      setError("");
      setSuccessMsg("");
      await api.delete(`/categories/${id}`);
      setSuccessMsg(`Kategori "${name}" berhasil dihapus permanen dari database.`);
      onChanged(); // Refresh data di parent
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal menghapus kategori. Pastikan kategori kosong.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-md flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Tags className="w-4 h-4 text-amber-500" />
            Kelola Kategori
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-5 flex flex-col gap-4 max-h-[70vh] overflow-y-auto">
          {error && (
            <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}
          {successMsg && (
            <p className="text-xs text-emerald-500 bg-emerald-500/10 border border-emerald-500/20 px-3 py-2 rounded-lg">
              {successMsg}
            </p>
          )}

          {/* Form Tambah */}
          <form onSubmit={handleAdd} className="flex gap-2">
            <input
              type="text"
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              placeholder="Kategori baru (cth: Lemari Pakaian)"
              className="flex-1 px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
              disabled={loading}
            />
            <button
              type="submit"
              disabled={loading || !newCategory.trim()}
              className="px-4 py-2 bg-amber-500 text-black font-semibold text-xs rounded-lg hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center gap-1"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Tambah
            </button>
          </form>

          <hr className="border-[var(--border)]" />

          {/* Daftar Kategori */}
          <div className="flex flex-col gap-2">
            <p className="text-xs font-semibold text-[var(--text-secondary)] mb-1">Daftar Kategori ({categories.length})</p>
            {categories.length === 0 ? (
              <p className="text-xs text-[var(--text-muted)] text-center py-4">Belum ada kategori.</p>
            ) : (
              categories.map((c) => (
                <div key={c.ID} className="flex items-center justify-between px-3 py-2 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)]">
                  <span className="text-xs font-semibold text-[var(--text-primary)]">{c.name}</span>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.ID, c.name)}
                    disabled={loading}
                    className="p-1.5 text-[var(--text-muted)] hover:text-rose-500 hover:bg-rose-500/10 rounded-md transition-colors disabled:opacity-50"
                    title="Hapus"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
