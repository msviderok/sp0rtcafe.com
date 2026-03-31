import { useMutation, useQuery } from 'convex-solidjs';
import type { DragEventHandler } from 'solid-js';
import { For, Show, createEffect, createMemo, createSignal, onCleanup } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import GridOverlay from './GridOverlay';
import GridSizeControl from './GridSizeControl';
import PlacedSprite from './PlacedSprite';

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
					<div class="text-xs uppercase tracking-[0.28em] text-white/45">Scene canvas</div>
					<h1 class="text-2xl font-semibold text-white">Main scene</h1>
				</div>
				<div class="flex flex-wrap items-center gap-3">
					<GridSizeControl gridSize={props.gridSize} onChange={props.onGridSizeChange} />
					<button
						class="rounded-full border border-white/10 bg-black/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10"
						type="button"
						onClick={props.onToggleGrid}
					>
						{props.showGrid ? 'Hide grid' : 'Show grid'}
					</button>
				</div>
			</div>

			<div class="overflow-auto rounded-[28px] border border-white/10 bg-black/25 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
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

	const [selectedAssetId, setSelectedAssetId] = createSignal<Id<'sceneAssets'> | null>(null);
	const [localTransforms, setLocalTransforms] = createSignal<Record<string, LocalTransform>>({});
	const [editingAsset, setEditingAsset] = createSignal<EditingAsset | null>(null);

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

	const onDrop: DragEventHandler<HTMLDivElement, DragEvent> = async (event) => {
		event.preventDefault();
		props.onDragStateChange(false);

		const spriteId = event.dataTransfer?.getData('spriteId') as Id<'sprites'> | '';

		if (!spriteId || !canvasRef) {
			return;
		}

		const rect = canvasRef.getBoundingClientRect();
		const rawX = event.clientX - rect.left;
		const rawY = event.clientY - rect.top;
		const x = Math.max(0, Math.min(SCENE_WIDTH, snapToGrid(rawX, props.gridSize)));
		const y = Math.max(0, Math.min(SCENE_HEIGHT, snapToGrid(rawY, props.gridSize)));

		await placeAsset.mutate({
			sceneId: props.sceneId,
			spriteId,
			x,
			y,
		});
	};

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
			onDragOver={(event) => {
				event.preventDefault();
				props.onDragStateChange(true);
			}}
			onDragLeave={() => props.onDragStateChange(false)}
			onDrop={onDrop}
			onPointerDown={() => setSelectedAssetId(null)}
		>
			<Show
				when={!assets.isLoading()}
				fallback={<div class="absolute left-6 top-6 text-sm text-white/55">Loading scene...</div>}
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
										setSelectedAssetId(null);
										setLocalTransforms((current) => {
											const next = { ...current };
											delete next[asset._id];
											return next;
										});
										void removeAsset.mutate({ assetId: asset._id });
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
	children?: import('solid-js').JSXElement;
	ref?: (element: HTMLDivElement) => void;
	onDragOver?: DragEventHandler<HTMLDivElement, DragEvent>;
	onDragLeave?: DragEventHandler<HTMLDivElement, DragEvent>;
	onDrop?: DragEventHandler<HTMLDivElement, DragEvent>;
	onPointerDown?: (event: PointerEvent) => void;
}) {
	return (
		<div
			ref={props.ref}
			class="relative overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,214,153,0.14),_transparent_35%),linear-gradient(180deg,#34231b_0%,#1e1512_48%,#140d0b_100%)]"
			style={{
				width: `${SCENE_WIDTH}px`,
				height: `${SCENE_HEIGHT}px`,
			}}
			onDragOver={props.onDragOver}
			onDragLeave={props.onDragLeave}
			onDrop={props.onDrop}
			onPointerDown={props.onPointerDown}
		>
			<GridOverlay gridSize={props.gridSize} visible={props.showGrid} />
			<div class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.16)_18%,rgba(0,0,0,0.48)_100%)]" />
			<div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,244,214,0.08)_0%,transparent_100%)]" />
			{props.children}
		</div>
	);
}
