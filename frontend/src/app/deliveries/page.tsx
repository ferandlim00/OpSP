"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated, getUser } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import { formatRupiah } from "@/utils/formatters";
import {
  Truck,
  Plus,
  Search,
  Calendar,
  MapPin,
  User,
  Package,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  X,
  ArrowRight,
  Boxes,
  Camera,
  Phone,
  ImagePlus,
  Trash2,
  AlertTriangle,
  CreditCard,
} from "lucide-react";

type DeliveryStatus =
  | "SCHEDULED"
  | "PREPARING"
  | "IN_DELIVERY"
  | "COMPLETED"
  | "CANCELLED";

interface DeliveryItem {
  ID: number;
  product_id: number;
  qty: number;
  delivered_qty?: number;
  product?: { ID: number; name: string; sku: string };
}

interface DeliveryProofPhoto {
  ID: number;
  stage?: "PICKUP" | "DROPOFF";
  photo_url: string;
}

interface DeliveryProof {
  ID: number;
  receiver_name: string;
  pickup_note?: string;
  pickup_at?: string;
  delivered_at?: string;
  note: string;
  photos?: DeliveryProofPhoto[];
}

interface PaymentRef {
  ID: number;
  amount: number;
  method: string;
  payment_type: string;
  proof_url?: string;
  note?: string;
  CreatedAt?: string;
}

interface Delivery {
  ID: number;
  delivery_no: string;
  transaction_id: number;
  driver_id: number;
  address: string;
  scheduled_date?: string;
  shipping_cost?: number;
  status: DeliveryStatus;
  note: string;
  CreatedAt: string;
  transaction?: {
    ID: number;
    transaction_no: string;
    status?: string;
    payment_status?: "UNPAID" | "PARTIAL" | "PAID";
    total?: number;
    customer?: { name: string; phone: string; address: string };
    payments?: PaymentRef[];
  };
  driver?: { ID: number; name: string };
  items?: DeliveryItem[];
  proof?: DeliveryProof;
}

interface TransactionRefItem {
  ID: number;
  product_id: number;
  qty: number;
  delivered_qty?: number;
  returned_qty?: number;
  product?: { ID: number; name: string; sku: string };
}

interface TransactionRef {
  ID: number;
  transaction_no: string;
  status: string;
  payment_status?: "UNPAID" | "PARTIAL" | "PAID";
  total?: number;
  customer?: { name: string; phone?: string; address: string };
  items?: TransactionRefItem[];
  payments?: PaymentRef[];
}

interface DriverRef {
  ID: number;
  name: string;
  role?: { name: string };
}

interface PendingProofPhoto {
  file: File;
  preview: string;
}

const STEPS: { key: DeliveryStatus; label: string }[] = [
  { key: "SCHEDULED", label: "1. Tugas Masuk" },
  { key: "PREPARING", label: "2. Muat Barang (Foto)" },
  { key: "IN_DELIVERY", label: "3. Dalam Perjalanan" },
  { key: "COMPLETED", label: "4. Terkirim (Foto POD)" },
];

export default function DeliveriesPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const user = getUser();
  const role = user?.role?.name || "OWNER";

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [transactions, setTransactions] = useState<TransactionRef[]>([]);
  const [drivers, setDrivers] = useState<DriverRef[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("ALL");
  const [filterDriverId, setFilterDriverId] = useState<string>("ALL");
  const [filterDate, setFilterDate] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modal Tambah Pengiriman (Khusus Admin/Owner) + Pencarian Cerdas Pelanggan/Nota & Pencarian Barang
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [trxSearchQuery, setTrxSearchQuery] = useState("");
  const [trxDropdownOpen, setTrxDropdownOpen] = useState(false);
  const [itemSearchQuery, setItemSearchQuery] = useState("");
  const [form, setForm] = useState({
    transaction_id: "",
    driver_id: "",
    address: "",
    scheduled_date: new Date().toISOString().slice(0, 10),
    shipping_cost: "0",
    note: "",
  });
  const [shippingEnabled, setShippingEnabled] = useState(true);
  const [scheduleQtyMap, setScheduleQtyMap] = useState<Record<number, number>>({});

  // Modal Kamera Upload Foto Bukti (PICKUP / Persiapan atau DROPOFF / Selesai + Konfirmasi Qty Aktual)
  const [proofModalMode, setProofModalMode] = useState<"PICKUP" | "DROPOFF" | null>(null);
  const [proofTarget, setProofTarget] = useState<Delivery | null>(null);
  const [proofReceiver, setProofReceiver] = useState("");
  const [proofNote, setProofNote] = useState("");
  const [proofPhotos, setProofPhotos] = useState<PendingProofPhoto[]>([]);
  const [actualDeliveredMap, setActualDeliveredMap] = useState<Record<number, number>>({});
  const [proofSaving, setProofSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Modal Koordinasi Pelunasan Tagihan di Lokasi (Kurir / Admin) + Wajib Foto Bukti Bayar
  const [billModalDeliv, setBillModalDeliv] = useState<Delivery | null>(null);
  const [billAmt, setBillAmt] = useState<string>("");
  const [billMethod, setBillMethod] = useState<string>("CASH");
  const [billNote, setBillNote] = useState<string>("");
  const [billProofFile, setBillProofFile] = useState<File | null>(null);
  const [billProofPreview, setBillProofPreview] = useState<string>("");
  const billFileRef = useRef<HTMLInputElement | null>(null);
  const [billSaving, setBillSaving] = useState(false);

  const selectTransactionForSchedule = useCallback(
    (trx: TransactionRef) => {
      setForm((prev) => ({
        ...prev,
        transaction_id: String(trx.ID),
        address: trx.customer?.address || prev.address,
      }));
      setTrxSearchQuery("");
      setTrxDropdownOpen(false);
      setItemSearchQuery("");

      const nextQtyMap: Record<number, number> = {};
      (trx.items || []).forEach((it) => {
        const rem = Math.max(0, it.qty - (it.delivered_qty || 0));
        nextQtyMap[it.product_id] = rem;
      });
      setScheduleQtyMap(nextQtyMap);
    },
    []
  );

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [delivRes, setRes] = await Promise.allSettled([
        api.get("/deliveries"),
        api.get("/settings"),
      ]);
      if (delivRes.status === "fulfilled" && delivRes.value.data?.success && delivRes.value.data?.data) {
        setDeliveries(delivRes.value.data.data);
      }
      if (setRes.status === "fulfilled" && setRes.value.data?.success && setRes.value.data?.data) {
        const st = setRes.value.data.data;
        setShippingEnabled(st.shipping_cost_enabled !== "false");
        if (st.shipping_cost_enabled !== "false" && st.default_shipping_cost) {
          setForm((prev) => ({
            ...prev,
            shipping_cost: prev.shipping_cost === "0" ? st.default_shipping_cost : prev.shipping_cost,
          }));
        }
      }

      if (role === "OWNER" || role === "ADMIN") {
        const [trxRes, drvRes] = await Promise.all([
          api.get("/transactions"),
          api.get("/drivers"),
        ]);
        const loadedTrx: TransactionRef[] =
          trxRes.data.success && trxRes.data.data ? trxRes.data.data : [];
        setTransactions(loadedTrx);
        if (drvRes.data.success && drvRes.data.data) {
          setDrivers(drvRes.data.data);
        }

        // Jika dibuka dari pintasan Kasir (/deliveries?trx_id=...)
        if (typeof window !== "undefined") {
          const params = new URLSearchParams(window.location.search);
          const preselectId = params.get("trx_id");
          if (preselectId) {
            const target = loadedTrx.find((t) => String(t.ID) === preselectId);
            if (target) {
              setIsModalOpen(true);
              selectTransactionForSchedule(target);
            }
          }
        }
      }
    } catch (error) {
      console.error("Gagal memuat pengiriman:", error);
    } finally {
      setLoading(false);
    }
  }, [role, selectTransactionForSchedule]);

  useEffect(() => {
    setMounted(true);
    if (!isAuthenticated()) {
      router.push("/login");
      return;
    }
    fetchData();
  }, [router, fetchData]);

  const selectedTrxForSchedule = transactions.find(
    (t) => String(t.ID) === form.transaction_id
  );

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.transaction_id || !form.driver_id || !form.address) {
      alert("Transaksi, kurir, dan alamat wajib diisi.");
      return;
    }

    const itemsPayload = Object.entries(scheduleQtyMap)
      .map(([pid, qty]) => ({ product_id: Number(pid), qty: Number(qty) || 0 }))
      .filter((it) => it.qty > 0);

    if (selectedTrxForSchedule?.items?.length && itemsPayload.length === 0) {
      alert("Masukkan minimal 1 barang dengan jumlah kirim lebih dari 0.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/deliveries", {
        transaction_id: Number(form.transaction_id),
        driver_id: Number(form.driver_id),
        address: form.address,
        scheduled_date: form.scheduled_date,
        shipping_cost: shippingEnabled ? Number(form.shipping_cost) || 0 : 0,
        note: form.note,
        items: itemsPayload,
      });
      setIsModalOpen(false);
      setForm({
        transaction_id: "",
        driver_id: "",
        address: "",
        scheduled_date: new Date().toISOString().slice(0, 10),
        shipping_cost: form.shipping_cost,
        note: "",
      });
      setScheduleQtyMap({});
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal membuat jadwal pengiriman");
    } finally {
      setSubmitting(false);
    }
  };

  // Transisi untuk tahap SCHEDULED -> PREPARING atau CANCELLED
  const handleStepAdvance = async (d: Delivery, nextStatus: DeliveryStatus) => {
    if (nextStatus === "CANCELLED") {
      const ok = confirm(`Batalkan jadwal pengiriman "${d.delivery_no}"?`);
      if (!ok) return;
    }

    setBusyId(d.ID);
    try {
      await api.put(`/deliveries/${d.ID}/status`, { status: nextStatus });
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal memperbarui tahapan pengiriman");
    } finally {
      setBusyId(null);
    }
  };

  // Buka Modal Upload Foto Bukti (PICKUP saat persiapan berangkat, atau DROPOFF saat tiba)
  const openProofModal = (d: Delivery, mode: "PICKUP" | "DROPOFF") => {
    setProofTarget(d);
    setProofModalMode(mode);
    setProofReceiver(d.transaction?.customer?.name || "");
    setProofNote("");
    setProofPhotos([]);

    const initMap: Record<number, number> = {};
    (d.items || []).forEach((it) => {
      initMap[it.product_id] = it.qty;
    });
    setActualDeliveredMap(initMap);
  };

  const closeProofModal = () => {
    proofPhotos.forEach((p) => URL.revokeObjectURL(p.preview));
    setProofTarget(null);
    setProofModalMode(null);
    setProofPhotos([]);
    setActualDeliveredMap({});
  };

  const handleSelectProofFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const remaining = 5 - proofPhotos.length;
    const picked = files.slice(0, remaining).map((file) => ({
      file,
      preview: URL.createObjectURL(file),
    }));
    setProofPhotos((prev) => [...prev, ...picked]);
    e.target.value = "";
  };

  const removeProofPhoto = (idx: number) => {
    setProofPhotos((prev) => {
      const target = prev[idx];
      if (target) URL.revokeObjectURL(target.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleSubmitProof = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!proofTarget || !proofModalMode) return;

    if (proofModalMode === "DROPOFF" && !proofReceiver.trim()) {
      alert("Nama penerima barang wajib diisi.");
      return;
    }
    if (proofPhotos.length === 0) {
      alert(
        proofModalMode === "PICKUP"
          ? "Wajib mengunggah minimal 1 foto bukti persiapan/muat barang sebelum berangkat!"
          : "Wajib mengunggah minimal 1 foto bukti serah terima barang!"
      );
      return;
    }

    setProofSaving(true);
    try {
      const fd = new FormData();
      if (proofModalMode === "PICKUP") {
        fd.append("pickup_note", proofNote.trim());
      } else {
        fd.append("receiver_name", proofReceiver.trim());
        fd.append("note", proofNote.trim());
        const deliveredList = (proofTarget.items || []).map((it) => ({
          product_id: it.product_id,
          delivered_qty:
            actualDeliveredMap[it.product_id] !== undefined
              ? actualDeliveredMap[it.product_id]
              : it.qty,
        }));
        fd.append("delivered_items", JSON.stringify(deliveredList));
      }
      proofPhotos.forEach((p) => fd.append("photos", p.file));

      const endpoint =
        proofModalMode === "PICKUP"
          ? `/deliveries/${proofTarget.ID}/start`
          : `/deliveries/${proofTarget.ID}/complete`;

      await api.post(endpoint, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      closeProofModal();
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mengunggah foto bukti");
    } finally {
      setProofSaving(false);
    }
  };

  // Handler Koordinasi Pelunasan Tagihan di Lokasi (Kurir / Admin)
  const openBillSettlementModal = (d: Delivery, remainingAmt: number) => {
    setBillModalDeliv(d);
    setBillAmt(String(remainingAmt));
    setBillMethod("CASH");
    setBillNote(`Pelunasan saat pengantaran ${d.delivery_no}`);
    if (billProofPreview) URL.revokeObjectURL(billProofPreview);
    setBillProofFile(null);
    setBillProofPreview("");
  };

  const clearBillProof = () => {
    if (billProofPreview) URL.revokeObjectURL(billProofPreview);
    setBillProofFile(null);
    setBillProofPreview("");
  };

  const handleSelectBillProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (billProofPreview) URL.revokeObjectURL(billProofPreview);
    setBillProofFile(file);
    setBillProofPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const handleBillSettlementSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billModalDeliv) return;
    const amt = Number(billAmt) || 0;
    if (amt <= 0) {
      alert("Masukkan nominal pembayaran yang diterima.");
      return;
    }
    if (!billProofFile) {
      alert("Wajib mengunggah Foto Bukti Pembayaran (uang tunai / struk transfer / QRIS)!");
      return;
    }

    setBillSaving(true);
    try {
      const fd = new FormData();
      fd.append("amount", String(amt));
      fd.append("method", billMethod);
      fd.append("payment_type", "FULL");
      fd.append(
        "note",
        billNote.trim() || `Pelunasan di lokasi pengantaran (${billModalDeliv.delivery_no})`
      );
      fd.append("proof_photo", billProofFile);

      await api.post(`/transactions/${billModalDeliv.transaction_id}/payments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      clearBillProof();
      setBillModalDeliv(null);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mencatat pelunasan tagihan");
    } finally {
      setBillSaving(false);
    }
  };

  const filtered = deliveries.filter((d) => {
    const q = searchQuery.toLowerCase();
    const matchQ =
      d.delivery_no.toLowerCase().includes(q) ||
      (d.transaction?.transaction_no || "").toLowerCase().includes(q) ||
      (d.transaction?.customer?.name || "").toLowerCase().includes(q) ||
      (d.driver?.name || "").toLowerCase().includes(q) ||
      d.address.toLowerCase().includes(q) ||
      (d.items || []).some((it) =>
        (it.product?.name || "").toLowerCase().includes(q)
      );
    const matchStatus =
      filterStatus === "ALL"
        ? true
        : filterStatus === "ACTIVE"
        ? d.status === "SCHEDULED" ||
          d.status === "PREPARING" ||
          d.status === "IN_DELIVERY"
        : d.status === filterStatus;
    const matchDriver =
      filterDriverId === "ALL" || String(d.driver_id) === filterDriverId;
    const matchDate =
      !filterDate ||
      (d.scheduled_date && d.scheduled_date.slice(0, 10) === filterDate) ||
      (d.CreatedAt && d.CreatedAt.slice(0, 10) === filterDate);
    return matchQ && matchStatus && matchDriver && matchDate;
  });

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedDeliveries = filtered.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  // Kandidat transaksi yang masih membutuhkan pengiriman
  const schedulableTransactions = transactions.filter(
    (t) => t.status !== "COMPLETED" && t.status !== "CANCELLED"
  );

  // Filter cerdas transaksi/pelanggan/barang di dalam modal Jadwalkan Pengiriman
  const filteredScheduleTransactions = (
    schedulableTransactions.length > 0 ? schedulableTransactions : transactions
  ).filter((t) => {
    const q = trxSearchQuery.trim().toLowerCase();
    if (!q) return true;
    const matchNo = t.transaction_no.toLowerCase().includes(q);
    const matchCust =
      (t.customer?.name || "").toLowerCase().includes(q) ||
      (t.customer?.phone || "").toLowerCase().includes(q) ||
      (t.customer?.address || "").toLowerCase().includes(q);
    const matchProd = (t.items || []).some(
      (it) =>
        (it.product?.name || "").toLowerCase().includes(q) ||
        (it.product?.sku || "").toLowerCase().includes(q)
    );
    return matchNo || matchCust || matchProd;
  });

  if (!mounted) return null;

  const getStepIndex = (st: DeliveryStatus) => {
    if (st === "SCHEDULED") return 0;
    if (st === "PREPARING") return 1;
    if (st === "IN_DELIVERY") return 2;
    if (st === "COMPLETED") return 3;
    return -1;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-lg font-bold text-[var(--text-primary)] tracking-tight flex items-center gap-2">
                <Truck className="w-5 h-5 text-amber-500" />
                <span>Armada, Pengantaran & Koordinasi Tagihan (GrabCargo POD)</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                Wajib Foto Bukti 2x (Muat & Serah Terima), Konfirmasi Jumlah Barang Aktual, serta Koordinasi Pelunasan Tagihan di Lokasi.
              </p>
            </div>

            {(role === "OWNER" || role === "ADMIN") && (
              <button
                onClick={() => setIsModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
              >
                <Plus className="w-4 h-4" />
                Jadwalkan Pengiriman
              </button>
            )}
          </header>

          {/* Filter & Pencarian (Siap Menangani Ribuan Surat Jalan) */}
          <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5 flex-wrap">
                {[
                  { key: "ALL", label: `Semua (${deliveries.length})` },
                  {
                    key: "ACTIVE",
                    label: `Tugas Aktif (${
                      deliveries.filter(
                        (d) =>
                          d.status === "SCHEDULED" ||
                          d.status === "PREPARING" ||
                          d.status === "IN_DELIVERY"
                      ).length
                    })`,
                  },
                  { key: "SCHEDULED", label: "1. Tugas Masuk" },
                  { key: "PREPARING", label: "2. Muat Barang" },
                  { key: "IN_DELIVERY", label: "3. Dalam Perjalanan" },
                  { key: "COMPLETED", label: "4. Terkirim (POD)" },
                  { key: "CANCELLED", label: "Dibatalkan" },
                ].map((st) => (
                  <button
                    key={st.key}
                    onClick={() => {
                      setFilterStatus(st.key);
                      setCurrentPage(1);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-colors ${
                      filterStatus === st.key
                        ? "bg-amber-500 text-black font-semibold"
                        : "bg-[var(--bg-sunken)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--border)]"
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="text-xs font-mono text-[var(--text-muted)]">
                Menampilkan {paginatedDeliveries.length} dari {filtered.length} surat jalan
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5 pt-2 border-t border-[var(--border)]">
              <div className="relative sm:col-span-2">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="Cari No. SJ, No. Nota, Pelanggan, Kurir, Alamat, atau Nama Barang..."
                  className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {(role === "OWNER" || role === "ADMIN") && (
                <select
                  value={filterDriverId}
                  onChange={(e) => {
                    setFilterDriverId(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="px-3 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                >
                  <option value="ALL">Semua Driver / Kurir</option>
                  {drivers.map((drv) => (
                    <option key={drv.ID} value={String(drv.ID)}>
                      Kurir: {drv.name}
                    </option>
                  ))}
                </select>
              )}

              <div className="flex items-center gap-1.5">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="flex-1 px-2.5 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  title="Filter Tanggal Jadwal / Buat"
                />
                {filterDate && (
                  <button
                    type="button"
                    onClick={() => {
                      setFilterDate("");
                      setCurrentPage(1);
                    }}
                    className="px-2 py-1.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-xs text-rose-500 hover:bg-rose-500/10"
                    title="Reset Tanggal"
                  >
                    Reset
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Daftar Kartu Tugas Kurir */}
          {loading ? (
            <div className="p-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Memuat daftar tugas pengiriman...</span>
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-12 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] text-center text-xs text-[var(--text-muted)]">
              Belum ada tugas pengiriman yang ditemukan.
            </div>
          ) : (
            <div className="space-y-4">
              {paginatedDeliveries.map((d) => {
                const currentIdx = getStepIndex(d.status);
                const isBusy = busyId === d.ID;
                const custPhone = d.transaction?.customer?.phone || "";
                const waDigits = custPhone.replace(/[^0-9]/g, "");
                const waUrl = waDigits
                  ? `https://wa.me/${waDigits.startsWith("0") ? "62" + waDigits.slice(1) : waDigits}`
                  : "";

                const allPhotos = d.proof?.photos || [];
                const pickupPhotos = allPhotos.filter((p) => p.stage === "PICKUP");
                const dropoffPhotos = allPhotos.filter(
                  (p) => !p.stage || p.stage === "DROPOFF"
                );

                const hasPartialItem =
                  d.status === "COMPLETED" &&
                  (d.items || []).some(
                    (it) =>
                      it.delivered_qty !== undefined &&
                      it.delivered_qty < it.qty
                  );

                // Perhitungan Tagihan Nota untuk Koordinasi Kurir & Admin
                const trxTotal = d.transaction?.total || 0;
                const trxPayments = d.transaction?.payments || [];
                const totalPaid = trxPayments.reduce((acc, p) => acc + p.amount, 0);
                const remainingBill = Math.max(0, trxTotal - totalPaid);
                const payStatus = d.transaction?.payment_status || "PAID";
                const hasUnpaidBill = payStatus !== "PAID" && remainingBill > 0;

                return (
                  <div
                    key={d.ID}
                    className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] space-y-4 shadow-xs"
                  >
                    {/* Header Kartu Tugas & Tombol Utama Kurir */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-mono font-bold text-sm text-amber-500">
                            {d.delivery_no}
                          </span>
                          <span className="text-xs font-mono text-[var(--text-muted)] bg-[var(--bg-sunken)] px-2 py-0.5 rounded border border-[var(--border)]">
                            Nota: {d.transaction?.transaction_no || `#${d.transaction_id}`}
                          </span>
                          {d.status === "COMPLETED" && !hasPartialItem && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Terkirim Lengkap (POD Terverifikasi & Stok Dipotong)
                            </span>
                          )}
                          {d.status === "COMPLETED" && hasPartialItem && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-amber-500/10 text-amber-500 border border-amber-500/30">
                              <AlertTriangle className="w-3.5 h-3.5" />
                              Terkirim Sebagian / Kurang Kirim (Stok Dipotong Sesuai Aktual)
                            </span>
                          )}
                          {d.status === "CANCELLED" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold bg-rose-500/10 text-rose-500 border border-rose-500/20">
                              <XCircle className="w-3.5 h-3.5" />
                              Dibatalkan
                            </span>
                          )}
                        </div>

                        <div className="flex flex-wrap items-center gap-4 text-xs text-[var(--text-secondary)] pt-1">
                          <span className="flex items-center gap-1.5 font-semibold text-[var(--text-primary)]">
                            <User className="w-3.5 h-3.5 text-amber-500" />
                            Driver / Kurir: {d.driver?.name || `Driver #${d.driver_id}`}
                          </span>
                          {d.scheduled_date && (
                            <span className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                              Jadwal:{" "}
                              {new Date(d.scheduled_date).toLocaleDateString("id-ID", {
                                dateStyle: "medium",
                              })}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Tombol Aksi Bertahap ala Aplikasi Driver GrabCargo */}
                      <div className="flex items-center gap-2 shrink-0 flex-wrap">
                        {d.status === "SCHEDULED" && (
                          <button
                            disabled={isBusy}
                            onClick={() => handleStepAdvance(d, "PREPARING")}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                          >
                            {isBusy ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <Boxes className="w-4 h-4" />
                            )}
                            Terima Tugas & Siapkan Barang
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {d.status === "PREPARING" && (
                          <button
                            disabled={isBusy}
                            onClick={() => openProofModal(d, "PICKUP")}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                            Foto Persiapan Barang & Berangkat Antar
                            <ArrowRight className="w-3.5 h-3.5" />
                          </button>
                        )}

                        {d.status === "IN_DELIVERY" && (
                          <button
                            disabled={isBusy}
                            onClick={() => openProofModal(d, "DROPOFF")}
                            className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-xs font-semibold bg-emerald-500 text-black hover:bg-emerald-600 disabled:opacity-50 transition-colors"
                          >
                            <Camera className="w-4 h-4" />
                            Selesaikan & Upload Foto Serah Terima (POD)
                          </button>
                        )}

                        {(role === "OWNER" || role === "ADMIN") &&
                          d.status !== "COMPLETED" &&
                          d.status !== "CANCELLED" && (
                            <button
                              disabled={isBusy}
                              onClick={() => handleStepAdvance(d, "CANCELLED")}
                              className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-500 bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 disabled:opacity-50 transition-colors"
                            >
                              Batalkan
                            </button>
                          )}
                      </div>
                    </div>

                    {/* Panel Koordinasi Tagihan antara Pengantar Barang (Kurir) & Admin */}
                    {d.transaction && (
                      <div
                        className={`p-3.5 rounded-xl border flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                          hasUnpaidBill
                            ? "bg-rose-500/10 border-rose-500/30"
                            : "bg-emerald-500/5 border-emerald-500/20"
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <CreditCard
                              className={`w-4 h-4 ${
                                hasUnpaidBill ? "text-rose-500" : "text-emerald-500"
                              }`}
                            />
                            <span
                              className={`text-xs font-bold ${
                                hasUnpaidBill ? "text-rose-500" : "text-emerald-500"
                              }`}
                            >
                              {hasUnpaidBill
                                ? `KOORDINASI TAGIHAN: Masih Ada Sisa Tagihan ${formatRupiah(
                                    remainingBill
                                  )}`
                                : "STATUS TAGIHAN: LUNAS (Siap Serah Terima Tanpa Tagih)"}
                            </span>
                            <span className="text-xs font-mono text-[var(--text-secondary)]">
                              • Total Nota: {formatRupiah(trxTotal)} • Sudah Masuk:{" "}
                              {formatRupiah(totalPaid)}
                            </span>
                          </div>

                          {/* Daftar Bukti Pembayaran yang Sudah Masuk */}
                          {trxPayments.some((p) => p.proof_url) && (
                            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                              <span className="text-xs text-[var(--text-muted)]">
                                Bukti Pembayaran Tercatat:
                              </span>
                              {trxPayments.map((p, idx) =>
                                p.proof_url ? (
                                  <a
                                    key={p.ID || idx}
                                    href={getImageUrl(p.proof_url)}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-amber-500 hover:border-amber-500"
                                  >
                                    <Camera className="w-3 h-3" />
                                    Bukti #{idx + 1} ({p.payment_type} - {formatRupiah(p.amount)})
                                  </a>
                                ) : null
                              )}
                            </div>
                          )}
                        </div>

                        {hasUnpaidBill && d.status !== "CANCELLED" && (
                          <button
                            type="button"
                            onClick={() => openBillSettlementModal(d, remainingBill)}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 transition-colors"
                          >
                            <Camera className="w-3.5 h-3.5" />
                            Terima Pelunasan & Upload Bukti Bayar
                          </button>
                        )}
                      </div>
                    )}

                    {/* Stepper Visual 4 Tahap */}
                    {d.status !== "CANCELLED" && (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {STEPS.map((step, idx) => {
                          const isDone = currentIdx > idx || d.status === "COMPLETED";
                          const isCurrent = currentIdx === idx && d.status !== "COMPLETED";
                          return (
                            <div
                              key={step.key}
                              className={`px-3 py-2 rounded-lg border text-xs font-semibold flex items-center gap-2 ${
                                isDone
                                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-500"
                                  : isCurrent
                                  ? "bg-amber-500/10 border-amber-500/40 text-amber-500 font-bold"
                                  : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-muted)]"
                              }`}
                            >
                              {isDone ? (
                                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                              ) : (
                                <Clock className="w-3.5 h-3.5 shrink-0" />
                              )}
                              <span className="truncate">{step.label}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Rute Tujuan, Kontak Cepat Penerima & Muatan Barang */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
                      <div className="p-3.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <div className="text-xs font-bold text-[var(--text-primary)]">
                            Tujuan: {d.transaction?.customer?.name || "Pelanggan"}
                          </div>
                          <div className="flex items-center gap-1.5">
                            {waUrl && (
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-emerald-500 hover:border-emerald-500/40"
                              >
                                <Phone className="w-3 h-3" />
                                Hubungi
                              </a>
                            )}
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
                                d.address
                              )}`}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-amber-500 hover:border-amber-500/40"
                            >
                              <MapPin className="w-3 h-3" />
                              Buka Maps
                            </a>
                          </div>
                        </div>

                        <div className="flex items-start gap-1.5 text-xs text-[var(--text-secondary)]">
                          <MapPin className="w-3.5 h-3.5 text-amber-500 shrink-0 mt-0.5" />
                          <span>{d.address}</span>
                        </div>
                        {d.note && (
                          <div className="text-xs text-[var(--text-muted)] pt-1 border-t border-[var(--border)]">
                            Catatan: {d.note}
                          </div>
                        )}
                      </div>

                      <div className="p-3.5 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] space-y-1.5">
                        <div className="text-xs font-bold text-[var(--text-primary)] flex items-center justify-between">
                          <span>Daftar Muatan Surat Jalan:</span>
                          <span className="text-xs font-normal text-[var(--text-muted)]">
                            {d.status === "COMPLETED"
                              ? "Stok dipotong sesuai diterima"
                              : "Stok fisik ditahan (Pending)"}
                          </span>
                        </div>
                        <div className="space-y-1">
                          {d.items?.map((it) => {
                            const act =
                              d.status === "COMPLETED"
                                ? it.delivered_qty ?? it.qty
                                : null;
                            const isShort = act !== null && act < it.qty;
                            return (
                              <div
                                key={it.ID}
                                className="flex items-center justify-between text-xs text-[var(--text-secondary)]"
                              >
                                <span className="flex items-center gap-1.5">
                                  <Package className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                  {it.product?.name || `Produk #${it.product_id}`}
                                </span>
                                {act !== null ? (
                                  <strong
                                    className={`font-mono ${
                                      isShort ? "text-amber-500" : "text-emerald-500"
                                    }`}
                                  >
                                    Diterima: {act}/{it.qty} unit
                                  </strong>
                                ) : (
                                  <strong className="font-mono text-[var(--text-primary)]">
                                    {it.qty} unit
                                  </strong>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </div>

                    {/* Galeri Bukti 1: Foto Persiapan / Muat Barang (PICKUP) */}
                    {pickupPhotos.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-amber-500/5 border border-amber-500/20 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-bold text-amber-500 flex items-center gap-1.5">
                            <Boxes className="w-4 h-4" />
                            <span>Bukti Persiapan & Muat Barang ke Armada (Pickup Proof)</span>
                          </div>
                          {d.proof?.pickup_at && (
                            <span className="text-[var(--text-muted)] font-mono">
                              {new Date(d.proof.pickup_at).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          )}
                        </div>
                        {d.proof?.pickup_note && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            Catatan Muat: {d.proof.pickup_note}
                          </p>
                        )}
                        <div className="flex items-center gap-2.5 flex-wrap pt-1">
                          {pickupPhotos.map((ph) => (
                            <a
                              key={ph.ID}
                              href={getImageUrl(ph.photo_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] hover:border-amber-500 transition-colors"
                            >
                              <img
                                src={getImageUrl(ph.photo_url)}
                                alt="Bukti Persiapan Barang"
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Galeri Bukti 2: Foto Serah Terima di Lokasi Tujuan (DROPOFF / POD) */}
                    {d.status === "COMPLETED" && dropoffPhotos.length > 0 && (
                      <div className="p-3.5 rounded-lg bg-emerald-500/5 border border-emerald-500/20 space-y-2">
                        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                          <div className="font-bold text-emerald-500 flex items-center gap-1.5">
                            <Camera className="w-4 h-4" />
                            <span>
                              Bukti Serah Terima (POD) — Diterima oleh:{" "}
                              <strong className="text-[var(--text-primary)]">
                                {d.proof?.receiver_name || "Pelanggan"}
                              </strong>
                            </span>
                          </div>
                          {d.proof?.delivered_at && (
                            <span className="text-[var(--text-muted)] font-mono">
                              {new Date(d.proof.delivered_at).toLocaleString("id-ID", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })}
                            </span>
                          )}
                        </div>

                        {d.proof?.note && (
                          <p className="text-xs text-[var(--text-secondary)]">
                            Catatan Serah Terima: {d.proof.note}
                          </p>
                        )}

                        <div className="flex items-center gap-2.5 flex-wrap pt-1">
                          {dropoffPhotos.map((ph) => (
                            <a
                              key={ph.ID}
                              href={getImageUrl(ph.photo_url)}
                              target="_blank"
                              rel="noreferrer"
                              className="block w-20 h-20 rounded-lg overflow-hidden border border-[var(--border)] hover:border-amber-500 transition-colors"
                            >
                              <img
                                src={getImageUrl(ph.photo_url)}
                                alt="Bukti Serah Terima"
                                loading="lazy"
                                className="w-full h-full object-cover"
                              />
                            </a>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Navigasi Pagination (Agar 1.000+ Surat Jalan Tetap Ringan & Cepat) */}
              {filtered.length > 0 && (
                <div className="p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-xs text-[var(--text-secondary)]">
                    <span>Tampilkan per halaman:</span>
                    <select
                      value={pageSize}
                      onChange={(e) => {
                        setPageSize(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="px-2 py-1 bg-[var(--bg-sunken)] border border-[var(--border)] rounded text-xs font-mono text-[var(--text-primary)]"
                    >
                      <option value={10}>10 Surat Jalan</option>
                      <option value={25}>25 Surat Jalan</option>
                      <option value={50}>50 Surat Jalan</option>
                    </select>
                    <span className="font-mono text-[var(--text-muted)]">
                      (Total: {filtered.length} data)
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={safePage <= 1}
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-40 hover:border-amber-500/40"
                    >
                      ← Sebelumnya
                    </button>
                    <span className="text-xs font-mono font-bold px-2 text-[var(--text-primary)]">
                      Hal. {safePage} / {totalPages}
                    </span>
                    <button
                      type="button"
                      disabled={safePage >= totalPages}
                      onClick={() =>
                        setCurrentPage((p) => Math.min(totalPages, p + 1))
                      }
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-primary)] disabled:opacity-40 hover:border-amber-500/40"
                    >
                      Berikutnya →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </main>
      </div>

      {/* Modal 1: Buat Jadwal Pengiriman (Dilengkapi Pencarian Cerdas Pelanggan/Nota & Filter Item Nota Besar) */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-xl bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden max-h-[92vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Truck className="w-4 h-4 text-amber-500" />
                  Jadwalkan Pengiriman / Pengiriman Susulan (Admin)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Cari nota berdasarkan nama pelanggan, nomor HP, nomor nota, atau nama barang.
                </p>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4 overflow-y-auto">
              {/* Pencarian Cerdas Nota & Pelanggan */}
              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                  1. Cari & Pilih Nota Transaksi / Pelanggan *
                </label>

                {selectedTrxForSchedule ? (
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between gap-3">
                    <div className="min-w-0 space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono font-bold text-xs text-amber-500">
                          {selectedTrxForSchedule.transaction_no}
                        </span>
                        <span className="text-xs font-bold text-[var(--text-primary)]">
                          {selectedTrxForSchedule.customer?.name || "Pelanggan"}
                        </span>
                        {selectedTrxForSchedule.customer?.phone && (
                          <span className="text-xs font-mono text-[var(--text-secondary)]">
                            ({selectedTrxForSchedule.customer.phone})
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-[var(--text-muted)]">
                        {(selectedTrxForSchedule.items || []).length} jenis barang • Status Bayar:{" "}
                        <strong
                          className={
                            selectedTrxForSchedule.payment_status === "PAID"
                              ? "text-emerald-500"
                              : "text-rose-500"
                          }
                        >
                          {selectedTrxForSchedule.payment_status || "PAID"}
                        </strong>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        setForm((prev) => ({ ...prev, transaction_id: "" }));
                        setScheduleQtyMap({});
                      }}
                      className="px-2.5 py-1 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-500"
                    >
                      Ganti Nota
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={trxSearchQuery}
                        onFocus={() => setTrxDropdownOpen(true)}
                        onChange={(e) => {
                          setTrxSearchQuery(e.target.value);
                          setTrxDropdownOpen(true);
                        }}
                        placeholder="Ketik nama pelanggan, nomor HP, nomor nota (INV-...), atau nama barang..."
                        className="w-full pl-9 pr-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>

                    {trxDropdownOpen && (
                      <div className="mt-1 max-h-56 overflow-y-auto rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] divide-y divide-[var(--border)] shadow-lg">
                        {filteredScheduleTransactions.length > 0 ? (
                          filteredScheduleTransactions.slice(0, 40).map((t) => {
                            const totalItems = (t.items || []).length;
                            const remUnits = (t.items || []).reduce(
                              (acc, it) => acc + Math.max(0, it.qty - (it.delivered_qty || 0)),
                              0
                            );
                            const paidAmt = (t.payments || []).reduce(
                              (s, p) => s + p.amount,
                              0
                            );
                            const remBill = Math.max(0, (t.total || 0) - paidAmt);

                            return (
                              <button
                                key={t.ID}
                                type="button"
                                onClick={() => selectTransactionForSchedule(t)}
                                className="w-full text-left p-3 hover:bg-amber-500/10 transition-colors flex items-start justify-between gap-3"
                              >
                                <div className="min-w-0 space-y-0.5">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="font-mono font-bold text-xs text-amber-500">
                                      {t.transaction_no}
                                    </span>
                                    <span className="text-xs font-bold text-[var(--text-primary)]">
                                      {t.customer?.name || "Pelanggan"}
                                    </span>
                                    {t.customer?.phone && (
                                      <span className="text-xs font-mono text-[var(--text-secondary)]">
                                        • {t.customer.phone}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs text-[var(--text-muted)] truncate">
                                    {t.customer?.address || "Alamat belum diisi"}
                                  </div>
                                  <div className="text-xs text-[var(--text-secondary)] flex items-center gap-2 flex-wrap pt-0.5">
                                    <span className="font-mono">
                                      {totalItems} jenis barang ({remUnits} unit belum dikirim)
                                    </span>
                                    {remBill > 0 ? (
                                      <span className="text-rose-500 font-bold">
                                        • Sisa Tagihan: {formatRupiah(remBill)}
                                      </span>
                                    ) : (
                                      <span className="text-emerald-500 font-bold">
                                        • LUNAS
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <span className="px-2.5 py-1 rounded text-xs font-semibold bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] shrink-0">
                                  Pilih
                                </span>
                              </button>
                            );
                          })
                        ) : (
                          <div className="p-4 text-center text-xs text-[var(--text-muted)]">
                            Tidak ada nota transaksi yang cocok dengan pencarian.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Pengaturan Kuantitas Barang + Search Bar Barang untuk Nota dengan Banyak Item */}
              {selectedTrxForSchedule && (selectedTrxForSchedule.items || []).length > 0 && (
                <div className="p-3.5 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-xs font-bold text-[var(--text-primary)]">
                      2. Daftar Barang dalam Nota ({(selectedTrxForSchedule.items || []).length} Jenis)
                    </span>
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          const allMap: Record<number, number> = {};
                          (selectedTrxForSchedule.items || []).forEach((it) => {
                            allMap[it.product_id] = Math.max(
                              0,
                              it.qty - (it.delivered_qty || 0)
                            );
                          });
                          setScheduleQtyMap(allMap);
                        }}
                        className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-amber-500 hover:border-amber-500"
                      >
                        Isi Semua Sisa
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const zeroMap: Record<number, number> = {};
                          (selectedTrxForSchedule.items || []).forEach((it) => {
                            zeroMap[it.product_id] = 0;
                          });
                          setScheduleQtyMap(zeroMap);
                        }}
                        className="px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-xs font-semibold text-[var(--text-secondary)] hover:text-rose-500"
                      >
                        Nolkan (0) Semua
                      </button>
                    </div>
                  </div>

                  {/* Search Input untuk Mencari Barang di Dalam Nota Besar */}
                  {(selectedTrxForSchedule.items || []).length > 3 && (
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                      <input
                        type="text"
                        value={itemSearchQuery}
                        onChange={(e) => setItemSearchQuery(e.target.value)}
                        placeholder="Cari nama barang / SKU di dalam nota ini..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                    {selectedTrxForSchedule.items
                      ?.filter((it) => {
                        const q = itemSearchQuery.trim().toLowerCase();
                        if (!q) return true;
                        return (
                          (it.product?.name || "").toLowerCase().includes(q) ||
                          (it.product?.sku || "").toLowerCase().includes(q)
                        );
                      })
                      .map((it) => {
                        const delivered = it.delivered_qty || 0;
                        const rem = Math.max(0, it.qty - delivered);
                        const val =
                          scheduleQtyMap[it.product_id] !== undefined
                            ? scheduleQtyMap[it.product_id]
                            : rem;
                        return (
                          <div
                            key={it.ID}
                            className="flex items-center justify-between gap-3 p-2.5 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                {it.product?.name || `Produk #${it.product_id}`}
                              </div>
                              <div className="text-xs font-mono text-[var(--text-muted)]">
                                Pesanan: {it.qty} • Terkirim: {delivered} • Sisa:{" "}
                                <strong className="text-amber-500">{rem} unit</strong>
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={rem}
                                value={val}
                                onChange={(e) => {
                                  const num = Math.max(
                                    0,
                                    Math.min(rem, Number(e.target.value) || 0)
                                  );
                                  setScheduleQtyMap((prev) => ({
                                    ...prev,
                                    [it.product_id]: num,
                                  }));
                                }}
                                className="w-16 px-2 py-1 text-center font-mono text-xs font-bold bg-[var(--bg-sunken)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                              />
                              <span className="text-xs text-[var(--text-muted)]">
                                / {rem}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tugaskan Karyawan / Driver *
                  </label>
                  <select
                    value={form.driver_id}
                    onChange={(e) => setForm({ ...form, driver_id: e.target.value })}
                    required
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  >
                    <option value="">-- Pilih Petugas Pengiriman --</option>
                    {drivers.map((drv) => (
                      <option key={drv.ID} value={drv.ID}>
                        {drv.name} ({drv.role?.name})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Tanggal Jadwal Pengiriman
                  </label>
                  <input
                    type="date"
                    value={form.scheduled_date}
                    onChange={(e) => setForm({ ...form, scheduled_date: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Alamat Lengkap Tujuan *
                </label>
                <textarea
                  rows={2}
                  required
                  value={form.address}
                  onChange={(e) => setForm({ ...form, address: e.target.value })}
                  placeholder="Alamat tujuan pengiriman barang..."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              {shippingEnabled && (
                <div>
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                    Ongkos Kirim / Ongkir (Rp — Opsional sesuai Pengaturan Owner)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={form.shipping_cost}
                    onChange={(e) => setForm({ ...form, shipping_cost: e.target.value })}
                    className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan untuk Kurir & Koordinasi Tagihan
                </label>
                <input
                  type="text"
                  value={form.note}
                  onChange={(e) => setForm({ ...form, note: e.target.value })}
                  placeholder="Patokan rumah, instruksi bongkar muat, atau titip tagih sisa pelunasan..."
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
                  Terbitkan Jadwal
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 2: Upload Foto Bukti (Mode PICKUP = Persiapan Barang, Mode DROPOFF = Selesai Serah Terima + Qty Aktual) */}
      {proofTarget && proofModalMode && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <Camera
                    className={`w-4 h-4 ${
                      proofModalMode === "PICKUP" ? "text-amber-500" : "text-emerald-500"
                    }`}
                  />
                  {proofModalMode === "PICKUP"
                    ? `Foto Bukti Persiapan & Muat Barang (${proofTarget.delivery_no})`
                    : `Bukti Serah Terima / POD & Konfirmasi Barang (${proofTarget.delivery_no})`}
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  {proofModalMode === "PICKUP"
                    ? "Wajib foto barang yang sudah disiapkan/dimuat ke kendaraan sebelum berangkat."
                    : "Konfirmasi jumlah aktual barang yang diterima pelanggan & unggah foto bukti POD."}
                </p>
              </div>
              <button
                onClick={closeProofModal}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitProof} className="p-6 space-y-4 overflow-y-auto">
              {proofModalMode === "DROPOFF" && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Nama Penerima Barang di Lokasi *
                    </label>
                    <input
                      type="text"
                      required
                      value={proofReceiver}
                      onChange={(e) => setProofReceiver(e.target.value)}
                      placeholder="Contoh: Bpk. Andi (Pemilik Rumah)"
                      className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  {/* Konfirmasi Jumlah Barang Aktual Diterima (Antisipasi Barang Tidak Lengkap / Ditolak Sebagian) */}
                  <div className="p-3.5 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-[var(--text-primary)]">
                        Jumlah Barang Aktual Diterima Pelanggan
                      </span>
                      <span className="text-xs text-[var(--text-muted)]">
                        Ubah jika kurang/tidak lengkap
                      </span>
                    </div>
                    <div className="space-y-2">
                      {(proofTarget.items || []).map((it) => {
                        const curVal =
                          actualDeliveredMap[it.product_id] !== undefined
                            ? actualDeliveredMap[it.product_id]
                            : it.qty;
                        const isLess = curVal < it.qty;
                        return (
                          <div
                            key={it.ID}
                            className="flex items-center justify-between gap-3 p-2 rounded-lg bg-[var(--bg-surface)] border border-[var(--border)]"
                          >
                            <div className="min-w-0">
                              <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                {it.product?.name || `Produk #${it.product_id}`}
                              </div>
                              <div className="text-xs font-mono text-[var(--text-muted)]">
                                Dimuat di Surat Jalan: <strong>{it.qty} unit</strong>
                                {isLess && (
                                  <span className="text-amber-500 ml-1.5">
                                    (Kurang {it.qty - curVal} unit)
                                  </span>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <input
                                type="number"
                                min={0}
                                max={it.qty}
                                value={curVal}
                                onChange={(e) => {
                                  const num = Math.max(
                                    0,
                                    Math.min(it.qty, Number(e.target.value) || 0)
                                  );
                                  setActualDeliveredMap((prev) => ({
                                    ...prev,
                                    [it.product_id]: num,
                                  }));
                                }}
                                className="w-16 px-2 py-1 text-center font-mono text-xs font-bold bg-[var(--bg-sunken)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                              />
                              <span className="text-xs text-[var(--text-muted)]">
                                / {it.qty}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className="text-xs text-[var(--text-muted)]">
                      * Stok gudang hanya dipotong sebesar jumlah aktual yang diterima. Jika kurang kirim, nota otomatis berstatus{" "}
                      <strong className="text-amber-500">Kurang Kirim</strong> agar Admin bisa menjadwalkan pengiriman susulan.
                    </p>
                  </div>
                </>
              )}

              {/* Upload Foto Bukti */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                    {proofModalMode === "PICKUP"
                      ? "Foto Barang Siap / Dimuat di Armada (Wajib, maks. 5 foto) *"
                      : "Foto Bukti Serah Terima (Wajib, maks. 5 foto) *"}
                  </label>
                  <span className="text-xs text-[var(--text-muted)] font-mono">
                    {proofPhotos.length}/5 foto
                  </span>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  multiple
                  onChange={handleSelectProofFiles}
                  className="hidden"
                />

                <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5">
                  {proofPhotos.map((p, idx) => (
                    <div
                      key={idx}
                      className="relative aspect-square rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-sunken)]"
                    >
                      <img
                        src={p.preview}
                        alt="Preview Bukti"
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => removeProofPhoto(idx)}
                        className="absolute top-1 right-1 p-1 rounded bg-slate-950/80 text-rose-500 hover:bg-slate-950"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {proofPhotos.length < 5 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 flex flex-col items-center justify-center gap-1 text-amber-500 transition-colors"
                    >
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-xs font-semibold">Ambil Foto</span>
                    </button>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  {proofModalMode === "PICKUP"
                    ? "Catatan Kondisi Barang Saat Dimuat (Opsional)"
                    : "Catatan Kondisi Barang / Serah Terima"}
                </label>
                <textarea
                  rows={2}
                  value={proofNote}
                  onChange={(e) => setProofNote(e.target.value)}
                  placeholder={
                    proofModalMode === "PICKUP"
                      ? "Contoh: Barang sudah dicek mulus, diikat aman di bak mobil."
                      : "Contoh: Barang diterima lengkap dalam kondisi baik di ruang tamu."
                  }
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={closeProofModal}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={proofSaving || proofPhotos.length === 0}
                  className={`px-4 py-2 text-xs font-semibold rounded-lg text-black disabled:opacity-50 flex items-center gap-1.5 ${
                    proofModalMode === "PICKUP"
                      ? "bg-amber-500 hover:bg-amber-400"
                      : "bg-emerald-500 hover:bg-emerald-600"
                  }`}
                >
                  {proofSaving ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {proofModalMode === "PICKUP"
                    ? "Simpan Foto & Berangkat Antar"
                    : "Konfirmasi Selesai & Potong Stok"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal 3: Koordinasi Pelunasan Tagihan di Lokasi (Kurir / Admin) + Wajib Foto Bukti Bayar */}
      {billModalDeliv && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <CreditCard className="w-4 h-4 text-amber-500" />
                  Koordinasi Pelunasan Tagihan ({billModalDeliv.transaction?.transaction_no})
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Catat pelunasan tagihan yang diterima kurir/admin beserta foto bukti bayar.
                </p>
              </div>
              <button
                onClick={() => {
                  clearBillProof();
                  setBillModalDeliv(null);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleBillSettlementSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Metode Pelunasan di Lokasi
                </label>
                <select
                  value={billMethod}
                  onChange={(e) => setBillMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                >
                  <option value="CASH">Tunai (Dititipkan ke Kurir)</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="DEBIT">Kartu Debit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nominal Pembayaran Diterima (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={billAmt}
                  onChange={(e) => setBillAmt(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text-primary)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>Foto Bukti Pembayaran / Uang Tunai / Struk Transfer *</span>
                  </label>
                  <span className="text-xs font-semibold px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20">Wajib</span>
                </div>

                <input
                  ref={billFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleSelectBillProof}
                  className="hidden"
                />

                {billProofPreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-sunken)]">
                    <img
                      src={billProofPreview}
                      alt="Preview Bukti Pelunasan"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearBillProof}
                      className="absolute top-1.5 right-1.5 px-2 py-1 rounded bg-slate-950/85 text-rose-500 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Ganti
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => billFileRef.current?.click()}
                    className="w-full py-3 px-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 flex items-center justify-center gap-2 text-amber-500 transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-xs font-semibold">
                      Ambil Foto Bukti Pembayaran di Lokasi
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Koordinasi Kurir & Admin
                </label>
                <input
                  type="text"
                  value={billNote}
                  onChange={(e) => setBillNote(e.target.value)}
                  placeholder="Contoh: Uang tunai diterima kurir Budi, diserahkan ke kasir sore ini"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearBillProof();
                    setBillModalDeliv(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={billSaving}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {billSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Pelunasan & Bukti Bayar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
