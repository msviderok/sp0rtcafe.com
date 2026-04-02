import { For, Show } from "solid-js";
import type { CharacterManifestWithUrls } from "~/lib/characterCatalog.client";

export default function CharacterPickerRail(props: {
  characters: CharacterManifestWithUrls[];
  currentCharacterId: string;
  pendingCharacterId?: string | null;
  onApply: (characterId: string) => void;
  onSelectPreview: (characterId: string) => void;
  selectedCharacterId: string;
}) {
  const selectedCharacter = () =>
    props.characters.find((character) => character.id === props.selectedCharacterId) ?? null;
  const isPending = (characterId: string) => props.pendingCharacterId === characterId;
  const isApplyDisabled = (characterId: string) =>
    props.pendingCharacterId !== null && props.pendingCharacterId !== undefined
      ? true
      : characterId === props.currentCharacterId;
  let viewportRef: HTMLDivElement | undefined;

  const restoreScrollPosition = (scrollTop: number | null) => {
    if (scrollTop === null) {
      return;
    }

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (!viewportRef) {
          return;
        }

        viewportRef.scrollTop = scrollTop;
      });
    });
  };

  return (
    <aside class="flex h-full min-w-0 flex-col overflow-hidden">
      <div class="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
        <span class="text-[11px] uppercase tracking-[0.28em] text-white/45">Characters</span>
      </div>

      <div ref={viewportRef} class="min-h-0 flex-1 overflow-y-auto p-3 [overflow-anchor:none]">
        <div class="grid gap-2">
          <For each={props.characters}>
            {(character) => {
              const isCurrent = () => character.id === props.currentCharacterId;
              const isSelected = () => character.id === props.selectedCharacterId;

              return (
                <article
                  class={`group relative overflow-hidden rounded-[4px] border text-left transition ${
                    isSelected()
                      ? "border-white/25 bg-white/8"
                      : "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                  }`}
                >
                  <button
                    class="block w-full text-left"
                    type="button"
                    onClick={(e) => {
                      const scrollTop = viewportRef?.scrollTop ?? null;
                      (e.currentTarget as HTMLButtonElement).blur();
                      props.onSelectPreview(character.id);
                      restoreScrollPosition(scrollTop);
                    }}
                  >
                    <div class="relative h-28 overflow-hidden border-b border-white/10 bg-[#140d0b]">
                      <Show when={character.previewUrl}>
                        <div
                          class="absolute inset-0 bg-center bg-contain bg-no-repeat [image-rendering:pixelated]"
                          style={{
                            "background-image": `url(${character.previewUrl})`,
                          }}
                        />
                      </Show>
                      <div class="absolute inset-x-0 top-2 flex items-start justify-between px-2">
                        <div class="rounded-full border border-white/10 bg-black/55 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-white/80">
                          {character.animationCount} animations
                        </div>
                        <Show when={isCurrent()}>
                          <div class="rounded-full border border-emerald-400/25 bg-emerald-400/10 px-2 py-0.5 text-[9px] uppercase tracking-[0.14em] text-emerald-200">
                            Current
                          </div>
                        </Show>
                      </div>
                    </div>
                  </button>
                  <div class="flex items-center justify-between gap-3 px-3 py-2">
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-sm text-white/90">{character.label}</div>
                      <div class="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
                        {character.quickActionNames.length} quick actions
                      </div>
                    </div>
                    <button
                      class="shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1.5 text-[10px] uppercase tracking-[0.18em] text-white transition hover:bg-white/15 disabled:cursor-not-allowed disabled:text-white/35"
                      type="button"
                      disabled={isApplyDisabled(character.id)}
                      onClick={(e) => {
                        const scrollTop = viewportRef?.scrollTop ?? null;
                        (e.currentTarget as HTMLButtonElement).blur();
                        props.onApply(character.id);
                        restoreScrollPosition(scrollTop);
                      }}
                    >
                      {isPending(character.id) ? "Saving..." : isCurrent() ? "In use" : "Use"}
                    </button>
                  </div>
                </article>
              );
            }}
          </For>
        </div>

        <Show when={selectedCharacter()}>
          {(character) => (
            <section class="mt-3 rounded-[4px] border border-white/10 bg-black/25 p-3">
              <div>
                <div class="text-sm text-white/90">{character().label}</div>
                <div class="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/40">
                  {character().animationCount} animations available
                </div>
              </div>

              <div class="mt-3 flex flex-wrap gap-2">
                <For each={character().actions}>
                  {(action) => (
                    <div class="rounded-full border border-white/10 bg-white/[0.03] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-white/65">
                      {action.label}
                    </div>
                  )}
                </For>
              </div>
            </section>
          )}
        </Show>
      </div>
    </aside>
  );
}
