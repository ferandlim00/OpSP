"use client";

import React, { useState } from 'react';
import { X, Copy, Check, Layers, Palette, Type, Box, ShieldCheck } from 'lucide-react';

interface DesignSystemModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DesignSystemModal: React.FC<DesignSystemModalProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState<'tokens' | 'typography' | 'components' | 'guidelines'>('tokens');
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  if (!isOpen) return null;

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(id);
    setTimeout(() => setCopiedToken(null), 1500);
  };

  const colorTokens = [
    { name: 'Obsidian Canvas', hex: '#0A0D14', role: 'Global Low-Lighting Background', class: 'bg-[var(--bg-base)] text-[var(--text-primary)] border border-[var(--border)]' },
    { name: 'Card Surface', hex: '#0E1422', role: 'Container & Elevated Surfaces', class: 'bg-[var(--bg-surface)] text-[var(--text-primary)] border border-[var(--border)]' },
    { name: 'Subdued Border', hex: '#1E293B', role: 'Structural 1px Dividers', class: 'bg-[var(--bg-sunken)] text-[var(--text-secondary)]' },
    { name: 'Imperial Gold', hex: '#F59E0B', role: 'Primary Accent & Action Buttons', class: 'bg-amber-500 text-slate-950 font-bold' },
    { name: 'Pure White Text', hex: '#FFFFFF', role: 'High Contrast Primary Headings', class: 'bg-white text-slate-950 font-bold' },
    { name: 'Muted Slate', hex: '#94A3B8', role: 'Secondary Metadata & Labels', class: 'bg-slate-600 text-[var(--text-primary)]' },
    { name: 'Semantic Emerald', hex: '#10B981', role: 'Success / Lunas / Selesai', class: 'bg-emerald-500 text-slate-950 font-bold' },
    { name: 'Semantic Sky', hex: '#0EA5E9', role: 'Logistics / Dalam Pengiriman', class: 'bg-sky-500 text-slate-950 font-bold' },
    { name: 'Semantic Rose', hex: '#F43F5E', role: 'Alert / Jatuh Tempo / Habis', class: 'bg-rose-500 text-[var(--text-primary)] font-bold' },
  ];

  const typographyScale = [
    { level: 'Display / Page Title', size: '20px / 28px', weight: 'Bold (700)', sample: 'Ringkasan Eksekutif & Omset Bisnis' },
    { level: 'Section Title (H2)', size: '16px / 24px', weight: 'SemiBold (600)', sample: 'Katalog Produk & Transaksi Kasir' },
    { level: 'Card Header / Label (H3)', size: '13px / 18px', weight: 'SemiBold (600)', sample: 'Surat Jalan Pengiriman SJ-2026-0089' },
    { level: 'Body Regular', size: '12px / 16px', weight: 'Regular (400)', sample: 'Granit Valentino Gress Glazed Polished 60x60' },
    { level: 'Tabular Currency (Mono)', size: '14px / 20px', weight: 'Bold (700)', sample: 'Rp 1.842.500.000', isMono: true },
    { level: 'Micro Metadata', size: '10px / 14px', weight: 'Medium (500)', sample: 'SKU: GRN-VAL-6060 · Gudang BSD' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--bg-sunken)]/80 backdrop-blur-xs p-4">
      <div className="bg-[var(--bg-surface)] rounded-xl shadow-2xl border border-[var(--border)] w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border)] bg-[var(--bg-sunken)]/80">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500 flex items-center justify-center text-slate-950 font-bold">
              <Layers className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[var(--text-primary)] leading-tight">PropertiERP Low-Lighting Design System</h2>
              <p className="text-xs text-[var(--text-secondary)]">Palet temaram mewah, aksen emas champagne, tipografi kontras tinggi & presisi data</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-sunken)] rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-1 px-6 border-b border-[var(--border)] bg-[var(--bg-sunken)]/60">
          <button
            onClick={() => setActiveTab('tokens')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'tokens'
                ? 'border-amber-400 text-amber-300 bg-[var(--bg-sunken)]/50'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            Color Tokens (Low-Lighting Gold)
          </button>
          <button
            onClick={() => setActiveTab('typography')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'typography'
                ? 'border-amber-400 text-amber-300 bg-[var(--bg-sunken)]/50'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Type className="w-3.5 h-3.5" />
            Typography & Tabular Scale
          </button>
          <button
            onClick={() => setActiveTab('components')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'components'
                ? 'border-amber-400 text-amber-300 bg-[var(--bg-sunken)]/50'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Box className="w-3.5 h-3.5" />
            UI Component Specs
          </button>
          <button
            onClick={() => setActiveTab('guidelines')}
            className={`flex items-center gap-2 py-3 px-4 text-xs font-semibold border-b-2 transition-all ${
              activeTab === 'guidelines'
                ? 'border-amber-400 text-amber-300 bg-[var(--bg-sunken)]/50'
                : 'border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5" />
            Strict DOs & DON'Ts Audit
          </button>
        </div>

        {/* Content Area */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          
          {/* Tab 1: Color Tokens */}
          {activeTab === 'tokens' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Color Palette & Semantic Tokens (WCAG AA Compliant)</h3>
                <p className="text-xs text-[var(--text-secondary)]">60% neutral obsidian canvas, 30% structural surface & border, 10% high-intent gold accent.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {colorTokens.map((t, idx) => (
                  <div key={idx} className="p-3.5 rounded-xl bg-[var(--bg-sunken)]/80 border border-[var(--border)] flex items-center justify-between group">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold shadow-xs ${t.class}`}>
                        Aa
                      </div>
                      <div>
                        <h4 className="text-xs font-bold text-[var(--text-primary)]">{t.name}</h4>
                        <p className="text-[11px] text-[var(--text-secondary)]">{t.role}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => copyToClipboard(t.hex, t.name)}
                      className="p-1.5 rounded-md text-[var(--text-secondary)] hover:text-amber-400 hover:bg-[var(--bg-sunken)] transition-colors flex items-center gap-1 text-[11px] font-mono"
                      title="Salin Hex Code"
                    >
                      {copiedToken === t.name ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                      <span>{t.hex}</span>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 2: Typography */}
          {activeTab === 'typography' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Typographic Scale (Plus Jakarta Sans + JetBrains Mono)</h3>
                <p className="text-xs text-[var(--text-secondary)]">Strict tabular numerals (<code className="text-amber-400">font-mono tabular-nums</code>) for currency, metrics and SKU identifiers.</p>
              </div>

              <div className="space-y-3">
                {typographyScale.map((s, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-[var(--bg-sunken)]/80 border border-[var(--border)] flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div className="md:w-1/3">
                      <span className="text-xs font-bold text-amber-400">{s.level}</span>
                      <p className="text-[11px] text-[var(--text-muted)]">{s.size} · {s.weight}</p>
                    </div>
                    <div className="md:w-2/3">
                      <p className={`text-[var(--text-primary)] ${s.isMono ? 'font-mono tabular-nums tracking-wide font-bold text-amber-300' : ''}`}>
                        {s.sample}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tab 3: UI Component Specs */}
          {activeTab === 'components' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-[var(--text-primary)] mb-1">Status Indicators & Interactive States</h3>
                <p className="text-xs text-[var(--text-secondary)]">Semantic badges with status dots and distinct primary/secondary buttons.</p>
              </div>

              <div className="p-4 rounded-xl bg-[var(--bg-sunken)]/80 border border-[var(--border)] space-y-4">
                <span className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">Status Indicators (Non-Pill, Accessible Semantic Badges)</span>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400"></span>
                    Lunas / Selesai (Success)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400"></span>
                    Stok Menipis / Tempo 30d (Warning)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-400"></span>
                    Dalam Perjalanan (Logistics)
                  </span>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-rose-400"></span>
                    Jatuh Tempo / Habis (Danger)
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tab 4: Guidelines */}
          {activeTab === 'guidelines' && (
            <div className="space-y-6">
              <div className="p-5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 space-y-2">
                <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-2">
                  <Check className="w-4 h-4" /> Strictly Enforced Principles (DOs)
                </h4>
                <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside">
                  <li><strong>Desktop-first 1440px layout</strong> with high information density and clear visual hierarchy.</li>
                  <li><strong>Tabular Figures</strong> (<code className="text-amber-400">tabular-nums</code>) for every Indonesian Rupiah (Rp) figure.</li>
                  <li><strong>Clean 1px borders</strong> instead of muddy drop shadows or distracting neon gradients.</li>
                </ul>
              </div>

              <div className="p-5 rounded-xl bg-rose-500/10 border border-rose-500/20 space-y-2">
                <h4 className="text-xs font-bold text-rose-400 uppercase tracking-wider flex items-center gap-2">
                  <X className="w-4 h-4" /> Strictly Banned Anti-Patterns (DON'Ts)
                </h4>
                <ul className="text-xs text-[var(--text-secondary)] space-y-1.5 list-disc list-inside">
                  <li>No heavy glassmorphism or muddy backdrop blurs.</li>
                  <li>No giant cards with 1 sentence of text wasting screen real estate.</li>
                  <li>No color-alone status indications (always paired with semantic text or bullet indicator).</li>
                </ul>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[var(--border)] bg-[var(--bg-sunken)]/60 flex items-center justify-between text-xs text-[var(--text-secondary)]">
          <span>Standardized according to Enterprise ERP & POS Design Brief</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[var(--bg-sunken)] hover:bg-slate-700 text-[var(--text-primary)] font-medium transition-colors"
          >
            Tutup Spesifikasi
          </button>
        </div>

      </div>
    </div>
  );
};
