type DrawerSprite = {
	_id: string;
	key: string;
	url: string;
	width: number;
	height: number;
};

export default function DraggableSprite(props: {
	sprite: DrawerSprite;
	onDragStart: () => void;
	onDragEnd: () => void;
}) {
	return (
		<button
			type="button"
			draggable
			class="group flex cursor-grab flex-col gap-3 rounded-2xl border border-white/10 bg-white/5 p-3 text-left transition hover:border-white/25 hover:bg-white/10 active:cursor-grabbing"
			onDragStart={(event) => {
				event.dataTransfer?.setData('spriteId', props.sprite._id);
				event.dataTransfer?.setData('text/plain', props.sprite._id);
				props.onDragStart();
			}}
			onDragEnd={props.onDragEnd}
		>
			<div class="flex h-28 items-center justify-center rounded-xl bg-black/30 p-2">
				<img alt={props.sprite.key} class="max-h-full max-w-full object-contain" src={props.sprite.url} />
			</div>
			<div class="space-y-1">
				<div class="text-sm font-semibold text-white">{props.sprite.key}</div>
				<div class="text-xs text-white/55">
					{props.sprite.width} x {props.sprite.height}
				</div>
			</div>
		</button>
	);
}
