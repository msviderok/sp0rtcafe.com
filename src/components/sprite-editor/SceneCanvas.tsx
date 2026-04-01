import { useDragDropMonitor } from "@dnd-kit/solid";
import { createHotkey } from "@tanstack/solid-hotkeys";
import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { DEFAULT_BG_REPEAT, DEFAULT_BG_SIZE, getSpriteBackgroundStyle } from "~/lib/sceneStyles";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DndDebugReporter, DndDebugSnapshotReporter } from "./dndDebug";
import GridOverlay from "./GridOverlay";
import PlacedSprite from "./PlacedSprite";
import { isDrawerSpriteDragData, type DrawerSprite } from "./spriteDrag";

const SCENE_WIDTH = 1920;
const SCENE_HEIGHT = 1000;

const snapToGrid = (value: number, grid: number) => Math.round(value / grid) * grid;
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);
const normalizeRotation = (value: number) => {
  const normalized = value % 360;
  return normalized < 0 ? normalized + 360 : normalized;
};
const isEditableEventTarget = (target: EventTarget | null) => {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.closest("input, textarea, select, [contenteditable='true'], [role='textbox']") !== null
  );
};

type ResizeHandle = "nw" | "ne" | "sw" | "se" | "n" | "e" | "s" | "w";

type LocalTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
  locked: boolean;
};

type DeletedAssetSnapshot = {
  sceneId: Id<"scenes">;
  spriteId: Id<"sprites">;
  x: number;
  y: number;
  width: number;
  height: number;
  zIndex: number;
  rotation: number;
  locked: boolean;
  bgRepeat?: string;
  bgPosition?: string;
  bgSize?: string;
};

type EditingAsset = {
  assetId: Id<"sceneAssets">;
  mode: "move" | "resize" | "rotate";
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
  canResizeFreely: boolean;
};

type Marquee = { startX: number; startY: number; endX: number; endY: number };

type BulkMoveState = {
  startClientX: number;
  startClientY: number;
  startPositions: Record<string, { x: number; y: number }>;
};

type BulkResizeState = {
  handle: "nw" | "ne" | "sw" | "se";
  startClientX: number;
  startClientY: number;
  startBBox: { x: number; y: number; width: number; height: number };
  startSizes: Record<string, { x: number; y: number; width: number; height: number }>;
};

export default function SceneCanvas(props: {
  sceneId?: Id<"scenes">;
  sceneName?: string;
  gridSize: number;
  showGrid: boolean;
  isDraggingSprite: boolean;
  debugEnabled?: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  onDropTargetChange?: (isOver: boolean) => void;
  onDebugEvent?: DndDebugReporter;
  onDebugSnapshot?: DndDebugSnapshotReporter;
}) {
  const showGrid = createMemo(() => props.showGrid || props.isDraggingSprite);

  return (
    <section class="flex min-w-0 flex-1 flex-col gap-4">
      <div class="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div class="text-xs uppercase tracking-[0.28em] text-muted-foreground">Scene canvas</div>
          <h1 class="text-2xl font-semibold text-foreground">{props.sceneName ?? "Scene"}</h1>
        </div>
      </div>

      <div class="overflow-auto">
        <Show
          when={props.sceneId}
          fallback={<CanvasFrame gridSize={props.gridSize} showGrid={showGrid()} />}
        >
          {(sceneId) => (
            <CanvasWithScene
              sceneId={sceneId()}
              gridSize={props.gridSize}
              showGrid={showGrid()}
              onDragStateChange={props.onDragStateChange}
              onDropTargetChange={props.onDropTargetChange}
              debugEnabled={props.debugEnabled}
              onDebugEvent={props.onDebugEvent}
              onDebugSnapshot={props.onDebugSnapshot}
            />
          )}
        </Show>
      </div>
    </section>
  );
}

function CanvasWithScene(props: {
  sceneId: Id<"scenes">;
  gridSize: number;
  showGrid: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  onDropTargetChange?: (isOver: boolean) => void;
  debugEnabled?: boolean;
  onDebugEvent?: DndDebugReporter;
  onDebugSnapshot?: DndDebugSnapshotReporter;
}) {
  let canvasRef: HTMLDivElement | undefined;
  let lastInsideState = false;

  const assets = useQuery(api.sceneAssets.listByScene, () => ({ sceneId: props.sceneId }));
  const placeAsset = useMutation(api.sceneAssets.place);
  const reorderAssetLayers = useMutation(api.sceneAssets.reorder);
  const updateAsset = useMutation(api.sceneAssets.update);
  const removeAsset = useMutation(api.sceneAssets.remove);
  const restoreAsset = useMutation(api.sceneAssets.restore);

  const [selectedAssetIds, setSelectedAssetIds] = createSignal<Set<Id<"sceneAssets">>>(new Set());
  const [localTransforms, setLocalTransforms] = createSignal<Record<string, LocalTransform>>({});
  const [editingAsset, setEditingAsset] = createSignal<EditingAsset | null>(null);
  const [deletedStack, setDeletedStack] = createSignal<DeletedAssetSnapshot[]>([]);
  const [isDropTarget, setIsDropTarget] = createSignal(false);
  const [dragGhost, setDragGhost] = createSignal<{
    x: number;
    y: number;
    sprite: DrawerSprite;
    pending: boolean;
  } | null>(null);
  const [marquee, setMarquee] = createSignal<Marquee | null>(null);
  const [bulkMove, setBulkMove] = createSignal<BulkMoveState | null>(null);
  const [bulkResize, setBulkResize] = createSignal<BulkResizeState | null>(null);
  const [styleEditorAssetId, setStyleEditorAssetId] = createSignal<Id<"sceneAssets"> | null>(null);
  const [widthDraft, setWidthDraft] = createSignal("");
  const [heightDraft, setHeightDraft] = createSignal("");
  const [bgRepeatDraft, setBgRepeatDraft] = createSignal(DEFAULT_BG_REPEAT);
  const [bgPositionDraft, setBgPositionDraft] = createSignal("");
  const [bgSizeDraft, setBgSizeDraft] = createSignal(DEFAULT_BG_SIZE);
  let assetsCountAtDrop = -1;

  // Derived: single selected asset id (when exactly one selected)
  const singleSelectedId = createMemo(() => {
    const ids = selectedAssetIds();
    if (ids.size === 1) {
      return [...ids][0];
    }
    return null;
  });

  const getAssetOrderValue = (
    asset: { _creationTime: number; zIndex?: number },
    local?: LocalTransform
  ) => local?.zIndex ?? asset.zIndex ?? asset._creationTime;
  const placedAssets = createMemo(() => assets.data() ?? []);
  const orderedPlacedAssets = createMemo(() =>
    [...placedAssets()].sort((left, right) => {
      const leftOrder = getAssetOrderValue(left, localTransforms()[left._id]);
      const rightOrder = getAssetOrderValue(right, localTransforms()[right._id]);
      return leftOrder - rightOrder || left._creationTime - right._creationTime;
    })
  );
  const styleEditorAsset = createMemo(() => {
    const assetId = styleEditorAssetId();
    if (!assetId) {
      return null;
    }

    return placedAssets().find((asset) => asset._id === assetId) ?? null;
  });

  createEffect(() => {
    const selectedId = singleSelectedId();
    if (!selectedId || styleEditorAssetId() !== selectedId) {
      setStyleEditorAssetId(null);
    }
  });

  createEffect(() => {
    const current = styleEditorAsset();
    if (!current) {
      return;
    }

    const view = getAssetView(current);
    setWidthDraft(String(view.width));
    setHeightDraft(String(view.height));
    setBgRepeatDraft(current.bgRepeat ?? current.sprite.bgRepeat ?? DEFAULT_BG_REPEAT);
    setBgPositionDraft(current.bgPosition ?? current.sprite.bgPosition ?? "");
    setBgSizeDraft(current.bgSize ?? current.sprite.bgSize ?? DEFAULT_BG_SIZE);
  });

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
          local.zIndex === (asset.zIndex ?? asset._creationTime) &&
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

  createEffect(() => {
    props.onDebugSnapshot?.({
      sceneId: props.sceneId,
    });
  });

  createEffect(() => {
    props.onDropTargetChange?.(isDropTarget());
  });

  createEffect(() => {
    const count = placedAssets().length;
    if (dragGhost()?.pending && count > assetsCountAtDrop) {
      setDragGhost(null);
      assetsCountAtDrop = -1;
    }
  });

  useDragDropMonitor({
    onDragStart: ({ operation }) => {
      if (isDrawerSpriteDragData(operation.source?.data)) {
        props.onDragStateChange(true);
        setIsDropTarget(false);
        setDragGhost(null);
        lastInsideState = false;
        props.onDebugSnapshot?.({
          lastEvent: "drag start",
          activeSpriteKey: operation.source.data.sprite.key,
          sourceId: operation.source.data.spriteId,
          canvasInside: false,
          drop: "pending",
        });
        props.onDebugEvent?.("drag start", operation.source.data.sprite.key);
      }
    },
    onDragMove: ({ operation, nativeEvent }) => {
      if (!isDrawerSpriteDragData(operation.source?.data)) {
        return;
      }

      const fallbackPosition = operation.position as { current?: { x: number; y: number } };
      const clientX =
        nativeEvent instanceof PointerEvent ? nativeEvent.clientX : fallbackPosition.current?.x;
      const clientY =
        nativeEvent instanceof PointerEvent ? nativeEvent.clientY : fallbackPosition.current?.y;

      if (clientX === undefined || clientY === undefined) {
        setIsDropTarget(false);
        props.onDebugSnapshot?.({
          lastEvent: "drag move missing pointer",
          pointer: "missing",
          canvasInside: false,
        });
        props.onDebugEvent?.("drag move missing pointer");
        return;
      }

      const pointerPosition = getCanvasPointerPosition(clientX, clientY);
      const pointer = `${Math.round(clientX)}, ${Math.round(clientY)}`;
      const inside = pointerPosition?.inside ?? false;
      setIsDropTarget(inside);

      if (inside && pointerPosition) {
        const sprite = operation.source.data.sprite;
        setDragGhost({
          x: Math.max(
            0,
            Math.min(
              SCENE_WIDTH - sprite.width,
              snapToGrid(pointerPosition.rawX - sprite.width / 2, props.gridSize)
            )
          ),
          y: Math.max(
            0,
            Math.min(
              SCENE_HEIGHT - sprite.height,
              snapToGrid(pointerPosition.rawY - sprite.height / 2, props.gridSize)
            )
          ),
          sprite,
          pending: false,
        });
      } else {
        setDragGhost(null);
      }

      props.onDebugSnapshot?.({
        lastEvent: "drag move",
        pointer,
        canvasInside: inside,
      });

      if (inside !== lastInsideState) {
        lastInsideState = inside;
        props.onDebugEvent?.(inside ? "canvas entered" : "canvas left", pointer);
      }
    },
    onDragEnd: ({ operation, nativeEvent, canceled }) => {
      if (!isDrawerSpriteDragData(operation.source?.data)) {
        return;
      }

      props.onDragStateChange(false);

      const fallbackPosition = operation.position as { current?: { x: number; y: number } };
      const clientX =
        nativeEvent instanceof PointerEvent ? nativeEvent.clientX : fallbackPosition.current?.x;
      const clientY =
        nativeEvent instanceof PointerEvent ? nativeEvent.clientY : fallbackPosition.current?.y;

      if (clientX === undefined || clientY === undefined) {
        setIsDropTarget(false);
        setDragGhost(null);
        props.onDebugSnapshot?.({
          lastEvent: "drag end missing pointer",
          pointer: "missing",
          canvasInside: false,
          drop: "rejected: missing pointer",
        });
        props.onDebugEvent?.("drop rejected", "missing pointer");
        return;
      }

      const pointerPosition = getCanvasPointerPosition(clientX, clientY);
      const pointer = `${Math.round(clientX)}, ${Math.round(clientY)}`;
      setIsDropTarget(false);
      lastInsideState = false;

      if (canceled || !pointerPosition?.inside) {
        setDragGhost(null);
        props.onDebugSnapshot?.({
          lastEvent: canceled ? "drag canceled" : "drop rejected",
          pointer,
          canvasInside: pointerPosition?.inside ?? false,
          drop: canceled ? "rejected: canceled" : "rejected: outside canvas",
        });
        props.onDebugEvent?.(
          canceled ? "drag canceled" : "drop rejected",
          canceled ? pointer : `${pointer} outside canvas`
        );
        return;
      }

      const sprite = operation.source.data.sprite;
      const x = Math.max(
        0,
        Math.min(
          SCENE_WIDTH - sprite.width,
          snapToGrid(pointerPosition.rawX - sprite.width / 2, props.gridSize)
        )
      );
      const y = Math.max(
        0,
        Math.min(
          SCENE_HEIGHT - sprite.height,
          snapToGrid(pointerPosition.rawY - sprite.height / 2, props.gridSize)
        )
      );
      props.onDebugSnapshot?.({
        lastEvent: "drop accepted",
        pointer,
        canvasInside: true,
        drop: `${x}, ${y}`,
      });
      props.onDebugEvent?.("drop accepted", `${operation.source.data.sprite.key} -> ${x}, ${y}`);

      // Transition ghost to pending so it stays visible until Convex syncs
      assetsCountAtDrop = placedAssets().length;
      setDragGhost({ x, y, sprite, pending: true });

      void placeAsset.mutate({
        sceneId: props.sceneId,
        spriteId: operation.source.data.spriteId,
        x,
        y,
      });
    },
  });

  const getAssetView = (asset: {
    _id: Id<"sceneAssets">;
    _creationTime: number;
    x: number;
    y: number;
    width: number;
    height: number;
    zIndex?: number;
    rotation?: number;
    locked?: boolean;
  }) => {
    const local = localTransforms()[asset._id];
    return {
      x: local?.x ?? asset.x,
      y: local?.y ?? asset.y,
      width: local?.width ?? asset.width,
      height: local?.height ?? asset.height,
      zIndex: local?.zIndex ?? asset.zIndex ?? asset._creationTime,
      rotation: local?.rotation ?? asset.rotation ?? 0,
      locked: local?.locked ?? asset.locked ?? false,
    };
  };

  const canAssetResizeFreely = (asset: { bgRepeat?: string; sprite: { bgRepeat?: string } }) =>
    (asset.bgRepeat ?? asset.sprite.bgRepeat ?? DEFAULT_BG_REPEAT) !== "none";

  const deleteAsset = (
    asset: {
      _id: Id<"sceneAssets">;
      sceneId: Id<"scenes">;
      spriteId: Id<"sprites">;
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
    },
    view: LocalTransform
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
        zIndex: view.zIndex,
        rotation: view.rotation,
        locked: view.locked,
        bgRepeat: asset.bgRepeat,
        bgPosition: asset.bgPosition,
        bgSize: asset.bgSize,
      },
    ]);
    setSelectedAssetIds((prev) => {
      const next = new Set(prev);
      next.delete(asset._id);
      return next;
    });
    setLocalTransforms((current) => {
      const next = { ...current };
      delete next[asset._id];
      return next;
    });
    void removeAsset.mutate({ assetId: asset._id });
  };

  const bulkDelete = () => {
    const ids = selectedAssetIds();
    const all = placedAssets();
    for (const id of ids) {
      const asset = all.find((a) => a._id === id);
      if (!asset) continue;
      const view = getAssetView(asset);
      if (view.locked) continue;
      deleteAsset(asset, view);
    }
    setSelectedAssetIds(new Set());
  };

  const applyAssetPatch = async (
    asset: {
      _id: Id<"sceneAssets">;
      _creationTime: number;
      x: number;
      y: number;
      width: number;
      height: number;
      zIndex?: number;
      rotation?: number;
      locked?: boolean;
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
      sprite: {
        key: string;
        url: string;
        bgRepeat?: string;
        bgPosition?: string;
        bgSize?: string;
      };
    },
    patch: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
      rotation?: number;
      locked?: boolean;
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
    }
  ) => {
    const view = getAssetView(asset);
    const nextWidth = patch.width ?? view.width;
    const nextHeight = patch.height ?? view.height;
    const nextX = clamp(patch.x ?? view.x, 0, Math.max(0, SCENE_WIDTH - nextWidth));
    const nextY = clamp(patch.y ?? view.y, 0, Math.max(0, SCENE_HEIGHT - nextHeight));
    const nextRotation = patch.rotation ?? view.rotation;
    const nextLocked = patch.locked ?? view.locked;
    const nextZIndex = patch.zIndex ?? view.zIndex;

    setLocalTransforms((current) => ({
      ...current,
      [asset._id]: {
        x: nextX,
        y: nextY,
        width: nextWidth,
        height: nextHeight,
        zIndex: nextZIndex,
        rotation: nextRotation,
        locked: nextLocked,
      },
    }));

    await updateAsset.mutate({
      assetId: asset._id,
      x: nextX,
      y: nextY,
      width: nextWidth,
      height: nextHeight,
      zIndex: nextZIndex,
      rotation: nextRotation,
      locked: nextLocked,
      ...(patch.bgRepeat !== undefined ? { bgRepeat: patch.bgRepeat } : {}),
      ...(patch.bgPosition !== undefined ? { bgPosition: patch.bgPosition } : {}),
      ...(patch.bgSize !== undefined ? { bgSize: patch.bgSize } : {}),
    });
  };

  const handleApplyAssetSize = async () => {
    const asset = styleEditorAsset();
    const width = Number(widthDraft().trim());
    const height = Number(heightDraft().trim());

    if (
      !asset ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) {
      return;
    }

    await applyAssetPatch(asset, {
      width: snapToGrid(width, props.gridSize),
      height: snapToGrid(height, props.gridSize),
    });
  };

  const handleSaveAssetStyle = async () => {
    const asset = styleEditorAsset();
    if (!asset) {
      return;
    }

    await applyAssetPatch(asset, {
      bgRepeat: bgRepeatDraft() || DEFAULT_BG_REPEAT,
      bgPosition: bgPositionDraft().trim(),
      bgSize: bgSizeDraft().trim() || DEFAULT_BG_SIZE,
    });
  };

  const applyTilePreset = async (preset: "2x2" | "4x2" | "wall" | "ground" | "fill") => {
    const asset = styleEditorAsset();
    if (!asset) {
      return;
    }

    if (preset === "2x2") {
      await applyAssetPatch(asset, {
        width: props.gridSize * 2,
        height: props.gridSize * 2,
      });
      return;
    }

    if (preset === "4x2") {
      await applyAssetPatch(asset, {
        width: props.gridSize * 4,
        height: props.gridSize * 2,
      });
      return;
    }

    if (preset === "wall") {
      await applyAssetPatch(asset, {
        x: 0,
        width: SCENE_WIDTH,
        height: props.gridSize * 10,
        bgRepeat: "repeat",
        bgSize: `${props.gridSize}px ${props.gridSize}px`,
      });
      return;
    }

    if (preset === "ground") {
      const height = props.gridSize * 4;
      await applyAssetPatch(asset, {
        x: 0,
        y: SCENE_HEIGHT - height,
        width: SCENE_WIDTH,
        height,
        bgRepeat: "repeat",
        bgSize: `${props.gridSize}px ${props.gridSize}px`,
      });
      return;
    }

    await applyAssetPatch(asset, {
      x: 0,
      y: 0,
      width: SCENE_WIDTH,
      height: SCENE_HEIGHT,
      bgRepeat: "repeat",
      bgSize: `${props.gridSize}px ${props.gridSize}px`,
    });
  };

  const moveSelectedAssetLayers = async (direction: "backward" | "forward") => {
    const selected = selectedAssetIds();
    if (selected.size === 0) {
      return;
    }

    const reordered = [...orderedPlacedAssets()];
    if (direction === "forward") {
      for (let index = reordered.length - 2; index >= 0; index -= 1) {
        if (selected.has(reordered[index]._id) && !selected.has(reordered[index + 1]._id)) {
          [reordered[index], reordered[index + 1]] = [reordered[index + 1], reordered[index]];
        }
      }
    } else {
      for (let index = 1; index < reordered.length; index += 1) {
        if (selected.has(reordered[index]._id) && !selected.has(reordered[index - 1]._id)) {
          [reordered[index - 1], reordered[index]] = [reordered[index], reordered[index - 1]];
        }
      }
    }

    const updates = reordered.flatMap((asset, index) => {
      const nextZIndex = index + 1;
      return getAssetOrderValue(asset, localTransforms()[asset._id]) === nextZIndex
        ? []
        : [{ assetId: asset._id, zIndex: nextZIndex }];
    });

    if (updates.length === 0) {
      return;
    }

    setLocalTransforms((current) => {
      const next = { ...current };
      for (const update of updates) {
        const asset = reordered.find((item) => item._id === update.assetId);
        if (!asset) {
          continue;
        }

        const local = current[asset._id];
        next[asset._id] = {
          x: local?.x ?? asset.x,
          y: local?.y ?? asset.y,
          width: local?.width ?? asset.width,
          height: local?.height ?? asset.height,
          zIndex: update.zIndex,
          rotation: local?.rotation ?? asset.rotation ?? 0,
          locked: local?.locked ?? asset.locked ?? false,
        };
      }
      return next;
    });

    await reorderAssetLayers.mutate({ updates });
  };

  createHotkey(
    "Mod+[",
    () => {
      void moveSelectedAssetLayers("backward");
    },
    () => ({
      enabled: selectedAssetIds().size > 0,
      ignoreInputs: true,
    })
  );

  createHotkey(
    "Mod+]",
    () => {
      void moveSelectedAssetLayers("forward");
    },
    () => ({
      enabled: selectedAssetIds().size > 0,
      ignoreInputs: true,
    })
  );

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isEditableEventTarget(event.target)) {
        return;
      }

      if (event.key === "Escape") {
        setSelectedAssetIds(new Set());
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z") {
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

      if (event.key !== "Delete" && event.key !== "Backspace") {
        return;
      }

      const ids = selectedAssetIds();

      // Bulk delete
      if (ids.size > 1) {
        event.preventDefault();
        bulkDelete();
        return;
      }

      // Single delete
      const assetId = singleSelectedId();
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
        zIndex: local?.zIndex ?? asset.zIndex ?? asset._creationTime,
        rotation: local?.rotation ?? asset.rotation ?? 0,
        locked: local?.locked ?? asset.locked ?? false,
      });
    };

    window.addEventListener("keydown", handleKeyDown);
    onCleanup(() => window.removeEventListener("keydown", handleKeyDown));
  });

  // Single-asset edit effect (unchanged)
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

        if (previous.mode === "move") {
          return {
            ...previous,
            nextX: clamp(
              snapToGrid(previous.startX + deltaX, props.gridSize),
              0,
              Math.max(0, SCENE_WIDTH - previous.startWidth)
            ),
            nextY: clamp(
              snapToGrid(previous.startY + deltaY, props.gridSize),
              0,
              Math.max(0, SCENE_HEIGHT - previous.startHeight)
            ),
          };
        }

        if (previous.mode === "rotate") {
          const startAngle = Math.atan2(
            previous.startClientY - previous.startCenterY,
            previous.startClientX - previous.startCenterX
          );
          const currentAngle = Math.atan2(
            event.clientY - previous.startCenterY,
            event.clientX - previous.startCenterX
          );

          return {
            ...previous,
            nextRotation: normalizeRotation(
              previous.startRotation + ((currentAngle - startAngle) * 180) / Math.PI
            ),
          };
        }

        const widthCandidate =
          previous.handle === "nw" || previous.handle === "sw" || previous.handle === "w"
            ? previous.startWidth - deltaX
            : previous.startWidth + deltaX;
        const heightCandidate =
          previous.handle === "nw" || previous.handle === "ne" || previous.handle === "n"
            ? previous.startHeight - deltaY
            : previous.startHeight + deltaY;
        const maxWidthByBounds =
          previous.handle === "nw" || previous.handle === "sw" || previous.handle === "w"
            ? previous.startX + previous.startWidth
            : SCENE_WIDTH - previous.startX;
        const maxHeightByBounds =
          previous.handle === "nw" || previous.handle === "ne" || previous.handle === "n"
            ? previous.startY + previous.startHeight
            : SCENE_HEIGHT - previous.startY;
        let nextWidth: number;
        let nextHeight: number;

        if (previous.canResizeFreely) {
          nextWidth = clamp(
            snapToGrid(widthCandidate, props.gridSize),
            props.gridSize,
            Math.max(props.gridSize, maxWidthByBounds)
          );
          nextHeight = clamp(
            snapToGrid(heightCandidate, props.gridSize),
            props.gridSize,
            Math.max(props.gridSize, maxHeightByBounds)
          );
        } else {
          const widthScale = widthCandidate / previous.startWidth;
          const heightScale = heightCandidate / previous.startHeight;
          const dominantScale =
            Math.abs(widthScale - 1) > Math.abs(heightScale - 1) ? widthScale : heightScale;
          const aspectRatio = previous.startWidth / previous.startHeight;
          const maxWidth = Math.max(
            props.gridSize,
            Math.min(maxWidthByBounds, maxHeightByBounds * aspectRatio)
          );
          nextWidth = clamp(
            snapToGrid(
              previous.startWidth * Math.max(props.gridSize / previous.startWidth, dominantScale),
              props.gridSize
            ),
            props.gridSize,
            maxWidth
          );
          nextHeight = Math.max(props.gridSize, Math.round(nextWidth / aspectRatio));
        }

        const nextX =
          previous.handle === "nw" || previous.handle === "sw" || previous.handle === "w"
            ? previous.startX + (previous.startWidth - nextWidth)
            : previous.startX;
        const nextY =
          previous.handle === "nw" || previous.handle === "ne" || previous.handle === "n"
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
            zIndex:
              current[finalEdit.assetId]?.zIndex ??
              placedAssets().find((asset) => asset._id === finalEdit.assetId)?.zIndex ??
              0,
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

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      props.onDragStateChange(false);
    });
  });

  // Marquee effect
  createEffect(() => {
    const currentMarquee = marquee();
    if (!currentMarquee) {
      return;
    }

    const handlePointerMove = (event: PointerEvent) => {
      if (!canvasRef) return;
      const rect = canvasRef.getBoundingClientRect();
      setMarquee((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          endX: clamp(event.clientX - rect.left, 0, SCENE_WIDTH),
          endY: clamp(event.clientY - rect.top, 0, SCENE_HEIGHT),
        };
      });
    };

    const handlePointerUp = () => {
      const m = marquee();
      if (m) {
        const left = Math.min(m.startX, m.endX);
        const right = Math.max(m.startX, m.endX);
        const top = Math.min(m.startY, m.endY);
        const bottom = Math.max(m.startY, m.endY);

        // Only select if marquee has non-trivial size
        if (right - left > 2 || bottom - top > 2) {
          const all = placedAssets();
          const transforms = localTransforms();
          const hits = new Set<Id<"sceneAssets">>();
          for (const asset of all) {
            const local = transforms[asset._id];
            const ax = local?.x ?? asset.x;
            const ay = local?.y ?? asset.y;
            const aw = local?.width ?? asset.width;
            const ah = local?.height ?? asset.height;
            if (ax < right && ax + aw > left && ay < bottom && ay + ah > top) {
              hits.add(asset._id);
            }
          }
          if (hits.size > 0) {
            setSelectedAssetIds(hits);
          }
        }
      }
      setMarquee(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
    });
  });

  // Bulk move effect
  createEffect(() => {
    const state = bulkMove();
    if (!state) {
      return;
    }

    props.onDragStateChange(true);

    const handlePointerMove = (event: PointerEvent) => {
      const current = bulkMove();
      if (!current) return;

      const deltaX = event.clientX - current.startClientX;
      const deltaY = event.clientY - current.startClientY;

      setLocalTransforms((prev) => {
        const next = { ...prev };
        for (const [id, startPos] of Object.entries(current.startPositions)) {
          const asset = placedAssets().find((a) => a._id === id);
          if (!asset) continue;
          const local = prev[id];
          const width = local?.width ?? asset.width;
          const height = local?.height ?? asset.height;
          const rotation = local?.rotation ?? asset.rotation ?? 0;
          const zIndex = local?.zIndex ?? asset.zIndex ?? asset._creationTime;
          const locked = local?.locked ?? asset.locked ?? false;
          next[id] = {
            x: clamp(
              snapToGrid(startPos.x + deltaX, props.gridSize),
              0,
              Math.max(0, SCENE_WIDTH - width)
            ),
            y: clamp(
              snapToGrid(startPos.y + deltaY, props.gridSize),
              0,
              Math.max(0, SCENE_HEIGHT - height)
            ),
            width,
            height,
            zIndex,
            rotation,
            locked,
          };
        }
        return next;
      });
    };

    const handlePointerUp = () => {
      const current = bulkMove();
      props.onDragStateChange(false);

      if (current) {
        const transforms = localTransforms();
        const all = placedAssets();
        for (const id of Object.keys(current.startPositions)) {
          const local = transforms[id];
          if (!local) continue;
          const asset = all.find((a) => a._id === id);
          if (!asset) continue;
          void updateAsset.mutate({
            assetId: id as Id<"sceneAssets">,
            x: local.x,
            y: local.y,
            width: local.width,
            height: local.height,
            zIndex: local.zIndex,
            rotation: local.rotation,
          });
        }
      }

      setBulkMove(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      props.onDragStateChange(false);
    });
  });

  // Bulk resize effect
  createEffect(() => {
    const state = bulkResize();
    if (!state) return;

    props.onDragStateChange(true);

    const handlePointerMove = (event: PointerEvent) => {
      const current = bulkResize();
      if (!current) return;

      const rawDeltaX = event.clientX - current.startClientX;
      const rawDeltaY = event.clientY - current.startClientY;
      const { handle, startBBox, startSizes } = current;

      let newBBoxWidth: number;
      let newBBoxHeight: number;
      let anchorX: number;
      let anchorY: number;

      if (handle === "se") {
        newBBoxWidth = startBBox.width + rawDeltaX;
        newBBoxHeight = startBBox.height + rawDeltaY;
        anchorX = startBBox.x;
        anchorY = startBBox.y;
      } else if (handle === "sw") {
        newBBoxWidth = startBBox.width - rawDeltaX;
        newBBoxHeight = startBBox.height + rawDeltaY;
        anchorX = startBBox.x + startBBox.width;
        anchorY = startBBox.y;
      } else if (handle === "ne") {
        newBBoxWidth = startBBox.width + rawDeltaX;
        newBBoxHeight = startBBox.height - rawDeltaY;
        anchorX = startBBox.x;
        anchorY = startBBox.y + startBBox.height;
      } else {
        // nw
        newBBoxWidth = startBBox.width - rawDeltaX;
        newBBoxHeight = startBBox.height - rawDeltaY;
        anchorX = startBBox.x + startBBox.width;
        anchorY = startBBox.y + startBBox.height;
      }

      // Uniform scale: pick dominant axis
      const scaleX = newBBoxWidth / startBBox.width;
      const scaleY = newBBoxHeight / startBBox.height;
      const s = Math.max(0.05, Math.abs(rawDeltaX) >= Math.abs(rawDeltaY) ? scaleX : scaleY);

      setLocalTransforms((prev) => {
        const next = { ...prev };
        for (const [id, start] of Object.entries(startSizes)) {
          const asset = placedAssets().find((a) => a._id === id);
          if (!asset) continue;
          const local = prev[id];
          const rotation = local?.rotation ?? asset.rotation ?? 0;
          const zIndex = local?.zIndex ?? asset.zIndex ?? asset._creationTime;
          const locked = local?.locked ?? asset.locked ?? false;
          next[id] = {
            x: Math.round(anchorX + (start.x - anchorX) * s),
            y: Math.round(anchorY + (start.y - anchorY) * s),
            width: Math.max(props.gridSize, Math.round(start.width * s)),
            height: Math.max(props.gridSize, Math.round(start.height * s)),
            zIndex,
            rotation,
            locked,
          };
        }
        return next;
      });
    };

    const handlePointerUp = () => {
      const current = bulkResize();
      props.onDragStateChange(false);
      if (current) {
        const transforms = localTransforms();
        const all = placedAssets();
        for (const id of Object.keys(current.startSizes)) {
          const local = transforms[id];
          if (!local) continue;
          const asset = all.find((a) => a._id === id);
          if (!asset) continue;
          void updateAsset.mutate({
            assetId: id as Id<"sceneAssets">,
            x: local.x,
            y: local.y,
            width: local.width,
            height: local.height,
            zIndex: local.zIndex,
            rotation: local.rotation,
          });
        }
      }
      setBulkResize(null);
    };

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);

    onCleanup(() => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      props.onDragStateChange(false);
    });
  });

  const startEdit = (
    asset: {
      _id: Id<"sceneAssets">;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      locked?: boolean;
      bgRepeat?: string;
      sprite?: { bgRepeat?: string };
    },
    mode: EditingAsset["mode"],
    event: PointerEvent,
    handle?: ResizeHandle
  ) => {
    if (asset.locked) {
      props.onDebugEvent?.("asset edit blocked", asset._id);
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
      canResizeFreely:
        mode === "resize" &&
        !!asset.sprite &&
        canAssetResizeFreely({
          bgRepeat: asset.bgRepeat,
          sprite: asset.sprite,
        }),
    });
    props.onDebugSnapshot?.({
      lastEvent: `asset ${mode} start`,
      sourceId: asset._id,
      drop: `${asset.x}, ${asset.y}`,
    });
    props.onDebugEvent?.(`asset ${mode} start`, asset._id);
  };

  const startBulkMove = (event: PointerEvent) => {
    const ids = selectedAssetIds();
    const all = placedAssets();
    const transforms = localTransforms();
    const startPositions: Record<string, { x: number; y: number }> = {};
    for (const id of ids) {
      const asset = all.find((a) => a._id === id);
      if (!asset) continue;
      const local = transforms[id];
      startPositions[id] = {
        x: local?.x ?? asset.x,
        y: local?.y ?? asset.y,
      };
    }
    setBulkMove({
      startClientX: event.clientX,
      startClientY: event.clientY,
      startPositions,
    });
  };

  const multiSelectCount = createMemo(() => selectedAssetIds().size);

  const multiSelectBBox = createMemo(() => {
    const ids = selectedAssetIds();
    if (ids.size < 2) return null;
    const all = placedAssets();
    const transforms = localTransforms();
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const asset of all) {
      if (!ids.has(asset._id)) continue;
      const local = transforms[asset._id];
      const x = local?.x ?? asset.x;
      const y = local?.y ?? asset.y;
      const w = local?.width ?? asset.width;
      const h = local?.height ?? asset.height;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x + w);
      maxY = Math.max(maxY, y + h);
    }
    if (!isFinite(minX)) return null;
    return { x: minX, y: minY, width: maxX - minX, height: maxY - minY };
  });

  const startBulkResize = (handle: "nw" | "ne" | "sw" | "se", event: PointerEvent) => {
    const ids = selectedAssetIds();
    const all = placedAssets();
    const bbox = multiSelectBBox();
    if (!bbox) return;
    const startSizes: Record<string, { x: number; y: number; width: number; height: number }> = {};
    for (const id of ids) {
      const asset = all.find((a) => a._id === id);
      if (!asset) continue;
      const view = getAssetView(asset);
      if (view.locked) continue;
      startSizes[id] = { x: view.x, y: view.y, width: view.width, height: view.height };
    }
    setBulkResize({
      handle,
      startClientX: event.clientX,
      startClientY: event.clientY,
      startBBox: bbox,
      startSizes,
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
      onPointerDown={(event) => {
        // Only fire on direct background clicks (not sprite clicks)
        if (event.target !== event.currentTarget) return;
        setSelectedAssetIds(new Set());
        if (!canvasRef) return;
        const rect = canvasRef.getBoundingClientRect();
        setMarquee({
          startX: event.clientX - rect.left,
          startY: event.clientY - rect.top,
          endX: event.clientX - rect.left,
          endY: event.clientY - rect.top,
        });
      }}
    >
      {/* Marquee selection rect */}
      <Show when={marquee()}>
        {(m) => {
          const left = () => Math.min(m().startX, m().endX);
          const top = () => Math.min(m().startY, m().endY);
          const width = () => Math.abs(m().endX - m().startX);
          const height = () => Math.abs(m().endY - m().startY);
          return (
            <div
              class="pointer-events-none absolute border border-primary/70 bg-primary/10"
              style={{
                left: `${left()}px`,
                top: `${top()}px`,
                width: `${width()}px`,
                height: `${height()}px`,
              }}
            />
          );
        }}
      </Show>

      {/* Unified multi-select bounding box with corner resize handles */}
      <Show when={multiSelectCount() > 1 ? multiSelectBBox() : null}>
        {(bbox) => {
          const handlePos = {
            nw: "left-0 top-0 -translate-x-1/2 -translate-y-1/2 cursor-nw-resize",
            ne: "right-0 top-0 translate-x-1/2 -translate-y-1/2 cursor-ne-resize",
            sw: "left-0 bottom-0 -translate-x-1/2 translate-y-1/2 cursor-sw-resize",
            se: "right-0 bottom-0 translate-x-1/2 translate-y-1/2 cursor-se-resize",
          } as const;
          return (
            <div
              class="pointer-events-none absolute z-40 border border-dashed border-[#ffd58a]/50"
              style={{
                left: `${bbox().x - 6}px`,
                top: `${bbox().y - 6}px`,
                width: `${bbox().width + 12}px`,
                height: `${bbox().height + 12}px`,
              }}
            >
              <For each={["nw", "ne", "sw", "se"] as const}>
                {(handle) => (
                  <div
                    class={`pointer-events-auto absolute h-3 w-3 rounded-sm border-2 border-[#2d190f] bg-[#ffd58a] opacity-90 ${handlePos[handle]}`}
                    onPointerDown={(event) => {
                      event.stopPropagation();
                      event.preventDefault();
                      startBulkResize(handle, event);
                    }}
                  />
                )}
              </For>
            </div>
          );
        }}
      </Show>

      {/* Multi-select floating toolbar */}
      <Show when={multiSelectCount() > 1}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-60 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
          <span>{multiSelectCount()} selected</span>
          <button
            class="rounded-full px-2 py-1 text-rose-200 transition hover:bg-white/10"
            type="button"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={(event) => {
              event.stopPropagation();
              bulkDelete();
            }}
          >
            Delete {multiSelectCount()}
          </button>
        </div>
      </Show>

      {/* Drag ghost preview / pending placement */}
      <Show when={dragGhost()}>
        {(ghost) => (
          <div
            class={`pointer-events-none absolute transition-opacity duration-150 ${ghost().pending ? "opacity-100" : "opacity-45"}`}
            style={{
              left: `${ghost().x}px`,
              top: `${ghost().y}px`,
              width: `${ghost().sprite.width}px`,
              height: `${ghost().sprite.height}px`,
            }}
          >
            <div
              class={`absolute inset-0 bg-no-repeat bg-size-[100%_100%] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] ${ghost().pending ? "" : "brightness-125"}`}
              style={getSpriteBackgroundStyle(ghost().sprite)}
            />
            <Show when={!ghost().pending}>
              <div class="absolute inset-0 border border-dashed border-primary/60" />
            </Show>
          </div>
        )}
      </Show>

      <Show
        when={!assets.isLoading()}
        fallback={
          <div class="absolute left-6 top-6 text-sm text-muted-foreground">Loading scene...</div>
        }
      >
        <For each={orderedPlacedAssets()}>
          {(asset) =>
            (() => {
              const currentEdit = createMemo(() =>
                editingAsset()?.assetId === asset._id ? editingAsset() : null
              );
              const localTransform = createMemo(() => localTransforms()[asset._id]);
              const view = createMemo(() => ({
                x: currentEdit()?.nextX ?? localTransform()?.x ?? asset.x,
                y: currentEdit()?.nextY ?? localTransform()?.y ?? asset.y,
                width: currentEdit()?.nextWidth ?? localTransform()?.width ?? asset.width,
                height: currentEdit()?.nextHeight ?? localTransform()?.height ?? asset.height,
                zIndex: localTransform()?.zIndex ?? asset.zIndex ?? asset._creationTime,
                rotation:
                  currentEdit()?.nextRotation ?? localTransform()?.rotation ?? asset.rotation ?? 0,
                locked: localTransform()?.locked ?? asset.locked ?? false,
              }));

              const selectionMode = createMemo(() => {
                const ids = selectedAssetIds();
                if (!ids.has(asset._id)) return "none" as const;
                if (ids.size === 1) return "single" as const;
                return "multi" as const;
              });

              return (
                <PlacedSprite
                  sprite={{
                    url: asset.sprite.url,
                    width: view().width,
                    height: view().height,
                    bgRepeat: asset.bgRepeat ?? asset.sprite.bgRepeat,
                    bgPosition: asset.bgPosition ?? asset.sprite.bgPosition,
                    bgSize: asset.bgSize ?? asset.sprite.bgSize,
                  }}
                  x={view().x}
                  y={view().y}
                  zIndex={view().zIndex}
                  rotation={view().rotation}
                  locked={view().locked}
                  canResizeFreely={canAssetResizeFreely(asset)}
                  selectionMode={selectionMode()}
                  isStyleEditorOpen={styleEditorAssetId() === asset._id}
                  styleEditorContent={
                    <Show when={styleEditorAssetId() === asset._id ? asset : null}>
                      {(a) => (
                        <div class="grid gap-3">
                          <div class="flex items-start gap-2.5">
                            <div
                              class="size-9 shrink-0 rounded-md border border-white/8 bg-white/5 bg-contain bg-center bg-no-repeat"
                              style={{ "background-image": `url(${a().sprite.url})` }}
                            />
                            <div class="min-w-0">
                              <div class="truncate text-[13px] font-medium leading-tight">{a().sprite.key}</div>
                              <div class="mt-0.5 text-[10px] tabular-nums text-white/35">
                                {getAssetView(a()).width} x {getAssetView(a()).height} · layer {getAssetView(a()).zIndex}
                              </div>
                            </div>
                          </div>

                          <div class="h-px bg-white/6" />

                          <div class="grid gap-1">
                            <div class="text-[10px] uppercase tracking-widest text-white/30">Presets</div>
                            <div class="flex flex-wrap gap-1">
                              <For each={["2x2", "4x2", "fill", "wall", "ground"] as const}>
                                {(preset) => (
                                  <button
                                    class="rounded-md bg-white/4 px-2.5 py-1 text-[11px] text-white/65 transition hover:bg-white/10 hover:text-white active:scale-95"
                                    type="button"
                                    onClick={() => void applyTilePreset(preset)}
                                  >
                                    {preset[0].toUpperCase() + preset.slice(1)}
                                  </button>
                                )}
                              </For>
                            </div>
                          </div>

                          <div class="h-px bg-white/6" />

                          <div class="grid gap-1">
                            <div class="text-[10px] uppercase tracking-widest text-white/30">Size</div>
                            <div class="grid grid-cols-[1fr_1fr_auto] items-end gap-1.5">
                              <label class="grid gap-0.5 text-[10px] text-white/40">
                                W
                                <input
                                  class="h-7 rounded-md border border-white/6 bg-white/4 px-2 text-xs tabular-nums text-white outline-none transition placeholder:text-white/15 focus:border-white/20 focus:bg-white/6"
                                  value={widthDraft()}
                                  inputmode="numeric"
                                  onInput={(event) => setWidthDraft(event.currentTarget.value)}
                                />
                              </label>
                              <label class="grid gap-0.5 text-[10px] text-white/40">
                                H
                                <input
                                  class="h-7 rounded-md border border-white/6 bg-white/4 px-2 text-xs tabular-nums text-white outline-none transition placeholder:text-white/15 focus:border-white/20 focus:bg-white/6"
                                  value={heightDraft()}
                                  inputmode="numeric"
                                  onInput={(event) => setHeightDraft(event.currentTarget.value)}
                                />
                              </label>
                              <button
                                class="h-7 rounded-md bg-white/8 px-2.5 text-[11px] text-white/65 transition hover:bg-white/15 hover:text-white active:scale-95"
                                type="button"
                                onClick={() => void handleApplyAssetSize()}
                              >
                                Apply
                              </button>
                            </div>
                          </div>

                          <div class="h-px bg-white/6" />

                          <div class="grid gap-1">
                            <div class="text-[10px] uppercase tracking-widest text-white/30">Background</div>
                            <div class="grid gap-1.5">
                              <select
                                class="h-7 rounded-md border border-white/6 bg-white/4 px-2 text-xs text-white outline-none transition focus:border-white/20 focus:bg-white/6"
                                value={bgRepeatDraft()}
                                onChange={(event) => setBgRepeatDraft(event.currentTarget.value)}
                              >
                                <option value="no-repeat">no-repeat</option>
                                <option value="repeat">repeat</option>
                                <option value="repeat-x">repeat-x</option>
                                <option value="repeat-y">repeat-y</option>
                                <option value="space">space</option>
                                <option value="round">round</option>
                              </select>
                              <div class="grid grid-cols-2 gap-1.5">
                                <label class="grid gap-0.5 text-[10px] text-white/40">
                                  Position
                                  <input
                                    class="h-7 rounded-md border border-white/6 bg-white/4 px-2 text-xs text-white outline-none transition placeholder:text-white/15 focus:border-white/20 focus:bg-white/6"
                                    value={bgPositionDraft()}
                                    placeholder="center"
                                    onInput={(event) => setBgPositionDraft(event.currentTarget.value)}
                                  />
                                </label>
                                <label class="grid gap-0.5 text-[10px] text-white/40">
                                  Size
                                  <input
                                    class="h-7 rounded-md border border-white/6 bg-white/4 px-2 text-xs text-white outline-none transition placeholder:text-white/15 focus:border-white/20 focus:bg-white/6"
                                    value={bgSizeDraft()}
                                    placeholder={DEFAULT_BG_SIZE}
                                    onInput={(event) => setBgSizeDraft(event.currentTarget.value)}
                                  />
                                </label>
                              </div>
                              <button
                                class="h-7 rounded-md bg-white/8 px-2.5 text-[11px] text-white/65 transition hover:bg-white/15 hover:text-white active:scale-95"
                                type="button"
                                onClick={() => void handleSaveAssetStyle()}
                              >
                                Save style
                              </button>
                            </div>
                          </div>
                        </div>
                      )}
                    </Show>
                  }
                  onSelect={(event) => {
                    if (event.shiftKey) {
                      // Shift+click: toggle in/out of multi-select
                      setSelectedAssetIds((prev) => {
                        const next = new Set(prev);
                        if (next.has(asset._id)) {
                          next.delete(asset._id);
                        } else {
                          next.add(asset._id);
                        }
                        return next;
                      });
                    } else if (selectedAssetIds().size > 1 && selectedAssetIds().has(asset._id)) {
                      // Already in multi-select: keep selection (bulk move will be initiated)
                    } else {
                      // Single select
                      setSelectedAssetIds(new Set([asset._id]));
                    }
                  }}
                  onMoveStart={(event) => {
                    event.stopPropagation();
                    event.preventDefault();
                    const ids = selectedAssetIds();
                    if (ids.size > 1 && ids.has(asset._id)) {
                      // Bulk move
                      startBulkMove(event);
                    } else {
                      setSelectedAssetIds(new Set([asset._id]));
                      startEdit(
                        {
                          ...asset,
                          ...view(),
                        },
                        "move",
                        event
                      );
                    }
                  }}
                  onResizeStart={(handle, event) => {
                    event.preventDefault();
                    setSelectedAssetIds(new Set([asset._id]));
                    startEdit(
                      {
                        ...asset,
                        ...view(),
                      },
                      "resize",
                      event,
                      handle
                    );
                  }}
                  onRotateStart={(event) => {
                    event.preventDefault();
                    setSelectedAssetIds(new Set([asset._id]));
                    startEdit(
                      {
                        ...asset,
                        ...view(),
                      },
                      "rotate",
                      event
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
                        zIndex: view().zIndex,
                        rotation: view().rotation,
                        locked: nextLocked,
                      },
                    }));
                    void updateAsset.mutate({
                      assetId: asset._id,
                      locked: nextLocked,
                    });
                  }}
                  onToggleStyleEditor={() => {
                    setSelectedAssetIds(new Set([asset._id]));
                    setStyleEditorAssetId((current) => (current === asset._id ? null : asset._id));
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
  children?: import("solid-js").JSXElement;
  ref?: (element: HTMLDivElement) => void;
  onPointerDown?: (event: PointerEvent) => void;
}) {
  return (
    <div
      ref={props.ref}
      class={`relative overflow-hidden rounded-none border ${props.isDropTarget ? "border-primary/70 shadow-[0_0_0_1px_color-mix(in_oklch,var(--primary)_30%,transparent),0_0_42px_color-mix(in_oklch,var(--primary)_16%,transparent)]" : "border-border"}`}
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
