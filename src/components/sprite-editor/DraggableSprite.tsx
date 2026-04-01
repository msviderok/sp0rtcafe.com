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
