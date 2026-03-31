import { useMutation } from "convex-solidjs";
import { createSignal, onMount } from "solid-js";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import SceneCanvas from "./SceneCanvas";
import SpriteDrawer from "./SpriteDrawer";

export default function SpriteEditor() {
  const ensureScene = useMutation(api.scenes.ensure);
  const [sceneId, setSceneId] = createSignal<Id<"scenes">>();
  const [gridSize, setGridSize] = createSignal(32);
  const [drawerOpen, setDrawerOpen] = createSignal(true);
  const [showGrid, setShowGrid] = createSignal(true);
  const [isDraggingSprite, setIsDraggingSprite] = createSignal(false);

  onMount(() => {
    void ensureScene
      .mutate({
        name: "main",
        width: 1920,
        height: 1000,
      })
      .then((id) => setSceneId(id));
  });

  return (
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

      <SpriteDrawer
        open={drawerOpen()}
        onClose={() => setDrawerOpen(false)}
        onDragStateChange={setIsDraggingSprite}
      />
    </div>
  );
}
