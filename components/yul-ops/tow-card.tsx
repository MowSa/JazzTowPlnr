'use client';

import { useState } from 'react';
import { Truck } from 'lucide-react';
import type { TowLink } from '@/lib/yul-ops/tow-link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { applyTowPickup } from './use-tow-plan';

function slipLabel(slipMin: number) {
  if (Math.abs(slipMin) < 5) return 'On plan';
  return `${slipMin > 0 ? '+' : '−'}${Math.abs(slipMin)} min`;
}

function slipClass(link: TowLink) {
  if (!link.suggest) return '';
  return link.slipMin > 0 ? 'is-late' : 'is-early';
}

/** Compact pickup chip for a flight-list card. */
export function TowChip({ link }: { link: TowLink }) {
  return (
    <span
      className={cn('yul-tow-chip', slipClass(link))}
      title={
        link.suggest
          ? `Tow pickup ${link.planned} · live ETA suggests ${link.etaPickup}`
          : `Tow pickup ${link.planned}`
      }
    >
      <Truck size={12} aria-hidden="true" />
      {link.planned}
      {link.suggest && <> → {link.etaPickup}</>}
    </span>
  );
}

/** Tow-plan section in the selected-flight panel, with a one-click re-time. */
export function TowPlanCard({ link }: { link: TowLink }) {
  const [status, setStatus] = useState<'idle' | 'saved' | 'failed'>('idle');
  const { move } = link;
  return (
    <section className="yul-tow" aria-label="Tow plan">
      <header>
        <Truck size={15} aria-hidden="true" />
        <strong>Tow plan</strong>
        <span>
          FIN {move.fin || '—'} · {move.from || '—'} → {move.to || '—'}
        </span>
      </header>
      <div className="yul-times">
        <div>
          <span>Planned pickup</span>
          <strong>{link.planned}</strong>
        </div>
        <div>
          <span>From live ETA</span>
          <strong>{link.etaPickup}</strong>
          <small className={cn('yul-tow-slip', slipClass(link))}>{slipLabel(link.slipMin)}</small>
        </div>
      </div>
      {move.actualPickup && <p>Tow started at {move.actualPickup}; pickup is not re-timed.</p>}
      {!move.actualPickup && !link.suggest && link.slipMin < 0 && (
        <p>Arriving early. The pickup is held by gate availability, so it stays put.</p>
      )}
      {status === 'saved' && <p>Pickup updated. Review it on the Tow plan before issuing.</p>}
      {status === 'failed' && <p>Could not save to the tow plan in this tab.</p>}
      {link.suggest && status !== 'saved' && (
        <Button
          type="button"
          variant="outline"
          className="mt-2 h-9 w-full"
          onClick={() => setStatus(applyTowPickup(move.id, link.etaPickup) ? 'saved' : 'failed')}
        >
          Move pickup to {link.etaPickup}
        </Button>
      )}
    </section>
  );
}
