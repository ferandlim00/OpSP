"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import {
  Users,
  Search,
  Plus,
  Phone,
  MapPin,
  Loader2,
  Edit2,
  Trash2,
  X,
} from "lucide-react";

interface Customer {
  ID: number;
  customer_code: string;
  name: string;
  phone: string;
  email: string;
  address: string;
}

interface CustomerFormData {
  name: string;
  phone: string;
  email: string;
  address: string;
}

export default function CustomersPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<Customer | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  const [form, setForm] = useState<CustomerFormData>({
    name: "", phone: "", email: "", address: "",
  });

  const fetchCustomers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get("/customers", {
        params: searchQuery ? { search: searchQuery } : {},
      });
      setCustomers(res.data.data || []);
    } catch {
      // handled by interceptor
    } finally {
      setLoading(false);
    }
  }, [searchQuery]);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.push("/login"); return; }
  }, [router]);

  useEffect(() => {
    if (mounted) {
      const timeout = setTimeout(fetchCustomers, 300);
      return () => clearTimeout(timeout);
    }
  }, [mounted, fetchCustomers]);

  if (!mounted) return null;

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", phone: "", email: "", address: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (c: Customer) => {
    setEditTarget(c);
    setForm({ name: c.name, phone: c.phone, email: c.email, address: c.address });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      setFormError("Nama dan nomor HP wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      if (editTarget) {
        await api.put(`/customers/${editTarget.ID}`, form);
        notify("success", `Pelanggan "${form.name}" berhasil diperbarui.`);
      } else {
        await api.post("/customers", form);
        notify("success", `Pelanggan "${form.name}" berhasil ditambahkan.`);
      }
      setShowModal(false);
      fetchCustomers();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (c: Customer) => {
    if (!confirm(`Hapus permanen pelanggan "${c.name}" dari database MySQL?`)) return;
    try {
      await api.delete(`/customers/${c.ID}`);
      notify("success", `Pelanggan "${c.name}" berhasil dihapus permanen dari database.`);
      fetchCustomers();
    } catch (err: any) {
      notify("error", err?.response?.data?.message || "Gagal menghapus pelanggan.");
    }
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {notice && (
            <div
              className={`px-4 py-3 rounded-xl border text-xs font-semibold ${
                notice.type === "success"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}
            >
              {notice.text}
            </div>
          )}

          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Users className="w-5 h-5 text-amber-500" />
                <span>Data Pelanggan</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Kelola data pelanggan toko dan riwayat pembelian.
              </p>
            </div>

            <div className="flex items-center gap-2 w-full sm:w-auto">
              <div className="relative flex-1 sm:flex-initial">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, HP, kode..."
                  className="pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 w-full sm:w-52"
                />
              </div>

              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-all shrink-0"
              >
                <Plus className="w-4 h-4" />
                Tambah
              </button>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="ml-2 text-[var(--text-secondary)] text-sm">Memuat data...</span>
            </div>
          ) : customers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
              <Users className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Belum ada pelanggan.</p>
              <button onClick={openCreate} className="mt-3 text-xs text-amber-500 hover:underline">
                + Tambah pelanggan pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {customers.map((cust) => (
                <div
                  key={cust.ID}
                  className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3 flex flex-col justify-between hover:border-amber-500/40 transition-colors"
                >
                  <div className="space-y-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                          {cust.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-[var(--text-primary)]">{cust.name}</h3>
                          <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">{cust.customer_code}</span>
                        </div>
                      </div>
                    </div>

                    <div className="p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] space-y-1.5 text-xs">
                      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Phone className="w-3.5 h-3.5 shrink-0 text-amber-500" />
                        <span className="font-mono text-[var(--text-primary)]">{cust.phone}</span>
                      </div>
                      {cust.email && (
                        <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                          <span className="text-[var(--text-muted)]">@</span>
                          <span className="truncate">{cust.email}</span>
                        </div>
                      )}
                      {cust.address && (
                        <div className="flex items-start gap-2 text-[var(--text-secondary)]">
                          <MapPin className="w-3.5 h-3.5 shrink-0 mt-0.5 text-[var(--text-muted)]" />
                          <span className="line-clamp-2">{cust.address}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex justify-end gap-1.5">
                    <button
                      onClick={() => openEdit(cust)}
                      className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/30 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(cust)}
                      className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
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

      {/* Modal Tambah/Edit */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-sunken)]/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[90vh] overflow-y-auto bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {editTarget ? "Edit Pelanggan" : "Tambah Pelanggan Baru"}
              </h2>
              <button onClick={() => setShowModal(false)} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-3">
              {formError && (
                <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">
                  {formError}
                </p>
              )}

              {[
                { label: "Nama Lengkap *", key: "name", placeholder: "Nama pelanggan" },
                { label: "No. HP *", key: "phone", placeholder: "0812-xxxx-xxxx" },
                { label: "Email", key: "email", placeholder: "email@example.com" },
              ].map(({ label, key, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{label}</label>
                  <input
                    type="text"
                    value={form[key as keyof CustomerFormData]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={3}
                  placeholder="Alamat lengkap pelanggan"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 resize-none"
                />
              </div>
            </div>

            <div className="px-6 pb-5 flex gap-3 justify-end">
              <button
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-sunken)] border border-[var(--border)] hover:bg-[var(--bg-surface)] transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editTarget ? "Simpan Perubahan" : "Tambah Pelanggan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}