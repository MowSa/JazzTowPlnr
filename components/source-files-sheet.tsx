'use client';
import type { RefObject } from 'react';
import {
  Upload,
  FileSpreadsheet,
  Settings2,
  AlertTriangle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Popover,
  PopoverTrigger,
  PopoverContent,
  PopoverTitle,
  PopoverDescription,
} from '@/components/ui/popover';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet';
import type { AirportPlan } from '@/lib/gates';
import type { Report } from '@/lib/tows';

export type SourceFilesSheetProps = {
  sourcesOpen: boolean;
  setSourcesOpen: (open: boolean) => void;
  error: string;
  dragging: boolean;
  setDragging: (dragging: boolean) => void;
  fileName: string;
  report: Report;
  dateOverride: string;
  setDateOverride: (date: string) => void;
  loading: boolean;
  upload: (file: File) => Promise<void>;
  fileInput: RefObject<HTMLInputElement | null>;
  airport: AirportPlan | null;
  airportLoading: boolean;
  airportError: string;
  airportInput: RefObject<HTMLInputElement | null>;
  clearDesk: () => void;
};

export function SourceFilesSheet({
  sourcesOpen,
  setSourcesOpen,
  error,
  dragging,
  setDragging,
  fileName,
  report,
  dateOverride,
  setDateOverride,
  loading,
  upload,
  fileInput,
  airport,
  airportLoading,
  airportError,
  airportInput,
  clearDesk,
}: SourceFilesSheetProps) {
  return (
    <Sheet open={sourcesOpen} onOpenChange={setSourcesOpen}>
      <SheetContent className="edit-sheet source-manager">
        <SheetHeader>
          <SheetTitle>Source files</SheetTitle>
          <SheetDescription>
            Manage the operating day’s source data. Replacing the schedule
            resets working edits.
          </SheetDescription>
        </SheetHeader>
        {error && (
          <p role="alert" className="message error">
            {error}
          </p>
        )}
        <section
          className={`upload-panel ${dragging ? 'dragging' : ''}`}
          aria-label="Upload flight schedule"
        >
          <div className="source-heading">
            <span>
              <FileSpreadsheet size={15} /> FLIGHT SCHEDULE
            </span>
            <Popover>
              <PopoverTrigger
                className="source-options"
                aria-label="Schedule details and upload date"
              >
                <Settings2 size={16} />
              </PopoverTrigger>
              <PopoverContent align="end" className="source-popover">
                <PopoverTitle>Schedule details</PopoverTitle>
                <PopoverDescription>
                  Uploads are processed in your browser. Edits last for this
                  session.
                </PopoverDescription>
                <p className="source-full-name">{fileName}</p>
                <p>
                  {report.turns.length} aircraft turns · {report.cancelled}{' '}
                  cancelled entries skipped
                  {report.duplicates > 0
                    ? ` · ${report.duplicates} duplicates skipped`
                    : ''}
                </p>
                <label htmlFor="upload-date-override">
                  Upload date override
                  <Input
                    id="upload-date-override"
                    type="date"
                    value={dateOverride}
                    onChange={(e) => setDateOverride(e.target.value)}
                  />
                </label>
                <p className="muted">Leave blank to use the date in the CSV.</p>
              </PopoverContent>
            </Popover>
          </div>
          <div className="source-body">
            <div className="file-description">
              <strong title={fileName}>
                {fileName || 'No schedule uploaded'}
              </strong>
              <span>
                {dragging
                  ? 'Drop to load this schedule'
                  : !fileName
                    ? 'Start with a turn-view CSV'
                    : report.turns.length + ' aircraft turns loaded'}
              </span>
            </div>
            <Button
              className="button upload-button"
              variant="outline"
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node | null))
                  setDragging(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                if (e.dataTransfer.files[0])
                  void upload(e.dataTransfer.files[0]);
              }}
              onClick={() => fileInput.current?.click()}
              disabled={loading}
            >
              <Upload size={16} />
              {loading ? 'Reading…' : 'Upload CSV'}
            </Button>
          </div>
        </section>
        <section className="source-airport">
          <h3>AIRPORT PLAN</h3>
          <strong>{airport?.name || 'No airport workbook loaded'}</strong>
          <p>
            {airport
              ? `${airport.assignments.length} assignments · ${airport.date || 'Report date unavailable'}`
              : 'Upload the daily airport planning workbook to verify gates or view occupancy.'}
          </p>
          <Button
            variant="outline"
            className="button"
            disabled={airportLoading}
            onClick={() => airportInput.current?.click()}
          >
            {airportLoading
              ? 'Reading workbook…'
              : airport
                ? 'Replace airport plan'
                : 'Upload airport plan'}
          </Button>
          {airportError && (
            <p role="alert" className="warning-text">
              {airportError}
            </p>
          )}
        </section>
        {airport?.date && airport.date !== report.date && (
          <div className="source-date-warning">
            <AlertTriangle size={18} />
            <div>
              <strong>Source dates differ</strong>
              <p>
                Turn schedule: {report.date}
                <br />
                Airport plan: {airport.date}
              </p>
            </div>
          </div>
        )}
        <p className="source-session-note">
          The working plan stays in this browser tab across refresh. Use Clear
          desk to start empty. Download reports before closing.
        </p>
        <Button
          variant="outline"
          className="button source-clear-desk"
          onClick={clearDesk}
          disabled={!fileName && !airport}
        >
          Clear desk
        </Button>
      </SheetContent>
    </Sheet>
  );
}
