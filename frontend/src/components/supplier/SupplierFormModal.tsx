"use client";

import React, { useState, useEffect } from "react";
import { Supplier, SupplierInput } from "@/types/supplier";
import { X, Building2, Loader2 } from "lucide-react";

interface SupplierFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: SupplierInput) => Promise<void>;
  initialData?: Supplier | null;
  title: string;
}

const emptyForm: SupplierInput = {
  code: "",
  name: "",
  phone: "",
  email: "",
  address: "",
  pic: "",
  is_active: true,
  note: "",
};

export default function SupplierFormModal({
  isOpen,
  onClose,
  onSubmit,
  initialData,
  title,
}: SupplierFormModalProps) {
  const [formData, setFormData] = useState<SupplierInput>(emptyForm);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (initialData) {
      setFormData({
        code: initialData.code || "",
        name: initialData.name || "",
        phone: initialData.phone || "",
        email: initialData.email || "",
        address: initialData.address || "",
        pic: initialData.pic || "",
        is_active: initialData.is_active ?? true,
        note: initialData.note || "",
      });
    } else {
      setFormData({
        ...emptyForm,
        code: `SUP-${Date.now().toString().slice(-4)}`, // Kode otomatis sederhana
      });
    }
  }, [initialData, isOpen]);

  if (!isOpen) return null;

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value, type } = e.target;
    if (type === "checkbox") {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData((prev) => ({ ...prev, [name]: checked }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await onSubmit(formData);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const inputCls =
    "w-full px-3 py-2 bg-[var(--bg-sunken)] border border-[var(--border)] rounded-lg text-xs text-[var(--text-primary)] placeholder-[var(--text-muted)] focus:outline-none focus:ring-1 focus:ring-amber-500";
  const labelCls = "block text-xs font-semibold text-[var(--text-secondary)] mb-1";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4">
      <div className="w-full max-w-lg bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)]">
          <h2 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Building2 className="w-4 h-4 text-amber-500" />
            {title}
          </h2>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-[var(--text-muted)] hover:text-[var(--text-primary)]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Kode Supplier *</label>
              <input
                type="text"
                name="code"
                value={formData.code}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="misal: SUP-001"
              />
            </div>
            <div>
              <label className={labelCls}>Nama Supplier / PT *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                className={inputCls}
                placeholder="Nama vendor"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>No. HP / Telepon</label>
              <input
                type="text"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                className={inputCls}
                placeholder="0812xxxxxxxx"
              />
            </div>
            <div>
              <label className={labelCls}>Email</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                className={inputCls}
                placeholder="vendor@mail.com"
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Penanggung Jawab (PIC)</label>
            <input
              type="text"
              name="pic"
              value={formData.pic}
              onChange={handleChange}
              className={inputCls}
              placeholder="Nama sales/kontak person"
            />
          </div>

          <div>
            <label className={labelCls}>Alamat</label>
            <textarea
              name="address"
              value={formData.address}
              onChange={handleChange}
              rows={2}
              className={inputCls}
              placeholder="Alamat gudang / kantor vendor"
            />
          </div>

          <div>
            <label className={labelCls}>Catatan Tambahan</label>
            <input
              type="text"
              name="note"
              value={formData.note}
              onChange={handleChange}
              className={inputCls}
              placeholder="Syarat retur, termin pembayaran, dll"
            />
          </div>

          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="is_active"
              name="is_active"
              checked={formData.is_active}
              onChange={handleChange}
              className="w-4 h-4 rounded border-[var(--border)] text-amber-500 focus:ring-amber-500"
            />
            <label htmlFor="is_active" className="text-xs text-[var(--text-secondary)] font-medium cursor-pointer">
              Supplier Aktif (bisa dipilih saat mencatat barang masuk)
            </label>
          </div>

          {/* Footer Buttons */}
          <div className="pt-4 border-t border-[var(--border)] flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[var(--bg-sunken)] border border-[var(--border)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-all"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-amber-500 text-black hover:bg-amber-400 transition-all flex items-center gap-1.5"
            >
              {loading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Simpan Data
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}