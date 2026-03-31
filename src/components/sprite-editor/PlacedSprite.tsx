export type SceneSprite = {
	url: string;
	width: number;
	height: number;
};

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

export default function PlacedSprite(props: {
	sprite: SceneSprite;
	x: number;
	y: number;
	rotation: number;
	locked: boolean;
	isSelected: boolean;
	onSelect: () => void;
	onMoveStart: (event: PointerEvent) => void;
	onResizeStart: (handle: ResizeHandle, event: PointerEvent) => void;
	onRotateStart: (event: PointerEvent) => void;
	onDelete: () => void;
	onToggleLock: () => void;
}) {
	const handlePositions: Record<ResizeHandle, string> = {
		nw: 'left-0 top-0 -translate-x-[1px] -translate-y-[1px] border-l-2 border-t-2',
		ne: 'right-0 top-0 translate-x-[1px] -translate-y-[1px] border-r-2 border-t-2',
		sw: 'bottom-0 left-0 -translate-x-[1px] translate-y-[1px] border-b-2 border-l-2',
		se: 'bottom-0 right-0 translate-x-[1px] translate-y-[1px] border-b-2 border-r-2',
	};

	return (
		<div
			class="absolute"
			style={{
				left: `${props.x}px`,
				top: `${props.y}px`,
				width: `${props.sprite.width}px`,
				height: `${props.sprite.height}px`,
				transform: `rotate(${props.rotation}deg)`,
				'transform-origin': 'center center',
			}}
		>
			<div
				class="absolute inset-0 bg-no-repeat bg-size-[100%_100%] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] touch-none"
				style={{
					'background-image': `url(${props.sprite.url})`,
				}}
				onPointerDown={(event) => {
					event.stopPropagation();
					props.onSelect();
					if (!props.locked) {
						props.onMoveStart(event);
					}
				}}
			/>

			{props.isSelected ? (
				<>
					<div
						class="pointer-events-none absolute inset-0 border-2 border-solid"
						style={{
							borderColor: 'rgb(255 217 122 / 1)',
							'box-shadow': '0 0 0 1px rgb(0 0 0 / 0.5), 0 0 18px rgb(255 201 102 / 0.28)',
						}}
					/>

					<div class="absolute -top-10 left-1/2 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
						<button
							class="rounded-full px-2 py-1 transition hover:bg-white/10"
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								props.onToggleLock();
							}}
						>
							{props.locked ? 'Unlock' : 'Lock'}
						</button>
						<button
							class={`rounded-full px-2 py-1 transition hover:bg-white/10 ${props.locked ? 'cursor-not-allowed text-white/30' : 'text-rose-200'}`}
							type="button"
							onPointerDown={(event) => event.stopPropagation()}
							onClick={(event) => {
								event.stopPropagation();
								if (!props.locked) {
									props.onDelete();
								}
							}}
						>
							Delete
						</button>
					</div>

					<div class="absolute left-1/2 top-0 h-5 w-px -translate-x-1/2 -translate-y-full bg-[#ffd58a]/70" />
					<div
						class={`absolute left-1/2 top-0 h-3 w-3 -translate-x-1/2 -translate-y-[22px] rounded-full border border-[#2d190f] bg-[#ffd58a] ${props.locked ? 'cursor-not-allowed opacity-35' : 'cursor-grab'}`}
						onPointerDown={(event) => {
							event.stopPropagation();
							if (!props.locked) {
								props.onRotateStart(event);
							}
						}}
					/>

					{(['nw', 'ne', 'sw', 'se'] as ResizeHandle[]).map((handle) => (
						<div
							class={`absolute h-3 w-3 opacity-90 ${handlePositions[handle]} ${props.locked ? 'pointer-events-none opacity-35' : 'cursor-se-resize'}`}
							onPointerDown={(event) => {
								event.stopPropagation();
								if (!props.locked) {
									props.onResizeStart(handle, event);
								}
							}}
						/>
					))}
				</>
			) : null}
		</div>
	);
}
