import { getSpriteBackgroundStyle } from "~/lib/sceneStyles";
import { cn } from "~/lib/utils";

export type SceneSprite = {
  url: string;
  width: number;
  height: number;
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
  rotation: number;
  locked: boolean;
  canResizeFreely: boolean;
  selectionMode: "none" | "single" | "multi";
  isStyleEditorOpen: boolean;
  onSelect: (event: PointerEvent) => void;
  onMoveStart: (event: PointerEvent) => void;
  onResizeStart: (handle: EdgeResizeHandle, event: PointerEvent) => void;
  onRotateStart: (event: PointerEvent) => void;
  onDelete: () => void;
  onToggleLock: () => void;
  onToggleStyleEditor: () => void;
}) {
  return (
    <div
      class="absolute origin-center"
      style={{
        left: `${props.x}px`,
        top: `${props.y}px`,
        width: `${props.sprite.width}px`,
        height: `${props.sprite.height}px`,
        transform: `rotate(${props.rotation}deg)`,
      }}
    >
      <div
        class="absolute inset-0 z-10 bg-no-repeat bg-size-[100%_100%] drop-shadow-[0_10px_24px_rgba(0,0,0,0.35)] touch-none"
        style={getSpriteBackgroundStyle(props.sprite)}
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
              "border-color": "rgb(255 217 122 / 1)",
              "box-shadow": "0 0 0 1px rgb(0 0 0 / 0.5), 0 0 18px rgb(255 201 102 / 0.28)",
            }}
          />

          <div class="absolute -top-10 left-1/2 z-50 flex -translate-x-1/2 items-center gap-1 rounded-full border border-white/10 bg-black/75 px-2 py-1 text-[10px] uppercase tracking-[0.18em] text-white/70">
            <button
              class="rounded-full px-2 py-1 transition hover:bg-white/10"
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleStyleEditor();
              }}
            >
              {props.isStyleEditorOpen ? "Close style" : "Style"}
            </button>
            <button
              class="rounded-full px-2 py-1 transition hover:bg-white/10"
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                props.onToggleLock();
              }}
            >
              {props.locked ? "Unlock" : "Lock"}
            </button>
            <button
              class={`rounded-full px-2 py-1 transition hover:bg-white/10 ${props.locked ? "cursor-not-allowed text-white/30" : "text-rose-200"}`}
              type="button"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation();
                if (!props.locked) {
                  props.onDelete();
                }
              }}
            >
              Delete
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
              "absolute size-3 left-0 top-0 -translate-x-px -translate-y-px border-l-2 border-t-2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-nw-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("nw", event);
            }}
          />
          <div
            class={cn(
              "absolute size-3 left-0 top-0 right-0 translate-x-px -translate-y-px border-r-2 border-t-2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-se-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("ne", event);
            }}
          />
          <div
            class={cn(
              "absolute size-3 bottom-0 left-0 -translate-x-px translate-y-px border-b-2 border-l-2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-se-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("sw", event);
            }}
          />
          <div
            class={cn(
              "absolute size-3 bottom-0 right-0 translate-x-px translate-y-px border-b-2 border-r-2",
              props.locked ? "pointer-events-none opacity-35" : "cursor-se-resize"
            )}
            onPointerDown={(event) => {
              event.stopPropagation();
              if (!props.locked) props.onResizeStart("se", event);
            }}
          />

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
            "box-shadow": "0 0 0 1px rgb(0 0 0 / 0.5), 0 0 18px rgb(255 201 102 / 0.28)",
          }}
        />
      ) : null}
    </div>
  );
}
