"use client";

import React, { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Package,
  Truck,
  AlertTriangle,
  ArrowRight,
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

// Data chart omset bulanan (akan diganti data real dari API nanti)
const chartData = [
  { bulan: "Apr", omset: 0 },
  { bulan: "Mei", omset: 0 },
  { bulan: "Jun", omset: 0 },
  { bulan: "Jul", omset: 0 },
  { bulan: "Agu", omset: 0 },
  { bulan: "Sep", omset: 0 },
];

const kpiCards = [
  {
    label: "Total Penjualan",
    value: "Rp 0",
    sub: "Belum ada transaksi",
    icon: ShoppingCart,
    color: "text-amber-400",
    bg: "bg-amber-500/10",
    border: "border-amber-500/20",
  },
  {
    label: "Pelanggan",
    value: "0",
    sub: "Total pelanggan terdaftar",
    icon: Users,
    color: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/20",
  },
  {
    label: "Produk Aktif",
    value: "0",
    sub: "Produk dalam katalog",
    icon: Package,
    color: "text-emerald-400",
    bg: "bg-emerald-500/10",
    border: "border-emerald-500/20",
  },
  {
    label: "Stok Menipis",
    value: "0",
    sub: "Produk perlu restock",
    icon: AlertTriangle,
    color: "text-rose-400",
    bg: "bg-rose-500/10",
    border: "border-rose-500/20",
  },
];

const quickLinks = [
  { label: "Tambah Transaksi", href: "/transactions", icon: ShoppingCart, color: "text-amber-400" },
  { label: "Kelola Produk", href: "/products", icon: Package, color: "text-sky-400" },
  { label: "Data Pelanggan", href: "/customers", icon: Users, color: "text-emerald-400" },
  { label: "Cek Pengiriman", href: "/deliveries", icon: Truck, color: "text-purple-400" },
];

export default function DashboardPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = getUser();

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) router.push("/login");
  }, [router]);

  if (!mounted) return null;

  const now = new Date();
  const greeting =
    now.getHours() < 12 ? "Selamat Pagi" : now.getHours() < 17 ? "Selamat Siang" : "Selamat Malam";

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">

          {/* Welcome Banner */}
          <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
                {greeting},{" "}
                <span className="text-amber-500">{user?.name || "Owner"}</span> 👋
              </h1>
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            </div>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">
              Berikut ringkasan operasional toko World Furniture hari ini.
            </p>
          </div>

          {/* KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {kpiCards.map((kpi) => {
              const Icon = kpi.icon;
              return (
                <div
                  key={kpi.label}
                  className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                      {kpi.label}
                    </span>
                    <div className={`p-1.5 rounded-lg ${kpi.bg} border ${kpi.border}`}>
                      <Icon className={`w-4 h-4 ${kpi.color}`} />
                    </div>
                  </div>
                  <div className="text-xl font-bold text-[var(--text-primary)] font-mono tabular-nums">
                    {kpi.value}
                  </div>
                  <p className="text-[11px] text-[var(--text-secondary)]">{kpi.sub}</p>
                </div>
              );
            })}
          </div>

          {/* Chart + Quick Links */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Omset Chart */}
            <div className="lg:col-span-2 p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-500" />
                    Grafik Omset 6 Bulan Terakhir
                  </h3>
                  <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                    Data akan terisi otomatis setelah transaksi dicatat.
                  </p>
                </div>
              </div>

              <div className="h-52 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barSize={24}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis
                      dataKey="bulan"
                      stroke="#64748b"
                      fontSize={11}
                      tickLine={false}
                      axisLine={{ stroke: "#1e293b" }}
                    />
                    <YAxis
                      stroke="#64748b"
                      fontSize={10}
                      tickLine={false}
                      axisLine={false}
                      tickFormatter={(v) => `${v / 1000000}jt`}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "#0a0d14",
                        borderColor: "#334155",
                        borderRadius: "8px",
                        color: "#fff",
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
            </div>

            {/* Quick Links */}
            <div className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">Akses Cepat</h3>
              <p className="text-xs text-[var(--text-secondary)]">Navigasi ke fitur yang sering digunakan.</p>

              <div className="space-y-2 pt-1">
                {quickLinks.map((link) => {
                  const Icon = link.icon;
                  return (
                    <button
                      key={link.label}
                      onClick={() => router.push(link.href)}
                      className="w-full flex items-center justify-between p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] hover:border-[var(--border-soft)] hover:bg-[var(--bg-surface)] transition-all group"
                    >
                      <div className="flex items-center gap-3">
                        <Icon className={`w-4 h-4 ${link.color}`} />
                        <span className="text-xs font-semibold text-[var(--text-secondary)] group-hover:text-[var(--text-primary)] transition-colors">
                          {link.label}
                        </span>
                      </div>
                      <ArrowRight className="w-3.5 h-3.5 text-[var(--text-muted)] group-hover:text-[var(--text-primary)] transition-colors" />
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Info Banner — Sistem Baru */}
          <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
              <Package className="w-4 h-4 text-amber-500" />
            </div>
            <div>
              <p className="text-xs font-semibold text-amber-500">
                Sistem Baru — Mulai Dari Sini
              </p>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Tambahkan kategori produk dan data produk furniture terlebih dahulu untuk memulai pencatatan penjualan.
                Setelah produk tersedia, fitur Kasir & Transaksi siap digunakan.
              </p>
            </div>
          </div>

        </main>
      </div>
    </div>
  );
}