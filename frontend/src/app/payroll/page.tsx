"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { formatRupiah } from "@/utils/formatters";
import {
  DollarSign,
  Plus,
  Trash2,
  Loader2,
  User,
  Calendar,
  X,
} from "lucide-react";

interface PayrollDeduction {
  ID: number;
  type: "ABSENCE" | "MANUAL";
  amount: number;
  reason: string;
}

interface Payroll {
  ID: number;
  employee_id: number;
  month: number;
  year: number;
  base_salary: number;
  total_deduction: number;
  net_salary: number;
  note: string;
  CreatedAt: string;
  employee?: {
    ID: number;
    employee_code: string;
    name: string;
  };
  deductions?: PayrollDeduction[];
}

interface UserOption {
  ID: number;
  name: string;
  username: string;
  role?: { name: string };
}

const MONTHS = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

export default function PayrollPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [users, setUsers] = useState<UserOption[]>([]);
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const now = new Date();
  const [form, setForm] = useState({
    user_id: "",
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    base_salary: "3500000",
    deduction_amount: "0",
    deduction_reason: "",
    note: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [payRes, usrRes] = await Promise.all([
        api.get("/payrolls"),
        api.get("/users"),
      ]);
      if (payRes.data.success && payRes.data.data) {
        setPayrolls(payRes.data.data);
      }
      if (usrRes.data.success && usrRes.data.data) {
        setUsers(usrRes.data.data);
      }
    } catch {
      // handled
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

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.user_id) {
      alert("Pilih karyawan terlebih dahulu");
      return;
    }
    setSubmitting(true);
    try {
      const dedAmt = Number(form.deduction_amount) || 0;
      await api.post("/payrolls", {
        user_id: Number(form.user_id),
        month: Number(form.month),
        year: Number(form.year),
        base_salary: Number(form.base_salary) || 0,
        note: form.note,
        deductions:
          dedAmt > 0
            ? [
                {
                  type: "MANUAL",
                  amount: dedAmt,
                  reason: form.deduction_reason || "Potongan gaji",
                },
              ]
            : [],
      });
      setIsModalOpen(false);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal menerbitkan slip gaji");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Hapus slip gaji ini?")) return;
    try {
      await api.delete(`/payrolls/${id}`);
      await fetchData();
    } catch {
      alert("Gagal menghapus slip gaji");
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-amber-500" />
                <span>Penggajian & Slip Gaji Karyawan</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Penerbitan gaji pokok bulanan, rincian potongan, dan total gaji bersih (take home pay).
              </p>
            </div>

            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Terbitkan Slip Gaji
            </button>
          </header>

          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat data penggajian...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                      <th className="px-6 py-4 text-left">Periode</th>
                      <th className="px-6 py-4 text-left">Karyawan</th>
                      <th className="px-6 py-4 text-right">Gaji Pokok</th>
                      <th className="px-6 py-4 text-right">Total Potongan</th>
                      <th className="px-6 py-4 text-right">Gaji Bersih</th>
                      <th className="px-6 py-4 text-left">Catatan</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {payrolls.map((p) => (
                      <tr key={p.ID} className="hover:bg-[var(--bg-sunken)]/50 transition-colors">
                        <td className="px-6 py-4 font-semibold text-[var(--text-primary)]">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3.5 h-3.5 text-amber-500" />
                            <span>
                              {MONTHS[(p.month || 1) - 1]} {p.year}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                            <User className="w-3.5 h-3.5 text-amber-500" />
                            <span>{p.employee?.name || `Karyawan #${p.employee_id}`}</span>
                          </div>
                          {p.employee?.employee_code && (
                            <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                              {p.employee.employee_code}
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-[var(--text-secondary)]">
                          {formatRupiah(p.base_salary)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono text-rose-500">
                          - {formatRupiah(p.total_deduction)}
                        </td>
                        <td className="px-6 py-4 text-right font-mono font-bold text-amber-500 text-sm">
                          {formatRupiah(p.net_salary)}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {p.note || "-"}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button
                            onClick={() => handleDelete(p.ID)}
                            className="p-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-sunken)] hover:text-rose-500 hover:border-rose-500/30 transition-colors"
                            title="Hapus Slip Gaji"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}

                    {payrolls.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-6 py-16 text-center text-[var(--text-secondary)] font-medium">
                          Belum ada data penggajian yang diterbitkan.
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

      {/* Modal Terbitkan Slip Gaji */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-500" />
                Terbitkan Slip Gaji Bulanan
              </h2>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Pilih Karyawan *
                </label>
                <select
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                  required
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="">-- Pilih Karyawan --</option>
                  {users.map((u) => (
                    <option key={u.ID} value={u.ID}>
                      {u.name} ({u.role?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Bulan
                  </label>
                  <select
                    value={form.month}
                    onChange={(e) => setForm({ ...form, month: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    {MONTHS.map((m, idx) => (
                      <option key={m} value={idx + 1}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tahun
                  </label>
                  <input
                    type="number"
                    value={form.year}
                    onChange={(e) => setForm({ ...form, year: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Gaji Pokok (Rp) *
                </label>
                <input
                  type="number"
                  min="0"
                  required
                  value={form.base_salary}
                  onChange={(e) => setForm({ ...form, base_salary: e.target.value })}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Potongan (Rp)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.deduction_amount}
                    onChange={(e) => setForm({ ...form, deduction_amount: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Alasan Potongan
                  </label>
                  <input
                    type="text"
                    value={form.deduction_reason}
                    onChange={(e) => setForm({ ...form, deduction_reason: e.target.value })}
                    placeholder="Kasbon / Alfa"
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Slip Gaji
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Bonus target, transfer BCA, dll"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {submitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Slip Gaji
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
