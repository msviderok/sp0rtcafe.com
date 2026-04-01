import { useDraggable } from '@dnd-kit/solid';
import { DRAWER_SPRITE_DRAG_TYPE, type DrawerSprite } from './spriteDrag';

export default function DraggableSprite(props: { sprite: DrawerSprite }) {
	const { ref, isDragging } = useDraggable({
		id: props.sprite._id,
		type: DRAWER_SPRITE_DRAG_TYPE,
		feedback: 'clone',
		data: {
			kind: 'drawer-sprite',
			spriteId: props.sprite._id,
			sprite: props.sprite,
		},
	});

	return (
		<button
			ref={ref}
			type="button"
			title={`${props.sprite.key} (${props.sprite.width}\u00d7${props.sprite.height})`}
			class={`flex h-12 w-12 cursor-grab items-center justify-center rounded-lg border border-transparent bg-muted/50 p-1 transition hover:border-primary/30 hover:bg-accent active:cursor-grabbing ${isDragging() ? 'opacity-40' : ''}`}
		>
			<img
				alt={props.sprite.key}
				class="max-h-full max-w-full object-contain"
				src={props.sprite.url}
				draggable={false}
			/>
		</button>
	);
}
