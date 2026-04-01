import { useDraggable } from '@dnd-kit/solid';
import { DRAWER_SPRITE_DRAG_TYPE, type DrawerSprite } from './spriteDrag';

export default function DraggableSprite(props: {
	sprite: DrawerSprite;
}) {
	const { ref, handleRef, isDragging } = useDraggable({
		id: props.sprite._id,
		type: DRAWER_SPRITE_DRAG_TYPE,
		feedback: 'clone',
		data: {
			kind: 'drawer-sprite',
			spriteId: props.sprite._id,
			sprite: props.sprite,
		},
	});

	const displayName = () => props.sprite.key.replace(/\.[^.]+$/, '');

	return (
		<button
			ref={(element) => {
				ref(element);
				handleRef(element);
			}}
			type="button"
			data-dnd-sprite={props.sprite.key}
			class={`touch-none flex w-full cursor-grab items-center gap-2.5 rounded-lg border border-transparent bg-muted/50 p-1.5 text-left transition hover:border-primary/30 hover:bg-accent active:cursor-grabbing ${isDragging() ? 'opacity-40' : ''}`}
		>
			<div class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted/60">
				<img
					alt={props.sprite.key}
					class="max-h-full max-w-full object-contain"
					src={props.sprite.url}
					draggable={false}
				/>
			</div>
			<div class="min-w-0 flex-1">
				<div class="truncate text-[11px] leading-tight text-foreground/80">{displayName()}</div>
				<div class="mt-0.5 text-[10px] tabular-nums text-muted-foreground">{props.sprite.width}×{props.sprite.height}</div>
			</div>
		</button>
	);
}
