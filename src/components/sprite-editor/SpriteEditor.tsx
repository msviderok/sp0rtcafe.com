import { DragDropManager } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/solid';
import { useMutation } from 'convex-solidjs';
import { For, Show, createSignal, onCleanup, onMount } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { DndDebugSnapshot } from './dndDebug';
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
	const [isOverCanvas, setIsOverCanvas] = createSignal(false);
	const [activeDrawerSprite, setActiveDrawerSprite] = createSignal<DrawerSprite>();
	const [debugEnabled, setDebugEnabled] = createSignal(false);
	const [debugSnapshot, setDebugSnapshot] = createSignal<DndDebugSnapshot>({
		lastEvent: 'idle',
		drop: 'pending',
		hookDragging: 'idle',
	});
	const [debugLog, setDebugLog] = createSignal<string[]>([]);

	const updateDebugSnapshot = (next: DndDebugSnapshot) => {
		setDebugSnapshot((current) => ({
			...current,
			...next,
		}));
	};

	const reportDebugEvent = (event: string, detail?: string) => {
		if (!debugEnabled()) {
			return;
		}

		const stamp = new Date().toLocaleTimeString('en-GB', {
			hour12: false,
			hour: '2-digit',
			minute: '2-digit',
			second: '2-digit',
		});
		const line = detail ? `${stamp} ${event}: ${detail}` : `${stamp} ${event}`;
		setDebugLog((current) => [line, ...current].slice(0, 12));
		console.info('[dnd-debug]', event, detail ?? '');
	};

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const fromQuery = params.get('dndDebug') === '1';
		const fromStorage = window.localStorage.getItem('sprite-editor:dnd-debug') === '1';
		setDebugEnabled(fromQuery || fromStorage);

		void ensureScene
			.mutate({
				name: 'main',
				width: 1920,
				height: 1000,
			})
			.then((id) => {
				setSceneId(id);
				updateDebugSnapshot({ sceneId: id });
			});
	});

	onCleanup(() => dragDropManager.destroy());

	return (
		<DragDropProvider
			manager={dragDropManager}
			onBeforeDragStart={({ operation }) => {
				if (!isDrawerSpriteDragData(operation.source?.data)) {
					return;
				}

				updateDebugSnapshot({
					lastEvent: 'before drag start',
					activeSpriteKey: operation.source.data.sprite.key,
					sourceId: operation.source.data.spriteId,
					drop: 'pending',
				});
				reportDebugEvent('before drag start', operation.source.data.sprite.key);
			}}
			onDragStart={({ operation }) => {
				const data = operation.source?.data;
				if (!isDrawerSpriteDragData(data)) {
					return;
				}

				setActiveDrawerSprite(data.sprite);
				setIsDraggingSprite(true);
				updateDebugSnapshot({
					lastEvent: 'provider drag start',
					activeSpriteKey: data.sprite.key,
					sourceId: data.spriteId,
					hookDragging: data.sprite.key,
					drop: 'pending',
				});
				reportDebugEvent('provider drag start', data.sprite.key);
			}}
			onDragEnd={({ operation, canceled }) => {
				if (isDrawerSpriteDragData(operation.source?.data)) {
					setActiveDrawerSprite(undefined);
					setIsDraggingSprite(false);
					updateDebugSnapshot({
						lastEvent: canceled ? 'provider drag canceled' : 'provider drag end',
						hookDragging: 'idle',
					});
					reportDebugEvent(canceled ? 'provider drag canceled' : 'provider drag end', operation.source.data.sprite.key);
				}
			}}
		>
			<div class="min-h-screen bg-background text-foreground">
				<button
					class={`fixed bottom-4 left-4 z-[95] rounded-full border px-3 py-2 text-[11px] uppercase tracking-[0.22em] shadow-lg transition ${
						debugEnabled()
							? 'border-amber-500 bg-amber-500/90 text-black'
							: 'border-border bg-background/90 text-muted-foreground'
					}`}
					type="button"
					onClick={() => {
						const next = !debugEnabled();
						setDebugEnabled(next);
						window.localStorage.setItem('sprite-editor:dnd-debug', next ? '1' : '0');
						setDebugLog([]);
						reportDebugEvent(next ? 'debug enabled' : 'debug disabled');
					}}
				>
					DnD debug {debugEnabled() ? 'on' : 'off'}
				</button>

				<Show when={debugEnabled()}>
					<div class="fixed bottom-20 left-4 z-[95] w-[min(26rem,calc(100vw-2rem))] rounded-2xl border border-amber-500/40 bg-black/88 p-4 text-[11px] text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm">
						<div class="mb-3 flex items-center justify-between gap-3">
							<div class="text-[10px] uppercase tracking-[0.24em] text-amber-300">DnD debug</div>
							<div class="text-[10px] text-white/60">?dndDebug=1 also enables it</div>
						</div>
						<div class="grid grid-cols-2 gap-x-3 gap-y-1 text-white/80">
							<div>event</div>
							<div class="text-right text-white">{debugSnapshot().lastEvent ?? 'idle'}</div>
							<div>sprite</div>
							<div class="text-right text-white">{debugSnapshot().activeSpriteKey ?? 'none'}</div>
							<div>source</div>
							<div class="truncate text-right text-white">{debugSnapshot().sourceId ?? 'none'}</div>
							<div>scene</div>
							<div class="truncate text-right text-white">{debugSnapshot().sceneId ?? 'loading'}</div>
							<div>pointer</div>
							<div class="text-right text-white">{debugSnapshot().pointer ?? 'none'}</div>
							<div>canvas</div>
							<div class="text-right text-white">{debugSnapshot().canvasInside === undefined ? 'unknown' : debugSnapshot().canvasInside ? 'inside' : 'outside'}</div>
							<div>drop</div>
							<div class="text-right text-white">{debugSnapshot().drop ?? 'pending'}</div>
							<div>sprite ptr</div>
							<div class="truncate text-right text-white">{debugSnapshot().spritePointer ?? 'none'}</div>
							<div>hook drag</div>
							<div class="text-right text-white">{debugSnapshot().hookDragging ?? 'idle'}</div>
						</div>
						<div class="mt-3 border-t border-white/10 pt-3">
							<div class="mb-2 text-[10px] uppercase tracking-[0.24em] text-white/50">Recent</div>
							<div class="max-h-44 space-y-1 overflow-auto font-mono text-[10px] leading-4 text-white/75">
								<For each={debugLog()}>{(line) => <div>{line}</div>}</For>
							</div>
						</div>
					</div>
				</Show>

				<div class="mx-auto flex min-h-screen max-w-[2200px] flex-col gap-6 px-4 py-6 lg:px-6">
					<SceneCanvas
						sceneId={sceneId()}
						gridSize={gridSize()}
						showGrid={showGrid()}
						isDraggingSprite={isDraggingSprite()}
						debugEnabled={debugEnabled()}
						onGridSizeChange={setGridSize}
						onToggleGrid={() => setShowGrid((current) => !current)}
						onDragStateChange={setIsDraggingSprite}
					onDropTargetChange={setIsOverCanvas}
						onDebugEvent={reportDebugEvent}
						onDebugSnapshot={updateDebugSnapshot}
					/>
				</div>

				<SpriteSidebar
					debugEnabled={debugEnabled()}
					onDebugEvent={reportDebugEvent}
					onDebugSnapshot={updateDebugSnapshot}
				/>
			</div>

			<DragOverlay class="pointer-events-none z-[80]" dropAnimation={null}>
				<Show when={activeDrawerSprite() && !isOverCanvas()}>
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
