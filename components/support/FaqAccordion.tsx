'use client';

import { useState } from 'react';

type FaqItem = { question: string; answer: string };

export function FaqAccordion({ items }: { items: FaqItem[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="divide-y divide-border">
      {items.map((item, i) => (
        <div key={i}>
          <button
            type="button"
            onClick={() => setOpenIndex(openIndex === i ? null : i)}
            aria-expanded={openIndex === i}
            className="w-full text-left px-6 py-4 flex items-center justify-between gap-4 hover:bg-primary/5 transition-colors"
          >
            <span className="font-medium text-foreground text-sm">{item.question}</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={`shrink-0 text-muted-foreground transition-transform duration-200 ${openIndex === i ? 'rotate-180' : ''}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {openIndex === i && (
            <div className="px-6 pt-4 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border/50">
              {item.answer}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
