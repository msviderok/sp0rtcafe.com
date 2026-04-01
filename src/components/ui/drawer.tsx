import { DrawerPreview as DrawerPrimitive } from "@msviderok/base-ui-solid/drawer";
import { splitProps } from "solid-js";

import { cn } from "~/lib/utils";

function DrawerRoot(props: DrawerPrimitive.Root.Props) {
  return <DrawerPrimitive.Root data-slot="drawer" {...props} />;
}

function DrawerTrigger(props: DrawerPrimitive.Trigger.Props) {
  return <DrawerPrimitive.Trigger data-slot="drawer-trigger" {...props} />;
}

function DrawerPortal(props: DrawerPrimitive.Portal.Props) {
  return <DrawerPrimitive.Portal data-slot="drawer-portal" {...props} />;
}

function DrawerClose(props: DrawerPrimitive.Close.Props) {
  return <DrawerPrimitive.Close data-slot="drawer-close" {...props} />;
}

function DrawerContent(props: DrawerPrimitive.Content.Props) {
  const [local, rest] = splitProps(props, ["class", "children"]);
  return (
    <DrawerPortal data-slot="drawer-portal">
      <DrawerPrimitive.Content
        data-slot="drawer-content"
        class={cn(
          "group/drawer-content fixed z-50 flex h-auto flex-col bg-transparent p-2 text-xs/relaxed text-popover-foreground before:absolute before:inset-2 before:-z-10 before:rounded-xl before:border before:border-border before:bg-popover data-[vaul-drawer-direction=bottom]:inset-x-0 data-[vaul-drawer-direction=bottom]:bottom-0 data-[vaul-drawer-direction=bottom]:mt-24 data-[vaul-drawer-direction=bottom]:max-h-[80vh] data-[vaul-drawer-direction=left]:inset-y-0 data-[vaul-drawer-direction=left]:left-0 data-[vaul-drawer-direction=left]:w-3/4 data-[vaul-drawer-direction=right]:inset-y-0 data-[vaul-drawer-direction=right]:right-0 data-[vaul-drawer-direction=right]:w-3/4 data-[vaul-drawer-direction=top]:inset-x-0 data-[vaul-drawer-direction=top]:top-0 data-[vaul-drawer-direction=top]:mb-24 data-[vaul-drawer-direction=top]:max-h-[80vh] data-[vaul-drawer-direction=left]:sm:max-w-sm data-[vaul-drawer-direction=right]:sm:max-w-sm",
          local.class
        )}
        {...rest}
      >
        <div class="mx-auto mt-4 hidden h-1.5 w-[100px] shrink-0 rounded-full bg-muted group-data-[vaul-drawer-direction=bottom]/drawer-content:block" />
        {local.children}
      </DrawerPrimitive.Content>
    </DrawerPortal>
  );
}

function DrawerTitle(props: DrawerPrimitive.Title.Props) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DrawerPrimitive.Title
      data-slot="drawer-title"
      class={cn("font-heading text-sm font-medium text-foreground", local.class)}
      {...rest}
    />
  );
}

function DrawerDescription(props: DrawerPrimitive.Description.Props) {
  const [local, rest] = splitProps(props, ["class"]);
  return (
    <DrawerPrimitive.Description
      data-slot="drawer-description"
      class={cn("text-xs/relaxed text-muted-foreground", local.class)}
      {...rest}
    />
  );
}

export {
  DrawerClose,
  DrawerContent,
  DrawerDescription,
  DrawerPortal,
  DrawerRoot,
  DrawerTitle,
  DrawerTrigger,
};
