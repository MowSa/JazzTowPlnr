export type ToastNotice = {
  id: string;
  flightLabel: string;
  kind: 'early' | 'late' | 'on-time';
  detail: string;
  clocks?: string;
  shownAt: number;
};

const HISTORY_KEY = 'yul-toast-history';
const HISTORY_LIMIT = 50;

const listeners = new Set<() => void>();
let items: ToastNotice[] = [];
let loaded = false;

function isNotice(value: unknown): value is ToastNotice {
  if (!value || typeof value !== 'object') return false;
  const item = value as ToastNotice;
  return (
    typeof item.id === 'string' &&
    typeof item.flightLabel === 'string' &&
    typeof item.shownAt === 'number' &&
    (item.kind === 'early' || item.kind === 'late' || item.kind === 'on-time')
  );
}

function load() {
  if (loaded) return;
  loaded = true;
  try {
    const raw = sessionStorage.getItem(HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    items = Array.isArray(parsed) ? parsed.filter(isNotice).sort((a, b) => b.shownAt - a.shownAt) : [];
  } catch {
    items = [];
  }
}

function persist() {
  try {
    sessionStorage.setItem(HISTORY_KEY, JSON.stringify(items));
  } catch {
    /* History still works for this tab. */
  }
}

function notify() {
  for (const listener of listeners) listener();
}

export function getToastHistory() {
  load();
  return items;
}

export function subscribeToastHistory(listener: () => void) {
  load();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function recordToastNotice(notice: ToastNotice) {
  load();
  const preview = notice.id.startsWith('__preview__');
  if (!preview && items.some((item) => item.id === notice.id)) return;
  const entry = preview ? { ...notice, id: `${notice.id}-${notice.shownAt}` } : notice;
  items = [entry, ...items].sort((a, b) => b.shownAt - a.shownAt).slice(0, HISTORY_LIMIT);
  persist();
  notify();
}
