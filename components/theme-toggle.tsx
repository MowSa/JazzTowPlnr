'use client';

import { useLayoutEffect, useState } from 'react';
import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const THEME_KEY = 'jazztow-theme';

export function ThemeToggle({ className }: { className?: string }) {
  // Server and first client render must agree: dark is the bootstrap default.
  // The saved preference is only applied after mount to avoid hydration mismatch.
  const [dark, setDark] = useState(true);
  const [mounted, setMounted] = useState(false);
  useLayoutEffect(() => {
    let saved: string | null = null;
    try {
      saved = localStorage.getItem(THEME_KEY);
    } catch {
      /* Theme still works when storage is unavailable. */
    }
    const enabled = saved ? saved === 'dark' : true;
    // The class flips synchronously to avoid a theme flash; state updates are
    // deferred a tick so the effect body stays free of synchronous setState
    // (react-compiler EffectSetState).
    document.documentElement.classList.toggle('dark', enabled);
    const apply = window.setTimeout(() => {
      setDark(enabled);
      setMounted(true);
    }, 0);
    return () => window.clearTimeout(apply);
  }, []);
  function toggle() {
    const enabled = !dark;
    setDark(enabled);
    document.documentElement.classList.toggle('dark', enabled);
    try {
      localStorage.setItem(THEME_KEY, enabled ? 'dark' : 'light');
    } catch {
      /* Preference cannot be persisted. */
    }
  }
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn('theme-toggle', className)}
      onClick={toggle}
      suppressHydrationWarning
      aria-label={dark ? 'Use light mode' : 'Use dark mode'}
      title={dark ? 'Use light mode' : 'Use dark mode'}
    >
      {mounted && !dark ? <Moon /> : <Sun />}
    </Button>
  );
}
