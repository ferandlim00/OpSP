"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import {
  UserCog,
  Plus,
  Search,
  Shield,
  Phone,
  Mail,
  CheckCircle2,
  XCircle,
  Edit2,
  Trash2,
  Loader2,
  X,
  Eye,
  EyeOff,
} from "lucide-react";

interface Role {
  ID: number;
  name: string;
  description: string;
}

interface User {
  ID: number;
  name: string;
  username: string;
  email: string;
  is_active: boolean;
  role_id: number;
  role?: Role;
  employee?: {
    phone: string;
    address: string;
    employee_code: string;
  };
}

interface UserFormData {
  name: string;
  username: string;
  email: string;
  password: string;
  role_id: number;
  phone: string;
  address: string;
}

export default function EmployeesPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterRole, setFilterRole] = useState("ALL");

  const [showModal, setShowModal] = useState(false);
  const [editTarget, setEditTarget] = useState<User | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState("");

  const [form, setForm] = useState<UserFormData>({
    name: "", username: "", email: "", password: "",
    role_id: 0, phone: "", address: "",
  });

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/users"),
        api.get("/roles"),
      ]);
      setUsers(usersRes.data.data || []);
      setRoles(rolesRes.data.data || []);
    } catch {
      // error handled by interceptor
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) { router.push("/login"); return; }
    fetchData();
  }, [router, fetchData]);

  if (!mounted) return null;

  const filteredUsers = users.filter((u) => {
    const matchSearch =
      u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchRole =
      filterRole === "ALL" || u.role?.name === filterRole;
    return matchSearch && matchRole;
  });

  const openCreate = () => {
    setEditTarget(null);
    setForm({ name: "", username: "", email: "", password: "", role_id: roles[0]?.ID || 0, phone: "", address: "" });
    setFormError("");
    setShowModal(true);
  };

  const openEdit = (u: User) => {
    setEditTarget(u);
    setForm({
      name: u.name,
      username: u.username,
      email: u.email,
      password: "",
      role_id: u.role_id,
      phone: u.employee?.phone || "",
      address: u.employee?.address || "",
    });
    setFormError("");
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.username || !form.email || (!editTarget && !form.password)) {
      setFormError("Nama, username, email, dan password wajib diisi.");
      return;
    }
    try {
      setSaving(true);
      setFormError("");
      if (editTarget) {
        await api.put(`/users/${editTarget.ID}`, form);
      } else {
        await api.post("/users", form);
      }
      setShowModal(false);
      fetchData();
    } catch (err: any) {
      setFormError(err?.response?.data?.message || "Terjadi kesalahan.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (u: User) => {
    if (!confirm(`Hapus karyawan "${u.name}"? Tindakan ini tidak bisa dibatalkan.`)) return;
    try {
      await api.delete(`/users/${u.ID}`);
      fetchData();
    } catch {
      alert("Gagal menghapus karyawan.");
    }
  };

  const roleColors: Record<string, string> = {
    OWNER: "bg-purple-500/10 text-purple-400 border-purple-500/20",
    ADMIN: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    EMPLOYEE: "bg-sky-500/10 text-sky-400 border-sky-500/20",
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
                <UserCog className="w-5 h-5 text-amber-500" />
                <span>Manajemen Karyawan</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Kelola akun karyawan, hak akses, dan data profil.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari karyawan..."
                  className="pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500 w-48"
                />
              </div>

              {/* Filter Role */}
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="py-1.5 px-3 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
              >
                <option value="ALL">Semua Role</option>
                {roles.map((r) => (
                  <option key={r.ID} value={r.name}>{r.name}</option>
                ))}
              </select>

              {/* Tambah */}
              <button
                onClick={openCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-all"
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
          ) : filteredUsers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-[var(--text-muted)]">
              <UserCog className="w-12 h-12 mb-3 opacity-30" />
              <p className="text-sm">Belum ada karyawan.</p>
              <button onClick={openCreate} className="mt-3 text-xs text-amber-500 hover:underline">
                + Tambah karyawan pertama
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredUsers.map((u) => (
                <div
                  key={u.ID}
                  className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3 flex flex-col justify-between hover:border-[var(--border-soft)] transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center justify-center font-bold text-sm shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <h3 className="text-xs font-bold text-[var(--text-primary)]">{u.name}</h3>
                        <p className="text-[11px] text-[var(--text-secondary)] font-mono">@{u.username}</p>
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${roleColors[u.role?.name || "EMPLOYEE"] || roleColors.EMPLOYEE}`}>
                      {u.role?.name || "—"}
                    </span>
                  </div>

                  <div className="p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] space-y-1.5 text-xs">
                    <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                      <Mail className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    {u.employee?.phone && (
                      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Phone className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono text-[var(--text-primary)]">{u.employee.phone}</span>
                      </div>
                    )}
                    {u.employee?.employee_code && (
                      <div className="flex items-center gap-2 text-[var(--text-secondary)]">
                        <Shield className="w-3.5 h-3.5 shrink-0" />
                        <span className="font-mono text-[var(--text-primary)]">{u.employee.employee_code}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                    <span className={`flex items-center gap-1 text-[11px] font-semibold ${u.is_active ? "text-emerald-500" : "text-rose-500"}`}>
                      {u.is_active ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                      {u.is_active ? "Aktif" : "Nonaktif"}
                    </span>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => openEdit(u)}
                        className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-amber-500 hover:border-amber-500/30 transition-colors"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(u)}
                        className="p-1.5 rounded-md bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
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
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                {editTarget ? "Edit Karyawan" : "Tambah Karyawan Baru"}
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
                { label: "Nama Lengkap", key: "name", type: "text", placeholder: "Nama karyawan" },
                { label: "Username", key: "username", type: "text", placeholder: "username_unik" },
                { label: "Email", key: "email", type: "email", placeholder: "email@example.com" },
              ].map(({ label, key, type, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">{label}</label>
                  <input
                    type={type}
                    value={form[key as keyof UserFormData] as string}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    placeholder={placeholder}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              ))}

              {/* Password */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Password {editTarget && <span className="text-[var(--text-muted)] font-normal">(kosongkan jika tidak diubah)</span>}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full px-3 py-2 pr-10 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Role / Hak Akses</label>
                <select
                  value={form.role_id}
                  onChange={(e) => setForm({ ...form, role_id: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  {roles.map((r) => (
                    <option key={r.ID} value={r.ID}>{r.name} — {r.description}</option>
                  ))}
                </select>
              </div>

              {/* Phone & Address */}
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">No. HP</label>
                <input
                  type="text"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                  placeholder="0812-xxxx-xxxx"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">Alamat</label>
                <textarea
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  rows={2}
                  placeholder="Alamat tempat tinggal"
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
                className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-slate-950 hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center gap-2"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                {editTarget ? "Simpan Perubahan" : "Tambah Karyawan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}