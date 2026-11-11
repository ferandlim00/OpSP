"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import { formatRupiah } from "@/utils/formatters";
import {
  Clock,
  MapPin,
  LogIn,
  LogOut,
  Loader2,
  User,
  CheckCircle2,
  AlertCircle,
  Camera,
  Trash2,
} from "lucide-react";

interface Attendance {
  ID: number;
  employee_id: number;
  type: "CHECK_IN" | "CHECK_OUT";
  photo_url?: string;
  latitude: number;
  longitude: number;
  accuracy: number;
  device_info: string;
  timestamp: string;
  employee?: {
    ID: number;
    employee_code: string;
    name: string;
    base_salary?: number;
    user?: {
      role?: {
        name: string;
      };
    };
  };
}

export default function AttendancePage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number; acc: number } | null>(null);
  const [attendanceEnabled, setAttendanceEnabled] = useState(true);
  const [gpsRequired, setGpsRequired] = useState(true);
  const [dailySalaryDefault, setDailySalaryDefault] = useState(150000);
  const [workStartTime, setWorkStartTime] = useState("08:00");
  const [lateDeductionAmount, setLateDeductionAmount] = useState(50000);

  // Wajib Foto Absen (Selfie / Kamera) sesuai PLAN.md Baris 23
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fetchAttendances = useCallback(async () => {
    setLoading(true);
    try {
      const [attRes, setRes] = await Promise.allSettled([
        api.get("/attendances"),
        api.get("/settings"),
      ]);
      if (attRes.status === "fulfilled" && attRes.value.data?.success && attRes.value.data?.data) {
        setRecords(attRes.value.data.data);
      }
      if (setRes.status === "fulfilled" && setRes.value.data?.success && setRes.value.data?.data) {
        const s = setRes.value.data.data;
        setAttendanceEnabled(s.attendance_enabled !== "false");
        setGpsRequired(s.attendance_gps_enabled !== "false");
        if (s.default_daily_salary) setDailySalaryDefault(Number(s.default_daily_salary) || 150000);
        if (s.work_start_time) setWorkStartTime(s.work_start_time);
        if (s.absence_deduction_amount) setLateDeductionAmount(Number(s.absence_deduction_amount) || 0);
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
    fetchAttendances();

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            acc: pos.coords.accuracy,
          });
        },
        () => {
          // Biarkan 0 jika tidak diizinkan
        }
      );
    }
  }, [router, fetchAttendances]);

  const handleSelectPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(file);
    setPhotoPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearPhoto = () => {
    if (photoPreview) URL.revokeObjectURL(photoPreview);
    setPhotoFile(null);
    setPhotoPreview("");
  };

  const handleClock = async (type: "CHECK_IN" | "CHECK_OUT") => {
    if (!photoFile) {
      setMessage({
        type: "err",
        text: "Wajib mengambil/mengunggah Foto Bukti Kehadiran (Selfie/Kamera) terlebih dahulu sesuai aturan bisnis!",
      });
      return;
    }

    setSubmitting(true);
    setMessage(null);
    try {
      const fd = new FormData();
      fd.append("type", type);
      fd.append("latitude", String(coords?.lat || 0));
      fd.append("longitude", String(coords?.lng || 0));
      fd.append("accuracy", String(coords?.acc || 0));
      fd.append("photo", photoFile);

      await api.post("/attendances", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearPhoto();
      setMessage({
        type: "ok",
        text: `Berhasil mencatat ${type === "CHECK_IN" ? "Absen Masuk" : "Absen Pulang"} beserta foto bukti!`,
      });
      await fetchAttendances();
    } catch (err: any) {
      setMessage({
        type: "err",
        text: err.response?.data?.message || "Gagal mencatat presensi.",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header, Upload Foto Wajib & Tombol Absen */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                  <Clock className="w-5 h-5 text-amber-500" />
                  <span>Presensi Kehadiran & Perhitungan Gaji Harian</span>
                </h1>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 flex items-center gap-1.5">
                  <MapPin className="w-3.5 h-3.5 text-amber-500" />
                  {!attendanceEnabled
                    ? "Sistem Presensi sedang dinonaktifkan oleh Owner."
                    : !gpsRequired
                    ? `Mode Bebas Lokasi Aktif · Jam Kerja: ${workStartTime}`
                    : coords
                    ? `Lokasi GPS Terkunci · Jam Masuk: ${workStartTime}`
                    : "Menunggu izin GPS browser untuk validasi lokasi toko..."}
                </p>
              </div>

              {attendanceEnabled && (
                <div className="flex flex-wrap items-center gap-2.5">
                  <button
                    disabled={submitting}
                    onClick={() => handleClock("CHECK_IN")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                  >
                    <LogIn className="w-4 h-4" />
                    Absen Masuk (Check-In)
                  </button>
                  <button
                    disabled={submitting}
                    onClick={() => handleClock("CHECK_OUT")}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold bg-[var(--bg-sunken)] text-[var(--text-primary)] border border-[var(--border)] hover:border-amber-500/40 disabled:opacity-50 transition-colors"
                  >
                    <LogOut className="w-4 h-4 text-amber-500" />
                    Absen Pulang (Check-Out)
                  </button>
                </div>
              )}
            </div>

            {attendanceEnabled && (
              <div className="pt-3 border-t border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    capture="user"
                    onChange={handleSelectPhoto}
                    className="hidden"
                  />
                  {photoPreview ? (
                    <div className="flex items-center gap-3">
                      <img
                        src={photoPreview}
                        alt="Preview Foto Absen"
                        className="w-12 h-12 rounded-lg object-cover border border-amber-500"
                      />
                      <div>
                        <p className="text-xs font-bold text-emerald-500">
                          Foto Kehadiran Siap Dikirim
                        </p>
                        <button
                          type="button"
                          onClick={clearPhoto}
                          className="text-xs text-rose-500 hover:underline flex items-center gap-1 mt-0.5"
                        >
                          <Trash2 className="w-3 h-3" />
                          Ganti / Hapus Foto
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="px-3.5 py-2 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 text-amber-500 text-xs font-bold flex items-center gap-2 transition-colors"
                    >
                      <Camera className="w-4 h-4" />
                      <span>1. Ambil / Pilih Foto Bukti Kehadiran (Wajib *)</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[var(--text-muted)]">
                  Sesuai aturan bisnis, setiap presensi wajib disertai foto bukti kehadiran.
                </p>
              </div>
            )}
          </div>

          {message && (
            <div
              className={`p-3.5 rounded-xl border text-xs font-semibold flex items-center gap-2 ${
                message.type === "ok"
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                  : "bg-rose-500/10 border-rose-500/20 text-rose-500"
              }`}
            >
              {message.type === "ok" ? (
                <CheckCircle2 className="w-4 h-4 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Tabel Riwayat Kehadiran Sesuai PLAN.md Baris 20 */}
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden shadow-xs">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat riwayat presensi...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                      <th className="px-6 py-4 text-left">Nama Karyawan</th>
                      <th className="px-6 py-4 text-left">Role</th>
                      <th className="px-6 py-4 text-left">Status Presensi</th>
                      <th className="px-6 py-4 text-left">Tanggal & Jam</th>
                      <th className="px-6 py-4 text-left">Bukti Foto</th>
                      <th className="px-6 py-4 text-right">Gaji Didapat</th>
                      <th className="px-6 py-4 text-right">Potongan</th>
                      <th className="px-6 py-4 text-right">Total Gaji</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {records.map((r) => {
                      const dObj = new Date(r.timestamp);
                      const datePart = dObj.toLocaleDateString("id-ID", {
                        dateStyle: "medium",
                      });
                      const timePart = dObj.toLocaleTimeString("id-ID", {
                        hour: "2-digit",
                        minute: "2-digit",
                      });
                      const roleName = r.employee?.user?.role?.name || "EMPLOYEE";

                      // Hitung gaji harian & potongan keterlambatan untuk CHECK_IN
                      const isCheckIn = r.type === "CHECK_IN";
                      const earnedSalary = isCheckIn ? dailySalaryDefault : 0;
                      const [targetH, targetM] = (workStartTime || "08:00")
                        .split(":")
                        .map((n) => Number(n) || 0);
                      const isLate =
                        isCheckIn &&
                        (dObj.getHours() > targetH ||
                          (dObj.getHours() === targetH && dObj.getMinutes() > targetM + 15));
                      const deduction = isLate ? Math.min(earnedSalary, lateDeductionAmount) : 0;
                      const netTotal = Math.max(0, earnedSalary - deduction);

                      return (
                        <tr key={r.ID} className="hover:bg-[var(--bg-sunken)]/50 transition-colors">
                          <td className="px-6 py-4">
                            <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                              <User className="w-3.5 h-3.5 text-amber-500" />
                              <span>{r.employee?.name || `Karyawan #${r.employee_id}`}</span>
                            </div>
                            {r.employee?.employee_code && (
                              <span className="text-xs font-mono font-medium text-[var(--text-secondary)]">
                                {r.employee.employee_code}
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4">
                            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {roleName}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            {r.type === "CHECK_IN" ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                <LogIn className="w-3 h-3" />
                                Hadir (Masuk)
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                                <LogOut className="w-3 h-3" />
                                Hadir (Pulang)
                              </span>
                            )}
                          </td>
                          <td className="px-6 py-4 font-mono text-[var(--text-primary)] whitespace-nowrap">
                            <div>{datePart}</div>
                            <div className="text-xs text-[var(--text-secondary)]">
                              Jam {timePart}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            {r.photo_url ? (
                              <a
                                href={getImageUrl(r.photo_url)}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-[var(--bg-sunken)] border border-[var(--border)] hover:border-amber-500/40"
                              >
                                <img
                                  src={getImageUrl(r.photo_url)}
                                  alt="Bukti Absen"
                                  className="w-7 h-7 rounded object-cover"
                                />
                                <span className="text-xs text-amber-500 font-semibold">
                                  Foto
                                </span>
                              </a>
                            ) : (
                              <span className="text-[var(--text-muted)]">-</span>
                            )}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-[var(--text-primary)]">
                            {isCheckIn ? formatRupiah(earnedSalary) : "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono text-rose-500">
                            {isCheckIn ? (deduction > 0 ? `-${formatRupiah(deduction)}` : "Rp 0") : "-"}
                          </td>
                          <td className="px-6 py-4 text-right font-mono font-bold text-emerald-500">
                            {isCheckIn ? formatRupiah(netTotal) : "-"}
                          </td>
                        </tr>
                      );
                    })}

                    {records.length === 0 && (
                      <tr>
                        <td colSpan={8} className="px-6 py-12 text-center text-[var(--text-muted)]">
                          Belum ada rekaman presensi kehadiran karyawan.
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
    </div>
  );
}
