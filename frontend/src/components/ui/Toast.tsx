"use client";

import React from 'react';
import { CheckCircle, AlertCircle, Info, X } from 'lucide-react';

export interface ToastProps {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
  onClose: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ id, type, title, message, onClose }) => {
  return (
    <div className="flex items-start gap-3 p-4 rounded-xl bg-[var(--bg-surface)] border border-[var(--border)] shadow-2xl min-w-[320px] max-w-md animate-in slide-in-from-top-2 duration-200">
      <div className="shrink-0 mt-0.5">
        {type === 'success' && <CheckCircle className="w-5 h-5 text-emerald-400" />}
        {type === 'error' && <AlertCircle className="w-5 h-5 text-rose-400" />}
        {type === 'info' && <Info className="w-5 h-5 text-amber-400" />}
      </div>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-bold text-[var(--text-primary)] leading-tight">{title}</h4>
        <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-relaxed">{message}</p>
      </div>
      <button
        onClick={() => onClose(id)}
        className="p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)] rounded-lg transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
};
