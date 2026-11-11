"use client";

import React, { useEffect, useRef, useState } from "react";
import api from "@/lib/api";
import { getImageUrl } from "@/lib/media";
import { formatRupiah } from "@/utils/formatters";
import {
  Product,
  ProductCategory,
  ProductImage,
  ROOM_OPTIONS,
  MAX_IMAGES,
  MAX_IMAGE_SIZE,
} from "@/types/product";
import { X, Loader2, ImagePlus, Star, Trash2, Package } from "lucide-react";

interface Props {
  open: boolean;
  product: Product | null; // null = mode tambah
  categories: ProductCategory[];
  onClose: () => void;
  onSaved: (message: string) => void;
}

interface FormState {
  name: string;
  sku: string;
  category_id: string;
  room_type: string;
  description: string;
  price_buy: string;
  price_sell: string;
  stock: string;
  min_stock: string;
  is_active: boolean;
}

const emptyForm: FormState = {
  name: "", sku: "", category_id: "", room_type: "OTHER", description: "",
  price_buy: "", price_sell: "", stock: "0", min_stock: "0", is_active: true,
};

// Foto baru yang belum diupload (mode tambah)
interface PendingFile {
  file: File;
  preview: string;
}

const inputCls =
  "w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500";
const labelCls = "block text-xs font-semibold text-[var(--text-secondary)] mb-1";

// Header multipart: wajib ditulis karena default instance axios kita = application/json
const multipartHeaders = { headers: { "Content-Type": "multipart/form-data" } };

export default function ProductFormModal({ open, product, categories, onClose, onSaved }: Props) {
  const isEdit = !!product;
  const [form, setForm] = useState<FormState>(emptyForm);
  const [pending, setPending] = useState<PendingFile[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [saving, setSaving] = useState(false);
  const [imgBusy, setImgBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Isi form saat modal dibuka
  useEffect(() => {
    if (!open) return;
    setError("");
    setPending([]);
    if (product) {
      setForm({
        name: product.name,
        sku: product.sku,
        category_id: String(product.category_id),
        room_type: product.room_type || "OTHER",
        description: product.description || "",
        price_buy: product.price_buy != null ? String(product.price_buy) : "",
        price_sell: product.price_sell && product.price_sell > 0 ? String(product.price_sell) : "",
        stock: String(product.stock),
        min_stock: String(product.min_stock),
        is_active: product.is_active,
      });
      setImages(product.images || []);
    } else {
      setForm(emptyForm);
      setImages([]);
    }
  }, [open, product]);

  // Bersihkan object URL preview saat komponen dilepas (cegah memory leak)
  const pendingRef = useRef<PendingFile[]>([]);
  pendingRef.current = pending;
  useEffect(() => {
    return () => pendingRef.current.forEach((p) => URL.revokeObjectURL(p.preview));
  }, []);

  if (!open) return null;

  const set = (k: keyof FormState, v: string | boolean) => setForm((f) => ({ ...f, [k]: v }));

  const totalImages = isEdit ? images.length : pending.length;

  // Validasi file di sisi browser (backend juga memvalidasi ulang)
  const validateFiles = (files: File[]): string | null => {
    if (totalImages + files.length > MAX_IMAGES) return `Maksimal ${MAX_IMAGES} foto per produk.`;
    for (const f of files) {
      if (!/^image\/(jpeg|png|webp)$/.test(f.type)) return `${f.name}: hanya JPG, PNG, atau WEBP.`;
      if (f.size > MAX_IMAGE_SIZE) return `${f.name}: ukuran melebihi 5MB.`;
    }
    return null;
  };

  const reloadImages = async () => {
    if (!product) return;
    const res = await api.get(`/products/${product.ID}`);
    setImages(res.data.data.images || []);
  };

  const handlePickFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    e.target.value = ""; // supaya file yang sama bisa dipilih lagi
    if (files.length === 0) return;

    const msg = validateFiles(files);
    if (msg) { setError(msg); return; }
    setError("");

    if (!isEdit) {
      // Mode tambah: simpan dulu di memori, diupload saat klik Simpan
      setPending((p) => [...p, ...files.map((file) => ({ file, preview: URL.createObjectURL(file) }))]);
      return;
    }

    // Mode edit: langsung upload ke backend
    try {
      setImgBusy(true);
      const fd = new FormData();
      files.forEach((f) => fd.append("images", f));
      await api.post(`/products/${product!.ID}/images`, fd, multipartHeaders);
      await reloadImages();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal upload foto.");
    } finally {
      setImgBusy(false);
    }
  };

  const removePending = (idx: number) => {
    setPending((p) => {
      URL.revokeObjectURL(p[idx].preview);
      return p.filter((_, i) => i !== idx);
    });
  };

  const makePendingPrimary = (idx: number) => {
    setPending((p) => [p[idx], ...p.filter((_, i) => i !== idx)]);
  };

  const deleteImage = async (img: ProductImage) => {
    if (!confirm("Hapus foto ini?")) return;
    try {
      setImgBusy(true);
      await api.delete(`/products/${product!.ID}/images/${img.ID}`);
      await reloadImages();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal menghapus foto.");
    } finally {
      setImgBusy(false);
    }
  };

  const setPrimary = async (img: ProductImage) => {
    try {
      setImgBusy(true);
      await api.put(`/products/${product!.ID}/images/${img.ID}/primary`);
      await reloadImages();
    } catch (err: any) {
      setError(err?.response?.data?.message || "Gagal mengubah foto utama.");
    } finally {
      setImgBusy(false);
    }
  };

  const handleSave = async () => {
    if (!form.name.trim()) return setError("Nama produk wajib diisi.");
    if (!form.category_id) return setError("Kategori wajib dipilih.");
    if (!isEdit && pending.length === 0) {
      return setError("Wajib mengunggah minimal 1 foto produk sesuai aturan bisnis.");
    }
    if (form.price_sell && Number(form.price_sell) < 0) return setError("Harga jual tidak boleh negatif.");

    const fd = new FormData();
    fd.append("name", form.name.trim());
    fd.append("sku", form.sku.trim());
    fd.append("category_id", form.category_id);
    fd.append("room_type", form.room_type);
    fd.append("description", form.description);
    fd.append("price_buy", (form.price_buy || "").trim());
    fd.append("price_sell", (form.price_sell || "").trim());
    fd.append("stock", form.stock || "0");
    fd.append("min_stock", form.min_stock || "0");
    fd.append("is_active", String(form.is_active));
    if (!isEdit) pending.forEach((p) => fd.append("images", p.file)); // urutan pertama = foto utama

    try {
      setSaving(true);
      setError("");
      if (isEdit) {
        await api.put(`/products/${product!.ID}`, fd, multipartHeaders);
        onSaved("Produk berhasil diperbarui.");
      } else {
        await api.post("/products", fd, multipartHeaders);
        onSaved("Produk berhasil ditambahkan.");
      }
    } catch (err: any) {
      setError(err?.response?.data?.message || "Terjadi kesalahan saat menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  const margin =
    form.price_buy && form.price_sell && Number(form.price_buy) > 0 && Number(form.price_sell) > 0
      ? Number(form.price_sell) - Number(form.price_buy)
      : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-3xl max-h-[92vh] flex flex-col bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Package className="w-4 h-4 text-amber-500" />
            {isEdit ? "Edit Produk" : "Tambah Produk Baru"}
          </h2>
          <button onClick={onClose} className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {error && (
            <p className="text-xs text-rose-500 bg-rose-500/10 border border-rose-500/20 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* ── Foto Produk ── */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className={labelCls + " mb-0"}>
                Foto Produk <span className="font-normal text-[var(--text-muted)]">({totalImages}/{MAX_IMAGES})</span>
              </label>
              {imgBusy && <Loader2 className="w-4 h-4 animate-spin text-amber-500" />}
            </div>

            <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
              {/* Mode edit: foto yang sudah tersimpan */}
              {isEdit &&
                images.map((img) => (
                  <ImageTile
                    key={img.ID}
                    src={getImageUrl(img.image_url)}
                    primary={img.is_primary}
                    disabled={imgBusy}
                    onPrimary={() => setPrimary(img)}
                    onDelete={() => deleteImage(img)}
                  />
                ))}

              {/* Mode tambah: preview sebelum upload */}
              {!isEdit &&
                pending.map((p, i) => (
                  <ImageTile
                    key={p.preview}
                    src={p.preview}
                    primary={i === 0}
                    onPrimary={() => makePendingPrimary(i)}
                    onDelete={() => removePending(i)}
                  />
                ))}

              {totalImages < MAX_IMAGES && (
                <button
                  type="button"
                  disabled={imgBusy}
                  onClick={() => fileRef.current?.click()}
                  className="aspect-square rounded-xl border-2 border-dashed border-[var(--border)] hover:border-amber-500/50 hover:bg-amber-500/5 flex flex-col items-center justify-center gap-1 text-[var(--text-muted)] hover:text-amber-500 transition-colors disabled:opacity-50"
                >
                  <ImagePlus className="w-5 h-5" />
                  <span className="text-xs font-semibold">Tambah</span>
                </button>
              )}
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              multiple
              hidden
              onChange={handlePickFiles}
            />
            <p className="text-xs text-[var(--text-muted)] mt-2">
              JPG/PNG/WEBP, maks 5MB per foto. Foto bertanda ★ menjadi foto utama.
              {isEdit && " Perubahan foto langsung tersimpan."}
            </p>
          </div>

          {/* ── Informasi Dasar ── */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <label className={labelCls}>Nama Produk *</label>
              <input className={inputCls} value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="cth: Sofa L Minimalis 3 Dudukan" />
            </div>
            <div>
              <label className={labelCls}>SKU <span className="font-normal text-[var(--text-muted)]">(kosongkan = otomatis)</span></label>
              <input className={inputCls + " font-mono uppercase"} value={form.sku} onChange={(e) => set("sku", e.target.value)} placeholder="PRD-XXXXXX-XXXX" />
            </div>
            <div>
              <label className={labelCls}>Kategori *</label>
              <select className={inputCls} value={form.category_id} onChange={(e) => set("category_id", e.target.value)}>
                <option value="">Pilih kategori...</option>
                {categories.map((c) => (
                  <option key={c.ID} value={c.ID}>{c.name}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Peruntukan Ruangan</label>
              <div className="flex flex-wrap gap-2">
                {ROOM_OPTIONS.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => set("room_type", r.value)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${form.room_type === r.value
                      ? "bg-amber-500 text-black font-semibold border-amber-500"
                      : "bg-[var(--bg-sunken)] border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                      }`}
                  >
                    {r.emoji} {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="sm:col-span-2">
              <label className={labelCls}>Deskripsi</label>
              <textarea className={inputCls + " resize-none"} rows={3} value={form.description} onChange={(e) => set("description", e.target.value)} placeholder="Bahan, ukuran, warna, dsb." />
            </div>
          </div>

          {/* ── Harga & Stok ── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-[var(--border)]">
            <div>
              <label className="block text-xs font-semibold text-[var(--text-secondary)] mb-1">
                Harga Jual (Opsional)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-xs">Rp</span>
                <input
                  type="number"
                  value={form.price_sell || ""}
                  onChange={(e) => set("price_sell", e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-[var(--bg-base)] border border-[var(--border)] rounded-lg text-xs focus:ring-1 focus:ring-amber-500"
                  placeholder="Kosongkan jika belum ada harga"
                />
              </div>
            </div>
            <div className="col-span-2">
              <label className={labelCls}>Harga Modal (Rp) <span className="font-normal text-[var(--text-muted)]">(opsional)</span></label>
              <input type="number" min={0} className={inputCls + " font-mono tabular-nums"} value={form.price_buy} onChange={(e) => set("price_buy", e.target.value)} placeholder="Boleh dikosongkan" />
              {margin !== null && (
                <p className={`text-xs mt-1 font-mono ${margin >= 0 ? "text-emerald-500" : "text-rose-500"}`}>
                  Margin: {formatRupiah(margin)}
                </p>
              )}
            </div>
            <div className="col-span-1">
              <label className={labelCls}>{isEdit ? "Stok" : "Stok Awal"}</label>
              <input type="number" min={0} className={inputCls + " font-mono"} value={form.stock} onChange={(e) => set("stock", e.target.value)} />
            </div>
            <div className="col-span-1">
              <label className={labelCls}>Stok Minimum</label>
              <input type="number" min={0} className={inputCls + " font-mono"} value={form.min_stock} onChange={(e) => set("min_stock", e.target.value)} />
            </div>
            <div className="col-span-2 flex items-end">
              <label className="flex items-center gap-2 cursor-pointer select-none pb-2">
                <input type="checkbox" checked={form.is_active} onChange={(e) => set("is_active", e.target.checked)} className="w-4 h-4 accent-amber-500" />
                <span className="text-xs font-semibold text-[var(--text-secondary)]">Produk aktif (tampil di kasir)</span>
              </label>
            </div>
          </div>
          {isEdit && (
            <p className="text-xs text-[var(--text-secondary)] font-medium -mt-2">
              Perubahan stok di sini otomatis dicatat sebagai &quot;penyesuaian stok&quot; di riwayat inventori.
            </p>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[var(--border)] flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-xs font-semibold text-[var(--text-secondary)] bg-[var(--bg-sunken)] border border-[var(--border)] hover:text-[var(--text-primary)] transition-colors">
            Batal
          </button>
          <button
            onClick={handleSave}
            disabled={saving || imgBusy}
            className="px-4 py-2 rounded-lg text-xs font-semibold bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50 transition-all flex items-center gap-2"
          >
            {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {isEdit ? "Simpan Perubahan" : "Simpan Produk"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Kotak foto kecil dengan tombol "jadikan utama" & "hapus" ──
function ImageTile({
  src, primary, disabled, onPrimary, onDelete,
}: {
  src: string; primary: boolean; disabled?: boolean; onPrimary: () => void; onDelete: () => void;
}) {
  return (
    <div className={`relative aspect-square rounded-xl overflow-hidden border-2 group ${primary ? "border-amber-500" : "border-[var(--border)]"}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="Foto produk" className="w-full h-full object-cover" />
      {primary && (
        <span className="absolute top-1 left-1 px-2 py-0.5 rounded-md bg-amber-500 text-black text-xs font-semibold flex items-center gap-0.5">
          <Star className="w-3 h-3 fill-current" /> Utama
        </span>
      )}
      <div className="absolute inset-0 bg-slate-950/60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
        {!primary && (
          <button type="button" disabled={disabled} onClick={onPrimary} title="Jadikan foto utama" className="p-1.5 rounded-lg bg-amber-500 text-black hover:bg-amber-400 disabled:opacity-50">
            <Star className="w-3.5 h-3.5" />
          </button>
        )}
        <button type="button" disabled={disabled} onClick={onDelete} title="Hapus foto" className="p-1.5 rounded-lg bg-rose-500 text-white hover:bg-rose-400 disabled:opacity-50">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
