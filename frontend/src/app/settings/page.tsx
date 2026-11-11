"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import {
  Settings,
  Save,
  MapPin,
  Building2,
  Loader2,
  CheckCircle2,
  Navigation,
  Search,
  Link2,
  Power,
  Clock,
  Truck,
  DollarSign,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

interface GeoSearchResult {
  display_name: string;
  lat: string;
  lon: string;
}

export default function SettingsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savedNotice, setSavedNotice] = useState(false);

  // State bantu untuk pencarian lokasi manusiawi (tanpa ketik koordinat manual)
  const [detectingGps, setDetectingGps] = useState(false);
  const [detectedPlaceName, setDetectedPlaceName] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchingPlace, setSearchingPlace] = useState(false);
  const [searchResults, setSearchResults] = useState<GeoSearchResult[]>([]);
  const [gmapsUrl, setGmapsUrl] = useState("");
  const [locNotice, setLocNotice] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const [form, setForm] = useState<Record<string, string>>({
    store_name: "PropertiERP",
    store_address: "",
    store_phone: "",
    store_email: "",
    store_logo_url: "",
    store_latitude: "-6.200000",
    store_longitude: "106.816666",
    store_radius_meters: "100",
    attendance_enabled: "true",
    attendance_gps_enabled: "true",
    payroll_enabled: "true",
    delivery_schedule_enabled: "true",
    shipping_cost_enabled: "true",
    default_shipping_cost: "50000",
    default_daily_salary: "150000",
    default_monthly_salary: "3500000",
    work_start_time: "08:00",
    work_end_time: "17:00",
    payment_system_info: "Tunai, Transfer Bank BCA, QRIS",
    absence_deduction_amount: "50000",
  });

  const fetchSettings = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get("/settings");
      if (res.data.success && res.data.data) {
        setForm((prev) => ({ ...prev, ...res.data.data }));
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
    fetchSettings();
  }, [router, fetchSettings]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setSavedNotice(false);
    try {
      const res = await api.put("/settings", form);
      if (res.data.success && res.data.data) {
        setForm((prev) => ({ ...prev, ...res.data.data }));
        setSavedNotice(true);
        window.dispatchEvent(new Event("settings-updated"));
        setTimeout(() => setSavedNotice(false), 3000);
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal menyimpan pengaturan");
    } finally {
      setSaving(false);
    }
  };

  const toggleSetting = (key: string) => {
    setForm((prev) => ({
      ...prev,
      [key]: prev[key] === "false" ? "true" : "false",
    }));
  };

  // 1. Deteksi Lokasi GPS Otomatis (1-Klik)
  const handleUseCurrentLocation = () => {
    if (!("geolocation" in navigator)) {
      setLocNotice({
        type: "err",
        text: "Browser Anda tidak mendukung fitur deteksi lokasi GPS.",
      });
      return;
    }
    setDetectingGps(true);
    setLocNotice(null);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude.toFixed(6);
        const lng = pos.coords.longitude.toFixed(6);
        setForm((prev) => ({
          ...prev,
          store_latitude: lat,
          store_longitude: lng,
        }));
        try {
          const r = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
          );
          const data = await r.json();
          if (data?.display_name) {
            setDetectedPlaceName(data.display_name);
          }
        } catch {
          // Abaikan jika reverse geocode gagal
        }
        setDetectingGps(false);
        setLocNotice({
          type: "ok",
          text: "Titik lokasi toko berhasil diatur sesuai posisi perangkat Anda saat ini!",
        });
      },
      () => {
        setDetectingGps(false);
        setLocNotice({
          type: "err",
          text: "Gagal mengakses GPS perangkat. Pastikan izin lokasi browser diaktifkan, atau gunakan pencarian nama alamat di bawah.",
        });
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  // 2. Cari Lokasi berdasarkan Nama Jalan / Tempat / Gedung
  const handleSearchAddress = async () => {
    if (!searchQuery.trim()) return;
    setSearchingPlace(true);
    setLocNotice(null);
    setSearchResults([]);
    try {
      const q = encodeURIComponent(searchQuery.trim());
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${q}&countrycodes=id&limit=5`
      );
      const data: GeoSearchResult[] = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setSearchResults(data);
      } else {
        setLocNotice({
          type: "err",
          text: "Alamat tidak ditemukan. Coba ketik nama jalan, kelurahan, atau kota yang lebih umum.",
        });
      }
    } catch {
      setLocNotice({
        type: "err",
        text: "Gagal mencari alamat. Periksa koneksi internet Anda.",
      });
    } finally {
      setSearchingPlace(false);
    }
  };

  const handleSelectSearchResult = (item: GeoSearchResult) => {
    const lat = parseFloat(item.lat).toFixed(6);
    const lng = parseFloat(item.lon).toFixed(6);
    setForm((prev) => ({
      ...prev,
      store_latitude: lat,
      store_longitude: lng,
    }));
    setDetectedPlaceName(item.display_name);
    setSearchResults([]);
    setLocNotice({
      type: "ok",
      text: `Titik toko berhasil dipilih: ${item.display_name}`,
    });
  };

  // 3. Ekstrak otomatis dari Link Google Maps
  const handleApplyGmapsLink = (val: string) => {
    setGmapsUrl(val);
    if (!val.trim()) return;
    // Cocokkan pola @-6.1234,106.1234 atau q=-6.1234,106.1234 atau !3d-6.1234!4d106.1234
    const atMatch = val.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    const qMatch = val.match(/[?&](?:q|ll|query)=(-?\d+\.\d+),(-?\d+\.\d+)/);
    const bangMatch = val.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/);
    const directMatch = val.trim().match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);

    const matched = atMatch || qMatch || bangMatch || directMatch;
    if (matched) {
      const lat = parseFloat(matched[1]).toFixed(6);
      const lng = parseFloat(matched[2]).toFixed(6);
      setForm((prev) => ({
        ...prev,
        store_latitude: lat,
        store_longitude: lng,
      }));
      setLocNotice({
        type: "ok",
        text: "Berhasil membaca titik lokasi dari link Google Maps!",
      });
    } else {
      setLocNotice({
        type: "err",
        text: "Link belum memuat titik lokasi. Buka Google Maps di browser, klik titik toko Anda, lalu salin link panjang dari bilah alamat (address bar).",
      });
    }
  };

  if (!mounted) return null;

  const inputCls =
    "w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500";
  const labelCls = "block text-xs font-semibold text-[var(--text-secondary)] mb-1";

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-4xl w-full mx-auto space-y-6">
          <header className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Settings className="w-5 h-5 text-amber-500" />
                <span>Pengaturan Sistem Operasional</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Konfigurasi profil toko, titik GPS presensi, dan parameter penggajian.
              </p>
            </div>
          </header>

          {savedNotice && (
            <div className="p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-semibold flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              <span>Pengaturan sistem berhasil diperbarui!</span>
            </div>
          )}

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Memuat konfigurasi...</span>
            </div>
          ) : (
            <form onSubmit={handleSave} className="space-y-6">
              {/* Profil Operasional */}
              <section className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                  <Building2 className="w-4 h-4 text-amber-500" />
                  Identitas & Kontak Operasional
                </h2>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Nama Sistem / Toko</label>
                    <input
                      type="text"
                      value={form.store_name || ""}
                      onChange={(e) => setForm({ ...form, store_name: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>No. Telepon / WhatsApp Admin</label>
                    <input
                      type="text"
                      value={form.store_phone || ""}
                      onChange={(e) => setForm({ ...form, store_phone: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Alamat Lengkap Perusahaan</label>
                  <textarea
                    rows={2}
                    value={form.store_address || ""}
                    onChange={(e) => setForm({ ...form, store_address: e.target.value })}
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className={labelCls}>Email Perusahaan (Opsional)</label>
                    <input
                      type="email"
                      placeholder="admin@perusahaan.com"
                      value={form.store_email || ""}
                      onChange={(e) => setForm({ ...form, store_email: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>URL / Link Logo Perusahaan (Opsional)</label>
                    <input
                      type="text"
                      placeholder="https://... atau /uploads/..."
                      value={form.store_logo_url || ""}
                      onChange={(e) => setForm({ ...form, store_logo_url: e.target.value })}
                      className={inputCls}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t border-[var(--border)]">
                  <div>
                    <label className={labelCls}>
                      Sistem Pembayaran Transaksi (Opsional)
                    </label>
                    <input
                      type="text"
                      placeholder="Tunai, Transfer BCA 1234567890, QRIS"
                      value={form.payment_system_info || ""}
                      onChange={(e) =>
                        setForm({ ...form, payment_system_info: e.target.value })
                      }
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>
                      Tarif Ongkir Pengiriman Default (Rp — Opsional)
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        min="0"
                        value={form.default_shipping_cost || "0"}
                        onChange={(e) =>
                          setForm({ ...form, default_shipping_cost: e.target.value })
                        }
                        className={`${inputCls} font-mono`}
                      />
                      <button
                        type="button"
                        onClick={() => toggleSetting("shipping_cost_enabled")}
                        className={`px-3 py-2 rounded-lg text-xs font-semibold shrink-0 border ${
                          form.shipping_cost_enabled !== "false"
                            ? "bg-amber-500 text-black font-semibold border-amber-500"
                            : "bg-[var(--bg-sunken)] text-[var(--text-muted)] border-[var(--border)]"
                        }`}
                      >
                        {form.shipping_cost_enabled !== "false" ? "Ongkir Aktif" : "Nonaktif"}
                      </button>
                    </div>
                  </div>
                </div>
              </section>

              {/* Saklar Fitur & Modul Sistem (On/Off) */}
              <section className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
                <div className="border-b border-[var(--border)] pb-3">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <Power className="w-4 h-4 text-amber-500" />
                    Kontrol Modul Operasional (Aktif / Nonaktif)
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Nyalakan atau matikan sistem presensi, validasi lokasi GPS, pengiriman, dan penggajian sesuai kebutuhan toko Anda.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                  {/* Toggle 1: Sistem Presensi */}
                  <div
                    onClick={() => toggleSetting("attendance_enabled")}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      form.attendance_enabled !== "false"
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] opacity-75"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Clock className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Sistem Presensi Kehadiran
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {form.attendance_enabled !== "false"
                          ? "Aktif — Karyawan dapat melakukan absen masuk & pulang setiap hari."
                          : "Nonaktif — Menu Presensi disembunyikan & potongan alfa dinonaktifkan."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.attendance_enabled !== "false"}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                        form.attendance_enabled !== "false"
                          ? "bg-amber-500"
                          : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          form.attendance_enabled !== "false"
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Toggle 2: Kunci Radius GPS Presensi */}
                  <div
                    onClick={() => {
                      if (form.attendance_enabled !== "false") {
                        toggleSetting("attendance_gps_enabled");
                      }
                    }}
                    className={`p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      form.attendance_enabled === "false"
                        ? "bg-[var(--bg-sunken)] border-[var(--border)] opacity-40 cursor-not-allowed"
                        : form.attendance_gps_enabled !== "false"
                        ? "bg-amber-500/5 border-amber-500/30 cursor-pointer"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] cursor-pointer"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Wajib Berada di Lokasi Toko saat Absen
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {form.attendance_gps_enabled !== "false"
                          ? "Aktif — Karyawan hanya bisa absen jika berada di dalam radius lokasi toko."
                          : "Bebas Lokasi — Karyawan/sopir bisa absen dari mana saja (tanpa batas jarak)."}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={form.attendance_enabled === "false"}
                      role="switch"
                      aria-checked={form.attendance_gps_enabled !== "false"}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                        form.attendance_gps_enabled !== "false" &&
                        form.attendance_enabled !== "false"
                          ? "bg-amber-500"
                          : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          form.attendance_gps_enabled !== "false" &&
                          form.attendance_enabled !== "false"
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Toggle 3: Sistem Jadwal Pengiriman */}
                  <div
                    onClick={() => toggleSetting("delivery_schedule_enabled")}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      form.delivery_schedule_enabled !== "false"
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] opacity-75"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Truck className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Sistem Pengiriman & Surat Jalan
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {form.delivery_schedule_enabled !== "false"
                          ? "Aktif — Modul penjadwalan kurir, bukti foto, dan surat jalan digunakan."
                          : "Nonaktif — Menu Pengiriman disembunyikan dari operasional."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.delivery_schedule_enabled !== "false"}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                        form.delivery_schedule_enabled !== "false"
                          ? "bg-amber-500"
                          : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          form.delivery_schedule_enabled !== "false"
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>

                  {/* Toggle 4: Sistem Penggajian */}
                  <div
                    onClick={() => toggleSetting("payroll_enabled")}
                    className={`cursor-pointer p-4 rounded-xl border transition-all flex items-start justify-between gap-3 ${
                      form.payroll_enabled !== "false"
                        ? "bg-amber-500/5 border-amber-500/30"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] opacity-75"
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-amber-500 shrink-0" />
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          Sistem Penggajian & Slip Gaji
                        </span>
                      </div>
                      <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                        {form.payroll_enabled !== "false"
                          ? "Aktif — Modul rekap gaji bulanan & perhitungan potongan karyawan aktif."
                          : "Nonaktif — Menu Penggajian disembunyikan dari sidebar."}
                      </p>
                    </div>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={form.payroll_enabled !== "false"}
                      className={`w-11 h-6 rounded-full transition-colors p-0.5 shrink-0 ${
                        form.payroll_enabled !== "false"
                          ? "bg-amber-500"
                          : "bg-slate-600"
                      }`}
                    >
                      <div
                        className={`w-5 h-5 rounded-full bg-white transition-transform ${
                          form.payroll_enabled !== "false"
                            ? "translate-x-5"
                            : "translate-x-0"
                        }`}
                      />
                    </button>
                  </div>
                </div>
              </section>

              {/* Pengaturan Lokasi Toko & Aturan Presensi yang Manusiawi */}
              <section className="p-6 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-5">
                <div className="border-b border-[var(--border)] pb-3">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-amber-500" />
                    Lokasi Toko & Parameter Kehadiran
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Pilih lokasi toko dengan 1 klik GPS, cari nama alamat, atau tempel link Google Maps — tanpa perlu mengetik angka koordinat.
                  </p>
                </div>

                {form.attendance_enabled === "false" ? (
                  <div className="p-4 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] text-xs text-[var(--text-secondary)]">
                    Sistem Presensi sedang <strong>Dinonaktifkan</strong>. Nyalakan saklar{" "}
                    <strong>Sistem Presensi Kehadiran</strong> di atas jika ingin mengatur lokasi absen dan potongan alfa.
                  </div>
                ) : (
                  <>
                    {form.attendance_gps_enabled === "false" ? (
                      <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-500 font-medium">
                        Mode <strong>Bebas Lokasi</strong> sedang aktif: Karyawan dapat melakukan absen masuk & pulang dari mana saja tanpa dibatasi radius lokasi toko.
                      </div>
                    ) : (
                      <div className="space-y-4">
                        {locNotice && (
                          <div
                            className={`p-3 rounded-lg border text-xs font-semibold ${
                              locNotice.type === "ok"
                                ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500"
                                : "bg-rose-500/10 border-rose-500/20 text-rose-500"
                            }`}
                          >
                            {locNotice.text}
                          </div>
                        )}

                        {/* Pilihan 1: 1-Klik Lokasi Saat Ini */}
                        <div className="p-4 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-0.5">
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              Cara 1: Sedang Berada di Toko Sekarang?
                            </p>
                            <p className="text-xs text-[var(--text-secondary)]">
                              Klik tombol di samping untuk langsung mengunci posisi toko sesuai lokasi perangkat Anda saat ini.
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={handleUseCurrentLocation}
                            disabled={detectingGps}
                            className="px-4 py-2.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2 shrink-0 transition-colors"
                          >
                            {detectingGps ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Navigation className="w-4 h-4" />
                            )}
                            <span>Gunakan Lokasi Saya Saat Ini</span>
                          </button>
                        </div>

                        {/* Pilihan 2 & 3: Cari Nama Alamat atau Paste Link Google Maps */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="p-4 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2.5">
                            <label className="block text-xs font-bold text-[var(--text-primary)]">
                              Cara 2: Cari Nama Jalan / Daerah / Gedung
                            </label>
                            <div className="flex gap-2">
                              <input
                                type="text"
                                placeholder="Contoh: Jl. Sudirman Jakarta / Pasar Baru..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSearchAddress();
                                  }
                                }}
                                className={inputCls}
                              />
                              <button
                                type="button"
                                onClick={handleSearchAddress}
                                disabled={searchingPlace}
                                className="px-3 py-2 rounded-lg text-xs font-bold bg-[var(--bg-surface)] border border-[var(--border)] hover:border-amber-500 text-[var(--text-primary)] flex items-center gap-1.5 shrink-0"
                              >
                                {searchingPlace ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-500" />
                                ) : (
                                  <Search className="w-3.5 h-3.5 text-amber-500" />
                                )}
                                <span>Cari</span>
                              </button>
                            </div>

                            {searchResults.length > 0 && (
                              <div className="mt-2 rounded-lg border border-[var(--border)] bg-[var(--bg-surface)] divide-y divide-[var(--border)] max-h-44 overflow-y-auto">
                                {searchResults.map((item, idx) => (
                                  <button
                                    key={idx}
                                    type="button"
                                    onClick={() => handleSelectSearchResult(item)}
                                    className="w-full text-left px-3 py-2 text-xs text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-amber-500/10 transition-colors flex items-start gap-2"
                                  >
                                    <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                                    <span className="line-clamp-2">{item.display_name}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="p-4 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2.5">
                            <label className="block text-xs font-bold text-[var(--text-primary)]">
                              Cara 3: Tempel Link Google Maps Toko
                            </label>
                            <div className="relative">
                              <input
                                type="text"
                                placeholder="Tempel link Google Maps (https://www.google.com/maps/...)"
                                value={gmapsUrl}
                                onChange={(e) => handleApplyGmapsLink(e.target.value)}
                                className={inputCls}
                              />
                            </div>
                            <p className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                              <Link2 className="w-3 h-3 text-amber-500 shrink-0" />
                              <span>
                                Salin link dari Google Maps, titik lokasi otomatis terbaca.
                              </span>
                            </p>
                          </div>
                        </div>

                        {/* Pratinjau Peta Visual */}
                        <div className="rounded-xl border border-[var(--border)] overflow-hidden bg-[var(--bg-sunken)]">
                          <div className="px-4 py-2.5 bg-[var(--bg-surface)] border-b border-[var(--border)] flex flex-wrap items-center justify-between gap-2">
                            <div className="text-xs">
                              <span className="font-bold text-[var(--text-primary)]">
                                Pratinjau Titik Peta Toko Saat Ini
                              </span>
                              {detectedPlaceName && (
                                <p className="text-xs text-[var(--text-secondary)] truncate max-w-lg">
                                  {detectedPlaceName}
                                </p>
                              )}
                            </div>
                            <a
                              href={`https://www.google.com/maps?q=${form.store_latitude},${form.store_longitude}`}
                              target="_blank"
                              rel="noreferrer"
                              className="text-xs font-semibold text-amber-500 hover:underline flex items-center gap-1"
                            >
                              <span>Lihat di Google Maps</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          </div>
                          <div className="h-52 w-full">
                            <iframe
                              title="Peta Lokasi Toko"
                              width="100%"
                              height="100%"
                              style={{ border: 0 }}
                              loading="lazy"
                              src={`https://www.openstreetmap.org/export/embed.html?bbox=${
                                parseFloat(form.store_longitude || "106.816666") - 0.003
                              }%2C${
                                parseFloat(form.store_latitude || "-6.200000") - 0.003
                              }%2C${
                                parseFloat(form.store_longitude || "106.816666") + 0.003
                              }%2C${
                                parseFloat(form.store_latitude || "-6.200000") + 0.003
                              }&layer=mapnik&marker=${
                                form.store_latitude || "-6.200000"
                              }%2C${form.store_longitude || "106.816666"}`}
                            />
                          </div>
                        </div>

                        {/* Pilihan Cepat Jarak Radius Absen */}
                        <div className="space-y-2 pt-1">
                          <label className={labelCls}>
                            Jarak Maksimal Karyawan Bisa Absen dari Titik Toko (Radius)
                          </label>
                          <div className="flex flex-wrap items-center gap-2">
                            {[
                              { val: "50", label: "50 Meter (Area Ruko)" },
                              { val: "100", label: "100 Meter (Area Gudang)" },
                              { val: "250", label: "250 Meter (Kompleks)" },
                              { val: "500", label: "500 Meter (Area Luas)" },
                            ].map((preset) => (
                              <button
                                key={preset.val}
                                type="button"
                                onClick={() =>
                                  setForm({ ...form, store_radius_meters: preset.val })
                                }
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                                  form.store_radius_meters === preset.val
                                    ? "bg-amber-500 text-black border-amber-500 font-semibold"
                                    : "bg-[var(--bg-sunken)] text-[var(--text-secondary)] border-[var(--border)] hover:border-amber-500/40"
                                }`}
                              >
                                {preset.label}
                              </button>
                            ))}
                            <div className="flex items-center gap-1.5 ml-auto">
                              <input
                                type="number"
                                min="10"
                                value={form.store_radius_meters || "100"}
                                onChange={(e) =>
                                  setForm({ ...form, store_radius_meters: e.target.value })
                                }
                                className="w-24 px-2.5 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                              />
                              <span className="text-xs text-[var(--text-secondary)]">Meter</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Parameter Jam Kerja, Gaji Harian/Bulanan, & Potongan (Sesuai PLAN.md Baris 19) */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-3 border-t border-[var(--border)]">
                      <div>
                        <label className={labelCls}>Jam Masuk Karyawan (Opsional)</label>
                        <input
                          type="time"
                          value={form.work_start_time || "08:00"}
                          onChange={(e) =>
                            setForm({ ...form, work_start_time: e.target.value })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Jam Keluar Karyawan (Opsional)</label>
                        <input
                          type="time"
                          value={form.work_end_time || "17:00"}
                          onChange={(e) =>
                            setForm({ ...form, work_end_time: e.target.value })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Nominal Potongan Gaji / Alfa (Rp)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.absence_deduction_amount || "50000"}
                          onChange={(e) =>
                            setForm({ ...form, absence_deduction_amount: e.target.value })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Gaji per Hari Karyawan Default (Rp — Opsional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.default_daily_salary || "150000"}
                          onChange={(e) =>
                            setForm({ ...form, default_daily_salary: e.target.value })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>
                          Gaji per Bulan Karyawan Default (Rp — Opsional)
                        </label>
                        <input
                          type="number"
                          min="0"
                          value={form.default_monthly_salary || "3500000"}
                          onChange={(e) =>
                            setForm({ ...form, default_monthly_salary: e.target.value })
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                    </div>
                  </>
                )}
              </section>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 flex items-center gap-2 transition-colors"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Save className="w-4 h-4" />
                  )}
                  Simpan Semua Pengaturan
                </button>
              </div>
            </form>
          )}
        </main>
      </div>
    </div>
  );
}
