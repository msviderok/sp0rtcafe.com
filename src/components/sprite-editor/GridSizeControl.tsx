export default function GridSizeControl(props: { gridSize: number; onChange: (value: number) => void }) {
	return (
		<label class="flex items-center gap-3 rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70">
			Grid
			<input
				class="w-20 rounded-md border border-white/10 bg-white/10 px-2 py-1 text-sm tracking-normal text-white outline-none"
				min="8"
				max="128"
				step="8"
				type="number"
				value={props.gridSize}
				onInput={(event) => {
					const nextValue = Number(event.currentTarget.value);
					if (Number.isFinite(nextValue) && nextValue > 0) {
						props.onChange(nextValue);
					}
				}}
			/>
		</label>
	);
}
