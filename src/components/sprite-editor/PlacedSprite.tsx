import type { JSXElement } from "solid-js";
import { Popover } from "~/components/ui";
import { getSpriteBackgroundStyle } from "~/lib/sceneStyles";
import { cn } from "~/lib/utils";

const IconSliders = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M136,80v24a8,8,0,0,1-16,0V80a8,8,0,0,1,16,0Zm48,48a8,8,0,0,0-8,8v16H40a8,8,0,0,0,0,16H176v16a8,8,0,0,0,16,0V136A8,8,0,0,0,184,128Zm-80,24H40a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16Zm112-96H152a8,8,0,0,0,0,16h64a8,8,0,0,0,0-16ZM112,56a8,8,0,0,0-8,8v16H40a8,8,0,0,0,0,16h64v16a8,8,0,0,0,16,0V64A8,8,0,0,0,112,56Z" />
  </svg>
);
const IconLock = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,80H176V56a48,48,0,0,0-96,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM96,56a32,32,0,0,1,64,0V80H96ZM208,208H48V96H208V208Z" />
  </svg>
);
const IconLockOpen = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M208,80H96V56a32,32,0,0,1,32-32c15.37,0,29.2,11,32.16,25.59a8,8,0,0,0,15.68-3.18C171.32,24.15,151.2,8,128,8A48.05,48.05,0,0,0,80,56V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80Zm0,128H48V96H208V208Z" />
  </svg>
);
const IconTrash = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M216,48H176V40a24,24,0,0,0-24-24H104A24,24,0,0,0,80,40v8H40a8,8,0,0,0,0,16h8V208a16,16,0,0,0,16,16H192a16,16,0,0,0,16-16V64h8a8,8,0,0,0,0-16ZM96,40a8,8,0,0,1,8-8h48a8,8,0,0,1,8,8v8H96Zm96,168H64V64H192ZM112,104v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Zm48,0v64a8,8,0,0,1-16,0V104a8,8,0,0,1,16,0Z" />
  </svg>
);
const IconCollision = () => (
  <svg aria-hidden="true" width="12" height="12" viewBox="0 0 256 256" fill="currentColor">
    <path d="M40,64A16,16,0,0,1,56,48H200a16,16,0,0,1,16,16V192a16,16,0,0,1-16,16H56a16,16,0,0,1-16-16ZM200,64H56V192H200ZM88,96h80a8,8,0,0,1,0,16H88a8,8,0,0,1,0-16Zm0,48h80a8,8,0,0,1,0,16H88a8,8,0,0,1,0-16Z" />
  </svg>
);

export type SceneSprite = {
  url: string;
  width: number;
  height: number;
  opacity?: number;
  bgRepeat?: string;
  bgPosition?: string;
  bgSize?: string;
};

type ResizeHandle = "nw" | "ne" | "sw" | "se";
type EdgeResizeHandle = ResizeHandle | "n" | "e" | "s" | "w";

export default function PlacedSprite(props: {
  sprite: SceneSprite;
  x: number;
  y: number;
  zIndex: number;
  rotation: number;
  locked: boolean;
  collision: boolean;
  canResizeFreely: boolean;
  selectionMode: "none" | "single" | "multi";
  actionsDisabled?: boolean;
  isStyleEditorOpen: boolean;
  styleEditorContent?: JSXElement;
  onSelect: (event: PointerEvent) => void;
  onMoveStart: (event: PointerEvent) => void;
  onResizeStart: (handle: EdgeResizeHandle, event: PointerEvent) => void;
  onRotateStart: (event: PointerEvent) => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onToggleCollision: () => void;
  onToggleStyleEditor: () => void;
}) {
  const cornerHandleClass =
    "absolute z-40 flex h-8 w-8 items-center justify-center rounded-full transition";
  const cornerHandleVisualClass =
    "pointer-events-none h-3.5 w-3.5 border-[#ffd58a] drop-shadow-[0_0_10px_rgba(255,213,138,0.2)]";

  return (
    <div
      class="absolute origin-center [image-rendering:pixelated]"
      style={{
        left: `${props.x}px`,
        top: `${props.y}px`,
        width: `${props.sprite.width}px`,
        height: `${props.sprite.height}px`,
        "z-index": props.zIndex,
        transform: `rotate(${props.rotation}deg)`,
      }}
    >
      <div
        class="absolute inset-0 z-10 bg-no-repeat bg-size-[100%_100%] touch-none"
        style={{
          ...getSpriteBackgroundStyle(props.sprite),
          opacity: String(props.sprite.opacity ?? 1),
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          props.onSelect(event);
          if (!props.locked) {
            props.onMoveStart(event);
          }
        }}
      />

      {props.selectionMode === "single" ? (
        <>
          <div
            class="pointer-events-none absolute inset-0 z-30 border-2 border-solid"
            style={{
              "border-color": props.collision ? "rgb(52 211 153 / 0.95)" : "rgb(255 217 122 / 1)",
            }}
          />

          <div
            class={cn(
              "absolute left-1/2 top-3 z-50 flex -translate-x-1/2 items-center gap-0.5 rounded-full border border-white/12 bg-[#120f0d]/78 px-1 py-0.5 shadow-[0_14px_36px_rgba(0,0,0,0.38)] backdrop-blur-xl transition",
              props.actionsDisabled && "pointer-events-none opacity-40"
            )}
          >
            <Popover.Root
              open={props.isStyleEditorOpen}
              onOpenChange={(open) => {
                if (open !== props.isStyleEditorOpen) props.onToggleStyleEditor();
              }}
            >
              <Popover.Trigger
                class={cn(
                  "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition",
                  props.isStyleEditorOpen
                    ? "border-white/16 bg-white/14 text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-md"
                    : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/8 hover:text-white/90"
                )}
                onPointerDown={(event: PointerEvent) => event.stopPropagation()}
                onClick={(event: MouseEvent) => event.stopPropagation()}
              >
                <IconSliders />
                Style
              </Popover.Trigger>
              <Popover.Content
                side="top"
                sideOffset={12}
                positionMethod="fixed"
                collisionPadding={16}
                sticky
                collisionAvoidance={{ side: "flip", align: "shift", fallbackAxisSide: "end" }}
                class="w-72 rounded-2xl border border-white/10 bg-[#120f0d]/72 p-3.5 text-white shadow-[0_28px_60px_rgba(0,0,0,0.52)] backdrop-blur-2xl"
              >
                {props.styleEditorContent}
              </Popover.Content>
              </Popover.Root>

            <div class="mx-0.5 h-3.5 w-px bg-white/10" />

            <button
              class={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition",
                props.collision
                  ? "border-emerald-400/18 bg-emerald-500/15 text-emerald-200"
                  : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/8 hover:text-white/90"
              )}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleCollision();
              }}
            >
              <IconCollision />
              {props.collision ? "Collision" : "No collision"}
            </button>

            <div class="mx-0.5 h-3.5 w-px bg-white/10" />

            <button
              class={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition",
                props.locked
                  ? "border-amber-400/18 bg-amber-500/15 text-amber-300/90"
                  : "border-transparent text-white/60 hover:border-white/10 hover:bg-white/8 hover:text-white/90"
              )}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleLock();
              }}
            >
              {props.locked ? <IconLock /> : <IconLockOpen />}
              {props.locked ? "Locked" : "Lock"}
            </button>

            <div class="mx-0.5 h-3.5 w-px bg-white/10" />

            <button
              class={cn(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] transition",
                props.locked
                  ? "cursor-not-allowed border-transparent text-white/20"
                  : "border-transparent text-white/60 hover:border-rose-300/14 hover:bg-rose-500/15 hover:text-rose-300"
              )}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!props.locked) props.onDelete();
              }}
            >
              <IconTrash />
            </button>
          </div>

          <div class="absolute left-1/2 top-0 z-20 h-5 w-px -translate-x-1/2 -translate-y-full bg-[#ffd58a]/70" />
          <div
            class={`absolute left-1/2 top-0 z-20 h-3 w-3 -translate-x-1/2 -translate-y-[22px] rounded-full border border-[#2d190f] bg-[#ffd58a] ${props.locked ? "cursor-not-allowed opacity-35" : "cursor-grab"}`}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onRotateStart(event);
            }}
          />

          <div
            class={cn(
              cornerHandleClass,
              "left-0 top-0 -translate-x-1/2 -translate-y-1/2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-nw-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("nw", event);
            }}
          >
            <div class={cn(cornerHandleVisualClass, "border-l-2 border-t-2")} />
          </div>
          <div
            class={cn(
              cornerHandleClass,
              "right-0 top-0 translate-x-1/2 -translate-y-1/2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-ne-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("ne", event);
            }}
          >
            <div class={cn(cornerHandleVisualClass, "border-r-2 border-t-2")} />
          </div>
          <div
            class={cn(
              cornerHandleClass,
              "bottom-0 left-0 -translate-x-1/2 translate-y-1/2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-sw-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("sw", event);
            }}
          >
            <div class={cn(cornerHandleVisualClass, "border-b-2 border-l-2")} />
          </div>
          <div
            class={cn(
              cornerHandleClass,
              "bottom-0 right-0 translate-x-1/2 translate-y-1/2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-se-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("se", event);
            }}
          >
            <div class={cn(cornerHandleVisualClass, "border-b-2 border-r-2")} />
          </div>

          {props.canResizeFreely && (
            <>
              <div
                class={cn(
                  "absolute z-40 left-1/2 top-0 h-3 w-8 -translate-x-1/2 -translate-y-1/2 cursor-ns-resize rounded-full border border-[#2d190f] bg-[#ffd58a] opacity-100",
                  props.locked && "pointer-events-none opacity-35"
                )}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!props.locked) props.onResizeStart("n", event);
                }}
              />
              <div
                class={cn(
                  "absolute z-40 right-0 top-1/2 h-8 w-3 translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-[#2d190f] bg-[#ffd58a] opacity-100",
                  props.locked && "pointer-events-none opacity-35"
                )}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!props.locked) props.onResizeStart("e", event);
                }}
              />
              <div
                class={cn(
                  "absolute z-40 bottom-0 left-1/2 h-3 w-8 -translate-x-1/2 translate-y-1/2 cursor-ns-resize rounded-full border border-[#2d190f] bg-[#ffd58a] opacity-100",
                  props.locked && "pointer-events-none opacity-35"
                )}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!props.locked) props.onResizeStart("s", event);
                }}
              />
              <div
                class={cn(
                  "absolute z-40 left-0 top-1/2 h-8 w-3 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize rounded-full border border-[#2d190f] bg-[#ffd58a] opacity-100",
                  props.locked && "pointer-events-none opacity-35"
                )}
                onPointerDown={(event) => {
                  event.stopPropagation();
                  if (!props.locked) props.onResizeStart("w", event);
                }}
              />
            </>
          )}
        </>
      ) : props.selectionMode === "multi" ? (
        <div
          class="pointer-events-none absolute inset-0 z-30 border-2 border-solid"
          style={{
            "border-color": "rgb(255 217 122 / 1)",
          }}
        />
      ) : null}
    </div>
  );
}
