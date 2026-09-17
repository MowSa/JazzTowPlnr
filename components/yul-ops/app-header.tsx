'use client';

import Link from 'next/link';
import { type ReactNode, useEffect, useRef } from 'react';
import { MoreHorizontal, Search } from 'lucide-react';
import { ThemeToggle } from '@/components/theme-toggle';
import { flightLabel, routeLabel } from '@/lib/yul-ops/format';
import type { LiveAircraft } from '@/lib/yul-ops/types';
import { MapleMark } from './maple-mark';
import { ToastInbox } from './toast-inbox';
import { Button } from '@/components/ui/button';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Kbd } from '@/components/ui/kbd';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export type MainTab = 'live' | 'arrivals' | 'departures';

export function AppHeader({
  query,
  hits,
  searchOpen,
  statusPill,
  settings,
  summary,
  onQuery,
  onSelect,
  onSearchFocus,
  onSearchBlur,
}: {
  query: string;
  hits: LiveAircraft[];
  searchOpen: boolean;
  statusPill?: ReactNode;
  settings: ReactNode;
  summary?: ReactNode;
  onQuery: (value: string) => void;
  onSelect: (id: string) => void;
  onSearchFocus: () => void;
  onSearchBlur: () => void;
}) {
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        searchRef.current?.focus();
        onSearchFocus();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onSearchFocus]);

  return (
    <header className="yul-header yul-glass">
      <div className="yul-header-left">
        <Link href="/yul" className="yul-brand" aria-label="Jazz at YUL live map">
          <MapleMark />
          <span className="yul-brand-text">
            <strong>Jazz @ YUL</strong>
            <span>Montréal–Trudeau</span>
          </span>
        </Link>
        {statusPill}
      </div>
      {summary}
      <div className="yul-header-right">
        <div className="relative">
          <InputGroup className="yul-search h-10 w-[280px] rounded-full bg-[var(--panel-2)]">
            <InputGroupAddon>
              <Search />
            </InputGroupAddon>
            <InputGroupInput
              ref={searchRef}
              value={query}
              onChange={(event) => onQuery(event.target.value)}
              onFocus={onSearchFocus}
              onBlur={onSearchBlur}
              placeholder="Search flight, registration, or airport"
              aria-label="Search aircraft"
            />
            <InputGroupAddon align="inline-end">
              <Kbd>⌘K</Kbd>
            </InputGroupAddon>
          </InputGroup>
          {searchOpen && hits.length > 0 && (
            <div className="absolute top-12 right-0 z-20 w-80 overflow-hidden rounded-xl border border-border bg-popover p-1 shadow-md">
              {hits.map((item) => (
                <Button
                  key={item.id}
                  variant="ghost"
                  className="h-auto w-full justify-between px-3 py-2"
                  onClick={() => onSelect(item.id)}
                >
                  <span className="font-semibold">{flightLabel(item)}</span>
                  <span className="text-muted-foreground text-xs">
                    {routeLabel(item.origin, item.destination)}
                  </span>
                </Button>
              ))}
            </div>
          )}
        </div>
        <ToastInbox />
        <ThemeToggle className="size-10 min-w-10" />
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                size="icon-lg"
                className="size-10"
                aria-label="Display and options"
              />
            }
          >
            <MoreHorizontal />
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80">
            {settings}
          </PopoverContent>
        </Popover>
      </div>
    </header>
  );
}
