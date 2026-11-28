/**
 * My Clav › Tracker: four columns on desktop (Planning, Preparing, Submitted,
 * Decision), the same groups stacked on a phone.
 *
 * Without JavaScript every card has a stage menu and a "Change" button posting
 * to /api/tracker/item, which comes back here. With JavaScript the menu saves
 * on change, and on desktop a card can be dragged to another column (the
 * Decision column then offers Accepted / Waitlisted / Rejected / Enrolled).
 * The menu stays the keyboard way to move a card.
 */
import '../styles/tracker.css';
import { useState } from 'react';
import { useHydrated } from './hydrated';

export type Stage =
  'planning' | 'preparing' | 'submitted' | 'accepted' | 'waitlisted' | 'rejected' | 'enrolled';

export interface BoardItem {
  id: number;
  name: string;
  /** "Not translated yet" label, when the name is in English. */
  nameNote: string | null;
  provider: string | null;
  stage: Stage;
  href: string;
  deadline: string;
  /** e.g. "4 of 7 done". */
  progress: string;
  done: number;
  total: number;
}

export interface BoardColumn {
  key: string;
  label: string;
  stages: Stage[];
  empty: string;
}

export interface TrackerBoardProps {
  lang: string;
  back: string;
  items: BoardItem[];
  columns: BoardColumn[];
  stageLabels: Record<Stage, string>;
  labels: {
    change: string;
    saved: string;
    error: string;
    /** "Move {name} to". */
    moveTo: string;
    dropHere: string;
    progress: string;
  };
}

export default function TrackerBoard(props: TrackerBoardProps) {
  const { lang, back, columns, stageLabels, labels } = props;
  const [items, setItems] = useState(props.items);
  const enhanced = useHydrated();
  const [dragging, setDragging] = useState<number | null>(null);
  const [message, setMessage] = useState('');

  async function move(id: number, stage: Stage) {
    const before = items;
    const item = before.find((i) => i.id === id);
    if (!item || item.stage === stage) return;
    setItems(before.map((i) => (i.id === id ? { ...i, stage } : i)));
    try {
      const response = await fetch('/api/tracker/item', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'stage', id, stage, lang }),
      });
      if (!response.ok) throw new Error(String(response.status));
      setMessage(`${item.name}: ${stageLabels[stage]}. ${labels.saved}`);
    } catch {
      setItems(before);
      setMessage(labels.error);
    }
  }

  function dropProps(stage: Stage) {
    return {
      onDragOver: (event: DragEvent) => {
        if (dragging !== null) event.preventDefault();
      },
      onDrop: (event: DragEvent) => {
        event.preventDefault();
        if (dragging !== null) void move(dragging, stage);
        setDragging(null);
      },
    };
  }

  return (
    <div class="tracker-board" data-dragging={dragging !== null ? 'true' : undefined}>
      <p class="visually-hidden" role="status" aria-live="polite">
        {message}
      </p>
      {columns.map((column) => {
        const list = items.filter((i) => column.stages.includes(i.stage));
        const first = column.stages[0] ?? 'planning';
        const many = column.stages.length > 1;
        return (
          <section
            class="board-column"
            aria-labelledby={`column-${column.key}`}
            {...(many ? {} : dropProps(first))}
          >
            <h2 id={`column-${column.key}`} class="board-title">
              {column.label} <span class="board-count">{list.length}</span>
            </h2>
            {many && dragging !== null && (
              <div class="drop-zones">
                {column.stages.map((stage) => (
                  <div class="drop-zone" {...dropProps(stage)}>
                    {stageLabels[stage]}
                  </div>
                ))}
              </div>
            )}
            {list.length === 0 ? (
              <p class="board-empty">
                {dragging !== null && !many ? labels.dropHere : column.empty}
              </p>
            ) : (
              <ul class="board-list">
                {list.map((item) => (
                  // Dragging is a mouse shortcut; the stage menu below is the keyboard way.
                  // eslint-disable-next-line jsx-a11y-x/no-noninteractive-element-interactions
                  <li
                    class="card board-card"
                    draggable={enhanced}
                    data-item={item.id}
                    onDragStart={(event: DragEvent) => {
                      event.dataTransfer?.setData('text/plain', String(item.id));
                      setDragging(item.id);
                    }}
                    onDragEnd={() => setDragging(null)}
                  >
                    <a class="board-name" href={item.href}>
                      {item.name}
                    </a>
                    {item.nameNote && <span class="muted-note">{item.nameNote}</span>}
                    {item.provider && <span class="text-small text-muted">{item.provider}</span>}
                    <span class="text-small">{item.deadline}</span>
                    <div class="board-progress">
                      <progress
                        max={Math.max(item.total, 1)}
                        value={item.done}
                        aria-label={labels.progress}
                      />
                      <span class="text-small text-muted">{item.progress}</span>
                    </div>
                    <form method="post" action="/api/tracker/item" class="stage-form">
                      <input type="hidden" name="action" value="stage" />
                      <input type="hidden" name="id" value={String(item.id)} />
                      <input type="hidden" name="lang" value={lang} />
                      <input type="hidden" name="back" value={back} />
                      <label class="visually-hidden" for={`stage-${item.id}`}>
                        {labels.moveTo.replace('{name}', item.name)}
                      </label>
                      <select
                        id={`stage-${item.id}`}
                        name="stage"
                        class="input stage-select"
                        value={item.stage}
                        onChange={(event: Event) => {
                          if (!enhanced) return;
                          void move(
                            item.id,
                            (event.currentTarget as HTMLSelectElement).value as Stage,
                          );
                        }}
                      >
                        {(Object.keys(stageLabels) as Stage[]).map((stage) => (
                          <option value={stage} selected={stage === item.stage}>
                            {stageLabels[stage]}
                          </option>
                        ))}
                      </select>
                      {!enhanced && (
                        <button type="submit" class="button button-secondary">
                          {labels.change}
                        </button>
                      )}
                    </form>
                  </li>
                ))}
              </ul>
            )}
          </section>
        );
      })}
    </div>
  );
}
