'use client';

import { useMemo, useState, useTransition } from 'react';
import { ArrowDown, ArrowUp, BookOpen, Pencil, Plus, Save } from 'lucide-react';
import { createBook, deleteBook, updateBook } from '@/app/actions/books';
import { useRouter } from 'next/navigation';

type BookStatus = 'not-started' | 'reading' | 'finished';

interface Domain {
  _id: string;
  name: string;
}

interface BookRow {
  _id: string;
  title: string;
  author?: string;
  category?: string;
  status?: string;
  startedOn?: string | null;
  finishedOn?: string | null;
  order?: number;
  createdAt?: string;
}

interface Props {
  initialData: {
    books: BookRow[];
    domains: Domain[];
  };
}

const STATUS_OPTIONS: { value: BookStatus; label: string }[] = [
  { value: 'not-started', label: 'Not Started' },
  { value: 'reading', label: 'Reading' },
  { value: 'finished', label: 'Finished' },
];

function normalizeStatus(status?: string): BookStatus {
  if (status === 'reading' || status === 'finished' || status === 'not-started') return status;
  if (status === 'completed') return 'finished';
  return 'not-started';
}

function toInputDate(value?: string | null): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().split('T')[0];
}

function toReadableDate(value?: string | null): string {
  if (!value) return '-';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

function sortRows(rows: BookRow[]): BookRow[] {
  return [...rows].sort((a, b) => {
    const aReading = normalizeStatus(a.status) === 'reading' ? 0 : 1;
    const bReading = normalizeStatus(b.status) === 'reading' ? 0 : 1;
    if (aReading !== bReading) return aReading - bReading;

    const aOrder = a.order ?? Number.MAX_SAFE_INTEGER;
    const bOrder = b.order ?? Number.MAX_SAFE_INTEGER;
    if (aOrder !== bOrder) return aOrder - bOrder;

    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime();
  });
}

export default function BooksTableModeClient({ initialData }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editMode, setEditMode] = useState(false);
  const [books, setBooks] = useState<BookRow[]>(sortRows(initialData.books));
  const [newRow, setNewRow] = useState({
    title: '',
    author: '',
    category: '',
    status: 'not-started' as BookStatus,
    startedOn: '',
    finishedOn: '',
  });

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    books.forEach((b) => {
      const c = (b.category || '').trim();
      if (c) set.add(c);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [books]);

  const defaultDomainId = initialData.domains[0]?._id;

  function updateLocalRow(id: string, patch: Partial<BookRow>) {
    setBooks((prev) => sortRows(prev.map((row) => (row._id === id ? { ...row, ...patch } : row))));
  }

  function handleStatusChange(row: BookRow, nextStatus: BookStatus) {
    const today = new Date().toISOString().split('T')[0];
    const patch: Partial<BookRow> = { status: nextStatus };

    if (nextStatus === 'reading' && !toInputDate(row.startedOn)) {
      patch.startedOn = today;
    }
    if (nextStatus === 'finished' && !toInputDate(row.finishedOn)) {
      patch.finishedOn = today;
    }
    if (nextStatus !== 'finished') {
      patch.finishedOn = '';
    }

    updateLocalRow(row._id, patch);
  }

  function moveRow(index: number, direction: 'up' | 'down') {
    setBooks((prev) => {
      const next = [...prev];
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, i) => ({ ...row, order: i + 1 }));
    });
  }

  function saveRow(row: BookRow) {
    startTransition(async () => {
      await updateBook(row._id, {
        title: row.title.trim(),
        author: row.author?.trim() || '',
        category: row.category?.trim() || 'General',
        status: normalizeStatus(row.status),
        startedOn: toInputDate(row.startedOn) || undefined,
        finishedOn: toInputDate(row.finishedOn) || undefined,
        order: row.order,
      });
      router.refresh();
    });
  }

  function saveOrder() {
    startTransition(async () => {
      await Promise.all(
        books.map((row, i) =>
          updateBook(row._id, {
            order: i + 1,
          })
        )
      );
      router.refresh();
    });
  }

  function addRow() {
    if (!newRow.title.trim()) return;

    startTransition(async () => {
      await createBook({
        domainId: defaultDomainId,
        title: newRow.title.trim(),
        author: newRow.author.trim(),
        category: newRow.category.trim() || 'General',
        status: newRow.status,
        startedOn: newRow.startedOn || undefined,
        finishedOn: newRow.finishedOn || undefined,
      });
      setNewRow({
        title: '',
        author: '',
        category: '',
        status: 'not-started',
        startedOn: '',
        finishedOn: '',
      });
      router.refresh();
    });
  }

  function removeRow(bookId: string) {
    startTransition(async () => {
      await deleteBook(bookId);
      setBooks((prev) => prev.filter((b) => b._id !== bookId));
      router.refresh();
    });
  }

  return (
    <div className="space-y-4 pb-16">
      <div className="rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card/70 p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BookOpen className="text-amber-500" size={22} />
            <div>
              <h1 className="text-xl font-semibold tracking-tight">Books</h1>
              <p className="text-xs text-muted-foreground">Table mode only. Current reading always stays on top.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setEditMode((v) => !v)}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm hover:bg-secondary"
            >
              <Pencil size={14} />
              {editMode ? 'Exit Edit' : 'Edit Mode'}
            </button>
            {editMode && (
              <button
                onClick={saveOrder}
                disabled={isPending}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
              >
                <Save size={14} />
                Save Row Order
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-border/60 bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-[920px] w-full text-sm">
            <thead className="bg-secondary/60 text-xs uppercase tracking-wider text-muted-foreground">
              <tr>
                <th className="px-3 py-3 text-left">Book Name</th>
                <th className="px-3 py-3 text-left">Author</th>
                <th className="px-3 py-3 text-left">Category</th>
                <th className="px-3 py-3 text-left">Status</th>
                <th className="px-3 py-3 text-left">Started On</th>
                <th className="px-3 py-3 text-left">Finished On</th>
                {editMode && <th className="px-3 py-3 text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {books.map((row, index) => (
                <tr key={row._id} className="border-t border-border/60 align-top">
                  <td className="px-3 py-2.5 font-medium">
                    {editMode ? (
                      <input
                        value={row.title || ''}
                        onChange={(e) => updateLocalRow(row._id, { title: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      />
                    ) : (
                      row.title
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editMode ? (
                      <input
                        value={row.author || ''}
                        onChange={(e) => updateLocalRow(row._id, { author: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                        placeholder="Optional"
                      />
                    ) : (
                      row.author || '-'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editMode ? (
                      <>
                        <input
                          value={row.category || ''}
                          onChange={(e) => updateLocalRow(row._id, { category: e.target.value })}
                          list="book-categories"
                          className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                          placeholder="Type new or choose"
                        />
                        <datalist id="book-categories">
                          {categoryOptions.map((c) => (
                            <option key={c} value={c} />
                          ))}
                        </datalist>
                      </>
                    ) : (
                      row.category || 'General'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editMode ? (
                      <select
                        value={normalizeStatus(row.status)}
                        onChange={(e) => handleStatusChange(row, e.target.value as BookStatus)}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      >
                        {STATUS_OPTIONS.map((s) => (
                          <option key={s.value} value={s.value}>
                            {s.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      STATUS_OPTIONS.find((s) => s.value === normalizeStatus(row.status))?.label || 'Not Started'
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editMode ? (
                      <input
                        type="date"
                        value={toInputDate(row.startedOn)}
                        onChange={(e) => updateLocalRow(row._id, { startedOn: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      />
                    ) : (
                      toReadableDate(row.startedOn)
                    )}
                  </td>
                  <td className="px-3 py-2.5">
                    {editMode ? (
                      <input
                        type="date"
                        value={toInputDate(row.finishedOn)}
                        onChange={(e) => updateLocalRow(row._id, { finishedOn: e.target.value })}
                        className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      />
                    ) : (
                      toReadableDate(row.finishedOn)
                    )}
                  </td>
                  {editMode && (
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => moveRow(index, 'up')}
                          className="rounded-md border border-border p-1.5 hover:bg-secondary"
                          title="Move up"
                        >
                          <ArrowUp size={14} />
                        </button>
                        <button
                          onClick={() => moveRow(index, 'down')}
                          className="rounded-md border border-border p-1.5 hover:bg-secondary"
                          title="Move down"
                        >
                          <ArrowDown size={14} />
                        </button>
                        <button
                          onClick={() => saveRow(row)}
                          className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-1.5 text-emerald-600 hover:bg-emerald-500/20"
                          title="Save row"
                        >
                          <Save size={14} />
                        </button>
                        <button
                          onClick={() => removeRow(row._id)}
                          className="rounded-md border border-rose-500/40 bg-rose-500/10 p-1.5 text-rose-600 hover:bg-rose-500/20"
                          title="Delete row"
                        >
                          <span className="text-xs">Del</span>
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}

              {editMode && (
                <tr className="border-t border-border/60 bg-secondary/20">
                  <td className="px-3 py-2.5">
                    <input
                      value={newRow.title}
                      onChange={(e) => setNewRow((p) => ({ ...p, title: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      placeholder="Book name"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={newRow.author}
                      onChange={(e) => setNewRow((p) => ({ ...p, author: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      placeholder="Optional"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      value={newRow.category}
                      onChange={(e) => setNewRow((p) => ({ ...p, category: e.target.value }))}
                      list="book-categories"
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                      placeholder="Type new or choose"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <select
                      value={newRow.status}
                      onChange={(e) => setNewRow((p) => ({ ...p, status: e.target.value as BookStatus }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                    >
                      {STATUS_OPTIONS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="date"
                      value={newRow.startedOn}
                      onChange={(e) => setNewRow((p) => ({ ...p, startedOn: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <input
                      type="date"
                      value={newRow.finishedOn}
                      onChange={(e) => setNewRow((p) => ({ ...p, finishedOn: e.target.value }))}
                      className="w-full rounded-md border border-border bg-background px-2 py-1.5"
                    />
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <button
                      onClick={addRow}
                      disabled={isPending || !newRow.title.trim()}
                      className="inline-flex items-center gap-1 rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:opacity-90 disabled:opacity-60"
                    >
                      <Plus size={12} />
                      Add
                    </button>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
