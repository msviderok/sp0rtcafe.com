import { Popover as PopoverPrimitive } from "@msviderok/base-ui-solid/popover";
import { type ComponentProps, mergeProps, splitProps } from "solid-js";

import { cn } from "~/lib/utils";

function Popover(props: PopoverPrimitive.Root.Props) {
  return <PopoverPrimitive.Root data-slot="popover" {...props} />;
}

function PopoverTrigger(props: PopoverPrimitive.Trigger.Props) {
  return <PopoverPrimitive.Trigger data-slot="popover-trigger" {...props} />;
}

function PopoverContent(
  props: PopoverPrimitive.Popup.Props &
    Pick<PopoverPrimitive.Positioner.Props, "align" | "alignOffset" | "side" | "sideOffset">
) {
  const mergedProps = mergeProps(
    { align: "center" as const, alignOffset: 0, side: "bottom" as const, sideOffset: 4 },
    props
  );
  const [local, rest] = splitProps(mergedProps, [
    "class",
    "align",
    "alignOffset",
    "side",
    "sideOffset",
  ]);
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Positioner
        align={local.align}
        alignOffset={local.alignOffset}
        side={local.side}
        sideOffset={local.sideOffset}
        class="isolate z-50"
      >
        <PopoverPrimitive.Popup
          data-slot="popover-content"
          class={cn(
            "z-50 flex w-72 origin-(--transform-origin) flex-col gap-4 rounded-lg border border-border bg-popover p-2.5 text-xs text-popover-foreground outline-hidden duration-100 data-[side=bottom]:slide-in-from-top-2 data-[side=inline-end]:slide-in-from-left-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
            local.class
          )}
          {...rest}
        />
      </PopoverPrimitive.Positioner>
    </PopoverPrimitive.Portal>
  );
}

function PopoverHeader(props: ComponentProps<"div">) {
  return (
    <div
      data-slot="popover-header"
      {...props}
      class={cn("flex flex-col gap-1 text-xs", props.class)}
    />
  );
}

function PopoverTitle(props: PopoverPrimitive.Title.Props) {
  return (
    <PopoverPrimitive.Title
      data-slot="popover-title"
      {...props}
      class={cn("font-heading text-sm font-medium", props.class)}
    />
  );
}

function PopoverDescription(props: PopoverPrimitive.Description.Props) {
  return (
    <PopoverPrimitive.Description
      data-slot="popover-description"
      {...props}
      class={cn("text-muted-foreground", props.class)}
    />
  );
}

export { Popover, PopoverContent, PopoverDescription, PopoverHeader, PopoverTitle, PopoverTrigger };
