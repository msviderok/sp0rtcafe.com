import { useDraggable } from '@dnd-kit/solid';
import { createEffect } from 'solid-js';
import type { DndDebugReporter, DndDebugSnapshotReporter } from './dndDebug';
import { DRAWER_SPRITE_DRAG_TYPE, type DrawerSprite } from './spriteDrag';

export default function DraggableSprite(props: {
	sprite: DrawerSprite;
	debugEnabled?: boolean;
	onDebugEvent?: DndDebugReporter;
	onDebugSnapshot?: DndDebugSnapshotReporter;
}) {
	let lastDraggingState: boolean | undefined;

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

	createEffect(() => {
		if (!props.debugEnabled) {
			return;
		}

		const dragging = isDragging();
		if (lastDraggingState === undefined) {
			lastDraggingState = dragging;
			if (!dragging) {
				return;
			}
		}

		if (lastDraggingState === dragging) {
			return;
		}

		lastDraggingState = dragging;
		props.onDebugSnapshot?.({
			hookDragging: dragging ? props.sprite.key : 'idle',
		});
		props.onDebugEvent?.(dragging ? 'hook drag active' : 'hook drag idle', props.sprite.key);
	});

		return (
			<button
				ref={(element) => {
					ref(element);
					handleRef(element);
				}}
				type="button"
				title={`${props.sprite.key} (${props.sprite.width}\u00d7${props.sprite.height})`}
				data-dnd-sprite={props.sprite.key}
				class={`touch-none flex h-12 w-12 cursor-grab items-center justify-center rounded-lg border border-transparent bg-muted/50 p-1 transition hover:border-primary/30 hover:bg-accent active:cursor-grabbing ${isDragging() ? 'opacity-40' : ''}`}
			onPointerDown={(event) => {
				if (!props.debugEnabled) {
					return;
				}

				const pointer = `${Math.round(event.clientX)}, ${Math.round(event.clientY)}`;
				props.onDebugSnapshot?.({
					spritePointer: `${props.sprite.key} @ ${pointer}`,
					activeSpriteKey: props.sprite.key,
					sourceId: props.sprite._id,
					lastEvent: 'sprite pointer down',
					pointer,
				});
				props.onDebugEvent?.('sprite pointer down', `${props.sprite.key} @ ${pointer}`);
			}}
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
