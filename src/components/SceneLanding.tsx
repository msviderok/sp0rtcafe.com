import { useQuery } from "convex-solidjs";
import { For, Show } from "solid-js";
import { getSpriteBackgroundStyle } from "~/lib/sceneStyles";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";

export default function SceneLanding() {
  const defaultScene = useQuery(api.scenes.getDefault, {});

  return (
    <main class="min-h-screen bg-[#140d0b] px-4 py-8 text-foreground">
      <div class="mx-auto mb-6 flex max-w-[2200px] items-center justify-end">
        <a
          class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10 hover:text-white"
          href="/editor"
        >
          Open editor
        </a>
      </div>

      <div class="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[2200px] items-center justify-center">
        <Show
          when={!defaultScene.isLoading()}
          fallback={
            <div class="flex flex-col items-center gap-4">
              <div class="flex gap-1.5">
                <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
                <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
                <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
              </div>
              <p class="text-xs uppercase tracking-[0.22em] text-white/30">Loading scene</p>
            </div>
          }
        >
          <Show
            when={defaultScene.data()}
            fallback={
              <div class="flex max-w-md flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
                <div class="text-xs uppercase tracking-[0.22em] text-white/45">No scene yet</div>
                <div class="text-sm text-white/70">
                  Create a scene first, then set it as default.
                </div>
                <a
                  class="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15"
                  href="/editor"
                >
                  Open editor
                </a>
              </div>
            }
          >
            {(scene) => (
              <LandingScene sceneId={scene()._id} width={scene().width} height={scene().height} />
            )}
          </Show>
        </Show>
      </div>
    </main>
  );
}

function LandingScene(props: { sceneId: Id<"scenes">; width: number; height: number }) {
  const assets = useQuery(api.sceneAssets.listByScene, { sceneId: props.sceneId });

  return (
    <div class="overflow-auto rounded-[32px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <div
        class="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#1e1512]"
        style={{
          width: `${props.width}px`,
          height: `${props.height}px`,
        }}
      >
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-black/30" />
        <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-white/[0.04]" />

        <Show
          when={!assets.isLoading()}
          fallback={
            <div class="absolute left-6 top-6 text-sm text-muted-foreground">Loading scene...</div>
          }
        >
          <For each={assets.data() ?? []}>
            {(asset) => (
              <div
                class="absolute [image-rendering:pixelated]"
                style={{
                  left: `${asset.x}px`,
                  top: `${asset.y}px`,
                  width: `${asset.width}px`,
                  height: `${asset.height}px`,
                  transform: `rotate(${asset.rotation ?? 0}deg)`,
                  "transform-origin": "center center",
                }}
              >
                <div
                  class="absolute inset-0"
                  style={{
                    ...getSpriteBackgroundStyle({
                      url: asset.sprite.url,
                      bgRepeat: asset.bgRepeat ?? asset.sprite.bgRepeat,
                      bgPosition: asset.bgPosition ?? asset.sprite.bgPosition,
                      bgSize: asset.bgSize ?? asset.sprite.bgSize,
                    }),
                    opacity: String(asset.opacity ?? 1),
                  }}
                />
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
}
