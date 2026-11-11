"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { formatRupiah } from "@/utils/formatters";
import {
  ClipboardList,
  Plus,
  CheckCircle2,
  XCircle,
  Loader2,
  Building2,
  PackageCheck,
  Trash2,
  X,
  Search,
} from "lucide-react";

interface Supplier {
  ID: number;
  name: string;
  phone?: string;
}

interface Product {
  ID: number;
  sku: string;
  name: string;
  stock: number;
  price_buy?: number;
  price_sell: number;
}

interface POItem {
  ID: number;
  product_id: number;
  qty: number;
  received_qty: number;
  price_modal?: number;
  product?: Product;
}

interface PurchaseOrder {
  ID: number;
  po_number: string;
  supplier_id: number;
  date: string;
  status: "PENDING" | "ORDERED" | "RECEIVED" | "CANCELLED";
  received_at?: string;
  total: number;
  note: string;
  supplier?: Supplier;
  items?: POItem[];
}

export default function PurchaseOrdersPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [pos, setPos] = useState<PurchaseOrder[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");

  // Modal Buat PO Baru
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [supplierId, setSupplierId] = useState("");
  const [poDate, setPoDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [poNote, setPoNote] = useState("");
  const [poItems, setPoItems] = useState<
    { product_id: number; qty: number; price_modal: number }[]
  >([]);

  // Modal Konfirmasi Terima Barang Gudang
  const [receiveTarget, setReceiveTarget] = useState<PurchaseOrder | null>(null);
  const [receiveQtys, setReceiveQtys] = useState<Record<number, number>>({});
  const [receivePrices, setReceivePrices] = useState<Record<number, number>>({});
  const [receiveNote, setReceiveNote] = useState("");
  const [receiving, setReceiving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [poRes, supRes, prodRes] = await Promise.allSettled([
        api.get("/purchase-orders"),
        api.get("/suppliers"),
        api.get("/products"),
      ]);
      if (poRes.status === "fulfilled" && poRes.value.data?.data) {
        setPos(poRes.value.data.data);
      }
      if (supRes.status === "fulfilled" && supRes.value.data?.data) {
        setSuppliers(supRes.value.data.data);
      }
      if (prodRes.status === "fulfilled" && prodRes.value.data?.data) {
        setProducts(prodRes.value.data.data);
      }
    } catch {
      // ignore
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
    fetchAll();
  }, [router, fetchAll]);

  const handleOpenCreate = () => {
    setSupplierId(suppliers[0] ? String(suppliers[0].ID) : "");
    setPoDate(new Date().toISOString().slice(0, 10));
    setPoNote("");
    if (products.length > 0) {
      setPoItems([
        {
          product_id: products[0].ID,
          qty: 10,
          price_modal: products[0].price_buy || 0,
        },
      ]);
    } else {
      setPoItems([]);
    }
    setShowCreateModal(true);
  };

  const handleAddItemRow = () => {
    if (products.length === 0) return;
    setPoItems((prev) => [
      ...prev,
      {
        product_id: products[0].ID,
        qty: 1,
        price_modal: products[0].price_buy || 0,
      },
    ]);
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!supplierId) {
      alert("Pilih Supplier terlebih dahulu.");
      return;
    }
    if (poItems.length === 0) {
      alert("Tambahkan minimal 1 produk untuk pengadaan.");
      return;
    }
    setCreating(true);
    try {
      await api.post("/purchase-orders", {
        supplier_id: Number(supplierId),
        date: poDate,
        note: poNote,
        items: poItems.map((it) => ({
          product_id: Number(it.product_id),
          qty: Number(it.qty),
          price_modal: Number(it.price_modal),
        })),
      });
      setShowCreateModal(false);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal membuat Purchase Order");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenReceive = (po: PurchaseOrder) => {
    const qMap: Record<number, number> = {};
    const pMap: Record<number, number> = {};
    (po.items || []).forEach((it) => {
      qMap[it.product_id] = it.qty;
      pMap[it.product_id] = it.price_modal || 0;
    });
    setReceiveQtys(qMap);
    setReceivePrices(pMap);
    setReceiveNote("");
    setReceiveTarget(po);
  };

  const handleConfirmReceive = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!receiveTarget) return;
    setReceiving(true);
    try {
      const itemsPayload = (receiveTarget.items || []).map((it) => ({
        product_id: it.product_id,
        received_qty: Number(receiveQtys[it.product_id] ?? it.qty),
        price_modal: Number(receivePrices[it.product_id] ?? (it.price_modal || 0)),
      }));
      await api.post(`/purchase-orders/${receiveTarget.ID}/receive`, {
        note: receiveNote,
        items: itemsPayload,
      });
      setReceiveTarget(null);
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengonfirmasi penerimaan PO");
    } finally {
      setReceiving(false);
    }
  };

  const handleCancelPO = async (po: PurchaseOrder) => {
    if (!confirm(`Batalkan Purchase Order ${po.po_number}?`)) return;
    try {
      await api.put(`/purchase-orders/${po.ID}/status`, { status: "CANCELLED" });
      await fetchAll();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal membatalkan PO");
    }
  };

  if (!mounted) return null;

  const filteredPOs = pos.filter((po) => {
    if (statusFilter !== "ALL" && po.status !== statusFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchNo = po.po_number?.toLowerCase().includes(q);
      const matchSup = po.supplier?.name?.toLowerCase().includes(q);
      if (!matchNo && !matchSup) return false;
    }
    return true;
  });

  const inputCls =
    "w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500";

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <ClipboardList className="w-5 h-5 text-amber-500" />
                <span>Purchase Order (PO) & Pengadaan Barang</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Pemesanan barang ke Supplier & konfirmasi penerimaan otomatis ke stok gudang.
              </p>
            </div>

            <button
              onClick={handleOpenCreate}
              className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1.5 self-start sm:self-auto transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Buat PO Baru</span>
            </button>
          </header>

          {/* Filter & Pencarian */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
              {[
                { key: "ALL", label: "Semua PO" },
                { key: "ORDERED", label: "Sedang Dipesan" },
                { key: "RECEIVED", label: "Sudah Diterima Gudang" },
                { key: "CANCELLED", label: "Dibatalkan" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    statusFilter === tab.key
                      ? "bg-amber-500 text-black font-semibold"
                      : "bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="w-3.5 h-3.5 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Cari No. PO atau Supplier..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
              />
            </div>
          </div>

          {/* Tabel Daftar Purchase Order */}
          <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden">
            {loading ? (
              <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
                <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
                <span className="text-xs">Memuat data Purchase Order...</span>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                      <th className="px-6 py-4 text-left">No. PO & Tanggal</th>
                      <th className="px-6 py-4 text-left">Supplier</th>
                      <th className="px-6 py-4 text-left">Rincian Barang</th>
                      <th className="px-6 py-4 text-left">Total Estimasi Modal</th>
                      <th className="px-6 py-4 text-left">Status</th>
                      <th className="px-6 py-4 text-right">Aksi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border)]">
                    {filteredPOs.map((po) => (
                      <tr key={po.ID} className="hover:bg-[var(--bg-sunken)]/50">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="font-mono font-bold text-amber-500">
                            {po.po_number}
                          </div>
                          <div className="text-xs text-[var(--text-secondary)]">
                            {new Date(po.date).toLocaleDateString("id-ID", {
                              dateStyle: "medium",
                            })}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                            <Building2 className="w-3.5 h-3.5 text-amber-500" />
                            <span>{po.supplier?.name || "-"}</span>
                          </div>
                          {po.note && (
                            <p className="text-xs text-[var(--text-secondary)] mt-0.5 max-w-xs truncate">
                              {po.note}
                            </p>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="space-y-1">
                            {(po.items || []).map((it) => (
                              <div
                                key={it.ID}
                                className="text-xs text-[var(--text-secondary)] flex items-center gap-1.5"
                              >
                                <span className="font-medium text-[var(--text-primary)]">
                                  {it.product?.name || `Produk #${it.product_id}`}
                                </span>
                                <span className="font-mono text-amber-500">
                                  × {it.qty}
                                </span>
                                {po.status === "RECEIVED" && (
                                  <span className="text-xs text-emerald-500 font-semibold">
                                    (Diterima: {it.received_qty})
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>
                        <td className="px-6 py-4 font-mono font-bold text-[var(--text-primary)] whitespace-nowrap">
                          {formatRupiah(po.total)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {po.status === "RECEIVED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" />
                              Diterima Gudang
                            </span>
                          ) : po.status === "CANCELLED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <XCircle className="w-3 h-3" />
                              Dibatalkan
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-amber-500/10 text-amber-500 border border-amber-500/20">
                              Sedang Dipesan
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right whitespace-nowrap">
                          {(po.status === "ORDERED" || po.status === "PENDING") && (
                            <div className="inline-flex items-center gap-2">
                              <button
                                onClick={() => handleOpenReceive(po)}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-600 flex items-center gap-1 transition-colors"
                              >
                                <PackageCheck className="w-3.5 h-3.5" />
                                <span>Terima Barang</span>
                              </button>
                              <button
                                onClick={() => handleCancelPO(po)}
                                className="px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-rose-500/10 text-rose-500 hover:bg-rose-500/20 transition-colors"
                              >
                                Batal
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}

                    {filteredPOs.length === 0 && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-16 text-center text-[var(--text-secondary)] font-medium"
                        >
                          Belum ada data Purchase Order (PO).
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

      {/* Modal Buat PO Baru */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-2xl w-full p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <h2 className="text-sm font-bold text-[var(--text-primary)]">
                Buat Purchase Order (PO) Pengadaan Baru
              </h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Pilih Supplier
                  </label>
                  <select
                    value={supplierId}
                    onChange={(e) => setSupplierId(e.target.value)}
                    className={inputCls}
                    required
                  >
                    <option value="">-- Pilih Supplier --</option>
                    {suppliers.map((s) => (
                      <option key={s.ID} value={s.ID}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tanggal Pemesanan
                  </label>
                  <input
                    type="date"
                    value={poDate}
                    onChange={(e) => setPoDate(e.target.value)}
                    className={inputCls}
                    required
                  />
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-[var(--text-secondary)]">
                    Daftar Barang yang Dipesan
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-bold text-amber-500 hover:underline flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Tambah Baris Produk
                  </button>
                </div>

                <div className="space-y-2">
                  {poItems.map((row, idx) => (
                    <div
                      key={idx}
                      className="grid grid-cols-12 gap-2 items-center p-2.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)]"
                    >
                      <div className="col-span-5">
                        <select
                          value={row.product_id}
                          onChange={(e) => {
                            const pid = Number(e.target.value);
                            const found = products.find((p) => p.ID === pid);
                            setPoItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? {
                                      ...it,
                                      product_id: pid,
                                      price_modal: found?.price_buy || 0,
                                    }
                                  : it
                              )
                            );
                          }}
                          className={inputCls}
                        >
                          {products.map((p) => (
                            <option key={p.ID} value={p.ID}>
                              {p.name} (Stok: {p.stock})
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="1"
                          placeholder="Qty"
                          value={row.qty}
                          onChange={(e) =>
                            setPoItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { ...it, qty: Number(e.target.value) } : it
                              )
                            )
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div className="col-span-3">
                        <input
                          type="number"
                          min="0"
                          placeholder="Harga Modal"
                          value={row.price_modal}
                          onChange={(e) =>
                            setPoItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? { ...it, price_modal: Number(e.target.value) }
                                  : it
                              )
                            )
                          }
                          className={`${inputCls} font-mono`}
                        />
                      </div>
                      <div className="col-span-1 text-right">
                        <button
                          type="button"
                          onClick={() =>
                            setPoItems((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="p-1.5 text-rose-500 hover:bg-rose-500/10 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan PO (Opsional)
                </label>
                <input
                  type="text"
                  value={poNote}
                  onChange={(e) => setPoNote(e.target.value)}
                  placeholder="Contoh: Pengiriman via ekspedisi kargo..."
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50"
                >
                  {creating ? "Menyimpan..." : "Simpan Purchase Order"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Konfirmasi Terima Barang Gudang */}
      {receiveTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl max-w-xl w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[var(--border)] pb-3">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)]">
                  Konfirmasi Penerimaan Barang ({receiveTarget.po_number})
                </h2>
                <p className="text-xs text-[var(--text-secondary)]">
                  Stok produk akan otomatis bertambah dan tercatat di Kartu Stok (INBOUND).
                </p>
              </div>
              <button
                onClick={() => setReceiveTarget(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmReceive} className="space-y-4">
              <div className="space-y-2.5 max-h-64 overflow-y-auto">
                {(receiveTarget.items || []).map((it) => (
                  <div
                    key={it.ID}
                    className="p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] grid grid-cols-12 gap-3 items-center"
                  >
                    <div className="col-span-6">
                      <p className="text-xs font-bold text-[var(--text-primary)]">
                        {it.product?.name || `Produk #${it.product_id}`}
                      </p>
                      <p className="text-xs text-[var(--text-muted)]">
                        Dipesan: {it.qty} unit
                      </p>
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-[var(--text-secondary)] mb-0.5">
                        Qty Diterima
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={receiveQtys[it.product_id] ?? it.qty}
                        onChange={(e) =>
                          setReceiveQtys((prev) => ({
                            ...prev,
                            [it.product_id]: Number(e.target.value),
                          }))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                    <div className="col-span-3">
                      <label className="block text-xs text-[var(--text-secondary)] mb-0.5">
                        Harga Beli (Rp)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={receivePrices[it.product_id] ?? (it.price_modal || 0)}
                        onChange={(e) =>
                          setReceivePrices((prev) => ({
                            ...prev,
                            [it.product_id]: Number(e.target.value),
                          }))
                        }
                        className={`${inputCls} font-mono`}
                      />
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Penerimaan Gudang
                </label>
                <input
                  type="text"
                  value={receiveNote}
                  onChange={(e) => setReceiveNote(e.target.value)}
                  placeholder="Contoh: Barang diterima lengkap & kondisi baik..."
                  className={inputCls}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--border)]">
                <button
                  type="button"
                  onClick={() => setReceiveTarget(null)}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={receiving}
                  className="px-4 py-2 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-600 disabled:opacity-50"
                >
                  {receiving ? "Memproses..." : "Konfirmasi Terima & Tambah Stok"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
