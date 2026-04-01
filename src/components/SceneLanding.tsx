import { useQuery } from "convex-solidjs";
import { For, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import { getSpriteBackgroundStyle } from "~/lib/sceneStyles";

export default function SceneLanding() {
  const defaultScene = useQuery(api.scenes.getDefault, {});
  const assets = useQuery(
    api.sceneAssets.listByScene,
    () => (defaultScene.data()?._id ? { sceneId: defaultScene.data()!._id } : "skip")
  );

  return (
    <main class="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(255,215,170,0.14),_transparent_30%),linear-gradient(180deg,#2b1d16_0%,#140d0b_100%)] px-4 py-8 text-foreground">
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
          when={defaultScene.data()}
          fallback={<div class="text-sm text-muted-foreground">No default scene yet. Open /editor.</div>}
        >
          {(scene) => (
            <div class="overflow-auto rounded-[32px] border border-white/10 bg-black/20 p-4 shadow-[0_40px_140px_rgba(0,0,0,0.45)] backdrop-blur-sm">
              <div
                class="relative overflow-hidden rounded-[24px] border border-white/10 bg-[radial-gradient(circle_at_top,_rgba(255,214,153,0.14),_transparent_35%),linear-gradient(180deg,#34231b_0%,#1e1512_48%,#140d0b_100%)]"
                style={{
                  width: `${scene().width}px`,
                  height: `${scene().height}px`,
                }}
              >
                <div class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.16)_18%,rgba(0,0,0,0.48)_100%)]" />
                <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[linear-gradient(180deg,rgba(255,244,214,0.08)_0%,transparent_100%)]" />

                <Show
                  when={!assets.isLoading()}
                  fallback={<div class="absolute left-6 top-6 text-sm text-muted-foreground">Loading scene...</div>}
                >
                  <For each={assets.data() ?? []}>
                    {(asset) => (
                      <div
                        class="absolute drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)]"
                        style={{
                          left: `${asset.x}px`,
                          top: `${asset.y}px`,
                          width: `${asset.width}px`,
                          height: `${asset.height}px`,
                          transform: `rotate(${asset.rotation ?? 0}deg)`,
                          "transform-origin": "center center",
                        }}
                      >
                        <div class="absolute inset-0" style={getSpriteBackgroundStyle(asset.sprite)} />
                      </div>
                    )}
                  </For>
                </Show>
              </div>
            </div>
          )}
        </Show>
      </div>
    </main>
  );
}
