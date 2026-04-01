import { useDragDropMonitor } from "@dnd-kit/solid";
import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { DEFAULT_BG_REPEAT, DEFAULT_BG_SIZE, getSpriteBackgroundStyle } from "~/lib/sceneStyles";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DndDebugReporter, DndDebugSnapshotReporter } from "./dndDebug";
import GridOverlay from "./GridOverlay";
import GridSizeControl from "./GridSizeControl";
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

type ResizeHandle = "nw" | "ne" | "sw" | "se";

type LocalTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
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
};

type Marquee = { startX: number; startY: number; endX: number; endY: number };

type BulkMoveState = {
  startClientX: number;
  startClientY: number;
  startPositions: Record<string, { x: number; y: number }>;
};

export default function SceneCanvas(props: {
  sceneId?: Id<"scenes">;
  sceneName?: string;
  gridSize: number;
  showGrid: boolean;
  isDraggingSprite: boolean;
  debugEnabled?: boolean;
  onGridSizeChange: (value: number) => void;
  onToggleGrid: () => void;
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
        <div class="flex flex-wrap items-center gap-3">
          <GridSizeControl gridSize={props.gridSize} onChange={props.onGridSizeChange} />
          <button
            class="rounded-full border border-border bg-muted/30 px-4 py-2 text-xs uppercase tracking-[0.22em] text-muted-foreground transition hover:bg-accent"
            type="button"
            onClick={props.onToggleGrid}
          >
            {props.showGrid ? "Hide grid" : "Show grid"}
          </button>
        </div>
      </div>

      <div class="overflow-auto rounded-sm border border-border bg-muted/25 p-4 shadow-[0_40px_120px_rgba(0,0,0,0.35)]">
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
  const [styleEditorAssetId, setStyleEditorAssetId] = createSignal<Id<"sceneAssets"> | null>(null);
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

  const placedAssets = createMemo(() => assets.data() ?? []);
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
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    locked?: boolean;
  }) => {
    const local = localTransforms()[asset._id];
    return {
      x: local?.x ?? asset.x,
      y: local?.y ?? asset.y,
      width: local?.width ?? asset.width,
      height: local?.height ?? asset.height,
      rotation: local?.rotation ?? asset.rotation ?? 0,
      locked: local?.locked ?? asset.locked ?? false,
    };
  };

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

  const handleSaveAssetStyle = async () => {
    const asset = styleEditorAsset();
    if (!asset) {
      return;
    }

    await updateAsset.mutate({
      assetId: asset._id,
      bgRepeat: bgRepeatDraft() || DEFAULT_BG_REPEAT,
      bgPosition: bgPositionDraft().trim(),
      bgSize: bgSizeDraft().trim() || DEFAULT_BG_SIZE,
    });
  };

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
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
          previous.handle === "nw" || previous.handle === "sw"
            ? previous.startWidth - deltaX
            : previous.startWidth + deltaX;
        const heightCandidate =
          previous.handle === "nw" || previous.handle === "ne"
            ? previous.startHeight - deltaY
            : previous.startHeight + deltaY;
        const widthScale = widthCandidate / previous.startWidth;
        const heightScale = heightCandidate / previous.startHeight;
        const dominantScale =
          Math.abs(widthScale - 1) > Math.abs(heightScale - 1) ? widthScale : heightScale;
        const aspectRatio = previous.startWidth / previous.startHeight;
        const maxWidthByBounds =
          previous.handle === "nw" || previous.handle === "sw"
            ? previous.startX + previous.startWidth
            : SCENE_WIDTH - previous.startX;
        const maxHeightByBounds =
          previous.handle === "nw" || previous.handle === "ne"
            ? previous.startY + previous.startHeight
            : SCENE_HEIGHT - previous.startY;
        const maxWidth = Math.max(
          props.gridSize,
          Math.min(maxWidthByBounds, maxHeightByBounds * aspectRatio)
        );
        const nextWidth = clamp(
          snapToGrid(
            previous.startWidth * Math.max(props.gridSize / previous.startWidth, dominantScale),
            props.gridSize
          ),
          props.gridSize,
          maxWidth
        );
        const nextHeight = Math.max(props.gridSize, Math.round(nextWidth / aspectRatio));

        const nextX =
          previous.handle === "nw" || previous.handle === "sw"
            ? previous.startX + (previous.startWidth - nextWidth)
            : previous.startX;
        const nextY =
          previous.handle === "nw" || previous.handle === "ne"
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

  const startEdit = (
    asset: {
      _id: Id<"sceneAssets">;
      x: number;
      y: number;
      width: number;
      height: number;
      rotation?: number;
      locked?: boolean;
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
  const styleEditorLayout = createMemo(() => {
    const asset = styleEditorAsset();
    if (!asset) {
      return null;
    }

    const view = getAssetView(asset);
    const panelWidth = 240;
    const panelHeight = 280;

    return {
      asset,
      left: clamp(view.x + view.width + 20, 16, SCENE_WIDTH - panelWidth - 16),
      top: clamp(view.y - 8, 16, SCENE_HEIGHT - panelHeight - 16),
    };
  });

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

      {/* Multi-select floating toolbar */}
      <Show when={multiSelectCount() > 1}>
        <div class="absolute top-4 left-1/2 -translate-x-1/2 z-10 flex items-center gap-2 rounded-full border border-white/10 bg-black/80 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white/70">
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

      <Show when={styleEditorLayout()}>
        {(layout) => (
          <section
            class="absolute z-20 w-60 rounded-2xl border border-white/10 bg-black/85 p-3 text-white shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            style={{
              left: `${layout().left}px`,
              top: `${layout().top}px`,
            }}
          >
            <div class="text-[10px] uppercase tracking-[0.24em] text-white/45">
              Placed sprite style
            </div>
            <div class="mt-1 truncate text-sm text-white">{layout().asset.sprite.key}</div>

            <div class="mt-3 grid gap-3">
              <label class="grid gap-1 text-xs text-white/60">
                <span>bg repeat</span>
                <select
                  class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-primary"
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
              </label>

              <label class="grid gap-1 text-xs text-white/60">
                <span>bg position</span>
                <input
                  class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary"
                  value={bgPositionDraft()}
                  placeholder="center"
                  onInput={(event) => setBgPositionDraft(event.currentTarget.value)}
                />
              </label>

              <label class="grid gap-1 text-xs text-white/60">
                <span>bg size</span>
                <input
                  class="rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition placeholder:text-white/25 focus:border-primary"
                  value={bgSizeDraft()}
                  placeholder={DEFAULT_BG_SIZE}
                  onInput={(event) => setBgSizeDraft(event.currentTarget.value)}
                />
              </label>

              <button
                class="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm transition hover:bg-white/10"
                type="button"
                onClick={() => void handleSaveAssetStyle()}
              >
                Save style
              </button>
            </div>
          </section>
        )}
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
        <For each={placedAssets()}>
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
                  rotation={view().rotation}
                  locked={view().locked}
                  selectionMode={selectionMode()}
                  isStyleEditorOpen={styleEditorAssetId() === asset._id}
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
