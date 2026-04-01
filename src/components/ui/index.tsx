import { clientOnly } from "@solidjs/start";

export const Slider = clientOnly(() => import("./slider"), { lazy: true });

export const Collapsible = {
  Root: clientOnly(async () => ({ default: (await import("./collapsible")).Collapsible }), {
    lazy: true,
  }),
  Trigger: clientOnly(
    async () => ({ default: (await import("./collapsible")).CollapsibleTrigger }),
    {
      lazy: true,
    }
  ),
  Content: clientOnly(
    async () => ({ default: (await import("./collapsible")).CollapsibleContent }),
    {
      lazy: true,
    }
  ),
};

export const Popover = {
  Root: clientOnly(async () => ({ default: (await import("./popover")).Popover }), {
    lazy: true,
  }),
  Trigger: clientOnly(async () => ({ default: (await import("./popover")).PopoverTrigger }), {
    lazy: true,
  }),
  Content: clientOnly(async () => ({ default: (await import("./popover")).PopoverContent }), {
    lazy: true,
  }),
  Header: clientOnly(async () => ({ default: (await import("./popover")).PopoverHeader }), {
    lazy: true,
  }),
  Title: clientOnly(async () => ({ default: (await import("./popover")).PopoverTitle }), {
    lazy: true,
  }),
  Description: clientOnly(
    async () => ({ default: (await import("./popover")).PopoverDescription }),
    {
      lazy: true,
    }
  ),
};
