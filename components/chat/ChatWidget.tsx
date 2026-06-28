'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useLocale, useTranslations } from 'next-intl';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import type { Components } from 'react-markdown';
import type { Locale } from '@/lib/constants';

type ChatMessage = { role: 'user' | 'model'; content: string };

// Tailwind-styled renderers for the Markdown the assistant returns. Internal
// links (starting with "/") navigate within the app and close the panel.
function markdownComponents(onNavigate: () => void): Components {
  return {
    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed">{children}</p>,
    ul: ({ children }) => <ul className="mb-2 list-disc space-y-1 pl-5 last:mb-0">{children}</ul>,
    ol: ({ children }) => <ol className="mb-2 list-decimal space-y-1 pl-5 last:mb-0">{children}</ol>,
    li: ({ children }) => <li className="leading-relaxed">{children}</li>,
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    h1: ({ children }) => <h3 className="mb-1 mt-2 font-heading text-sm font-semibold first:mt-0">{children}</h3>,
    h2: ({ children }) => <h3 className="mb-1 mt-2 font-heading text-sm font-semibold first:mt-0">{children}</h3>,
    h3: ({ children }) => <h3 className="mb-1 mt-2 font-heading text-sm font-semibold first:mt-0">{children}</h3>,
    code: ({ children }) => <code className="rounded bg-background px-1 py-0.5 text-[12px]">{children}</code>,
    hr: () => <hr className="my-2 border-border" />,
    a: ({ href, children }) => {
      const url = href ?? '#';
      if (url.startsWith('/')) {
        return (
          <Link href={url} onClick={onNavigate} className="font-medium text-primary underline underline-offset-2 hover:text-gold-dark">
            {children}
          </Link>
        );
      }
      return (
        <a href={url} target="_blank" rel="noopener noreferrer" className="font-medium text-primary underline underline-offset-2 hover:text-gold-dark">
          {children}
        </a>
      );
    },
    table: ({ children }) => (
      <div className="my-2 overflow-x-auto">
        <table className="w-full border-collapse text-xs">{children}</table>
      </div>
    ),
    th: ({ children }) => <th className="border border-border bg-muted/50 px-2 py-1 text-left font-semibold">{children}</th>,
    td: ({ children }) => <td className="border border-border px-2 py-1 align-top">{children}</td>,
  };
}

export function ChatWidget() {
  const t = useTranslations('chat');
  const locale = useLocale() as Locale;

  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Focus the input when the panel opens.
  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Keep the conversation scrolled to the latest message.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, loading]);

  async function send() {
    const text = input.trim();
    if (!text || loading) return;

    const nextMessages: ChatMessage[] = [...messages, { role: 'user', content: text }];
    setMessages(nextMessages);
    setInput('');
    setLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale, messages: nextMessages }),
      });

      if (!res.ok || !res.body) throw new Error('chat failed');

      // Append an empty assistant message, then fill it as tokens stream in.
      setMessages((prev) => [...prev, { role: 'model', content: '' }]);
      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: last.content + chunk };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => [...prev, { role: 'model', content: t('error') }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  return (
    <>
      {/* Floating toggle button */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? t('close_label') : t('open_label')}
        aria-expanded={open}
        className="fixed bottom-5 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-gold text-primary shadow-lg transition-transform hover:scale-105 focus:outline-none focus:ring-2 focus:ring-gold focus:ring-offset-2"
      >
        {open ? (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        ) : (
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        )}
      </button>

      {/* Chat panel */}
      {open && (
        <div
          role="dialog"
          aria-label={t('title')}
          className="fixed inset-x-0 bottom-0 z-50 flex h-[85vh] flex-col rounded-t-2xl border border-border bg-card shadow-card sm:inset-x-auto sm:bottom-24 sm:right-5 sm:h-[32rem] sm:w-96 sm:rounded-2xl"
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-3 rounded-t-2xl border-b border-border bg-primary/5 px-4 py-3">
            <div className="flex items-center gap-2">
              <div className="h-1 w-6 rounded-full bg-gold" />
              <h2 className="font-heading text-base font-semibold text-foreground">{t('title')}</h2>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label={t('close_label')}
              className="rounded-md p-1 text-muted-foreground hover:bg-primary/5 hover:text-foreground"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            role="log"
            aria-live="polite"
            aria-label={t('title')}
            className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
          >
            {messages.length === 0 ? (
              <div className="space-y-2 text-sm text-muted-foreground">
                <p className="text-foreground">{t('greeting')}</p>
                <p className="text-xs leading-relaxed">{t('empty_hint')}</p>
              </div>
            ) : (
              messages.map((m, i) =>
                m.role === 'user' ? (
                  <div
                    key={i}
                    className="ml-auto max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground"
                  >
                    {m.content}
                  </div>
                ) : (
                  <div
                    key={i}
                    className="mr-auto max-w-[90%] rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-2 text-sm text-foreground"
                  >
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents(() => setOpen(false))}>
                      {m.content}
                    </ReactMarkdown>
                  </div>
                )
              )
            )}
            {loading && messages[messages.length - 1]?.role === 'user' && (
              <div className="mr-auto flex gap-1 rounded-2xl rounded-bl-sm bg-muted/50 px-3.5 py-3" aria-label="…">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-muted-foreground" />
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t border-border px-3 py-3">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                placeholder={t('input_placeholder')}
                aria-label={t('input_placeholder')}
                disabled={loading}
                className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-gold disabled:opacity-60"
              />
              <button
                type="button"
                onClick={send}
                disabled={loading || !input.trim()}
                aria-label={t('send_label')}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold text-primary transition-opacity hover:bg-gold/90 disabled:opacity-40"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="22" y1="2" x2="11" y2="13" />
                  <polygon points="22 2 15 22 11 13 2 9 22 2" />
                </svg>
              </button>
            </div>
            <p className="mt-2 px-1 text-[11px] leading-tight text-muted-foreground">{t('disclaimer')}</p>
          </div>
        </div>
      )}
    </>
  );
}
