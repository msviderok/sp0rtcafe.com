import { DragDropManager } from '@dnd-kit/dom';
import { DragDropProvider, DragOverlay } from '@dnd-kit/solid';
import { useMutation, useQuery } from 'convex-solidjs';
import { For, Show, createEffect, createMemo, createSignal, onCleanup, onMount } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import type { DndDebugSnapshot } from './dndDebug';
import SceneCanvas from './SceneCanvas';
import SpriteSidebar from './SpriteSidebar';
import { isDrawerSpriteDragData, type DrawerSprite } from './spriteDrag';

function createSceneLabel(index: number) {
	return `scene-${index}`;
}

export default function SpriteEditor() {
	const dragDropManager = new DragDropManager();
	const ensureStarterScene = useMutation(api.scenes.ensureStarterScene);
	const createScene = useMutation(api.scenes.create);
	const updateScene = useMutation(api.scenes.update);
	const deleteScene = useMutation(api.scenes.remove);
	const setDefaultScene = useMutation(api.scenes.setDefault);
	const scenes = useQuery(api.scenes.list, {});
	const [sceneId, setSceneId] = createSignal<Id<'scenes'>>();
	const [createName, setCreateName] = createSignal('');
	const [sceneName, setSceneName] = createSignal('');
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

	const sortedScenes = createMemo(() =>
		[...(scenes.data() ?? [])].sort((left, right) => {
			if (left.isDefault !== right.isDefault) {
				return left.isDefault ? -1 : 1;
			}

			return left.name.localeCompare(right.name);
		}),
	);
	const selectedScene = createMemo(() =>
		sortedScenes().find((scene) => scene._id === sceneId()) ?? null,
	);

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

	createEffect(() => {
		const currentScene = selectedScene();
		if (currentScene) {
			setSceneName(currentScene.name);
		}
	});

	createEffect(() => {
		const currentSceneId = sceneId();
		const availableScenes = sortedScenes();

		if (currentSceneId && availableScenes.some((scene) => scene._id === currentSceneId)) {
			return;
		}

		if (availableScenes[0]) {
			setSceneId(availableScenes[0]._id);
			updateDebugSnapshot({ sceneId: availableScenes[0]._id });
		}
	});

	onMount(() => {
		const params = new URLSearchParams(window.location.search);
		const fromQuery = params.get('dndDebug') === '1';
		const fromStorage = window.localStorage.getItem('sprite-editor:dnd-debug') === '1';
		setDebugEnabled(fromQuery || fromStorage);

		void ensureStarterScene.mutate({}).then((id) => {
			setSceneId(id);
			updateDebugSnapshot({ sceneId: id });
		});
	});

	onCleanup(() => dragDropManager.destroy());

	const handleCreateScene = async () => {
		const name = createName().trim() || createSceneLabel(sortedScenes().length + 1);
		const id = await createScene.mutate({ name });
		setCreateName('');
		setSceneId(id);
		updateDebugSnapshot({ sceneId: id });
	};

	const handleRenameScene = async () => {
		const currentScene = selectedScene();
		if (!currentScene) {
			return;
		}

		await updateScene.mutate({
			sceneId: currentScene._id,
			name: sceneName(),
		});
	};

	const handleDeleteScene = async () => {
		const currentScene = selectedScene();
		if (!currentScene) {
			return;
		}

		await deleteScene.mutate({ sceneId: currentScene._id });
	};

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
					<section class="rounded-3xl border border-border bg-card/70 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
						<div class="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
							<div class="flex flex-1 flex-col gap-3">
								<div>
									<div class="text-xs uppercase tracking-[0.28em] text-muted-foreground">Scenes</div>
									<div class="mt-1 text-sm text-muted-foreground">CRUD + default landing scene</div>
								</div>

								<div class="flex flex-wrap gap-2">
									<For each={sortedScenes()}>
										{(scene) => (
											<button
												class={`rounded-full border px-3 py-2 text-xs transition ${
													sceneId() === scene._id
														? 'border-primary bg-primary/10 text-foreground'
														: 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
												}`}
												type="button"
												onClick={() => {
													setSceneId(scene._id);
													updateDebugSnapshot({ sceneId: scene._id });
												}}
											>
												{scene.name}
												{scene.isDefault ? ' *' : ''}
											</button>
										)}
									</For>
								</div>
							</div>

							<div class="grid gap-3 md:grid-cols-[minmax(0,16rem)_auto_auto_auto]">
								<input
									class="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
									value={createName()}
									placeholder="new scene name"
									onInput={(event) => setCreateName(event.currentTarget.value)}
								/>
								<button
									class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
									type="button"
									onClick={() => void handleCreateScene()}
								>
									Create
								</button>
								<button
									class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
									type="button"
									disabled={!selectedScene()}
									onClick={() => selectedScene() && void setDefaultScene.mutate({ sceneId: selectedScene()!._id })}
								>
									Set default
								</button>
								<button
									class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
									type="button"
									disabled={!selectedScene()}
									onClick={() => void handleDeleteScene()}
								>
									Delete
								</button>
							</div>
						</div>

						<Show when={selectedScene()}>
							{(scene) => (
								<div class="mt-4 grid gap-3 border-t border-border pt-4 md:grid-cols-[minmax(0,18rem)_auto]">
									<input
										class="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
										value={sceneName()}
										onInput={(event) => setSceneName(event.currentTarget.value)}
									/>
									<div class="flex flex-wrap gap-2">
										<button
											class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
											type="button"
											onClick={() => void handleRenameScene()}
										>
											Save name
										</button>
										<div class="flex items-center rounded-xl border border-border px-3 text-xs text-muted-foreground">
											{scene().width} x {scene().height}
											{scene().isDefault ? ' default /' : ''}
										</div>
									</div>
								</div>
							)}
						</Show>
					</section>

					<SceneCanvas
						sceneId={sceneId()}
						sceneName={selectedScene()?.name}
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
