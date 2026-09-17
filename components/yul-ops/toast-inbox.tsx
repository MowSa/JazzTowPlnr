'use client';

import { useSyncExternalStore } from 'react';
import { Bell } from 'lucide-react';
import { getToastHistory, subscribeToastHistory } from '@/lib/yul-ops/toast-history';
import { formatAgo } from '@/lib/yul-ops/format';
import { openLiveMapFlight } from './arrival-toasts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Empty, EmptyDescription, EmptyTitle } from '@/components/ui/empty';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';

const EMPTY: ReturnType<typeof getToastHistory> = [];

export function ToastInbox({ now = Date.now() }: { now?: number }) {
  const notices = useSyncExternalStore(subscribeToastHistory, getToastHistory, () => EMPTY);
  return (
    <Popover>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="icon"
            className="header-notices-button"
            aria-label={
              notices.length
                ? `Notifications, ${notices.length} arrival notices`
                : 'Notifications, none yet'
            }
          />
        }
      >
        <Bell />
        {notices.length > 0 && (
          <Badge variant="default" className="header-notices-count">
            {notices.length > 99 ? '99+' : notices.length}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="header-notices-panel w-96 p-0">
        <div className="header-notices-head">
          <strong>Arrival notices</strong>
          <span>{notices.length ? `${notices.length} recorded` : 'None yet'}</span>
        </div>
        {notices.length ? (
          <ScrollArea className="header-notices-list">
            {notices.map((notice) => (
              <Button
                key={notice.id}
                type="button"
                variant="ghost"
                className="header-notice-item"
                onClick={() => {
                  if (notice.id.startsWith('__preview__')) return;
                  openLiveMapFlight(notice.id);
                }}
              >
                <span className="header-notice-top">
                  <strong>{notice.flightLabel}</strong>
                  <em className={`is-${notice.kind}`}>{notice.kind}</em>
                  <small>{formatAgo(notice.shownAt, now)}</small>
                </span>
                {notice.detail && <span className="header-notice-detail">{notice.detail}</span>}
                {notice.clocks && <span className="header-notice-detail">{notice.clocks}</span>}
              </Button>
            ))}
          </ScrollArea>
        ) : (
          <Empty className="border-0 py-8">
            <EmptyTitle>No notices yet</EmptyTitle>
            <EmptyDescription>Early and late YUL arrivals will collect here.</EmptyDescription>
          </Empty>
        )}
      </PopoverContent>
    </Popover>
  );
}
