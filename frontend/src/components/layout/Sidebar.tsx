"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  ShoppingCart,
  Boxes,
  Truck,
  Users,
  UserCog,
  Clock,
  DollarSign,
  X,
  Package,
  Building2,
  Settings,
} from "lucide-react";
import { getUser } from "@/lib/auth";

interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
  const pathname = usePathname();
  const user = getUser();
  const role = user?.role?.name || "OWNER";

  const menuGroups = [
    {
      group: "Penjualan",
      items: [
        {
          name: "Dashboard",
          href: "/dashboard",
          icon: LayoutDashboard,
          roles: ["OWNER", "ADMIN", "EMPLOYEE"],
        },
        {
          name: "Kasir & Transaksi",
          href: "/transactions",
          icon: ShoppingCart,
          roles: ["OWNER", "ADMIN"],
        },
      ],
    },
    {
      group: "Produk & Gudang",
      items: [
        {
          name: "Produk Furniture",
          href: "/products",
          icon: Package,
          roles: ["OWNER", "ADMIN"],
        },
        {
          name: "Stok & Inventori",
          href: "/inventory",
          icon: Boxes,
          roles: ["OWNER", "ADMIN"],
        },
        {
          name: "Supplier",
          href: "/suppliers",
          icon: Building2,
          roles: ["OWNER", "ADMIN"],
        },
        {
          name: "Pengiriman",
          href: "/deliveries",
          icon: Truck,
          roles: ["OWNER", "ADMIN", "EMPLOYEE"],
        },
      ],
    },
    {
      group: "Pelanggan",
      items: [
        {
          name: "Data Pelanggan",
          href: "/customers",
          icon: Users,
          roles: ["OWNER", "ADMIN"],
        },
      ],
    },
    {
      group: "SDM & Keuangan",
      items: [
        {
          name: "Presensi",
          href: "/attendance",
          icon: Clock,
          roles: ["OWNER", "ADMIN", "EMPLOYEE"],
        },
        {
          name: "Penggajian",
          href: "/payroll",
          icon: DollarSign,
          roles: ["OWNER"],
        },
        {
          name: "Manajemen Karyawan",
          href: "/employees",
          icon: UserCog,
          roles: ["OWNER"],
        },
      ],
    },
    {
      group: "Sistem",
      items: [
        {
          name: "Pengaturan",
          href: "/settings",
          icon: Settings,
          roles: ["OWNER"],
        },
      ],
    },
  ];

  const isActive = (href: string) =>
    pathname === href ||
    (href !== "/dashboard" && pathname.startsWith(href));

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          onClick={onClose}
          className="fixed inset-0 z-40 bg-[var(--bg-sunken)]/80 backdrop-blur-xs lg:hidden"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 left-0 z-50 h-full w-64 bg-[var(--bg-base)] border-r border-[var(--border)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          isOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Brand Header */}
        <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-surface)]">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center font-extrabold text-slate-950 text-base shadow-xs shadow-amber-500/20">
              W
            </div>
            <div>
              <h1 className="text-sm font-bold text-[var(--text-primary)] tracking-tight">
                World Furniture
              </h1>
              <span className="text-[11px] text-[var(--text-secondary)] font-medium">
                Sistem Manajemen Toko
              </span>
            </div>
          </Link>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)] lg:hidden"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Menu Navigation */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
          {menuGroups.map((grp, gIdx) => {
            const visibleItems = grp.items.filter((it) =>
              it.roles.includes(role)
            );
            if (visibleItems.length === 0) return null;

            return (
              <div key={gIdx} className="space-y-1.5">
                <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[var(--text-muted)]">
                  {grp.group}
                </p>
                {visibleItems.map((item) => {
                  const active = isActive(item.href);
                  const Icon = item.icon;

                  return (
                    <Link
                      key={item.name}
                      href={item.href}
                      onClick={onClose}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                        active
                          ? "bg-amber-500 text-slate-950 shadow-xs shadow-amber-500/20 font-bold"
                          : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]"
                      }`}
                    >
                      <Icon
                        className={`w-4 h-4 ${
                          active ? "text-slate-950" : "text-[var(--text-secondary)]"
                        }`}
                      />
                      <span>{item.name}</span>
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Footer Role Card */}
        <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-amber-500/20 text-amber-500 border border-amber-500/30 flex items-center justify-center font-bold text-xs">
              {user?.name ? user.name.charAt(0).toUpperCase() : "O"}
            </div>
            <div className="overflow-hidden min-w-0">
              <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                {user?.name || "Owner"}
              </p>
              <p className="text-[10px] text-amber-500 font-mono uppercase truncate">
                {role}
              </p>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}