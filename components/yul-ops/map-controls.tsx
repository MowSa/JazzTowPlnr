'use client';

import { Crosshair, Globe, LocateFixed, Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export function MapControls({
  onHome,
  onGlobe,
  onZoomIn,
  onZoomOut,
}: {
  onHome: () => void;
  onGlobe: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}) {
  return (
    <div className="yul-map-controls yul-glass">
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-10 rounded-xl yul-map-btn"
              aria-label="Return to YUL"
              onClick={onHome}
            />
          }
        >
          <Crosshair />
        </TooltipTrigger>
        <TooltipContent>Return to YUL</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-10 rounded-xl yul-map-btn"
              aria-label="Regional globe view"
              onClick={onGlobe}
            />
          }
        >
          <Globe />
        </TooltipTrigger>
        <TooltipContent>Regional globe view</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-10 rounded-xl yul-map-btn"
              aria-label="Zoom in"
              onClick={onZoomIn}
            />
          }
        >
          <Plus />
        </TooltipTrigger>
        <TooltipContent>Zoom in</TooltipContent>
      </Tooltip>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              type="button"
              variant="ghost"
              size="icon-lg"
              className="size-10 rounded-xl yul-map-btn"
              aria-label="Zoom out"
              onClick={onZoomOut}
            />
          }
        >
          <Minus />
        </TooltipTrigger>
        <TooltipContent>Zoom out</TooltipContent>
      </Tooltip>
    </div>
  );
}

export function ViewSwitch({
  mode,
  onMode,
}: {
  mode: '2D' | '3D';
  onMode: (mode: '2D' | '3D') => void;
}) {
  return (
    <ToggleGroup
      className="yul-view-switch yul-glass"
      spacing={0}
      value={[mode]}
      onValueChange={(values) => {
        const next = values[0];
        if (next === '2D' || next === '3D') onMode(next);
      }}
      aria-label="Map view"
    >
      <ToggleGroupItem value="2D" className="h-8 rounded-full px-3.5">
        2D
      </ToggleGroupItem>
      <ToggleGroupItem value="3D" className="h-8 rounded-full px-3.5">
        3D
      </ToggleGroupItem>
    </ToggleGroup>
  );
}

export function FollowPill({ label, onStop }: { label: string; onStop: () => void }) {
  return (
    <output className="yul-follow-pill yul-glass" aria-live="polite">
      <span className="plane" aria-hidden="true">
        <LocateFixed size={15} />
      </span>
      Following {label}
      <Button
        type="button"
        size="sm"
        variant="secondary"
        className="rounded-full"
        onClick={onStop}
      >
        Stop
      </Button>
    </output>
  );
}
