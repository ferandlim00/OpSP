"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import SupplierFormModal from "@/components/supplier/SupplierFormModal";
import { Supplier, SupplierInput } from "@/types/supplier";
import api from "@/lib/api";
import {
  Building2,
  Plus,
  Search,
  Edit2,
  Trash2,
  Loader2,
  Phone,
  Mail,
  User,
  MapPin,
  CheckCircle2,
  XCircle,
} from "lucide-react";

export default function SuppliersPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = getUser();
  const role = user?.role?.name || "OWNER";
  const isOwner = role === "OWNER";

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const [notice, setNotice] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const notify = (type: "success" | "error", text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  };

  // Ambil data supplier dari API Go Fiber
  const fetchSuppliers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/suppliers");
      if (res.data.success && res.data.data) {
        setSuppliers(res.data.data);
      } else {
        setSuppliers([]);
      }
    } catch (error) {
      console.error("Gagal memuat data supplier:", error);
      setSuppliers([]);
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
    fetchSuppliers();
  }, [router, fetchSuppliers]);

  const handleOpenModal = (supplier?: Supplier) => {
    setEditingSupplier(supplier || null);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingSupplier(null);
  };

  const handleSubmit = async (data: SupplierInput) => {
    try {
      if (editingSupplier) {
        await api.put(`/suppliers/${editingSupplier.ID}`, data);
        notify("success", `Supplier "${data.name}" berhasil diperbarui.`);
      } else {
        await api.post("/suppliers", data);
        notify("success", `Supplier "${data.name}" berhasil ditambahkan.`);
      }
      await fetchSuppliers();
      handleCloseModal();
    } catch (error: any) {
      alert(error.response?.data?.message || "Gagal menyimpan data supplier");
    }
  };

  const handleDelete = async (id: number, name: string) => {
    if (confirm(`Hapus permanen supplier "${name}" dari database MySQL?`)) {
      try {
        await api.delete(`/suppliers/${id}`);
        notify("success", `Supplier "${name}" berhasil dihapus permanen dari database.`);
        await fetchSuppliers();
      } catch (error: any) {
        notify("error", error.response?.data?.message || "Gagal menghapus supplier");
      }
    }
  };

  // Filter pencarian
  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase();
    return (
      s.name.toLowerCase().includes(q) ||
      (s.code && s.code.toLowerCase().includes(q)) ||
      (s.pic && s.pic.toLowerCase().includes(q))
    );
  });

  if (!mounted) return null;

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

          {/* Header & Tombol Tambah */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Building2 className="w-5 h-5 text-amber-500" />
                <span>Data Supplier & Vendor</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Kelola daftar mitra dan pemasok barang logistik toko.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <div className="relative min-w-[220px]">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari nama, kode, PIC..."
                  className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {isOwner && (
                <button
                  onClick={() => handleOpenModal()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-all shadow-xs"
                >
                  <Plus className="w-4 h-4" />
                  Tambah Supplier
                </button>
              )}
            </div>
          </div>

          {/* Tabel Daftar Supplier */}
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat data supplier...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                      <th className="px-6 py-4">Kode & Nama</th>
                      <th className="px-6 py-4">Kontak & PIC</th>
                      <th className="px-6 py-4">Alamat</th>
                      <th className="px-6 py-4">Status</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredSuppliers.map((supplier) => (
                      <tr
                        key={supplier.ID}
                        className="hover:bg-[var(--bg-sunken)]/50 transition-colors"
                      >
                        {/* Kode & Nama */}
                        <td className="px-6 py-4">
                          <div className="font-bold text-[var(--text-primary)]">
                            {supplier.name}
                          </div>
                          <span className="inline-block text-xs font-mono text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded mt-0.5">
                            {supplier.code || "-"}
                          </span>
                        </td>

                        {/* Kontak & PIC */}
                        <td className="px-6 py-4 space-y-1">
                          {supplier.pic && (
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs">
                              <User className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                              <span>{supplier.pic}</span>
                            </div>
                          )}
                          {supplier.phone && (
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs font-mono">
                              <Phone className="w-3.5 h-3.5 text-amber-500" />
                              <span>{supplier.phone}</span>
                            </div>
                          )}
                          {supplier.email && (
                            <div className="flex items-center gap-1.5 text-[var(--text-secondary)] text-xs">
                              <Mail className="w-3.5 h-3.5 text-[var(--text-secondary)]" />
                              <span>{supplier.email}</span>
                            </div>
                          )}
                          {!supplier.pic && !supplier.phone && !supplier.email && (
                            <span className="text-[var(--text-secondary)]">-</span>
                          )}
                        </td>

                        {/* Alamat */}
                        <td className="px-6 py-4 max-w-xs truncate text-[var(--text-secondary)]">
                          {supplier.address ? (
                            <div className="flex items-start gap-1">
                              <MapPin className="w-3.5 h-3.5 text-[var(--text-secondary)] mt-0.5 shrink-0" />
                              <span className="truncate">{supplier.address}</span>
                            </div>
                          ) : (
                            <span className="text-[var(--text-secondary)]">-</span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="px-6 py-4">
                          {supplier.is_active ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Aktif
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" />
                              Nonaktif
                            </span>
                          )}
                        </td>

                        {/* Aksi */}
                        <td className="px-6 py-4 text-right space-x-1">
                          <button
                            onClick={() => handleOpenModal(supplier)}
                            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] hover:text-amber-500 hover:border-amber-500/30 transition-all"
                            title="Edit"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          {isOwner && (
                            <button
                              onClick={() => handleDelete(supplier.ID, supplier.name)}
                              className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] hover:text-rose-500 hover:border-rose-500/30 transition-all"
                              title="Hapus (Khusus Owner)"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredSuppliers.length === 0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-6 py-16 text-center text-xs text-[var(--text-secondary)]"
                        >
                          Belum ada data supplier yang ditemukan.
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

      <SupplierFormModal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onSubmit={handleSubmit}
        initialData={editingSupplier}
        title={editingSupplier ? "Edit Data Supplier" : "Tambah Supplier Baru"}
      />
    </div>
  );
}