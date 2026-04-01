import { Slider } from "~/components/ui";

const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 64;

export default function GridSizeControl(props: {
  gridSize: number;
  onChange: (value: number) => void;
  onCommit?: (value: number) => void;
}) {
  return (
    <div class="flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
      Grid
      <span class="w-24">
        <Slider
          fallback={<div class="h-3 w-full rounded-md bg-muted/80" role="presentation" />}
          min={MIN_GRID_SIZE}
          max={MAX_GRID_SIZE}
          step={4}
          value={[props.gridSize]}
          onValueChange={(values) => {
            const next = Array.isArray(values) ? values[0] : values;
            if (next !== undefined && next > 0) {
              props.onChange(next);
            }
          }}
          onValueCommitted={(values) => {
            const next = Array.isArray(values) ? values[0] : values;
            if (next !== undefined && next > 0) {
              props.onCommit?.(next);
            }
          }}
        />
      </span>
      <span class="w-8 text-center text-sm tabular-nums tracking-normal text-foreground">
        {props.gridSize}
      </span>
    </div>
  );
}
