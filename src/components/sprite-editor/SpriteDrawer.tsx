import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, Show } from "solid-js";
import { api } from "../../../convex/_generated/api";
import DraggableSprite from "./DraggableSprite";
import { SPRITE_CATALOG } from "./spriteCatalog";

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () =>
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    image.onerror = () => reject(new Error("Failed to load image"));
    image.src = url;
  });
}

function CatalogSpriteSync(props: { sprite: (typeof SPRITE_CATALOG)[number] }) {
  const cachedSprite = useQuery(api.sprites.getByUrl, () => ({ url: props.sprite.url }));
  const createSprite = useMutation(api.sprites.create);
  const [isCreating, setIsCreating] = createSignal(false);

  createEffect(() => {
    if (cachedSprite.isLoading() || cachedSprite.data() !== null || isCreating()) {
      return;
    }

    setIsCreating(true);
    void getImageDimensions(props.sprite.url)
      .then(({ width, height }) =>
        createSprite.mutate({
          key: props.sprite.key,
          url: props.sprite.url,
          width,
          height,
        })
      )
      .finally(() => setIsCreating(false));
  });

  return null;
}

export default function SpriteDrawer(props: {
  open: boolean;
  onClose: () => void;
  onDragStateChange: (isDragging: boolean) => void;
}) {
  const sprites = useQuery(api.sprites.list, {});
  const createSprite = useMutation(api.sprites.create);
  const [name, setName] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [errorMessage, setErrorMessage] = createSignal<string>();

  const sortedSprites = createMemo(() =>
    [...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key))
  );

  const addRemoteSprite = async (event: SubmitEvent) => {
    event.preventDefault();

    const trimmedName = name().trim();
    const trimmedUrl = url().trim();

    if (!trimmedName || !trimmedUrl) {
      setErrorMessage("name + url req");
      return;
    }

    try {
      setErrorMessage(undefined);
      const { width, height } = await getImageDimensions(trimmedUrl);
      await createSprite.mutate({
        key: trimmedName,
        url: trimmedUrl,
        width,
        height,
      });
      setName("");
      setUrl("");
    } catch {
      setErrorMessage("image load fail");
    }
  };

  return (
    <>
      <For each={SPRITE_CATALOG}>{(sprite) => <CatalogSpriteSync sprite={sprite} />}</For>

      <aside
        class="fixed right-0 top-0 z-40 flex h-screen w-[360px] max-w-[92vw] flex-col border-l border-white/10 bg-[#17110d]/95 text-white shadow-2xl transition-transform duration-200"
        style={{
          transform: props.open ? "translateX(0)" : "translateX(100%)",
        }}
      >
        <div class="flex items-center justify-between border-b border-white/10 px-5 py-4">
          <div>
            <div class="text-xs uppercase tracking-[0.28em] text-white/45">Sprite drawer</div>
            <h2 class="text-lg font-semibold">Palette</h2>
          </div>
          <button
            class="rounded-full border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:bg-white/10"
            type="button"
            onClick={props.onClose}
          >
            Close
          </button>
        </div>

        <form class="space-y-3 border-b border-white/10 px-5 py-4" onSubmit={addRemoteSprite}>
          <div class="text-xs uppercase tracking-[0.22em] text-white/45">Add by URL</div>
          <input
            class="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            placeholder="sprite key"
            value={name()}
            onInput={(event) => setName(event.currentTarget.value)}
          />
          <input
            class="w-full rounded-xl border border-white/10 bg-white/8 px-3 py-2 text-sm text-white outline-none placeholder:text-white/30"
            placeholder="https://..."
            value={url()}
            onInput={(event) => setUrl(event.currentTarget.value)}
          />
          <button
            class="w-full rounded-xl bg-[#f2bb55] px-3 py-2 text-sm font-semibold text-[#2d190f] transition hover:brightness-105 disabled:opacity-60"
            disabled={createSprite.isLoading()}
            type="submit"
          >
            {createSprite.isLoading() ? "Saving..." : "Save sprite"}
          </button>
          <Show when={errorMessage()}>
            <div class="text-xs text-amber-200/90">{errorMessage()}</div>
          </Show>
        </form>

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <Show
            when={!sprites.isLoading()}
            fallback={<div class="text-sm text-white/55">Loading sprites...</div>}
          >
            <div class="grid grid-cols-2 gap-3">
              <For each={sortedSprites()}>
                {(sprite) => (
                  <DraggableSprite
                    sprite={sprite}
                    onDragStart={() => props.onDragStateChange(true)}
                    onDragEnd={() => props.onDragStateChange(false)}
                  />
                )}
              </For>
            </div>
          </Show>
        </div>
      </aside>
    </>
  );
}
