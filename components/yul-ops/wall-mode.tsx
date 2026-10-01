'use client';

import { useEffect, useSyncExternalStore } from 'react';
import { Minimize2 } from 'lucide-react';
import { YUL } from '@/lib/yul-ops/constants';
import { formatClockShort } from '@/lib/yul-ops/format';
import { Button } from '@/components/ui/button';

// `/yul?wall` opens straight into wall mode so an ops-room screen can bookmark it.
const listeners = new Set<() => void>();
let wall: boolean | undefined;

function getWall() {
  if (wall === undefined) wall = new URLSearchParams(window.location.search).has('wall');
  return wall;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setWallMode(next: boolean) {
  if (next === getWall()) return;
  wall = next;
  const url = new URL(window.location.href);
  if (next) url.searchParams.set('wall', '');
  else url.searchParams.delete('wall');
  window.history.replaceState(window.history.state, '', url.toString().replace('wall=', 'wall'));
  // Fullscreen needs a user gesture; a bookmarked ?wall still works windowed (kiosk browsers are already fullscreen).
  if (next && !document.fullscreenElement) void document.documentElement.requestFullscreen?.().catch(() => {});
  if (!next && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  for (const listener of listeners) listener();
}

export function useWallMode() {
  const on = useSyncExternalStore(subscribe, getWall, () => false);

  // Keep the display awake while on the wall; the lock drops whenever the tab hides.
  useEffect(() => {
    if (!on || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let disposed = false;
    const acquire = () => {
      if (document.hidden) return;
      void navigator.wakeLock
        .request('screen')
        .then((next) => {
          if (disposed) void next.release();
          else lock = next;
        })
        .catch(() => {});
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      disposed = true;
      document.removeEventListener('visibilitychange', acquire);
      void lock?.release();
    };
  }, [on]);

  useEffect(() => {
    if (!on) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setWallMode(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [on]);

  return on;
}

export function WallOverlay({
  now,
  inbound,
  outbound,
}: {
  now: number;
  inbound: number;
  outbound: number;
}) {
  return (
    <div className="yul-wall-overlay">
      <div className="yul-wall-clock" aria-label="Montréal local time">
        {formatClockShort(now, YUL.timeZone)}
        <small>{formatClockShort(now)}z</small>
      </div>
      <div className="yul-wall-counts">
        <span>{inbound} inbound</span>
        <span>{outbound} outbound</span>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="yul-wall-exit"
        onClick={() => setWallMode(false)}
      >
        <Minimize2 />
        Exit wall display
      </Button>
    </div>
  );
}
