'use client';

import { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { arrivalAlertClocks, arrivalAlertDetail, arrivalAlerts, type ArrivalAlert } from '@/lib/yul-ops/arrival-alert';
import { freshArrivalAircraft } from '@/lib/yul-ops/freshness';
import { STA_UPDATED_EVENT } from '@/lib/yul-ops/schedule-sta';
import { Alert, AlertAction } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { recordToastNotice } from '@/lib/yul-ops/toast-history';
import { useLiveFlights } from './use-live-flights';
import './arrival-toasts.css';

const SHOWN_KEY = 'yul-arrival-toasts';
const PENDING_SELECT_KEY = 'yul-pending-flight';
const TOAST_MS = 6_000;
const PREVIEW_ID = '__preview__';
const PREVIEW_EVENT = 'yul-preview-arrival-toast';

function sampleAlert(): ArrivalAlert {
  const etaMs = Date.now() + 19 * 60_000;
  const staMs = etaMs - 12 * 60_000;
  return {
    id: PREVIEW_ID,
    flightLabel: 'AC8901',
    route: 'YOW → YUL',
    remainingMs: 19 * 60_000,
    etaMs,
    staMs,
    varianceMs: 12 * 60_000,
    kind: 'late',
  };
}

export function previewArrivalToast() {
  window.dispatchEvent(new Event(PREVIEW_EVENT));
}

function readShown() {
  try {
    const raw = sessionStorage.getItem(SHOWN_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, number>) : {};
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeShown(shown: Record<string, number>) {
  sessionStorage.setItem(SHOWN_KEY, JSON.stringify(shown));
}

function openFlight(id: string) {
  sessionStorage.setItem(PENDING_SELECT_KEY, id);
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  if (path === '/yul') {
    window.dispatchEvent(new CustomEvent('yul-select-flight', { detail: id }));
    return;
  }
  window.location.assign('/yul');
}

export function openLiveMapFlight(id: string) {
  openFlight(id);
}

export function consumePendingFlight() {
  const id = sessionStorage.getItem(PENDING_SELECT_KEY);
  if (!id) return null;
  sessionStorage.removeItem(PENDING_SELECT_KEY);
  return id;
}

function ToastTimer({
  shownAt,
  durationMs,
  onDone,
}: {
  shownAt: number;
  durationMs: number;
  onDone: () => void;
}) {
  const origin = useRef({
    durationMs,
    elapsed: Math.min(durationMs, Math.max(0, Date.now() - shownAt)),
  });
  const { durationMs: duration, elapsed } = origin.current;
  return (
    <span className="yul-arrival-toast-timer" aria-hidden="true">
      <i
        style={{
          animationDuration: `${duration}ms`,
          animationDelay: `-${elapsed}ms`,
        }}
        onAnimationEnd={(event) => {
          if (event.animationName !== 'yul-toast-shrink') return;
          onDone();
        }}
      />
    </span>
  );
}

export function ArrivalToastHost() {
  const feed = useLiveFlights();
  const shown = useRef<Record<string, number>>({});
  const timers = useRef(new Map<string, number>());
  const previewTimer = useRef<number>(0);
  const previewShownAt = useRef(0);
  const [toasts, setToasts] = useState<ArrivalAlert[]>([]);
  const [preview, setPreview] = useState<ArrivalAlert | null>(null);
  const [staRevision, setStaRevision] = useState(0);

  useEffect(() => {
    shown.current = readShown();
  }, []);

  useEffect(() => {
    const showPreview = () => {
      const alert = sampleAlert();
      const shownAt = Date.now();
      recordToastNotice({
        id: PREVIEW_ID,
        flightLabel: alert.flightLabel,
        kind: alert.kind,
        detail: arrivalAlertDetail(alert),
        clocks: arrivalAlertClocks(alert),
        shownAt,
      });
      previewShownAt.current = shownAt;
      setPreview(alert);
      window.clearTimeout(previewTimer.current);
      previewTimer.current = window.setTimeout(() => setPreview(null), TOAST_MS);
    };
    window.addEventListener(PREVIEW_EVENT, showPreview);
    return () => {
      window.removeEventListener(PREVIEW_EVENT, showPreview);
      window.clearTimeout(previewTimer.current);
    };
  }, []);

  useEffect(() => {
    const onSta = () => setStaRevision((value) => value + 1);
    window.addEventListener(STA_UPDATED_EVENT, onSta);
    return () => window.removeEventListener(STA_UPDATED_EVENT, onSta);
  }, []);

  useEffect(() => {
    if (!feed) return;
    const now = Date.now();
    const next = arrivalAlerts(freshArrivalAircraft(feed, now), now);
    const visible: ArrivalAlert[] = [];
    let wrote = false;
    const dismiss = (id: string) => {
      timers.current.delete(id);
      setToasts((current) => current.filter((item) => item.id !== id));
    };
    for (const alert of next) {
      const shownAt = shown.current[alert.id];
      if (!shownAt) {
        shown.current[alert.id] = now;
        wrote = true;
        visible.push(alert);
        recordToastNotice({
          id: alert.id,
          flightLabel: alert.flightLabel,
          kind: alert.kind,
          detail: arrivalAlertDetail(alert),
          clocks: arrivalAlertClocks(alert),
          shownAt: now,
        });
      } else if (now - shownAt < TOAST_MS) {
        visible.push(alert);
      } else {
        continue;
      }
      if (!timers.current.has(alert.id)) {
        const remaining = Math.max(400, TOAST_MS - (now - (shown.current[alert.id] || now)));
        timers.current.set(
          alert.id,
          window.setTimeout(() => dismiss(alert.id), remaining),
        );
      }
    }
    if (wrote) writeShown(shown.current);
    setToasts(visible);
  }, [feed, staRevision]);

  useEffect(() => {
    if (!feed) return;
    // Expiry can happen between polls. Withdraw stale notices without marking
    // unseen arrivals as shown, so a fresh recovery can still announce them.
    const expire = () => {
      const freshIds = new Set(freshArrivalAircraft(feed, Date.now()).map((item) => item.id));
      setToasts((current) => {
        const next = current.filter((item) => freshIds.has(item.id));
        return next.length === current.length ? current : next;
      });
    };
    expire();
    const timer = window.setInterval(expire, 1000);
    return () => window.clearInterval(timer);
  }, [feed]);

  useEffect(() => {
    const activeTimers = timers.current;
    return () => {
      for (const timer of activeTimers.values()) window.clearTimeout(timer);
      activeTimers.clear();
    };
  }, []);

  const visible = preview ? [preview, ...toasts.filter((item) => item.id !== PREVIEW_ID)] : toasts;
  if (!visible.length) return null;
  const dismiss = (id: string) => {
    if (id === PREVIEW_ID) {
      window.clearTimeout(previewTimer.current);
      setPreview(null);
      return;
    }
    const timer = timers.current.get(id);
    if (timer) window.clearTimeout(timer);
    timers.current.delete(id);
    setToasts((current) => current.filter((item) => item.id !== id));
  };
  return (
    <div className="yul-arrival-toasts" aria-live="polite">
      {visible.map((alert) => {
        const clocks = arrivalAlertClocks(alert);
        const shownAt = alert.id === PREVIEW_ID
          ? previewShownAt.current || Date.now()
          : shown.current[alert.id] || Date.now();
        return (
        <Alert key={alert.id} className={`yul-arrival-toast is-${alert.kind}`}>
          <Button
            type="button"
            variant="ghost"
            className="yul-arrival-toast-body h-auto justify-start px-0 py-0 text-left hover:bg-transparent"
            onClick={() => {
              if (alert.id === PREVIEW_ID) return;
              openFlight(alert.id);
            }}
          >
            <span className="block text-sm font-bold tracking-wide">
              {alert.flightLabel} <span>{alert.kind}</span>
            </span>
            <span className="yul-arrival-toast-sub mt-0.5 block text-xs font-medium">
              {arrivalAlertDetail(alert)}
            </span>
            {clocks && (
              <span className="yul-arrival-toast-sub yul-arrival-toast-clocks mt-0.5 block text-xs font-medium">
                {clocks}
              </span>
            )}
          </Button>
          <AlertAction>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="yul-arrival-toast-close"
              aria-label="Dismiss arrival notice"
              onClick={() => dismiss(alert.id)}
            >
              <X />
            </Button>
          </AlertAction>
          <ToastTimer
            key={`${alert.id}-${shownAt}`}
            shownAt={shownAt}
            durationMs={TOAST_MS}
            onDone={() => dismiss(alert.id)}
          />
        </Alert>
        );
      })}
    </div>
  );
}
