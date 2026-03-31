import { DragDropManager } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/solid';
import { useMutation } from 'convex-solidjs';
import { Show, createSignal, onCleanup, onMount } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import SceneCanvas from './SceneCanvas';
import SpriteDrawer from './SpriteDrawer';
import { isDrawerSpriteDragData, type DrawerSprite } from './spriteDrag';

export default function SpriteEditor() {
	const dragDropManager = new DragDropManager();
	const ensureScene = useMutation(api.scenes.ensure);
	const [sceneId, setSceneId] = createSignal<Id<'scenes'>>();
	const [gridSize, setGridSize] = createSignal(32);
	const [drawerOpen, setDrawerOpen] = createSignal(true);
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
			<div class="min-h-screen bg-[linear-gradient(180deg,#281913_0%,#120c0a_100%)] text-white">
				<div class="mx-auto flex min-h-screen max-w-[2200px] flex-col gap-6 px-4 py-6 lg:px-6">
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

				{!drawerOpen() ? (
					<button
						class="fixed right-4 top-4 z-30 rounded-full border border-white/10 bg-black/45 px-4 py-2 text-sm text-white/75 shadow-lg backdrop-blur-sm transition hover:bg-white/10"
						type="button"
						onClick={() => setDrawerOpen(true)}
					>
						Open drawer
					</button>
				) : null}

				<SpriteDrawer open={drawerOpen()} onClose={() => setDrawerOpen(false)} />
			</div>

			<DragOverlay class="pointer-events-none z-[80]" dropAnimation={null}>
				<Show when={activeDrawerSprite()}>
					{(sprite) => (
						<div class="w-[164px] rounded-2xl border border-white/20 bg-[#201611]/90 p-3 text-left shadow-[0_24px_60px_rgba(0,0,0,0.45)] backdrop-blur-sm">
							<div class="flex h-28 items-center justify-center rounded-xl bg-black/30 p-2">
								<img alt={sprite().key} class="max-h-full max-w-full object-contain" src={sprite().url} />
							</div>
							<div class="mt-3 space-y-1">
								<div class="text-sm font-semibold text-white">{sprite().key}</div>
								<div class="text-xs text-white/55">
									{sprite().width} x {sprite().height}
								</div>
							</div>
						</div>
					)}
				</Show>
			</DragOverlay>
		</DragDropProvider>
	);
}
