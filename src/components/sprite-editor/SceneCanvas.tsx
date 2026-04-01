import { useDragDropMonitor } from '@dnd-kit/solid';
import { useMutation, useQuery } from 'convex-solidjs';
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import GridOverlay from './GridOverlay';
import GridSizeControl from './GridSizeControl';
import PlacedSprite from './PlacedSprite';
import { isDrawerSpriteDragData } from './spriteDrag';

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1000;

const snapToGrid = (value: number, grid: number) => Math.round(value / grid) * grid;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const normalizeRotation = (value: number) => {
	const normalized = value % 360;
	return normalized < 0 ? normalized + 360 : normalized;
};

type ResizeHandle = 'nw' | 'ne' | 'sw' | 'se';

type LocalTransform = {
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	locked: boolean;
};

type DeletedAssetSnapshot = {
	sceneId: Id<'scenes'>;
	spriteId: Id<'sprites'>;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	locked: boolean;
};

type EditingAsset = {
	assetId: Id<'sceneAssets'>;
	mode: 'move' | 'resize' | 'rotate';
	handle?: ResizeHandle;
	startClientX: number;
	startClientY: number;
	startX: number;
	startY: number;
	startWidth: number;
	startHeight: number;
	startRotation: number;
	startCenterX: number;
	startCenterY: number;
	nextX: number;
	nextY: number;
	nextWidth: number;
	nextHeight: number;
	nextRotation: number;
	locked: boolean;
};

export default function SceneCanvas(props: {
	sceneId?: Id<'scenes'>;
	gridSize: number;
	showGrid: boolean;
	isDraggingSprite: boolean;
	onGridSizeChange: (value: number) => void;
	onToggleGrid: () => void;
	onDragStateChange: (isDragging: boolean) => void;
}) {
	const showGrid = createMemo(() => props.showGrid || props.isDraggingSprite);

	return (
		<section class="flex min-w-0 flex-1 flex-col gap-4">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<div>
					<div class="text-xs uppercase tracking-[0.28em] text-muted-foreground">Scene canvas</div>
					<h1 class="text-2xl font-semibold text-foreground">Main scene</h1>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<GridSizeControl gridSize={props.gridSize} onChange={props.onGridSizeChange} />
					<button
						class="rounded-full border border-border bg-muted/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground transition hover:bg-accent"
						type="button"
						onClick={props.onToggleGrid}
					>
						{props.showGrid ? 'Hide grid' : 'Show grid'}
					</button>
				</div>
			</div>

			<div class="overflow-auto rounded-[28px] border border-border bg-muted/25 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
				<Show when={props.sceneId} fallback={<CanvasFrame gridSize={props.gridSize} showGrid={showGrid()} />}>
					{(sceneId) => (
						<CanvasWithScene
							sceneId={sceneId()}
							gridSize={props.gridSize}
							showGrid={showGrid()}
							onDragStateChange={props.onDragStateChange}
						/>
					)}
				</Show>
			</div>
		</section>
	);
}

function CanvasWithScene(props: {
	sceneId: Id<'scenes'>;
	gridSize: number;
	showGrid: boolean;
	onDragStateChange: (isDragging: boolean) => void;
}) {
	let canvasRef: HTMLDivElement | undefined;

	const assets = useQuery(api.sceneAssets.listByScene, () => ({ sceneId: props.sceneId }));
	const placeAsset = useMutation(api.sceneAssets.place);
	const updateAsset = useMutation(api.sceneAssets.update);
	const removeAsset = useMutation(api.sceneAssets.remove);
	const restoreAsset = useMutation(api.sceneAssets.restore);

	const [selectedAssetId, setSelectedAssetId] = createSignal<Id<'sceneAssets'> | null>(null);
	const [localTransforms, setLocalTransforms] = createSignal<Record<string, LocalTransform>>({});
	const [editingAsset, setEditingAsset] = createSignal<EditingAsset | null>(null);
	const [deletedStack, setDeletedStack] = createSignal<DeletedAssetSnapshot[]>([]);
	const [isDropTarget, setIsDropTarget] = createSignal(false);

	const placedAssets = createMemo(() => assets.data() ?? []);

	createEffect(() => {
		const allAssets = placedAssets();
		if (allAssets.length === 0) {
			return;
		}

		setLocalTransforms((current) => {
			let changed = false;
			const next = { ...current };

			for (const asset of allAssets) {
				const local = next[asset._id];
				if (!local) {
					continue;
				}

				if (
					local.x === asset.x &&
					local.y === asset.y &&
					local.width === asset.width &&
					local.height === asset.height &&
					local.rotation === (asset.rotation ?? 0) &&
					local.locked === (asset.locked ?? false)
				) {
					delete next[asset._id];
					changed = true;
				}
			}

			return changed ? next : current;
		});
	});

	const getCanvasPointerPosition = (clientX: number, clientY: number) => {
		if (!canvasRef) {
			return null;
		}

		const rect = canvasRef.getBoundingClientRect();
		const rawX = clientX - rect.left;
		const rawY = clientY - rect.top;
		const inside = rawX >= 0 && rawX <= rect.width && rawY >= 0 && rawY <= rect.height;

		return {
			inside,
			rawX,
			rawY,
		};
	};

	useDragDropMonitor({
		onDragStart: ({ operation }) => {
			if (isDrawerSpriteDragData(operation.source?.data)) {
				props.onDragStateChange(true);
				setIsDropTarget(false);
			}
		},
		onDragMove: ({ operation, nativeEvent }) => {
			if (!isDrawerSpriteDragData(operation.source?.data)) {
				return;
			}

			const fallbackPosition = operation.position as { current?: { x: number; y: number } };
			const clientX = nativeEvent instanceof PointerEvent ? nativeEvent.clientX : fallbackPosition.current?.x;
			const clientY = nativeEvent instanceof PointerEvent ? nativeEvent.clientY : fallbackPosition.current?.y;

			if (clientX === undefined || clientY === undefined) {
				setIsDropTarget(false);
				return;
			}

			setIsDropTarget(getCanvasPointerPosition(clientX, clientY)?.inside ?? false);
		},
		onDragEnd: ({ operation, nativeEvent, canceled }) => {
			if (!isDrawerSpriteDragData(operation.source?.data)) {
				return;
			}

			props.onDragStateChange(false);

			const fallbackPosition = operation.position as { current?: { x: number; y: number } };
			const clientX = nativeEvent instanceof PointerEvent ? nativeEvent.clientX : fallbackPosition.current?.x;
			const clientY = nativeEvent instanceof PointerEvent ? nativeEvent.clientY : fallbackPosition.current?.y;

			if (clientX === undefined || clientY === undefined) {
				setIsDropTarget(false);
				return;
			}

			const pointerPosition = getCanvasPointerPosition(clientX, clientY);
			setIsDropTarget(false);

			if (canceled || !pointerPosition?.inside) {
				return;
			}

			const x = Math.max(0, Math.min(SCENE_WIDTH, snapToGrid(pointerPosition.rawX, props.gridSize)));
			const y = Math.max(0, Math.min(SCENE_HEIGHT, snapToGrid(pointerPosition.rawY, props.gridSize)));

			void placeAsset.mutate({
				sceneId: props.sceneId,
				spriteId: operation.source.data.spriteId,
				x,
				y,
			});
		},
	});

	const deleteAsset = (
		asset: {
			_id: Id<'sceneAssets'>;
			sceneId: Id<'scenes'>;
			spriteId: Id<'sprites'>;
		},
		view: LocalTransform,
	) => {
		setDeletedStack((current) => [
			...current,
			{
				sceneId: asset.sceneId,
				spriteId: asset.spriteId,
				x: view.x,
				y: view.y,
				width: view.width,
				height: view.height,
				rotation: view.rotation,
				locked: view.locked,
			},
		]);
		setSelectedAssetId(null);
		setLocalTransforms((current) => {
			const next = { ...current };
			delete next[asset._id];
			return next;
		});
		void removeAsset.mutate({ assetId: asset._id });
	};

	createEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'z') {
				const snapshots = deletedStack();
				const latest = snapshots.at(-1);
				if (!latest) {
					return;
				}

				event.preventDefault();
				setDeletedStack((current) => current.slice(0, -1));
				void restoreAsset.mutate(latest);
				return;
			}

			if (event.key !== 'Delete' && event.key !== 'Backspace') {
				return;
			}

			const assetId = selectedAssetId();
			if (!assetId) {
				return;
			}

			const asset = placedAssets().find((item) => item._id === assetId);
			if (!asset) {
				return;
			}

			const local = localTransforms()[assetId];
			const locked = local?.locked ?? asset.locked ?? false;
			if (locked) {
				return;
			}
			event.preventDefault();
			deleteAsset(asset, {
				x: local?.x ?? asset.x,
				y: local?.y ?? asset.y,
				width: local?.width ?? asset.width,
				height: local?.height ?? asset.height,
				rotation: local?.rotation ?? asset.rotation ?? 0,
				locked: local?.locked ?? asset.locked ?? false,
			});
		};

		window.addEventListener('keydown', handleKeyDown);
		onCleanup(() => window.removeEventListener('keydown', handleKeyDown));
	});

	createEffect(() => {
		const currentEdit = editingAsset();
		if (!currentEdit) {
			return;
		}

		props.onDragStateChange(true);

		const handlePointerMove = (event: PointerEvent) => {
			setEditingAsset((previous) => {
				if (!previous) {
					return previous;
				}

				const deltaX = event.clientX - previous.startClientX;
				const deltaY = event.clientY - previous.startClientY;

				if (previous.mode === 'move') {
					return {
						...previous,
						nextX: clamp(
							snapToGrid(previous.startX + deltaX, props.gridSize),
							0,
							Math.max(0, SCENE_WIDTH - previous.startWidth),
						),
						nextY: clamp(
							snapToGrid(previous.startY + deltaY, props.gridSize),
							0,
							Math.max(0, SCENE_HEIGHT - previous.startHeight),
						),
					};
				}

				if (previous.mode === 'rotate') {
					const startAngle = Math.atan2(
						previous.startClientY - previous.startCenterY,
						previous.startClientX - previous.startCenterX,
					);
					const currentAngle = Math.atan2(event.clientY - previous.startCenterY, event.clientX - previous.startCenterX);

					return {
						...previous,
						nextRotation: normalizeRotation(previous.startRotation + ((currentAngle - startAngle) * 180) / Math.PI),
					};
				}

				const widthCandidate =
					previous.handle === 'nw' || previous.handle === 'sw'
						? previous.startWidth - deltaX
						: previous.startWidth + deltaX;
				const heightCandidate =
					previous.handle === 'nw' || previous.handle === 'ne'
						? previous.startHeight - deltaY
						: previous.startHeight + deltaY;
				const widthScale = widthCandidate / previous.startWidth;
				const heightScale = heightCandidate / previous.startHeight;
				const dominantScale = Math.abs(widthScale - 1) > Math.abs(heightScale - 1) ? widthScale : heightScale;
				const aspectRatio = previous.startWidth / previous.startHeight;
				const maxWidthByBounds =
					previous.handle === 'nw' || previous.handle === 'sw'
						? previous.startX + previous.startWidth
						: SCENE_WIDTH - previous.startX;
				const maxHeightByBounds =
					previous.handle === 'nw' || previous.handle === 'ne'
						? previous.startY + previous.startHeight
						: SCENE_HEIGHT - previous.startY;
				const maxWidth = Math.max(props.gridSize, Math.min(maxWidthByBounds, maxHeightByBounds * aspectRatio));
				const nextWidth = clamp(
					snapToGrid(
						previous.startWidth * Math.max(props.gridSize / previous.startWidth, dominantScale),
						props.gridSize,
					),
					props.gridSize,
					maxWidth,
				);
				const nextHeight = Math.max(props.gridSize, Math.round(nextWidth / aspectRatio));

				const nextX =
					previous.handle === 'nw' || previous.handle === 'sw'
						? previous.startX + (previous.startWidth - nextWidth)
						: previous.startX;
				const nextY =
					previous.handle === 'nw' || previous.handle === 'ne'
						? previous.startY + (previous.startHeight - nextHeight)
						: previous.startY;

				return {
					...previous,
					nextX,
					nextY,
					nextWidth,
					nextHeight,
				};
			});
		};

		const handlePointerUp = () => {
			const finalEdit = editingAsset();
			props.onDragStateChange(false);

			if (finalEdit) {
				setLocalTransforms((current) => ({
					...current,
					[finalEdit.assetId]: {
						x: finalEdit.nextX,
						y: finalEdit.nextY,
						width: finalEdit.nextWidth,
						height: finalEdit.nextHeight,
						rotation: finalEdit.nextRotation,
						locked: finalEdit.locked,
					},
				}));

				void updateAsset.mutate({
					assetId: finalEdit.assetId,
					x: finalEdit.nextX,
					y: finalEdit.nextY,
					width: finalEdit.nextWidth,
					height: finalEdit.nextHeight,
					rotation: finalEdit.nextRotation,
				});
			}

			setEditingAsset(null);
		};

		window.addEventListener('pointermove', handlePointerMove);
		window.addEventListener('pointerup', handlePointerUp);

		onCleanup(() => {
			window.removeEventListener('pointermove', handlePointerMove);
			window.removeEventListener('pointerup', handlePointerUp);
			props.onDragStateChange(false);
		});
	});

	const startEdit = (
		asset: {
			_id: Id<'sceneAssets'>;
			x: number;
			y: number;
			width: number;
			height: number;
			rotation?: number;
			locked?: boolean;
		},
		mode: EditingAsset['mode'],
		event: PointerEvent,
		handle?: ResizeHandle,
	) => {
		if (asset.locked) {
			return;
		}

		const centerX = asset.x + asset.width / 2;
		const centerY = asset.y + asset.height / 2;

		setEditingAsset({
			assetId: asset._id,
			mode,
			handle,
			startClientX: event.clientX,
			startClientY: event.clientY,
			startX: asset.x,
			startY: asset.y,
			startWidth: asset.width,
			startHeight: asset.height,
			startRotation: asset.rotation ?? 0,
			startCenterX: centerX,
			startCenterY: centerY,
			nextX: asset.x,
			nextY: asset.y,
			nextWidth: asset.width,
			nextHeight: asset.height,
			nextRotation: asset.rotation ?? 0,
			locked: asset.locked ?? false,
		});
	};

	return (
		<CanvasFrame
			ref={(element) => {
				canvasRef = element;
			}}
			gridSize={props.gridSize}
			showGrid={props.showGrid}
			isDropTarget={isDropTarget()}
			onPointerDown={() => setSelectedAssetId(null)}
		>
			<Show
				when={!assets.isLoading()}
				fallback={<div class="absolute left-6 top-6 text-sm text-muted-foreground">Loading scene...</div>}
			>
				<For each={placedAssets()}>
					{(asset) =>
						(() => {
							const currentEdit = createMemo(() => (editingAsset()?.assetId === asset._id ? editingAsset() : null));
							const localTransform = createMemo(() => localTransforms()[asset._id]);
							const view = createMemo(() => ({
								x: currentEdit()?.nextX ?? localTransform()?.x ?? asset.x,
								y: currentEdit()?.nextY ?? localTransform()?.y ?? asset.y,
								width: currentEdit()?.nextWidth ?? localTransform()?.width ?? asset.width,
								height: currentEdit()?.nextHeight ?? localTransform()?.height ?? asset.height,
								rotation: currentEdit()?.nextRotation ?? localTransform()?.rotation ?? asset.rotation ?? 0,
								locked: localTransform()?.locked ?? asset.locked ?? false,
							}));

							return (
								<PlacedSprite
									sprite={{
										url: asset.sprite.url,
										width: view().width,
										height: view().height,
									}}
									x={view().x}
									y={view().y}
									rotation={view().rotation}
									locked={view().locked}
									isSelected={selectedAssetId() === asset._id}
									onSelect={() => setSelectedAssetId(asset._id)}
									onMoveStart={(event) => {
										event.stopPropagation();
										event.preventDefault();
										setSelectedAssetId(asset._id);
										startEdit(
											{
												...asset,
												...view(),
											},
											'move',
											event,
										);
									}}
									onResizeStart={(handle, event) => {
										event.preventDefault();
										setSelectedAssetId(asset._id);
										startEdit(
											{
												...asset,
												...view(),
											},
											'resize',
											event,
											handle,
										);
									}}
									onRotateStart={(event) => {
										event.preventDefault();
										setSelectedAssetId(asset._id);
										startEdit(
											{
												...asset,
												...view(),
											},
											'rotate',
											event,
										);
									}}
									onDelete={() => {
										deleteAsset(asset, view());
									}}
									onToggleLock={() => {
										const nextLocked = !view().locked;
										setLocalTransforms((current) => ({
											...current,
											[asset._id]: {
												x: view().x,
												y: view().y,
												width: view().width,
												height: view().height,
												rotation: view().rotation,
												locked: nextLocked,
											},
										}));
										void updateAsset.mutate({
											assetId: asset._id,
											locked: nextLocked,
										});
									}}
								/>
							);
						})()
					}
				</For>
			</Show>
		</CanvasFrame>
	);
}

function CanvasFrame(props: {
	gridSize: number;
	showGrid: boolean;
	isDropTarget?: boolean;
	children?: import('solid-js').JSXElement;
	ref?: (element: HTMLDivElement) => void;
	onPointerDown?: (event: PointerEvent) => void;
}) {
	return (
		<div
			ref={props.ref}
			class={`relative overflow-hidden rounded-[24px] border bg-[radial-gradient(circle_at_top,_rgba(255,214,153,0.14),_transparent_35%),linear-gradient(180deg,#34231b_0%,#1e1512_48%,#140d0b_100%)] transition-colors ${props.isDropTarget ? 'border-primary/70 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent),0_0_42px_color-mix(in_oklch,var(--primary)_16%,transparent)]' : 'border-border'}`}
			style={{
				width: `${SCENE_WIDTH}px`,
				height: `${SCENE_HEIGHT}px`,
			}}
			onPointerDown={props.onPointerDown}
		>
			<GridOverlay gridSize={props.gridSize} visible={props.showGrid} />
			<div class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.16)_18%,rgba(0,0,0,0.48)_100%)]" />
			<div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,244,214,0.08)_0%,transparent_100%)]" />
			{props.children}
		</div>
	);
}
