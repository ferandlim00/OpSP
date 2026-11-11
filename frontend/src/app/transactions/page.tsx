"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { isAuthenticated } from "@/lib/auth";
import Sidebar from "@/components/layout/Sidebar";
import Navbar from "@/components/layout/Navbar";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import { formatRupiah } from "@/utils/formatters";
import { Product } from "@/types/product";
import { Transaction, CustomerRef } from "@/types/transaction";
import {
  ShoppingCart,
  Search,
  Plus,
  Minus,
  Trash2,
  Loader2,
  Receipt,
  CheckCircle2,
  User,
  Phone,
  Package,
  X,
  CreditCard,
  MessageCircle,
  RotateCcw,
  AlertTriangle,
  UserPlus,
  MapPin,
  Camera,
  ImagePlus,
  Truck,
} from "lucide-react";

interface CartItem {
  product: Product;
  qty: number;
  dealPrice: number; // Harga deal/negosiasi di kasir per unit
  discount: number;
}

export default function TransactionsPage() {
  const router = useRouter();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [activeTab, setActiveTab] = useState<"POS" | "HISTORY">("POS");

  // Data Master & Riwayat
  const [products, setProducts] = useState<Product[]>([]);
  const [customers, setCustomers] = useState<CustomerRef[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [historySearch, setHistorySearch] = useState("");

  // State Kasir (POS)
  const [searchProduct, setSearchProduct] = useState("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [customerQuery, setCustomerQuery] = useState<string>("");
  const [customerDropdownOpen, setCustomerDropdownOpen] = useState(false);
  const [orderDiscount, setOrderDiscount] = useState<string>("0");
  const [paymentMethod, setPaymentMethod] = useState<string>("CASH");
  const [paymentType, setPaymentType] = useState<"FULL" | "DP">("FULL");
  const [dpAmount, setDpAmount] = useState<string>("");
  const [note, setNote] = useState("");
  const [checkoutProofFile, setCheckoutProofFile] = useState<File | null>(null);
  const [checkoutProofPreview, setCheckoutProofPreview] = useState<string>("");
  const checkoutFileRef = useRef<HTMLInputElement | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Modal Pelunasan Cicilan/DP + Upload Bukti Pembayaran
  const [payModalTrx, setPayModalTrx] = useState<Transaction | null>(null);
  const [addPayAmt, setAddPayAmt] = useState<string>("");
  const [addPayMethod, setAddPayMethod] = useState<string>("CASH");
  const [addPayNote, setAddPayNote] = useState<string>("");
  const [addPayProofFile, setAddPayProofFile] = useState<File | null>(null);
  const [addPayProofPreview, setAddPayProofPreview] = useState<string>("");
  const addPayFileRef = useRef<HTMLInputElement | null>(null);
  const [payingSaving, setPayingSaving] = useState(false);

  // Modal Tukar Barang (EXCHANGE) / Pengembalian Barang (RETURN)
  const [retModalTrx, setRetModalTrx] = useState<Transaction | null>(null);
  const [retAction, setRetAction] = useState<"EXCHANGE" | "RETURN">("EXCHANGE");
  const [retCondition, setRetCondition] = useState<"GOOD" | "DAMAGED">("GOOD");
  const [retReason, setRetReason] = useState<string>("");
  const [retQtyMap, setRetQtyMap] = useState<Record<number, number>>({});
  const [retSaving, setRetSaving] = useState(false);

  // Modal / Form Cepat Tambah Pelanggan Baru Langsung di Kasir (Quick-Add Customer)
  const [isNewCustOpen, setIsNewCustOpen] = useState(false);
  const [newCustSaving, setNewCustSaving] = useState(false);
  const [newCustForm, setNewCustForm] = useState({
    name: "",
    phone: "",
    address: "",
    note: "",
  });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [prodRes, custRes, trxRes] = await Promise.allSettled([
        api.get("/products?limit=100&status=active"),
        api.get("/customers"),
        api.get("/transactions"),
      ]);

      if (
        prodRes.status === "fulfilled" &&
        prodRes.value.data?.success &&
        prodRes.value.data?.data?.items
      ) {
        setProducts(prodRes.value.data.data.items);
      } else {
        setProducts([]);
      }

      if (
        custRes.status === "fulfilled" &&
        custRes.value.data?.success &&
        custRes.value.data?.data
      ) {
        setCustomers(custRes.value.data.data);
      } else {
        setCustomers([]);
      }

      if (
        trxRes.status === "fulfilled" &&
        trxRes.value.data?.success &&
        trxRes.value.data?.data
      ) {
        setTransactions(trxRes.value.data.data);
      } else {
        setTransactions([]);
      }
    } catch (error) {
      console.error("Gagal memuat data kasir:", error);
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

  // Tambah produk ke keranjang (harga deal diisi/diedit di kasir)
  const addToCart = (product: Product) => {
    if (product.stock <= 0) {
      alert(`Stok "${product.name}" habis.`);
      return;
    }

    setCart((prev) => {
      const existing = prev.find((item) => item.product.ID === product.ID);
      if (existing) {
        if (existing.qty + 1 > product.stock) {
          alert(`Maksimal stok tersedia: ${product.stock}`);
          return prev;
        }
        return prev.map((item) =>
          item.product.ID === product.ID ? { ...item, qty: item.qty + 1 } : item
        );
      }
      return [
        ...prev,
        {
          product,
          qty: 1,
          dealPrice: product.price_sell > 0 ? product.price_sell : 0,
          discount: 0,
        },
      ];
    });
  };

  // Ubah kuantitas item di keranjang
  const updateQty = (productId: number, delta: number) => {
    setCart((prev) =>
      prev
        .map((item) => {
          if (item.product.ID !== productId) return item;
          const nextQty = item.qty + delta;
          if (nextQty > item.product.stock) {
            alert(`Stok maksimal hanya ${item.product.stock}`);
            return item;
          }
          return { ...item, qty: nextQty };
        })
        .filter((item) => item.qty > 0)
    );
  };

  // Ubah harga deal/negosiasi per unit di kasir
  const updateDealPrice = (productId: number, priceVal: string) => {
    const cleaned = priceVal.replace(/[^0-9]/g, "");
    const num = cleaned === "" ? 0 : Number(cleaned);
    setCart((prev) =>
      prev.map((item) =>
        item.product.ID === productId ? { ...item, dealPrice: num } : item
      )
    );
  };

  const removeFromCart = (productId: number) => {
    setCart((prev) => prev.filter((item) => item.product.ID !== productId));
  };

  const subtotalGross = cart.reduce(
    (acc, item) => acc + Math.max(0, item.dealPrice * item.qty - item.discount),
    0
  );
  const discountNum = Number(orderDiscount) || 0;
  const grandTotal = Math.max(0, subtotalGross - discountNum);

  const selectedCustomer = customers.find(
    (c) => String(c.ID) === selectedCustomerId
  );

  const filteredCustomers = customers.filter((c) => {
    const q = customerQuery.trim().toLowerCase();
    if (!q) return true;
    return (
      c.name.toLowerCase().includes(q) ||
      (c.phone && c.phone.toLowerCase().includes(q)) ||
      (c.customer_code && c.customer_code.toLowerCase().includes(q))
    );
  });

  const handleSelectCheckoutProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (checkoutProofPreview) URL.revokeObjectURL(checkoutProofPreview);
    setCheckoutProofFile(file);
    setCheckoutProofPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearCheckoutProof = () => {
    if (checkoutProofPreview) URL.revokeObjectURL(checkoutProofPreview);
    setCheckoutProofFile(null);
    setCheckoutProofPreview("");
  };

  // Simpan Transaksi (Wajib Bukti Pembayaran saat Bayar Lunas maupun DP)
  const handleCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cart.length === 0) {
      alert("Keranjang belanja masih kosong.");
      return;
    }
    if (!selectedCustomerId) {
      alert("Pilih pelanggan terlebih dahulu (cari nama atau nomor HP).");
      return;
    }
    const invalidPriceItem = cart.find((item) => !item.dealPrice || item.dealPrice <= 0);
    if (invalidPriceItem) {
      alert(
        `Masukkan Harga Deal (Rp) untuk produk "${invalidPriceItem.product.name}" di keranjang terlebih dahulu.`
      );
      return;
    }

    const amountPaid =
      paymentType === "DP" ? Number(dpAmount) || 0 : grandTotal;

    if (amountPaid > 0 && !checkoutProofFile) {
      alert(
        "Wajib melampirkan Foto Bukti Pembayaran (struk transfer / QRIS / kuitansi tunai) untuk pembayaran Lunas maupun DP!"
      );
      return;
    }

    setSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("customer_id", String(selectedCustomerId));
      fd.append("discount", String(discountNum));
      fd.append("note", note.trim());
      fd.append("payment_method", paymentMethod);
      fd.append("payment_type", paymentType);
      fd.append("amount_paid", String(amountPaid));
      fd.append(
        "items",
        JSON.stringify(
          cart.map((item) => ({
            product_id: item.product.ID,
            qty: item.qty,
            price: item.dealPrice,
            discount: item.discount,
          }))
        )
      );
      if (checkoutProofFile) {
        fd.append("proof_photo", checkoutProofFile);
      }

      const idemKey = `TRX-${selectedCustomerId}-${grandTotal}-${cart
        .map((c) => `${c.product.ID}:${c.qty}`)
        .join(",")}`;

      await api.post("/transactions", fd, {
        headers: {
          "Content-Type": "multipart/form-data",
          "X-Idempotency-Key": idemKey,
        },
      });

      setCart([]);
      setSelectedCustomerId("");
      setCustomerQuery("");
      setOrderDiscount("0");
      setPaymentType("FULL");
      setDpAmount("");
      setNote("");
      clearCheckoutProof();
      await fetchData();
      setActiveTab("HISTORY");
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal memproses transaksi");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectAddPayProof = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (addPayProofPreview) URL.revokeObjectURL(addPayProofPreview);
    setAddPayProofFile(file);
    setAddPayProofPreview(URL.createObjectURL(file));
    e.target.value = "";
  };

  const clearAddPayProof = () => {
    if (addPayProofPreview) URL.revokeObjectURL(addPayProofPreview);
    setAddPayProofFile(null);
    setAddPayProofPreview("");
  };

  const handleAddPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalTrx) return;
    const amt = Number(addPayAmt) || 0;
    if (amt <= 0) {
      alert("Masukkan nominal pembayaran.");
      return;
    }
    if (!addPayProofFile) {
      alert("Wajib mengunggah Foto Bukti Pembayaran / Pelunasan!");
      return;
    }

    setPayingSaving(true);
    try {
      const fd = new FormData();
      fd.append("amount", String(amt));
      fd.append("method", addPayMethod);
      fd.append("payment_type", "FULL");
      fd.append("note", addPayNote.trim() || "Pelunasan tagihan nota");
      fd.append("proof_photo", addPayProofFile);

      await api.post(`/transactions/${payModalTrx.ID}/payments`, fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      clearAddPayProof();
      setPayModalTrx(null);
      setAddPayAmt("");
      setAddPayNote("");
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal mencatat pembayaran");
    } finally {
      setPayingSaving(false);
    }
  };

  // Buka Modal Tukar Barang / Pengembalian Barang
  const openReturnExchangeModal = (trx: Transaction) => {
    setRetModalTrx(trx);
    setRetAction("EXCHANGE");
    setRetCondition("GOOD");
    setRetReason("");
    const initMap: Record<number, number> = {};
    (trx.items || []).forEach((it) => {
      initMap[it.product_id] = 0;
    });
    setRetQtyMap(initMap);
  };

  const handleReturnExchangeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!retModalTrx) return;

    const itemsPayload = Object.entries(retQtyMap)
      .map(([pid, qty]) => ({ product_id: Number(pid), qty: Number(qty) || 0 }))
      .filter((it) => it.qty > 0);

    if (itemsPayload.length === 0) {
      alert("Masukkan minimal 1 unit barang yang akan ditukar atau dikembalikan.");
      return;
    }

    setRetSaving(true);
    try {
      await api.post(`/transactions/${retModalTrx.ID}/return-exchange`, {
        action: retAction,
        item_condition: retCondition,
        reason: retReason,
        items: itemsPayload,
      });
      setRetModalTrx(null);
      await fetchData();
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal memproses retur / tukar barang");
    } finally {
      setRetSaving(false);
    }
  };

  // Simpan Pelanggan Baru Langsung dari Kasir & Otomatis Pilih di Keranjang
  const handleQuickAddCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCustForm.name.trim() || !newCustForm.phone.trim()) {
      alert("Nama pelanggan dan nomor HP wajib diisi.");
      return;
    }

    setNewCustSaving(true);
    try {
      const res = await api.post("/customers", {
        name: newCustForm.name.trim(),
        phone: newCustForm.phone.trim(),
        address: newCustForm.address.trim(),
        note: newCustForm.note.trim(),
      });
      if (res.data?.success && res.data?.data) {
        const created: CustomerRef = res.data.data;
        setCustomers((prev) => [created, ...prev]);
        setSelectedCustomerId(String(created.ID));
        setCustomerQuery("");
        setCustomerDropdownOpen(false);
        setIsNewCustOpen(false);
        setNewCustForm({ name: "", phone: "", address: "", note: "" });
      }
    } catch (err: any) {
      alert(err.response?.data?.message || "Gagal menambahkan pelanggan baru");
    } finally {
      setNewCustSaving(false);
    }
  };

  const sendWhatsAppInvoice = (trx: Transaction) => {
    const rawPhone = trx.customer?.phone || "";
    const digits = rawPhone.replace(/[^0-9]/g, "");
    const waPhone = digits.startsWith("0")
      ? "62" + digits.slice(1)
      : digits;

    const paidSum = (trx.payments || []).reduce((s, p) => s + p.amount, 0);
    const remaining = Math.max(0, trx.total - paidSum);

    const itemLines = (trx.items || [])
      .map(
        (it) =>
          `- ${it.product?.name || "Produk"} (${it.qty}x @ ${formatRupiah(it.price)}) = ${formatRupiah(it.subtotal)}`
      )
      .join("\n");

    const text = [
      `*NOTA PEMBELIAN — PropertiERP*`,
      `No. Nota: *${trx.transaction_no}*`,
      `Pelanggan: ${trx.customer?.name || "-"}`,
      `Status Bayar: *${trx.payment_status}*`,
      ``,
      `*Rincian Pesanan:*`,
      itemLines,
      ``,
      `Total Tagihan: *${formatRupiah(trx.total)}*`,
      `Sudah Dibayar: *${formatRupiah(paidSum)}*`,
      remaining > 0 ? `Sisa Tagihan: *${formatRupiah(remaining)}*` : `Status: *LUNAS*`,
      `Terima kasih atas kepercayaan Anda!`,
    ].join("\n");

    const url = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(text)}`
      : `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, "_blank");
  };

  const filteredProducts = products.filter((p) => {
    const q = searchProduct.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      (p.sku && p.sku.toLowerCase().includes(q))
    );
  });

  const filteredTransactions = transactions.filter((trx) => {
    const q = historySearch.trim().toLowerCase();
    if (!q) return true;
    const matchNo = trx.transaction_no.toLowerCase().includes(q);
    const matchCust =
      (trx.customer?.name || "").toLowerCase().includes(q) ||
      (trx.customer?.phone || "").toLowerCase().includes(q);
    const matchItem = (trx.items || []).some((it) =>
      (it.product?.name || "").toLowerCase().includes(q)
    );
    return matchNo || matchCust || matchItem;
  });

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[var(--bg-base)] text-[var(--text-primary)] flex transition-colors duration-200">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        <Navbar onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />

        <main className="flex-1 p-4 lg:p-8 max-w-7xl w-full mx-auto space-y-6">
          {/* Header & Tab Switcher */}
          <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--border)]">
            <div>
              <h1 className="text-xl font-bold tracking-tight text-[var(--text-primary)] flex items-center gap-2">
                <ShoppingCart className="w-5 h-5 text-amber-500" />
                <span>Kasir & Transaksi</span>
              </h1>
              <p className="text-xs text-[var(--text-secondary)] font-medium mt-0.5 max-w-2xl">
                Wajib bukti pembayaran untuk Lunas maupun DP, terintegrasi langsung dengan koordinasi tagihan Kurir & Admin.
              </p>
            </div>

            <div className="flex items-center gap-2 bg-[var(--bg-surface)] p-1 rounded-lg border border-[var(--border)]">
              <button
                onClick={() => setActiveTab("POS")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === "POS"
                    ? "bg-amber-500 text-black font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Mesin Kasir (POS)
              </button>
              <button
                onClick={() => setActiveTab("HISTORY")}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
                  activeTab === "HISTORY"
                    ? "bg-amber-500 text-black font-semibold"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                Riwayat Nota ({transactions.length})
              </button>
            </div>
          </header>

          {loading ? (
            <div className="p-12 flex flex-col items-center justify-center gap-2 text-[var(--text-muted)]">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs font-medium">Memuat data kasir...</span>
            </div>
          ) : activeTab === "POS" ? (
            /* ── TAB 1: MESIN KASIR (POS) ── */
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Kiri: Daftar Produk */}
              <section className="lg:col-span-2 space-y-4">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={searchProduct}
                    onChange={(e) => setSearchProduct(e.target.value)}
                    placeholder="Cari nama produk atau SKU untuk ditambahkan ke keranjang..."
                    className="w-full pl-10 pr-4 py-2.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-xl text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[65vh] overflow-y-auto pr-1">
                  {filteredProducts.map((p) => {
                    const outOfStock = p.stock <= 0;
                    const hasRefPrice = p.price_sell && p.price_sell > 0;

                    return (
                      <button
                        key={p.ID}
                        type="button"
                        disabled={outOfStock}
                        onClick={() => addToCart(p)}
                        className={`text-left p-3.5 rounded-xl border transition-all flex flex-col justify-between gap-2 ${
                          outOfStock
                            ? "bg-[var(--bg-sunken)] border-[var(--border)] opacity-60 cursor-not-allowed"
                            : "bg-[var(--bg-surface)] border-[var(--border)] hover:border-amber-500/50"
                        }`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-xs font-bold text-[var(--text-primary)] line-clamp-1">
                              {p.name}
                            </h3>
                            <span
                              className={`px-1.5 py-0.5 rounded text-xs font-mono font-semibold shrink-0 ${
                                outOfStock
                                  ? "bg-rose-500/10 text-rose-500"
                                  : "bg-[var(--bg-sunken)] text-[var(--text-secondary)]"
                              }`}
                            >
                              Stok: {p.stock}
                            </span>
                          </div>
                          <p className="text-xs font-mono text-[var(--text-muted)] mt-0.5">
                            {p.sku}
                          </p>
                        </div>

                        <div className="pt-2 border-t border-[var(--border)] flex items-center justify-between">
                          <div className="flex flex-col">
                            <span className="text-xs text-[var(--text-muted)]">
                              Harga Katalog (Acuan)
                            </span>
                            <span className="text-xs font-bold text-amber-500 font-mono">
                              {hasRefPrice ? formatRupiah(p.price_sell) : "Input di Kasir"}
                            </span>
                          </div>
                          <span className="p-1.5 rounded bg-amber-500/10 text-amber-500">
                            <Plus className="w-3.5 h-3.5" />
                          </span>
                        </div>
                      </button>
                    );
                  })}

                  {filteredProducts.length === 0 && (
                    <div className="col-span-full py-16 px-6 text-center text-xs text-[var(--text-secondary)] bg-[var(--bg-surface)] rounded-xl border border-[var(--border)]">
                      Produk tidak ditemukan. Pastikan sudah menambahkan produk aktif di menu Katalog Produk.
                    </div>
                  )}
                </div>
              </section>

              {/* Kanan: Keranjang & Checkout */}
              <section className="p-5 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] flex flex-col justify-between space-y-5 h-fit">
                <div className="space-y-4">
                  <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2 border-b border-[var(--border)] pb-3">
                    <Receipt className="w-4 h-4 text-amber-500" />
                    Keranjang Belanja ({cart.length})
                  </h2>

                  {/* Daftar Item di Keranjang */}
                  <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                    {cart.map((item) => (
                      <div
                        key={item.product.ID}
                        className="p-3 rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <p className="text-xs font-bold text-[var(--text-primary)]">
                              {item.product.name}
                            </p>
                            <p className="text-xs font-mono text-[var(--text-muted)]">
                              {item.product.sku} • Acuan:{" "}
                              {item.product.price_sell > 0
                                ? formatRupiah(item.product.price_sell)
                                : "-"}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeFromCart(item.product.ID)}
                            className="text-[var(--text-muted)] hover:text-rose-500 p-1"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                            Harga Deal / Satuan di Kasir (Rp) *
                          </label>
                          <input
                            type="text"
                            inputMode="numeric"
                            value={item.dealPrice > 0 ? item.dealPrice.toLocaleString("id-ID") : ""}
                            onChange={(e) => updateDealPrice(item.product.ID, e.target.value)}
                            placeholder="Masukkan harga deal..."
                            className="w-full px-2.5 py-1.5 bg-[var(--bg-surface)] border border-[var(--border)] rounded-md text-xs font-mono font-bold text-amber-500 placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => updateQty(item.product.ID, -1)}
                              className="p-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              <Minus className="w-3 h-3" />
                            </button>
                            <span className="text-xs font-mono font-bold px-2">
                              {item.qty}
                            </span>
                            <button
                              type="button"
                              onClick={() => updateQty(item.product.ID, 1)}
                              className="p-1 rounded bg-[var(--bg-surface)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                            >
                              <Plus className="w-3 h-3" />
                            </button>
                          </div>

                          <span className="text-xs font-mono font-bold text-[var(--text-primary)]">
                            {formatRupiah(item.dealPrice * item.qty)}
                          </span>
                        </div>
                      </div>
                    ))}

                    {cart.length === 0 && (
                      <p className="text-xs text-[var(--text-muted)] text-center py-8">
                        Belum ada produk yang dipilih.
                      </p>
                    )}
                  </div>
                </div>

                {/* Form Pelanggan, Pembayaran, Bukti Bayar & Total */}
                <form onSubmit={handleCheckout} className="space-y-3 pt-3 border-t border-[var(--border)]">
                  <div className="relative">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)]">
                        Pelanggan (Cari Nama / No. HP) *
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setNewCustForm((prev) => ({
                            ...prev,
                            name: customerQuery.trim(),
                          }));
                          setIsNewCustOpen(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-bold bg-amber-500/15 text-amber-500 border border-amber-500/30 hover:bg-amber-500 hover:text-slate-950 transition-colors"
                      >
                        <UserPlus className="w-3 h-3" />
                        + Pelanggan Baru
                      </button>
                    </div>

                    {selectedCustomer ? (
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-500/10 border border-amber-500/30 rounded-lg text-xs">
                        <div className="min-w-0">
                          <div className="font-bold text-[var(--text-primary)] truncate">
                            {selectedCustomer.name}{" "}
                            <span className="font-mono text-xs text-amber-500">
                              ({selectedCustomer.customer_code})
                            </span>
                          </div>
                          <div className="text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3 text-amber-500" />
                            {selectedCustomer.phone || "-"}
                          </div>
                          {selectedCustomer.address && (
                            <div className="text-xs text-[var(--text-muted)] truncate flex items-center gap-1 mt-0.5">
                              <MapPin className="w-3 h-3 shrink-0" />
                              {selectedCustomer.address}
                            </div>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedCustomerId("");
                            setCustomerQuery("");
                          }}
                          className="p-1 text-[var(--text-muted)] hover:text-rose-500 shrink-0"
                          title="Ganti pelanggan"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div>
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                          <input
                            type="text"
                            value={customerQuery}
                            onFocus={() => setCustomerDropdownOpen(true)}
                            onChange={(e) => {
                              setCustomerQuery(e.target.value);
                              setCustomerDropdownOpen(true);
                            }}
                            placeholder="Ketik nama atau nomor HP (cth: 0812...)"
                            className="w-full pl-8 pr-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                          />
                        </div>

                        {customerDropdownOpen && (
                          <div className="mt-1 max-h-48 overflow-y-auto rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] divide-y divide-[var(--border)] shadow-lg">
                            {filteredCustomers.length > 0 ? (
                              filteredCustomers.slice(0, 30).map((c) => (
                                <button
                                  key={c.ID}
                                  type="button"
                                  onClick={() => {
                                    setSelectedCustomerId(String(c.ID));
                                    setCustomerDropdownOpen(false);
                                  }}
                                  className="w-full text-left px-3 py-2 hover:bg-amber-500/10 transition-colors flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0">
                                    <div className="text-xs font-semibold text-[var(--text-primary)] truncate">
                                      {c.name}
                                    </div>
                                    <div className="text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1">
                                      <Phone className="w-2.5 h-2.5 text-amber-500" />
                                      {c.phone || "-"}
                                    </div>
                                  </div>
                                  <span className="text-xs font-mono text-[var(--text-muted)] shrink-0">
                                    {c.customer_code}
                                  </span>
                                </button>
                              ))
                            ) : (
                              <div className="px-3 py-3 text-xs text-[var(--text-muted)] text-center space-y-2">
                                <div>Pelanggan belum terdaftar.</div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setNewCustForm((prev) => ({
                                      ...prev,
                                      name: customerQuery.trim(),
                                    }));
                                    setIsNewCustOpen(true);
                                  }}
                                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400"
                                >
                                  <UserPlus className="w-3.5 h-3.5" />
                                  Daftarkan &quot;{customerQuery || "Pelanggan Baru"}&quot; Sekarang
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Metode Bayar
                      </label>
                      <select
                        value={paymentMethod}
                        onChange={(e) => setPaymentMethod(e.target.value)}
                        className="w-full px-2.5 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="CASH">Tunai (Cash)</option>
                        <option value="TRANSFER">Transfer Bank</option>
                        <option value="QRIS">QRIS</option>
                        <option value="DEBIT">Kartu Debit</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Tipe Pembayaran
                      </label>
                      <select
                        value={paymentType}
                        onChange={(e) => setPaymentType(e.target.value as "FULL" | "DP")}
                        className="w-full px-2.5 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                      >
                        <option value="FULL">Bayar Lunas</option>
                        <option value="DP">DP (Uang Muka)</option>
                      </select>
                    </div>
                  </div>

                  {paymentType === "DP" && (
                    <div>
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                        Nominal Uang Muka / DP (Rp) *
                      </label>
                      <input
                        type="number"
                        min="1"
                        required
                        value={dpAmount}
                        onChange={(e) => setDpAmount(e.target.value)}
                        placeholder="Masukkan jumlah DP yang dibayar..."
                        className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                      />
                    </div>
                  )}

                  {/* Upload Bukti Pembayaran (Wajib untuk Bayar Lunas maupun DP) */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                        <Camera className="w-3.5 h-3.5 text-amber-500" />
                        <span>
                          Foto Bukti Pembayaran ({paymentType === "DP" ? "DP" : "Lunas"}) *
                        </span>
                      </label>
                      <span className="text-xs px-2 py-0.5 rounded bg-amber-500/10 text-amber-500 border border-amber-500/20 font-semibold">
                        Wajib
                      </span>
                    </div>

                    <input
                      ref={checkoutFileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      capture="environment"
                      onChange={handleSelectCheckoutProof}
                      className="hidden"
                    />

                    {checkoutProofPreview ? (
                      <div className="relative w-full h-28 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-sunken)]">
                        <img
                          src={checkoutProofPreview}
                          alt="Preview Bukti Pembayaran"
                          className="w-full h-full object-cover"
                        />
                        <button
                          type="button"
                          onClick={clearCheckoutProof}
                          className="absolute top-1.5 right-1.5 px-2 py-1 rounded bg-slate-950/85 text-rose-500 text-xs font-semibold flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" />
                          Ganti
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => checkoutFileRef.current?.click()}
                        className="w-full py-2.5 px-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 flex items-center justify-center gap-2 text-amber-500 transition-colors"
                      >
                        <ImagePlus className="w-4 h-4" />
                        <span className="text-xs font-semibold">
                          Upload Struk Transfer / QRIS / Bukti Bayar
                        </span>
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Potongan / Diskon Nota Tambahan (Rp)
                    </label>
                    <input
                      type="number"
                      min="0"
                      value={orderDiscount}
                      onChange={(e) => setOrderDiscount(e.target.value)}
                      className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                      Catatan Transaksi / Instruksi Pengiriman
                    </label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Misal: Pelunasan sisa tagihan dititip ke kurir saat barang sampai"
                      className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                    />
                  </div>

                  <div className="pt-2 space-y-1">
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>Subtotal Harga Deal</span>
                      <span className="font-mono">{formatRupiah(subtotalGross)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-[var(--text-secondary)]">
                      <span>Diskon Nota</span>
                      <span className="font-mono">- {formatRupiah(discountNum)}</span>
                    </div>
                    <div className="flex justify-between text-sm font-bold text-[var(--text-primary)] pt-1 border-t border-[var(--border)]">
                      <span>Total Tagihan</span>
                      <span className="font-mono text-amber-500">{formatRupiah(grandTotal)}</span>
                    </div>
                    {paymentType === "DP" && (
                      <div className="flex justify-between text-xs font-bold text-rose-500">
                        <span>Sisa Tagihan (Koordinasi Pengiriman)</span>
                        <span className="font-mono">
                          {formatRupiah(Math.max(0, grandTotal - (Number(dpAmount) || 0)))}
                        </span>
                      </div>
                    )}
                  </div>

                  <button
                    type="submit"
                    disabled={submitting || cart.length === 0}
                    className="w-full py-2.5 px-4 rounded-lg text-xs font-semibold text-black bg-amber-500 hover:bg-amber-400 disabled:opacity-50 transition-colors flex items-center justify-center gap-1.5"
                  >
                    {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                    Proses Transaksi & Simpan Bukti Bayar
                  </button>
                </form>
              </section>
            </div>
          ) : (
            /* ── TAB 2: RIWAYAT NOTA TRANSAKSI ── */
            <div className="space-y-4">
              {/* Pencarian Cepat Riwayat Nota */}
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)]">
                <div className="relative flex-1 min-w-[240px]">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)]" />
                  <input
                    type="text"
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    placeholder="Cari nomor nota, nama pelanggan, nomor HP, atau nama barang..."
                    className="w-full pl-9 pr-4 py-1.5 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                </div>
                <span className="text-xs text-[var(--text-muted)] font-mono">
                  Menampilkan {filteredTransactions.length} dari {transactions.length} nota
                </span>
              </div>

              <div className="rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] overflow-hidden shadow-xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="border-b border-[var(--border)] bg-[var(--bg-sunken)] text-[var(--text-secondary)] font-semibold">
                        <th className="px-4 py-3">No. Nota & Waktu</th>
                        <th className="px-4 py-3">Pelanggan & No. HP</th>
                        <th className="px-4 py-3">Rincian Barang & Progres Kirim</th>
                        <th className="px-4 py-3 text-right">Total & Sisa Tagihan</th>
                        <th className="px-4 py-3">Status Pesanan & Stok</th>
                        <th className="px-4 py-3">Status & Bukti Bayar</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {filteredTransactions.map((trx) => {
                        const dateStr = new Date(trx.CreatedAt).toLocaleString("id-ID", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        });
                        const paidSum = (trx.payments || []).reduce((s, p) => s + p.amount, 0);
                        const remaining = Math.max(0, trx.total - paidSum);

                        const hasDeliveredItems = (trx.items || []).some(
                          (it) => (it.delivered_qty || 0) > 0
                        );
                        const hasRemainingUndelivered = (trx.items || []).some(
                          (it) => (it.delivered_qty || 0) < it.qty
                        );
                        const isPartiallyDelivered =
                          hasDeliveredItems && hasRemainingUndelivered;

                        return (
                          <tr key={trx.ID} className="hover:bg-[var(--bg-sunken)]/50 transition-colors">
                            <td className="px-4 py-3.5">
                              <div className="font-mono font-bold text-amber-500">
                                {trx.transaction_no}
                              </div>
                              <div className="text-xs text-[var(--text-muted)] mt-0.5">
                                {dateStr}
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                                <User className="w-3.5 h-3.5 text-[var(--text-muted)]" />
                                {trx.customer?.name || `Pelanggan #${trx.customer_id}`}
                              </div>
                              {trx.customer?.phone && (
                                <div className="text-xs font-mono text-[var(--text-secondary)] flex items-center gap-1 mt-0.5">
                                  <Phone className="w-3 h-3 text-amber-500" />
                                  {trx.customer.phone}
                                </div>
                              )}
                              {trx.note && (
                                <div className="text-xs text-[var(--text-muted)] mt-0.5 max-w-xs">
                                  Catatan: {trx.note}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5 space-y-1.5">
                              {trx.items?.map((item) => {
                                const delivQty = item.delivered_qty || 0;
                                const retQty = item.returned_qty || 0;
                                return (
                                  <div key={item.ID} className="text-xs text-[var(--text-secondary)]">
                                    <div className="flex items-center gap-1.5">
                                      <Package className="w-3 h-3 text-[var(--text-muted)] shrink-0" />
                                      <span>
                                        {item.product?.name || `Produk #${item.product_id}`} ×{" "}
                                        <strong className="font-mono">{item.qty}</strong>{" "}
                                        <span className="font-mono text-[var(--text-muted)]">
                                          (@ {formatRupiah(item.price)})
                                        </span>
                                      </span>
                                    </div>
                                    <div className="pl-4 flex items-center gap-2 text-xs font-mono mt-0.5">
                                      <span
                                        className={
                                          delivQty >= item.qty && item.qty > 0
                                            ? "text-emerald-500"
                                            : delivQty > 0
                                            ? "text-amber-500"
                                            : "text-[var(--text-muted)]"
                                        }
                                      >
                                        Terkirim: {delivQty}/{item.qty}
                                      </span>
                                      {retQty > 0 && (
                                        <span className="text-rose-500">
                                          • Retur/Tukar: {retQty} unit
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </td>
                            <td className="px-4 py-3.5 text-right font-mono font-bold text-sm text-[var(--text-primary)]">
                              <div>{formatRupiah(trx.total)}</div>
                              <div className="text-xs font-normal text-emerald-500">
                                Masuk: {formatRupiah(paidSum)}
                              </div>
                              {trx.payment_status !== "PAID" && remaining > 0 && (
                                <div className="text-xs font-bold text-rose-500">
                                  Sisa Tagihan: {formatRupiah(remaining)}
                                </div>
                              )}
                            </td>
                            <td className="px-4 py-3.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
                                  trx.status === "COMPLETED"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : trx.status === "CANCELLED"
                                    ? "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                    : trx.status === "PROCESSING"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    : "bg-[var(--bg-sunken)] text-[var(--text-secondary)] border-[var(--border)]"
                                }`}
                              >
                                {trx.status === "COMPLETED" ? (
                                  "SELESAI (Stok Dipotong)"
                                ) : trx.status === "CANCELLED" ? (
                                  "DIBATALKAN / DIRETUR"
                                ) : isPartiallyDelivered ? (
                                  <>
                                    <AlertTriangle className="w-3 h-3" />
                                    KURANG KIRIM / TUKAR BARANG
                                  </>
                                ) : trx.status === "PROCESSING" ? (
                                  "DIJADWALKAN KIRIM"
                                ) : (
                                  "PENDING (Stok Ditahan)"
                                )}
                              </span>
                            </td>
                            <td className="px-4 py-3.5 space-y-1.5">
                              <span
                                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-bold border ${
                                  trx.payment_status === "PAID"
                                    ? "bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
                                    : trx.payment_status === "PARTIAL"
                                    ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                    : "bg-rose-500/10 text-rose-500 border-rose-500/20"
                                }`}
                              >
                                <CheckCircle2 className="w-3 h-3" />
                                {trx.payment_status === "PAID"
                                  ? "LUNAS"
                                  : trx.payment_status === "PARTIAL"
                                  ? "DP / BELUM LUNAS"
                                  : "BELUM BAYAR"}
                              </span>

                              {/* Daftar Bukti Pembayaran (DP maupun Lunas) */}
                              <div className="flex flex-wrap gap-1">
                                {(trx.payments || []).map((pay, idx) =>
                                  pay.proof_url ? (
                                    <a
                                      key={pay.ID || idx}
                                      href={getImageUrl(pay.proof_url)}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-[var(--bg-sunken)] border border-[var(--border)] text-xs font-semibold text-amber-500 hover:border-amber-500"
                                      title={`${pay.payment_type} (${pay.method}) - ${formatRupiah(pay.amount)}`}
                                    >
                                      <Camera className="w-2.5 h-2.5" />
                                      Bukti #{idx + 1} ({pay.payment_type})
                                    </a>
                                  ) : null
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-right space-x-1.5 whitespace-nowrap">
                              {trx.payment_status !== "PAID" && trx.status !== "CANCELLED" && (
                                <button
                                  onClick={() => {
                                    setPayModalTrx(trx);
                                    setAddPayAmt(String(remaining || trx.total));
                                    setAddPayNote("");
                                    clearAddPayProof();
                                  }}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500 text-slate-950 hover:bg-amber-400 transition-colors"
                                >
                                  <CreditCard className="w-3.5 h-3.5" />
                                  Lunasi
                                </button>
                              )}

                              {hasRemainingUndelivered && trx.status !== "CANCELLED" && (
                                <button
                                  onClick={() =>
                                    router.push(`/deliveries?trx_id=${trx.ID}`)
                                  }
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-amber-500 hover:border-amber-500/40 transition-colors"
                                  title="Langsung jadwalkan pengiriman untuk nota ini"
                                >
                                  <Truck className="w-3.5 h-3.5" />
                                  Jadwalkan Kirim
                                </button>
                              )}

                              {hasDeliveredItems && (
                                <button
                                  onClick={() => openReturnExchangeModal(trx)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-primary)] hover:border-amber-500/40 transition-colors"
                                  title="Tukar Barang atau Pengembalian Barang (Retur)"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-amber-500" />
                                  Retur / Tukar
                                </button>
                              )}

                              <button
                                onClick={() => sendWhatsAppInvoice(trx)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-primary)] hover:border-amber-500/40 transition-colors"
                                title="Kirim Nota ke WhatsApp"
                              >
                                <MessageCircle className="w-3.5 h-3.5 text-emerald-500" />
                                WA
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {filteredTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="px-6 py-12 text-center text-[var(--text-muted)]">
                            Belum ada riwayat transaksi penjualan yang sesuai pencarian.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal Pelunasan DP / Cicilan + Wajib Bukti Bayar */}
      {payModalTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <CreditCard className="w-4 h-4 text-amber-500" />
                Pelunasan Tagihan Nota {payModalTrx.transaction_no}
              </h2>
              <button
                onClick={() => {
                  clearAddPayProof();
                  setPayModalTrx(null);
                }}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleAddPayment} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Metode Pembayaran
                </label>
                <select
                  value={addPayMethod}
                  onChange={(e) => setAddPayMethod(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                >
                  <option value="CASH">Tunai (Cash)</option>
                  <option value="TRANSFER">Transfer Bank</option>
                  <option value="QRIS">QRIS</option>
                  <option value="DEBIT">Kartu Debit</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nominal Pembayaran (Rp) *
                </label>
                <input
                  type="number"
                  min="1"
                  required
                  value={addPayAmt}
                  onChange={(e) => setAddPayAmt(e.target.value)}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] font-mono"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-[var(--text-secondary)] flex items-center gap-1">
                    <Camera className="w-3.5 h-3.5 text-amber-500" />
                    <span>Foto Bukti Pelunasan (Struk / Transfer / Tunai) *</span>
                  </label>
                  <span className="text-xs font-bold text-amber-500">Wajib</span>
                </div>

                <input
                  ref={addPayFileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  capture="environment"
                  onChange={handleSelectAddPayProof}
                  className="hidden"
                />

                {addPayProofPreview ? (
                  <div className="relative w-full h-32 rounded-lg overflow-hidden border border-[var(--border)] bg-[var(--bg-sunken)]">
                    <img
                      src={addPayProofPreview}
                      alt="Bukti Pelunasan"
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={clearAddPayProof}
                      className="absolute top-1.5 right-1.5 px-2 py-1 rounded bg-slate-950/85 text-rose-500 text-xs font-semibold flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" />
                      Ganti
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => addPayFileRef.current?.click()}
                    className="w-full py-3 px-3 rounded-lg border border-dashed border-amber-500/50 bg-amber-500/5 hover:bg-amber-500/10 flex items-center justify-center gap-2 text-amber-500 transition-colors"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span className="text-xs font-semibold">
                      Ambil / Pilih Foto Bukti Pelunasan
                    </span>
                  </button>
                )}
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Pelunasan
                </label>
                <input
                  type="text"
                  value={addPayNote}
                  onChange={(e) => setAddPayNote(e.target.value)}
                  placeholder="Contoh: Diterima via transfer BCA / titipan kurir..."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => {
                    clearAddPayProof();
                    setPayModalTrx(null);
                  }}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={payingSaving}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {payingSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan Pembayaran & Bukti
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Tukar Barang (EXCHANGE) / Pengembalian Barang (RETURN) */}
      {retModalTrx && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <RotateCcw className="w-4 h-4 text-amber-500" />
                  Tukar Barang / Pengembalian Barang ({retModalTrx.transaction_no})
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Pilih mekanisme penanganan barang pasca-pengantaran beserta kondisi fisik barang.
                </p>
              </div>
              <button
                onClick={() => setRetModalTrx(null)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleReturnExchangeSubmit} className="p-6 space-y-4 overflow-y-auto">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1.5">
                  1. Pilih Jenis Layanan *
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setRetAction("EXCHANGE")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      retAction === "EXCHANGE"
                        ? "bg-amber-500/10 border-amber-500 text-[var(--text-primary)]"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <div className="text-xs font-bold text-amber-500">
                      Tukar Barang Baru (Exchange)
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Tagihan tetap. Membuka kembali antrean pengiriman agar Admin bisa menjadwalkan pengiriman unit pengganti.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setRetAction("RETURN")}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      retAction === "RETURN"
                        ? "bg-amber-500/10 border-amber-500 text-[var(--text-primary)]"
                        : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)]"
                    }`}
                  >
                    <div className="text-xs font-bold text-rose-500">
                      Pengembalian / Retur (Refund)
                    </div>
                    <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                      Tidak diganti unit baru. Kuantitas & total tagihan pada nota otomatis dikurangi.
                    </p>
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  2. Kondisi Fisik Barang yang Ditarik dari Pelanggan *
                </label>
                <select
                  value={retCondition}
                  onChange={(e) => setRetCondition(e.target.value as "GOOD" | "DAMAGED")}
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                >
                  <option value="GOOD">
                    Kondisi Bagus / Layak Jual Kembali (Otomatis tambah stok gudang / INBOUND)
                  </option>
                  <option value="DAMAGED">
                    Kondisi Rusak / Cacat (Tidak masuk stok siap jual, dicatat ADJUSTMENT di Kartu Stok)
                  </option>
                </select>
              </div>

              <div className="p-3.5 rounded-xl bg-[var(--bg-sunken)] border border-[var(--border)] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-[var(--text-primary)]">
                    3. Jumlah Unit yang Ditukar / Dikembalikan
                  </span>
                  <span className="text-xs text-[var(--text-muted)]">
                    Maks. sesuai jumlah terkirim
                  </span>
                </div>
                <div className="space-y-2">
                  {(retModalTrx.items || [])
                    .filter((it) => (it.delivered_qty || 0) > 0)
                    .map((it) => {
                      const maxDeliv = it.delivered_qty || 0;
                      const val = retQtyMap[it.product_id] || 0;
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
                              Sudah Diterima Pelanggan:{" "}
                              <strong className="text-emerald-500">{maxDeliv} unit</strong>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={maxDeliv}
                              value={val}
                              onChange={(e) => {
                                const num = Math.max(
                                  0,
                                  Math.min(maxDeliv, Number(e.target.value) || 0)
                                );
                                setRetQtyMap((prev) => ({
                                  ...prev,
                                  [it.product_id]: num,
                                }));
                              }}
                              className="w-16 px-2 py-1 text-center font-mono text-xs font-bold bg-[var(--bg-sunken)] border border-[var(--border)] rounded text-[var(--text-primary)]"
                            />
                            <span className="text-xs text-[var(--text-muted)]">
                              / {maxDeliv}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  4. Alasan Tukar Barang / Retur *
                </label>
                <input
                  type="text"
                  required
                  value={retReason}
                  onChange={(e) => setRetReason(e.target.value)}
                  placeholder="Contoh: Lecet di sudut meja saat bongkar muat / salah warna..."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)]"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRetModalTrx(null)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={retSaving}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {retSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  {retAction === "EXCHANGE"
                    ? "Proses Tukar Barang & Buka Jadwal Kirim"
                    : "Proses Retur & Koreksi Nota"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Cepat Tambah Pelanggan Baru di Kasir (Quick-Add Customer) */}
      {isNewCustOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
              <div>
                <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                  <UserPlus className="w-4 h-4 text-amber-500" />
                  Tambah Pelanggan Baru (Cepat dari Kasir)
                </h2>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5">
                  Otomatis terpilih di keranjang belanja setelah disimpan.
                </p>
              </div>
              <button
                onClick={() => setIsNewCustOpen(false)}
                className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleQuickAddCustomer} className="p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nama Lengkap Pelanggan *
                </label>
                <input
                  type="text"
                  required
                  value={newCustForm.name}
                  onChange={(e) => setNewCustForm({ ...newCustForm, name: e.target.value })}
                  placeholder="Contoh: Bpk. Hendra Wijaya"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Nomor HP / WhatsApp Aktif *
                </label>
                <input
                  type="tel"
                  required
                  value={newCustForm.phone}
                  onChange={(e) => setNewCustForm({ ...newCustForm, phone: e.target.value })}
                  placeholder="Contoh: 081234567890"
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs font-mono text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Alamat Pengiriman (Otomatis dipakai saat Jadwal Kirim)
                </label>
                <textarea
                  rows={2}
                  value={newCustForm.address}
                  onChange={(e) => setNewCustForm({ ...newCustForm, address: e.target.value })}
                  placeholder="Jl. Merdeka No. 45, RT 02/RW 05..."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                  Catatan Pelanggan (Opsional)
                </label>
                <input
                  type="text"
                  value={newCustForm.note}
                  onChange={(e) => setNewCustForm({ ...newCustForm, note: e.target.value })}
                  placeholder="Patokan rumah / preferensi pelanggan..."
                  className="w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] focus:outline-none focus:ring-1 focus:ring-amber-500"
                />
              </div>

              <div className="pt-2 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewCustOpen(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)]"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={newCustSaving}
                  className="px-4 py-2 text-xs font-bold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 flex items-center gap-1.5"
                >
                  {newCustSaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Simpan & Pilih Pelanggan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
