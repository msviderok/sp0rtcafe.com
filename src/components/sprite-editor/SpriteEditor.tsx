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
        <div class="flex items-center justify-between gap-4">
          <div>
            <div class="text-xs uppercase tracking-[0.32em] text-[#f2bb55]/70">Sprite editor</div>
            <p class="max-w-2xl text-sm text-white/60">
              Drag sprites from the drawer onto the 1920 x 1000 scene. Dimensions cache in Convex on
              first use.
            </p>
          </div>
          <button
            class="rounded-full border border-[#f2bb55]/30 bg-[#f2bb55]/12 px-4 py-2 text-sm font-semibold text-[#ffd58a] transition hover:bg-[#f2bb55]/18"
            type="button"
            onClick={() => setDrawerOpen((current) => !current)}
          >
            {drawerOpen() ? "Hide drawer" : "Open drawer"}
          </button>
        </div>

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

      <SpriteDrawer
        open={drawerOpen()}
        onClose={() => setDrawerOpen(false)}
        onDragStateChange={setIsDraggingSprite}
      />
    </div>
  );
}
