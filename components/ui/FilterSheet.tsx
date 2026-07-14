'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  closeLabel: string;
  clearLabel: string;
  applyLabel: string;
  onClear: () => void;
  hasFilters: boolean;
  children: React.ReactNode;
};

export function FilterSheet({
  open,
  onClose,
  title,
  closeLabel,
  clearLabel,
  applyLabel,
  onClear,
  hasFilters,
  children,
}: Props) {
  // Mount immediately, animate in on next tick, unmount after the closing
  // transition finishes so the slide-down/fade-out is visible instead of an
  // instant pop.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setMounted(true);
      const raf = requestAnimationFrame(() => setVisible(true));
      return () => cancelAnimationFrame(raf);
    }
    setVisible(false);
    const timeout = setTimeout(() => setMounted(false), 200);
    return () => clearTimeout(timeout);
  }, [open]);

  useEffect(() => {
    if (!mounted) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', handleKeyDown);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = '';
    };
  }, [mounted, onClose]);

  if (!mounted) return null;

  function handleBackdropClick(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === e.currentTarget) onClose();
  }

  return (
    <div
      className={`fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 transition-opacity duration-200 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
      onClick={handleBackdropClick}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`bg-card border border-border w-full sm:max-w-md sm:rounded-2xl rounded-t-2xl shadow-2xl flex flex-col max-h-[85vh] transition-transform duration-200 ${
          visible ? 'translate-y-0' : 'translate-y-full sm:translate-y-4 sm:opacity-0'
        }`}
      >
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="font-semibold text-base">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={closeLabel}
            className="p-1.5 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-4">{children}</div>

        <div className="p-4 border-t border-border flex items-center justify-between gap-3 flex-shrink-0">
          <button
            type="button"
            onClick={onClear}
            disabled={!hasFilters}
            className="text-sm text-muted-foreground hover:text-primary transition-colors underline disabled:opacity-40 disabled:pointer-events-none"
          >
            {clearLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
          >
            {applyLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
