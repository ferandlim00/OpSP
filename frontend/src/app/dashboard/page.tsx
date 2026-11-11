"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { formatRupiah, formatNumber } from "@/utils/formatters";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Truck,
  ArrowRight,
  Loader2,
  Clock,
  CheckCircle2,
  MapPin,
  CalendarCheck,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

interface MonthlyChartPoint {
  bulan: string;
  omset: number;
}

interface ActiveDeliveryTask {
  ID: number;
  delivery_no?: string;
  address: string;
  status: string;
  transaction?: {
    invoice_no?: string;
    customer?: {
      name?: string;
      phone?: string;
    };
  };
}

interface DashboardSummary {
  total_sales: number;
  total_sales_today?: number;
  total_sales_month?: number;
  total_orders: number;
  total_transactions_today?: number;
  total_customers: number;
  active_products: number;
  total_stock?: number;
  active_deliveries_count?: number;
  low_stock_count: number;
  low_stock_products?: number;
  today_attendances_count?: number;
  today_attendances_list?: {
    ID: number;
    type: "CHECK_IN" | "CHECK_OUT";
    timestamp: string;
    employee?: {
      name: string;
      user?: { role?: { name: string } };
    };
  }[];
  monthly_chart: MonthlyChartPoint[];
  monthly_sales?: MonthlyChartPoint[];
  my_active_deliveries?: number;
  my_completed_deliveries?: number;
  today_attendance_status?: string;
  monthly_attendance_days?: number;
  active_deliveries_list?: ActiveDeliveryTask[];
}

const allQuickLinks = [
  {
    label: "Kasir & Transaksi Baru",
    href: "/transactions",
    icon: ShoppingCart,
    roles: ["OWNER", "ADMIN"],
    settingKey: null,
  },
  {
    label: "Katalog & Stok Produk",
    href: "/products",
    icon: Package,
    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
    settingKey: null,
  },
  {
    label: "Daftar Data Pelanggan",
    href: "/customers",
    icon: Users,
    roles: ["OWNER", "ADMIN"],
    settingKey: null,
  },
  {
    label: "Tugas & Status Pengiriman",
    href: "/deliveries",
    icon: Truck,
    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
    settingKey: "delivery_schedule_enabled",
  },
  {
    label: "Presensi Kehadiran Hari Ini",
    href: "/attendance",
    icon: Clock,
    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
    settingKey: "attendance_enabled",
  },
];

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("OWNER");
  const [settingsMap, setSettingsMap] = useState<Record<string, string>>({
    attendance_enabled: "true",
    delivery_schedule_enabled: "true",
    payroll_enabled: "true",
  });
  const [summary, setSummary] = useState<DashboardSummary>({
    total_sales: 0,
    total_sales_today: 0,
    total_sales_month: 0,
    total_orders: 0,
    total_transactions_today: 0,
    total_customers: 0,
    active_products: 0,
    low_stock_count: 0,
    low_stock_products: 0,
    monthly_chart: [],
    monthly_sales: [],
    my_active_deliveries: 0,
    my_completed_deliveries: 0,
    today_attendance_status: "BELUM_ABSEN",
    monthly_attendance_days: 0,
    active_deliveries_list: [],
  });

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const [sumRes, setRes] = await Promise.allSettled([
        api.get("/dashboard/summary"),
        api.get("/settings"),
      ]);
      if (sumRes.status === "fulfilled" && sumRes.value.data?.success && sumRes.value.data?.data) {
        setSummary(sumRes.value.data.data);
      }
      if (setRes.status === "fulfilled" && setRes.value.data?.success && setRes.value.data?.data) {
        setSettingsMap((prev) => ({ ...prev, ...setRes.value.data.data }));
      }
    } catch {
      // Gunakan fallback 0 jika belum ada data
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
    const u = getUser();
    setRole(u?.role?.name || "OWNER");
    fetchSummary();
  }, [router, fetchSummary]);

  if (!mounted) return null;

  const isEmployee = role === "EMPLOYEE";
  const attendanceEnabled = settingsMap.attendance_enabled !== "false";

  const visibleQuickLinks = allQuickLinks.filter((item) => {
    if (!item.roles.includes(role)) return false;
    if (item.settingKey && settingsMap[item.settingKey] === "false") return false;
    return true;
  });

  const attendanceLabel = !attendanceEnabled
    ? "Nonaktif"
    : summary.today_attendance_status === "SUDAH_PULANG"
      ? "Selesai (Pulang)"
      : summary.today_attendance_status === "SUDAH_MASUK"
        ? "Sudah Masuk"
        : "Belum Absen";

  const kpiCards = isEmployee
    ? [
      {
        label: "Tugas Pengiriman Aktif",
        value: formatNumber(summary.my_active_deliveries || 0),
        sub: "Surat jalan perlu diproses",
        icon: Truck,
        isWarning: (summary.my_active_deliveries || 0) > 0,
        iconColor: "text-amber-500",
      },
      {
        label: "Pengiriman Selesai",
        value: formatNumber(summary.my_completed_deliveries || 0),
        sub: "Total surat jalan tuntas",
        icon: CheckCircle2,
        isWarning: false,
        iconColor: "text-amber-500",
      },
      {
        label: "Status Presensi Hari Ini",
        value: attendanceLabel,
        sub: attendanceEnabled
          ? "Status kehadiran harian Anda"
          : "Presensi dinonaktifkan Owner",
        icon: Clock,
        isWarning:
          attendanceEnabled && summary.today_attendance_status === "BELUM_ABSEN",
        iconColor:
          attendanceEnabled && summary.today_attendance_status === "BELUM_ABSEN"
            ? "text-rose-500"
            : "text-amber-500",
      },
      {
        label: "Kehadiran Bulan Ini",
        value: `${formatNumber(summary.monthly_attendance_days || 0)} Hari`,
        sub: "Total absen masuk bulan berjalan",
        icon: CalendarCheck,
        isWarning: false,
        iconColor: "text-amber-500",
      },
    ]
    : [
      {
        label: "Jumlah Pelanggan",
        value: formatNumber(summary.total_customers),
        sub: "Total pelanggan terdaftar",
        icon: Users,
        isWarning: false,
        iconColor: "text-amber-500",
      },
      {
        label: "Jumlah Stok Secara Total",
        value: `${formatNumber(summary.total_stock || 0)} Unit`,
        sub: `${formatNumber(summary.active_products)} produk aktif (${formatNumber(
          summary.low_stock_count
        )} menipis)`,
        icon: Package,
        isWarning: summary.low_stock_count > 0,
        iconColor: summary.low_stock_count > 0 ? "text-rose-500" : "text-amber-500",
      },
      {
        label: "Jumlah Pengiriman Aktif",
        value: formatNumber(summary.active_deliveries_count || 0),
        sub: "Surat jalan sedang berjalan",
        icon: Truck,
        isWarning: false,
        iconColor: "text-amber-500",
      },
      {
        label: "Transaksi Hari Ini",
        value: formatNumber(summary.total_transactions_today || 0),
        sub: `Omset hari ini: ${formatRupiah(summary.total_sales_today || 0)}`,
        icon: ShoppingCart,
        isWarning: false,
        iconColor: "text-amber-500",
      },
    ];

  const chartData = summary.monthly_sales?.length
    ? summary.monthly_sales
    : summary.monthly_chart || [];

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1 pb-2 border-b border-[var(--border)]">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)]">
                {isEmployee ? "Dashboard Tugas Karyawan" : "Dashboard Operasional"}
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                {isEmployee
                  ? "Ringkasan tugas pengiriman barang dan status kehadiran Anda hari ini."
                  : "Ringkasan performa penjualan, logistik, dan inventori toko."}
              </p>
            </div>
            {loading && (
              <Loader2 className="w-4 h-4 animate-spin text-amber-500" />
            )}
          </header>

          <section aria-labelledby="kpi-heading">
            <h2 id="kpi-heading" className="sr-only">
              Ringkasan Metrik Utama
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {kpiCards.map((kpi) => {
                const Icon = kpi.icon;
                return (
                  <div
                    key={kpi.label}
                    className={`p-4 rounded-xl border space-y-2 transition-colors ${kpi.isWarning
                      ? "bg-rose-500/5 border-rose-500/20"
                      : "bg-[var(--bg-surface)] border-[var(--border)]"
                      }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-[var(--text-secondary)] uppercase tracking-wider">
                        {kpi.label}
                      </span>
                      <div
                        className={`p-1.5 rounded-lg border ${kpi.isWarning
                          ? "bg-rose-500/10 border-rose-500/20"
                          : "bg-[var(--bg-sunken)] border-[var(--border)]"
                          }`}
                      >
                        <Icon className={`w-4 h-4 ${kpi.iconColor}`} aria-hidden="true" />
                      </div>
                    </div>

                    <div className="text-2xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                      {kpi.value}
                    </div>

                    <p
                      className={`text-xs font-medium ${kpi.isWarning ? "text-rose-500" : "text-[var(--text-muted)]"
                        }`}
                    >
                      {kpi.sub}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {isEmployee ? (
              <section
                aria-labelledby="tasks-heading"
                className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2
                      id="tasks-heading"
                      className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"
                    >
                      <Truck className="w-4 h-4 text-amber-500" aria-hidden="true" />
                      Daftar Tugas Pengiriman Aktif
                    </h2>
                    <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                      Surat jalan yang siap dimuat atau sedang dalam perjalanan.
                    </p>
                  </div>
                  {settingsMap.delivery_schedule_enabled !== "false" && (
                    <button
                      onClick={() => router.push("/deliveries")}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                    >
                      Buka Semua Pengiriman
                    </button>
                  )}
                </div>

                {!summary.active_deliveries_list || summary.active_deliveries_list.length === 0 ? (
                  <div className="p-8 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] text-center space-y-1">
                    <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto" />
                    <p className="text-xs font-semibold text-[var(--text-primary)]">
                      Tidak ada antrean pengiriman yang tertunda saat ini.
                    </p>
                    <p className="text-xs text-[var(--text-muted)]">
                      Tugas pengiriman baru akan otomatis muncul di sini saat dijadwalkan Admin.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {summary.active_deliveries_list.map((deliv) => (
                      <div
                        key={deliv.ID}
                        className="p-3.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-mono font-bold text-amber-500">
                              {deliv.delivery_no || `SJ-#${deliv.ID}`}
                            </span>
                            <span className="px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              {deliv.status === "IN_DELIVERY"
                                ? "Sedang Diantar"
                                : deliv.status === "PREPARING"
                                  ? "Siap Muat"
                                  : "Terjadwal"}
                            </span>
                          </div>
                          <p className="text-xs font-semibold text-[var(--text-primary)]">
                            {deliv.transaction?.customer?.name || "Pelanggan Toko"}{" "}
                            {deliv.transaction?.invoice_no
                              ? `(${deliv.transaction.invoice_no})`
                              : ""}
                          </p>
                          <p className="text-xs text-[var(--text-secondary)] flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                            <span className="truncate max-w-md">{deliv.address || "-"}</span>
                          </p>
                        </div>

                        <button
                          onClick={() => router.push("/deliveries")}
                          className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border)] hover:border-amber-500/40 text-[var(--text-primary)] flex items-center gap-1.5 self-start sm:self-center shrink-0"
                        >
                          <span>Proses</span>
                          <ArrowRight className="w-3.5 h-3.5 text-amber-500" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ) : (
              <section
                aria-labelledby="chart-heading"
                className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4"
              >
                <div>
                  <h2
                    id="chart-heading"
                    className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2"
                  >
                    <TrendingUp className="w-4 h-4 text-amber-500" aria-hidden="true" />
                    Grafik Transaksi Bulanan
                  </h2>
                  <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                    Data real-time yang diperbarui otomatis berdasarkan transaksi kasir.
                  </p>
                </div>

                <div className="h-56 w-full pt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} barSize={28}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                      <XAxis
                        dataKey="bulan"
                        stroke="var(--text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={{ stroke: "var(--border)" }}
                      />
                      <YAxis
                        stroke="var(--text-muted)"
                        fontSize={12}
                        tickLine={false}
                        axisLine={false}
                        tickFormatter={(v) => `${v / 1000000}jt`}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "var(--bg-surface)",
                          borderColor: "var(--border)",
                          borderRadius: "8px",
                          color: "var(--text-primary)",
                          fontSize: "12px",
                        }}
                        formatter={(value) => [
                          `Rp ${Number(value).toLocaleString("id-ID")}`,
                          "Omset",
                        ]}
                        labelStyle={{ color: "#f59e0b", fontWeight: "bold" }}
                      />
                      <Bar dataKey="omset" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            <section
              aria-labelledby="quicklinks-heading"
              className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4"
            >
              <div>
                <h2 id="quicklinks-heading" className="text-sm font-bold text-[var(--text-primary)]">
                  Akses Cepat {isEmployee ? "Karyawan" : ""}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5">
                  {isEmployee
                    ? "Pintasan menuju menu kerja yang sesuai dengan hak akses Anda."
                    : "Pintasan menuju modul operasional utama."}
                </p>
              </div>

              <div className="space-y-2 pt-1">
                {visibleQuickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.label}
                      onClick={() => router.push(link.href)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] hover:border-amber-500/40 hover:bg-[var(--bg-surface)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon
                          className="w-4 h-4 text-[var(--text-secondary)] group-hover:text-amber-500 transition-colors"
                          aria-hidden="true"
                        />
                        <span className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {link.label}
                        </span>
                      </div>
                      <ArrowRight
                        className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-amber-500 group-hover:translate-x-0.5 transition-all"
                        aria-hidden="true"
                      />
                    </button>
                  );
                })}
                {visibleQuickLinks.length === 0 && (
                  <p className="text-xs text-[var(--text-muted)] py-4 text-center">
                    Tidak ada modul pintasan yang aktif saat ini.
                  </p>
                )}
              </div>

              {/* Ringkasan Presensi Kehadiran Hari Ini (Sesuai PLAN.md Baris 11) */}
              {!isEmployee && attendanceEnabled && (
                <div className="pt-4 border-t border-[var(--border)] space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-[var(--text-primary)] flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-amber-500" />
                      <span>Presensi Kehadiran Hari Ini</span>
                    </h3>
                    <span className="text-xs font-mono font-semibold text-[var(--text-secondary)] px-2 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)]">
                      {summary.today_attendances_count || 0} Hadir
                    </span>
                  </div>
                  {!summary.today_attendances_list ||
                  summary.today_attendances_list.length === 0 ? (
                    <p className="text-xs text-[var(--text-muted)]">
                      Belum ada karyawan yang tercatat absen hari ini.
                    </p>
                  ) : (
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {summary.today_attendances_list.slice(0, 5).map((att) => (
                        <div
                          key={att.ID}
                          className="px-2.5 py-1.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] flex items-center justify-between text-xs"
                        >
                          <span className="font-semibold text-[var(--text-primary)] truncate">
                            {att.employee?.name || "Karyawan"}
                          </span>
                          <span className="text-xs font-mono font-medium text-amber-500">
                            {att.type === "CHECK_IN" ? "Masuk" : "Pulang"}{" "}
                            {new Date(att.timestamp).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
