'use client';
/**
 * Extracted from app/page.tsx without behavior changes.
 * Owns the tow-move edit sheet: fields, validation display and save.
 */
import { AlertTriangle, Check } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import { timeLabel, towLocation, gate, moveErrors, type Move, type Report } from '@/lib/tows';

export const EDIT_FIELDS = [
  ['fin', 'FIN #', 'text'],
  ['arrFlight', 'Arrival flight', 'text'],
  ['from', 'Tow from', 'text'],
  ['to', 'Tow to', 'text'],
  ['pickup', 'Scheduled pickup', 'time'],
  ['release', 'Aircraft release', 'time'],
  ['gateOpen', 'Gate opens at', 'time'],
  ['depFlight', 'Departure flight', 'text'],
  ['depTime', 'Departure time', 'time'],
  ['actualPickup', 'Actual pickup', 'time'],
  ['actualDrop', 'Actual drop', 'time'],
  ['tower', 'Tower', 'text'],
] as const;

/** Pure helper: normalize a move's route fields per its kind, as page.tsx did on save. */
export function normalizedSavedMove(editing: Move): Move {
  const normalize =
    editing.kind === 'long' ||
    editing.kind === 'same-area' ||
    editing.kind === 'manual'
      ? towLocation
      : gate;
  return {
    ...editing,
    from: normalize(editing.from),
    to: normalize(editing.to),
    reviewed: true,
  };
}

type Props = {
  editing: Move | null;
  editError: string;
  report: Report;
  isNewManual: boolean;
  onChange: (m: Move) => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: (e: React.SyntheticEvent<HTMLFormElement>) => void;
};

export function TowMoveEditor({
  editing,
  editError,
  report,
  isNewManual,
  onChange,
  onOpenChange,
  onSubmit,
}: Props) {
  return (
    <Sheet open={!!editing} onOpenChange={onOpenChange}>
      <SheetContent className="edit-sheet">
        <SheetHeader>
          <SheetTitle>
            {isNewManual
              ? 'Add tow move'
              : `Edit tow · FIN ${editing?.fin || 'unassigned'}`}
          </SheetTitle>
          <SheetDescription>
            {isNewManual
              ? 'Enter the required route and pickup details.'
              : editing?.reason}
          </SheetDescription>
        </SheetHeader>
        {editing && (
          <form onSubmit={onSubmit} className="edit-form">
            {editing.kind === 'manual' ? (
              <div className="edit-source">
                Manual tow move · required fields are marked *
              </div>
            ) : (
              <div className="edit-source">
                Source:{' '}
                {timeLabel(
                  report.turns.find((t) => t.id === editing.turnId)?.arrival ??
                    null,
                  report.date,
                )}{' '}
                arrival ·{' '}
                {timeLabel(
                  report.turns.find((t) => t.id === editing.turnId)
                    ?.departure ?? null,
                  report.date,
                )}{' '}
                departure
              </div>
            )}
            {editing.warnings.map((w) => (
              <p key={w} className="edit-warning">
                <AlertTriangle size={15} />
                {w}
              </p>
            ))}
            <div className="edit-grid">
              {EDIT_FIELDS.map(([key, label, type]) => {
                const required = ['fin', 'from', 'to', 'pickup'].includes(key);
                return (
                  <label key={key} htmlFor={`tow-edit-${key}`}>
                    {label}
                    {required ? ' *' : ''}
                    <Input
                      id={`tow-edit-${key}`}
                      type={type}
                      required={required}
                      readOnly={key === 'depTime' && editing.kind !== 'manual'}
                      value={editing[key]}
                      onChange={(e) =>
                        onChange({
                          ...editing,
                          [key]: e.target.value,
                          reviewed: false,
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
            <label className="check-label" htmlFor="edit-included">
              <Checkbox
                id="edit-included"
                checked={editing.included}
                onCheckedChange={(v) => onChange({ ...editing, included: !!v })}
              />
              Include on tow sheet
            </label>
            {editError && (
              <p role="alert" className="warning-text">
                {editError}
              </p>
            )}
            <p className="muted">
              Saving confirms this route, timing and any warnings have been
              reviewed.
            </p>
            <Button type="submit" className="button primary">
              <Check size={17} />
              {isNewManual ? 'Add tow move' : 'Save & mark reviewed'}
            </Button>
          </form>
        )}
      </SheetContent>
    </Sheet>
  );
}

/** Pure save handler logic shared by page.tsx: validate, normalize, insert/replace. */
export function commitEditedMove(
  editing: Move,
  moves: Move[],
  reportDate: string,
): { saved: Move; creating: boolean } | { error: string } {
  const errors = moveErrors(editing, reportDate);
  if (errors.length) return { error: errors.join(' ') };
  const creating = !moves.some((m) => m.id === editing.id);
  return { saved: normalizedSavedMove(editing), creating };
}

export default TowMoveEditor;
