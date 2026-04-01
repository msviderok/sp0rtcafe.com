import { DragDropManager } from "@dnd-kit/dom";
import { DragDropProvider, DragOverlay } from "@dnd-kit/solid";
import { useMutation, useQuery } from "convex-solidjs";
import { Show, createEffect, createMemo, createSignal, onCleanup, onMount } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import SceneCanvas from "./SceneCanvas";
import SpriteSidebar from "./SpriteSidebar";
import { isDrawerSpriteDragData, type DrawerSprite } from "./spriteDrag";

const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 64;
const DEFAULT_GRID_SIZE = 32;

function createSceneLabel(index: number) {
  return `scene-${index}`;
}

function normalizeGridSize(value: number) {
  return Math.min(Math.max(value, MIN_GRID_SIZE), MAX_GRID_SIZE);
}

export default function SpriteEditor() {
  const dragDropManager = new DragDropManager();
  const ensureStarterScene = useMutation(api.scenes.ensureStarterScene);
  const createScene = useMutation(api.scenes.create);
  const updateScene = useMutation(api.scenes.update);
  const deleteScene = useMutation(api.scenes.remove);
  const setDefaultScene = useMutation(api.scenes.setDefault);
  const scenes = useQuery(api.scenes.list, {});
  const [sceneId, setSceneId] = createSignal<Id<"scenes">>();
  const [createName, setCreateName] = createSignal("");
  const [sceneName, setSceneName] = createSignal("");
  const [pendingGridSizes, setPendingGridSizes] = createSignal<Record<string, number>>({});
  const [pendingShowGrid, setPendingShowGrid] = createSignal<Record<string, boolean>>({});
  const [isSidebarOpen, setIsSidebarOpen] = createSignal(true);
  const [isDraggingSprite, setIsDraggingSprite] = createSignal(false);
  const [isOverCanvas, setIsOverCanvas] = createSignal(false);
  const [activeDrawerSprite, setActiveDrawerSprite] = createSignal<DrawerSprite>();

  const sortedScenes = createMemo(() =>
    [...(scenes.data() ?? [])].sort((left, right) => {
      if (left.isDefault !== right.isDefault) {
        return left.isDefault ? -1 : 1;
      }

      return left.name.localeCompare(right.name);
    })
  );
  const selectedScene = createMemo(
    () => sortedScenes().find((scene) => scene._id === sceneId()) ?? null
  );
  const gridSize = createMemo(() => {
    const currentSceneId = sceneId();
    if (currentSceneId) {
      const pending = pendingGridSizes()[currentSceneId];
      if (pending !== undefined) {
        return pending;
      }
    }

    return normalizeGridSize(selectedScene()?.gridSize ?? DEFAULT_GRID_SIZE);
  });
  const showGrid = createMemo(() => {
    const currentSceneId = sceneId();
    if (currentSceneId) {
      const pending = pendingShowGrid()[currentSceneId];
      if (pending !== undefined) {
        return pending;
      }
    }

    return selectedScene()?.showGrid ?? true;
  });

  createEffect(() => {
    const currentScene = selectedScene();
    if (currentScene) {
      setSceneName(currentScene.name);
      const currentGridSize = normalizeGridSize(currentScene.gridSize ?? DEFAULT_GRID_SIZE);
      const pendingGridSize = pendingGridSizes()[currentScene._id];
      if (pendingGridSize !== undefined && pendingGridSize === currentGridSize) {
        setPendingGridSizes((current) => {
          const next = { ...current };
          delete next[currentScene._id];
          return next;
        });
      }

      const syncedShowGrid = currentScene.showGrid ?? true;
      const pendingSceneShowGrid = pendingShowGrid()[currentScene._id];
      if (pendingSceneShowGrid !== undefined && pendingSceneShowGrid === syncedShowGrid) {
        setPendingShowGrid((current) => {
          const next = { ...current };
          delete next[currentScene._id];
          return next;
        });
      }
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
    }
  });

  onMount(() => {
    void ensureStarterScene.mutate({}).then((id) => {
      setSceneId(id);
    });
  });

  onCleanup(() => dragDropManager.destroy());

  const handleCreateScene = async () => {
    const name = createName().trim() || createSceneLabel(sortedScenes().length + 1);
    const id = await createScene.mutate({ name });
    setCreateName("");
    setSceneId(id);
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

  const handleSetDefaultScene = async () => {
    const currentScene = selectedScene();
    if (!currentScene || currentScene.isDefault) {
      return;
    }

    await setDefaultScene.mutate({ sceneId: currentScene._id });
    setSceneId(currentScene._id);
  };

  const handleDeleteScene = async () => {
    const currentScene = selectedScene();
    if (!currentScene) {
      return;
    }

    await deleteScene.mutate({ sceneId: currentScene._id });
  };

  const handleGridSizeChange = (value: number) => {
    const currentSceneId = sceneId();
    const nextGridSize = normalizeGridSize(value);
    if (currentSceneId) {
      setPendingGridSizes((current) => ({
        ...current,
        [currentSceneId]: nextGridSize,
      }));
    }
  };

  const handleGridSizeCommit = (value: number) => {
    const currentSceneId = sceneId();
    if (!currentSceneId) {
      return;
    }

    const nextGridSize = normalizeGridSize(value);
    setPendingGridSizes((current) => ({
      ...current,
      [currentSceneId]: nextGridSize,
    }));

    void updateScene.mutate({
      sceneId: currentSceneId,
      gridSize: nextGridSize,
    });
  };

  const handleToggleGrid = () => {
    const currentSceneId = sceneId();
    const nextShowGrid = !showGrid();

    if (currentSceneId) {
      setPendingShowGrid((current) => ({
        ...current,
        [currentSceneId]: nextShowGrid,
      }));

      void updateScene.mutate({
        sceneId: currentSceneId,
        showGrid: nextShowGrid,
      });
      return;
    }

    setPendingShowGrid({});
  };

  return (
    <Show
      when={!scenes.isLoading()}
      fallback={
        <div class="flex min-h-screen items-center justify-center bg-background">
          <div class="flex flex-col items-center gap-4">
            <div class="flex gap-1.5">
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
              <div class="h-2 w-2 animate-bounce rounded-full bg-foreground/40 [animation-delay:300ms]" />
            </div>
            <p class="text-xs uppercase tracking-[0.22em] text-muted-foreground">Loading editor</p>
          </div>
        </div>
      }
    >
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
        onDragEnd={({ operation, canceled }) => {
          if (isDrawerSpriteDragData(operation.source?.data)) {
            setActiveDrawerSprite(undefined);
            setIsDraggingSprite(false);
          }
        }}
      >
        <div class="min-h-screen bg-background text-foreground">
          <div class="mx-auto flex min-h-screen w-full max-w-[2360px] flex-col gap-6 px-4 py-6 lg:px-6">
            <div
              class={`grid min-w-0 gap-6 transition-[grid-template-columns] duration-300 ease-in-out ${
                isSidebarOpen()
                  ? "xl:grid-cols-[18rem_minmax(0,1fr)]"
                  : "xl:grid-cols-[2.5rem_minmax(0,1fr)]"
              }`}
            >
              <SpriteSidebar
                isOpen={isSidebarOpen()}
                scenes={sortedScenes()}
                selectedSceneId={sceneId()}
                sceneName={sceneName()}
                createName={createName()}
                gridSize={gridSize()}
                showGrid={showGrid()}
                onOpenChange={setIsSidebarOpen}
                onGridSizeChange={handleGridSizeChange}
                onGridSizeCommit={handleGridSizeCommit}
                onToggleGrid={handleToggleGrid}
                onSelectScene={(id) => {
                  setSceneId(id);
                }}
                onSceneNameChange={setSceneName}
                onCreateNameChange={setCreateName}
                onCreateScene={() => void handleCreateScene()}
                onRenameScene={() => void handleRenameScene()}
                onSetDefaultScene={() => void handleSetDefaultScene()}
                onDeleteScene={() => void handleDeleteScene()}
              />

              <SceneCanvas
                sceneId={sceneId()}
                sceneName={selectedScene()?.name}
                gridSize={gridSize()}
                showGrid={showGrid()}
                isDraggingSprite={isDraggingSprite()}
                onDragStateChange={setIsDraggingSprite}
                onDropTargetChange={setIsOverCanvas}
              />
            </div>
          </div>
        </div>

        <DragOverlay class="pointer-events-none z-[80]" dropAnimation={null}>
          <Show when={!isOverCanvas() && activeDrawerSprite()}>
            {(sprite) => (
              <div class="flex h-14 w-14 items-center justify-center rounded-lg bg-card/90 p-1 backdrop-blur-sm">
                <img
                  alt={sprite().key}
                  class="max-h-full max-w-full object-contain"
                  src={sprite().url}
                />
              </div>
            )}
          </Show>
        </DragOverlay>
      </DragDropProvider>
    </Show>
  );
}
