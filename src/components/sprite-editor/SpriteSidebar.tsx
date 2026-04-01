import { useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, onMount, Show } from "solid-js";
import { future_genUploader } from "uploadthing/client-future";
import { DEFAULT_BG_REPEAT, DEFAULT_BG_SIZE } from "~/lib/sceneStyles";
import type { UploadRouter } from "~/server/uploadthing";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import type { DndDebugReporter, DndDebugSnapshotReporter } from "./dndDebug";
import DraggableSprite from "./DraggableSprite";

const uploadThing = future_genUploader<UploadRouter>({
  url: "/api/uploadthing",
});

function getFileFingerprint(file: Pick<File, "name" | "size" | "lastModified">) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function getFileDimensions(file: File): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        width: image.naturalWidth,
        height: image.naturalHeight,
      });
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Failed to read image dimensions"));
    };
    image.src = objectUrl;
  });
}

function compactUploadRecord(record: {
  uploadThingKey: string;
  fileName: string;
  status: "pending" | "uploading" | "uploaded" | "failed";
  progress: number;
  url?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: number;
  width?: number;
  height?: number;
  error?: string;
}) {
  return {
    uploadThingKey: record.uploadThingKey,
    fileName: record.fileName,
    status: record.status,
    progress: record.progress,
    ...(record.url !== undefined ? { url: record.url } : {}),
    ...(record.size !== undefined ? { size: record.size } : {}),
    ...(record.mimeType !== undefined ? { mimeType: record.mimeType } : {}),
    ...(record.uploadedAt !== undefined ? { uploadedAt: record.uploadedAt } : {}),
    ...(record.width !== undefined ? { width: record.width } : {}),
    ...(record.height !== undefined ? { height: record.height } : {}),
    ...(record.error !== undefined ? { error: record.error } : {}),
  };
}

export default function SpriteSidebar(props: {
  debugEnabled?: boolean;
  onDebugEvent?: DndDebugReporter;
  onDebugSnapshot?: DndDebugSnapshotReporter;
}) {
  const sprites = useQuery(api.sprites.list, {});
  const syncFiles = useMutation(api.files.upsertUploadThingFiles);
  const syncUploadedSprites = useMutation(api.files.syncUploadedImagesToSprites);
  const updatePresetStyle = useMutation(api.sprites.updatePresetStyle);
  const activeUploads = useQuery(api.files.listActiveUploads, {});
  const [errorMessage, setErrorMessage] = createSignal<string>();
  const [isUploading, setIsUploading] = createSignal(false);
  const [isOpen, setIsOpen] = createSignal(true);
  const [selectedSpriteId, setSelectedSpriteId] = createSignal<Id<"sprites">>();
  const [bgRepeat, setBgRepeat] = createSignal(DEFAULT_BG_REPEAT);
  const [bgPosition, setBgPosition] = createSignal("");
  const [bgSize, setBgSize] = createSignal(DEFAULT_BG_SIZE);
  let fileInputRef: HTMLInputElement | undefined;

  const sortedSprites = createMemo(() =>
    [...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key))
  );
  const visibleUploads = createMemo(() => activeUploads.data() ?? []);
  const selectedSprite = createMemo(() =>
    sortedSprites().find((sprite) => sprite._id === selectedSpriteId()) ?? null
  );

  createEffect(() => {
    const current = selectedSprite();
    if (!current) {
      return;
    }

    setBgRepeat(current.bgRepeat ?? DEFAULT_BG_REPEAT);
    setBgPosition(current.bgPosition ?? "");
    setBgSize(current.bgSize ?? DEFAULT_BG_SIZE);
  });

  createEffect(() => {
    const currentId = selectedSpriteId();
    if (currentId && sortedSprites().some((sprite) => sprite._id === currentId)) {
      return;
    }

    if (sortedSprites()[0]) {
      setSelectedSpriteId(sortedSprites()[0]._id);
    }
  });

  onMount(() => {
    void syncUploadedSprites.mutate({ limit: 200 });
  });

  const syncUploadBatch = async (
    files: Array<{
      uploadThingKey: string;
      fileName: string;
      status: "pending" | "uploading" | "uploaded" | "failed";
      progress: number;
      url?: string;
      size?: number;
      mimeType?: string;
      uploadedAt?: number;
      width?: number;
      height?: number;
      error?: string;
    }>
  ) => {
    if (files.length === 0) {
      return;
    }

    await syncFiles.mutate({
      files: files.map(compactUploadRecord),
      createSprites: true,
    });
  };

  const handleFileSelection = async (event: Event) => {
    const input = event.currentTarget as HTMLInputElement;
    const files = [...(input.files ?? [])];

    if (files.length === 0) {
      return;
    }

    const imageFiles = files.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length !== files.length) {
      setErrorMessage("images only");
      input.value = "";
      return;
    }

    setErrorMessage(undefined);
    setIsUploading(true);

    try {
      const imageMetadata = new Map<string, { width: number; height: number }>();
      await Promise.all(
        imageFiles.map(async (file) => {
          imageMetadata.set(getFileFingerprint(file), await getFileDimensions(file));
        })
      );

      const lastSyncedProgress = new Map<string, number>();

      await uploadThing.uploadFiles("imageUploader", {
        files: imageFiles,
        onEvent: (uploadEvent) => {
          if (uploadEvent.type === "presigned-received") {
            void syncUploadBatch(
              uploadEvent.files
                .filter((file) => file.key)
                .map((file) => {
                  const metadata = imageMetadata.get(getFileFingerprint(file));

                  return {
                    uploadThingKey: file.key!,
                    fileName: file.name,
                    status: "pending" as const,
                    progress: 0,
                    size: file.size,
                    mimeType: file.type || undefined,
                    width: metadata?.width,
                    height: metadata?.height,
                  };
                })
            );
            return;
          }

          if (uploadEvent.type === "upload-started") {
            const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
            void syncUploadBatch([
              {
                uploadThingKey: uploadEvent.file.key,
                fileName: uploadEvent.file.name,
                status: "uploading",
                progress: 0,
                size: uploadEvent.file.size,
                mimeType: uploadEvent.file.type || undefined,
                width: metadata?.width,
                height: metadata?.height,
              },
            ]);
            return;
          }

          if (uploadEvent.type === "upload-progress") {
            const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
            const nextProgress = Math.min(
              99,
              Math.max(1, Math.round((uploadEvent.file.sent / uploadEvent.file.size) * 100))
            );
            const previousProgress = lastSyncedProgress.get(uploadEvent.file.key) ?? -1;

            if (nextProgress - previousProgress < 5 && nextProgress !== 99) {
              return;
            }

            lastSyncedProgress.set(uploadEvent.file.key, nextProgress);
            void syncUploadBatch([
              {
                uploadThingKey: uploadEvent.file.key,
                fileName: uploadEvent.file.name,
                status: "uploading",
                progress: nextProgress,
                size: uploadEvent.file.size,
                mimeType: uploadEvent.file.type || undefined,
                width: metadata?.width,
                height: metadata?.height,
              },
            ]);
            return;
          }

          if (uploadEvent.type === "upload-completed") {
            const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
            void syncUploadBatch([
              {
                uploadThingKey: uploadEvent.file.key,
                fileName: uploadEvent.file.name,
                status: "uploaded",
                progress: 100,
                url: uploadEvent.file.url,
                size: uploadEvent.file.size,
                mimeType: uploadEvent.file.type || undefined,
                uploadedAt: Date.now(),
                width: metadata?.width,
                height: metadata?.height,
              },
            ]);
            return;
          }

          if (uploadEvent.type === "upload-failed") {
            const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
            void syncUploadBatch([
              {
                uploadThingKey: uploadEvent.file.key,
                fileName: uploadEvent.file.name,
                status: "failed",
                progress:
                  uploadEvent.file.size > 0
                    ? Math.round((uploadEvent.file.sent / uploadEvent.file.size) * 100)
                    : 0,
                size: uploadEvent.file.size,
                mimeType: uploadEvent.file.type || undefined,
                width: metadata?.width,
                height: metadata?.height,
                error: uploadEvent.file.reason.message,
              },
            ]);
            setErrorMessage("upload fail");
            return;
          }

          if (uploadEvent.type === "upload-aborted") {
            void syncUploadBatch(
              uploadEvent.files
                .filter((file) => file.key)
                .map((file) => {
                  const metadata = imageMetadata.get(getFileFingerprint(file));

                  return {
                    uploadThingKey: file.key!,
                    fileName: file.name,
                    status: "failed" as const,
                    progress: file.size > 0 ? Math.round((file.sent / file.size) * 100) : 0,
                    size: file.size,
                    mimeType: file.type || undefined,
                    width: metadata?.width,
                    height: metadata?.height,
                    error: "upload aborted",
                  };
                })
            );
            setErrorMessage("upload aborted");
          }
        },
      });
    } catch {
      setErrorMessage("upload fail");
    } finally {
      setIsUploading(false);
      input.value = "";
    }
  };

  const handleSavePresetStyle = async () => {
    const spriteId = selectedSpriteId();
    if (!spriteId) {
      return;
    }

    await updatePresetStyle.mutate({
      spriteId,
      bgRepeat: bgRepeat() || DEFAULT_BG_REPEAT,
      bgPosition: bgPosition().trim(),
      bgSize: bgSize().trim() || DEFAULT_BG_SIZE,
    });
  };

  return (
    <>
      <button
        class={`fixed right-0 top-1/2 z-50 -translate-y-1/2 cursor-pointer rounded-l-lg border border-r-0 border-border bg-popover px-2 py-3 text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition-opacity duration-300 hover:bg-accent hover:text-foreground [writing-mode:vertical-rl] ${isOpen() ? "pointer-events-none opacity-0" : "opacity-100"}`}
        type="button"
        onClick={() => setIsOpen(true)}
        aria-label="Open assets panel"
      >
        Assets
      </button>

      <aside
        class={`fixed inset-y-0 right-0 z-50 flex w-80 flex-col border-l border-border bg-popover transition-transform duration-300 ease-in-out ${isOpen() ? "translate-x-0" : "translate-x-full"}`}
        onKeyDown={(e) => e.key === "Escape" && setIsOpen(false)}
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <span class="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Assets</span>
          <button
            class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
            type="button"
            onClick={() => setIsOpen(false)}
            aria-label="Collapse"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
        </div>

        <div class="flex-1 overflow-y-auto p-2">
          <Show
            when={!sprites.isLoading()}
            fallback={<div class="p-2 text-xs text-muted-foreground">...</div>}
          >
            <div class="flex flex-col gap-0.5">
              <For each={sortedSprites()}>
                {(sprite) => (
                  <div class="flex items-center gap-2">
                    <div class="min-w-0 flex-1">
                      <DraggableSprite
                        sprite={sprite}
                        debugEnabled={props.debugEnabled}
                        onDebugEvent={props.onDebugEvent}
                        onDebugSnapshot={props.onDebugSnapshot}
                      />
                    </div>
                    <button
                      class={`rounded-md border px-2 py-1 text-[10px] uppercase tracking-[0.18em] transition ${
                        selectedSpriteId() === sprite._id
                          ? "border-primary bg-primary/10 text-foreground"
                          : "border-border text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      type="button"
                      onClick={() => setSelectedSpriteId(sprite._id)}
                    >
                      Style
                    </button>
                  </div>
                )}
              </For>
            </div>
          </Show>

          <Show when={selectedSprite()}>
            {(sprite) => (
              <section class="mt-4 rounded-2xl border border-border bg-background/60 p-3">
                <div class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">
                  Preset style
                </div>
                <div class="mt-1 truncate text-sm text-foreground">{sprite().key}</div>

                <div class="mt-3 grid gap-3">
                  <label class="grid gap-1 text-xs text-muted-foreground">
                    <span>bg repeat</span>
                    <select
                      class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                      value={bgRepeat()}
                      onChange={(event) => setBgRepeat(event.currentTarget.value)}
                    >
                      <option value="no-repeat">no-repeat</option>
                      <option value="repeat">repeat</option>
                      <option value="repeat-x">repeat-x</option>
                      <option value="repeat-y">repeat-y</option>
                      <option value="space">space</option>
                      <option value="round">round</option>
                    </select>
                  </label>

                  <label class="grid gap-1 text-xs text-muted-foreground">
                    <span>bg position</span>
                    <input
                      class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                      value={bgPosition()}
                      placeholder="unset"
                      onInput={(event) => setBgPosition(event.currentTarget.value)}
                    />
                  </label>

                  <label class="grid gap-1 text-xs text-muted-foreground">
                    <span>bg size</span>
                    <input
                      class="rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition focus:border-primary"
                      value={bgSize()}
                      placeholder={DEFAULT_BG_SIZE}
                      onInput={(event) => setBgSize(event.currentTarget.value)}
                    />
                  </label>

                  <button
                    class="rounded-lg border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
                    type="button"
                    onClick={() => void handleSavePresetStyle()}
                  >
                    Save preset style
                  </button>
                </div>
              </section>
            )}
          </Show>

          <Show when={visibleUploads().length > 0}>
            <div class="mt-2 flex flex-col gap-0.5">
              <For each={visibleUploads()}>
                {(file) => (
                  <div class="flex items-center gap-2.5 rounded-lg bg-muted/50 p-1.5">
                    <div
                      class="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted"
                      title={file.fileName}
                    >
                      <div
                        class="absolute inset-x-0 bottom-0 h-1 rounded-b bg-primary transition-[width] duration-150"
                        style={{ width: `${file.progress}%` }}
                      />
                    </div>
                    <div class="min-w-0 flex-1">
                      <div class="truncate text-[11px] leading-tight text-foreground/50">
                        {file.fileName}
                      </div>
                      <div class="mt-0.5 text-[10px] text-muted-foreground">
                        {file.status === "failed" ? (
                          <span class="text-destructive">failed</span>
                        ) : (
                          `${file.progress}%`
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </For>
            </div>
          </Show>
        </div>

        <div class="border-t border-border p-2">
          <input
            ref={fileInputRef}
            class="hidden"
            type="file"
            accept="image/*"
            multiple
            onChange={handleFileSelection}
          />
          <button
            class="flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
            type="button"
            title={isUploading() ? "Uploading..." : "Upload new assets"}
            disabled={isUploading()}
            onClick={() => fileInputRef?.click()}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <path d="M12 5v14" />
              <path d="M5 12h14" />
            </svg>
            {isUploading() ? "Uploading..." : "Upload new assets"}
          </button>
          <Show when={errorMessage()}>
            <div class="mt-1 text-[10px] leading-tight text-destructive">{errorMessage()}</div>
          </Show>
        </div>
      </aside>
    </>
  );
}
