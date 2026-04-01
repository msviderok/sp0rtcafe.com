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
