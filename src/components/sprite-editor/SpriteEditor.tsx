import { DragDropManager } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/solid';
import { useMutation } from 'convex-solidjs';
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import SceneCanvas from './SceneCanvas';
import SpriteSidebar from './SpriteSidebar';
import { isDrawerSpriteDragData, type DrawerSprite } from './spriteDrag';

export default function SpriteEditor() {
	const dragDropManager = new DragDropManager();
	const ensureScene = useMutation(api.scenes.ensure);
	const [sceneId, setSceneId] = createSignal<Id<'scenes'>>();
	const [gridSize, setGridSize] = createSignal(32);
	const [showGrid, setShowGrid] = createSignal(true);
	const [isDraggingSprite, setIsDraggingSprite] = createSignal(false);
	const [activeDrawerSprite, setActiveDrawerSprite] = createSignal<DrawerSprite>();

	onMount(() => {
		void ensureScene
			.mutate({
				name: 'main',
				width: 1920,
				height: 1000,
			})
			.then((id) => setSceneId(id));
	});

	onCleanup(() => dragDropManager.destroy());

	return (
		<DragDropProvider
			manager={dragDropManager}
			onDragStart={({ operation }) => {
				const data = operation.source?.data;
				if (!isDrawerSpriteDragData(data)) {
					return;
				}

				setActiveDrawerSprite(data.sprite);
				setIsDraggingSprite(true);
			}}
			onDragEnd={({ operation }) => {
				if (isDrawerSpriteDragData(operation.source?.data)) {
					setActiveDrawerSprite(undefined);
					setIsDraggingSprite(false);
				}
			}}
		>
			<div class="min-h-screen bg-background text-foreground">
				<div class="mx-auto flex min-h-screen max-w-[2200px] flex-col gap-6 px-4 py-6 pr-24 lg:px-6 lg:pr-24">
					<SceneCanvas
						sceneId={sceneId()}
						gridSize={gridSize()}
						showGrid={showGrid()}
						isDraggingSprite={isDraggingSprite()}
						onGridSizeChange={setGridSize}
						onToggleGrid={() => setShowGrid((current) => !current)}
						onDragStateChange={setIsDraggingSprite}
					/>
				</div>

				<SpriteSidebar />
			</div>

			<DragOverlay class="pointer-events-none z-[80]" dropAnimation={null}>
				<Show when={activeDrawerSprite()}>
					{(sprite) => (
						<div class="flex h-14 w-14 items-center justify-center rounded-lg bg-card/90 p-1 shadow-[0_8px_24px_rgba(0,0,0,0.3)] backdrop-blur-sm">
							<img alt={sprite().key} class="max-h-full max-w-full object-contain" src={sprite().url} />
						</div>
					)}
				</Show>
			</DragOverlay>
		</DragDropProvider>
	);
}
