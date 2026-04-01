import { Slider } from '~/components/ui';

export default function GridSizeControl(props: { gridSize: number; onChange: (value: number) => void }) {
	return (
		<div class="flex items-center gap-3 rounded-full border border-border bg-muted/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground">
			Grid
			<span class="w-24">
				<Slider
					fallback={<div class="h-3 w-full rounded-md bg-muted/80" role="presentation" />}
					min={8}
					max={128}
					step={8}
					value={[props.gridSize]}
					onValueChange={(values) => {
						const next = Array.isArray(values) ? values[0] : values;
						if (next !== undefined && next > 0) {
							props.onChange(next);
						}
					}}
				/>
			</span>
			<span class="w-8 text-center text-sm tabular-nums tracking-normal text-foreground">{props.gridSize}</span>
		</div>
	);
}
