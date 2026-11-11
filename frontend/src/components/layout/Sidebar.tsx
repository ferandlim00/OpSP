"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
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
    ClipboardList,
} from "lucide-react";
import { getUser, getToken, AuthUser } from "@/lib/auth";
import api from "@/lib/api";

interface SidebarProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const [mounted, setMounted] = useState(false);
    const [user, setUser] = useState<AuthUser | null>(null);

    const [moduleFlags, setModuleFlags] = useState({
        attendance_enabled: true,
        payroll_enabled: true,
        delivery_schedule_enabled: true,
    });

    useEffect(() => {
        setMounted(true);
        const token = getToken();
        const currentUser = getUser();
        if (!token || !currentUser) {
            if (pathname !== "/login") {
                router.replace("/login");
            }
            return;
        }
        setUser(currentUser);

        // Proteksi Route RBAC di sisi klien (mencegah akses URL manual oleh Role yang tidak berhak)
        const currentRole = (currentUser.role?.name || "EMPLOYEE").toUpperCase();
        const ownerOnlyPaths = ["/payroll", "/employees", "/users", "/settings"];
        const staffOnlyPaths = ["/transactions", "/suppliers", "/customers", "/inventory/purchase-orders"];

        if (currentRole !== "OWNER" && ownerOnlyPaths.some((p) => pathname.startsWith(p))) {
            router.replace("/dashboard");
            return;
        }
        if (currentRole === "EMPLOYEE" && staffOnlyPaths.some((p) => pathname.startsWith(p))) {
            router.replace("/dashboard");
        }
    }, [pathname, router]);

    // Least-privilege default: gunakan EMPLOYEE sampai profil user terkonfirmasi
    const role = (mounted && user?.role?.name ? user.role.name : "EMPLOYEE").toUpperCase();

    const loadModuleFlags = useCallback(async () => {
        try {
            const res = await api.get("/settings");
            if (res.data?.success && res.data?.data) {
                const d = res.data.data;
                setModuleFlags({
                    attendance_enabled: d.attendance_enabled !== "false",
                    payroll_enabled: d.payroll_enabled !== "false",
                    delivery_schedule_enabled: d.delivery_schedule_enabled !== "false",
                });
            }
        } catch {
            // Gunakan default true jika gagal memuat
        }
    }, []);

    useEffect(() => {
        loadModuleFlags();
        const handler = () => loadModuleFlags();
        window.addEventListener("settings-updated", handler);
        return () => window.removeEventListener("settings-updated", handler);
    }, [loadModuleFlags]);

    const menuGroups = [
        {
            group: "Penjualan",
            items: [
                {
                    name: "Dashboard",
                    href: "/dashboard",
                    icon: LayoutDashboard,
                    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
                    enabled: true,
                },
                {
                    name: "Kasir & Transaksi",
                    href: "/transactions",
                    icon: ShoppingCart,
                    roles: ["OWNER", "ADMIN"],
                    enabled: true,
                },
            ],
        },
        {
            group: "Produk & Gudang",
            items: [
                {
                    name: "Katalog Produk",
                    href: "/products",
                    icon: Package,
                    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
                    enabled: true,
                },
                {
                    name: "Stok & Inventori",
                    href: "/inventory",
                    icon: Boxes,
                    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
                    enabled: true,
                },
                {
                    name: "Supplier",
                    href: "/suppliers",
                    icon: Building2,
                    roles: ["OWNER", "ADMIN"],
                    enabled: true,
                },
                {
                    name: "Purchase Order (PO)",
                    href: "/inventory/purchase-orders",
                    icon: ClipboardList,
                    roles: ["OWNER", "ADMIN"],
                    enabled: true,
                },
                {
                    name: "Pengiriman",
                    href: "/deliveries",
                    icon: Truck,
                    roles: ["OWNER", "ADMIN", "EMPLOYEE"],
                    enabled: moduleFlags.delivery_schedule_enabled,
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
                    enabled: true,
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
                    enabled: moduleFlags.attendance_enabled,
                },
                {
                    name: "Penggajian",
                    href: "/payroll",
                    icon: DollarSign,
                    roles: ["OWNER"],
                    enabled: moduleFlags.payroll_enabled,
                },
                {
                    name: "Manajemen Karyawan",
                    href: "/employees",
                    icon: UserCog,
                    roles: ["OWNER"],
                    enabled: true,
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
                    enabled: true,
                },
            ],
        },
    ];

    const allMenuHrefs = menuGroups.flatMap((grp) => grp.items.map((it) => it.href));

    const isActive = (href: string) => {
        if (pathname === href) return true;
        if (href === "/dashboard") return false;
        const isSubRoute = pathname.startsWith(`${href}/`);
        if (!isSubRoute) return false;
        // Hindari menu induk ikut aktif jika ada sub-menu yang lebih spesifik cocok dengan pathname
        return !allMenuHrefs.some(
            (other) =>
                other !== href &&
                other.startsWith(`${href}/`) &&
                (pathname === other || pathname.startsWith(`${other}/`))
        );
    };

    return (
        <>
            {/* Mobile Backdrop */}
            <div
                onClick={onClose}
                aria-hidden="true"
                className={`fixed inset-0 z-40 bg-[var(--bg-sunken)]/80 backdrop-blur-xs lg:hidden transition-opacity duration-200 ${isOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
                    }`}
            />

            {/* Sidebar Container */}
            <aside
                className={`fixed top-0 left-0 z-50 h-full w-64 bg-[var(--bg-base)] border-r border-[var(--border)] flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0 ${isOpen ? "translate-x-0" : "-translate-x-full"
                    }`}
            >
                {/* Brand Header — Bersih tanpa logo kotak P */}
                <div className="h-16 flex items-center justify-between px-6 border-b border-[var(--border)] bg-[var(--bg-surface)]">
                    <Link href="/dashboard" className="flex flex-col">
                        <span className="text-base font-bold tracking-tight text-[var(--text-primary)]">
                            Properti<span className="text-amber-500">ERP</span>
                        </span>
                        <span className="text-xs text-[var(--text-secondary)] font-medium">
                            Sistem Operasional
                        </span>
                    </Link>
                    <button
                        onClick={onClose}
                        aria-label="Tutup menu sidebar"
                        className="p-2 rounded-lg text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] transition-colors lg:hidden"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Menu Navigation */}
                <nav className="flex-1 overflow-y-auto px-4 py-4 space-y-6" aria-label="Menu Utama">
                    {menuGroups.map((grp, gIdx) => {
                        const visibleItems = grp.items.filter(
                            (it) => it.roles.includes(role) && it.enabled !== false
                        );
                        if (visibleItems.length === 0) return null;

                        return (
                            <div key={gIdx} className="space-y-1.5">
                                {/* Header grup minimal text-xs (12px) dengan kontras tinggi */}
                                <p className="px-3 text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)]">
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
                                            className={`group flex items-center gap-3 px-3 py-2.5 lg:py-2 rounded-lg text-xs font-semibold transition-colors ${active
                                                ? "bg-amber-500 text-black font-semibold hover:bg-amber-400"
                                                : "text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)]"
                                                }`}
                                        >
                                            <Icon
                                                className={`w-4 h-4 shrink-0 transition-colors ${active ? "text-black" : "text-[var(--text-secondary)] group-hover:text-[var(--text-primary)]"
                                                    }`}
                                                aria-hidden="true"
                                            />
                                            <span>{item.name}</span>
                                        </Link>
                                    );
                                })}
                            </div>
                        );
                    })}
                </nav>

                {/* Footer User Info */}
                <div className="p-4 border-t border-[var(--border)] bg-[var(--bg-surface)] shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="overflow-hidden min-w-0">
                            <p className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                {mounted ? (user?.name || "Owner") : "Owner"}
                            </p>
                            <p className="text-xs text-[var(--text-secondary)] font-medium uppercase truncate">
                                {role}
                            </p>
                        </div>
                    </div>
                </div>
            </aside>
        </>
    );
}