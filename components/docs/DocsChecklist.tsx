'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Check, Plus, Trash2, X } from 'lucide-react';
import { MAX_DOC_NAME_LENGTH, type DocItem } from '@/lib/docs/types';

type Props = {
  items: DocItem[];
  onToggle: (id: string, checked: boolean) => void;
  onAdd: (name: string) => void;
  onRemove: (id: string) => void;
  atLimit: boolean;
  /** Two columns inside the wide list drawer, one in the university sidebar. */
  dense?: boolean;
};

/**
 * The checklist itself, with no opinion about where its data lives.
 *
 * Both the list drawer and the university page render this, so ticking a box
 * looks and behaves the same in both places — the difference between them is
 * only which `useDocsState` instance supplies the handlers.
 */
export function DocsChecklist({ items, onToggle, onAdd, onRemove, atLimit, dense = false }: Props) {
  const t = useTranslations('checklist');
  const [newName, setNewName] = useState('');
  const [showAdd, setShowAdd] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    const name = newName.trim();
    if (!name) return;
    onAdd(name);
    setNewName('');
    setShowAdd(false);
  }

  function openAdd() {
    setShowAdd(true);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div>
      <ul className={`gap-x-6 gap-y-1 mb-3 ${dense ? 'grid sm:grid-cols-2' : 'space-y-1'}`}>
        {items.map((item) => (
          <li key={item.id} className="flex items-center gap-3 group py-1">
            <button
              type="button"
              role="checkbox"
              aria-checked={item.checked}
              aria-label={item.name}
              onClick={() => onToggle(item.id, !item.checked)}
              className={`flex-shrink-0 w-5 h-5 rounded border-2 flex items-center justify-center transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 ${
                item.checked
                  ? 'bg-tk-green border-tk-green text-white'
                  : 'border-input hover:border-tk-green'
              }`}
            >
              {item.checked && <Check size={12} strokeWidth={3} aria-hidden="true" />}
            </button>

            <span
              className={`flex-1 text-[14px] leading-snug ${
                item.checked ? 'line-through text-muted-foreground' : 'text-foreground'
              }`}
            >
              {item.name}
            </span>

            <button
              type="button"
              onClick={() => onRemove(item.id)}
              aria-label={t('delete_item_label', { name: item.name })}
              className="opacity-0 group-hover:opacity-100 focus:opacity-100 flex-shrink-0 p-1 rounded text-muted-foreground hover:text-crimson transition-all focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <Trash2 size={13} aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      {items.length === 0 && (
        <p className="text-[14px] text-muted-foreground mb-3">{t('all_removed')}</p>
      )}

      {showAdd ? (
        <form onSubmit={handleAdd} className="flex gap-2">
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t('add_placeholder')}
            maxLength={MAX_DOC_NAME_LENGTH}
            className="flex-1 min-w-0 text-[14px] px-3 py-1.5 border border-input rounded-lg bg-card focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
            aria-label={t('add_placeholder')}
          />
          <button
            type="submit"
            disabled={!newName.trim()}
            className="text-[14px] px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40 font-medium whitespace-nowrap"
          >
            {t('add_button')}
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAdd(false);
              setNewName('');
            }}
            aria-label={t('cancel')}
            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </form>
      ) : atLimit ? (
        <p className="text-[13px] text-muted-foreground">{t('limit_reached')}</p>
      ) : (
        <button
          type="button"
          onClick={openAdd}
          className="text-[14px] text-primary hover:text-primary/80 inline-flex items-center gap-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary/30 rounded"
        >
          <Plus size={14} strokeWidth={2.5} aria-hidden="true" />
          {t('add_item')}
        </button>
      )}
    </div>
  );
}
