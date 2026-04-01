import { clientOnly } from "@solidjs/start";

export const Slider = clientOnly(() => import("./slider"), { lazy: true });

export const Drawer = {
  Root: clientOnly(async () => ({ default: (await import("./drawer")).DrawerRoot }), {
    lazy: true,
  }),
  Trigger: clientOnly(async () => ({ default: (await import("./drawer")).DrawerTrigger }), {
    lazy: true,
  }),
  Portal: clientOnly(async () => ({ default: (await import("./drawer")).DrawerPortal }), {
    lazy: true,
  }),
  Close: clientOnly(async () => ({ default: (await import("./drawer")).DrawerClose }), {
    lazy: true,
  }),
  Content: clientOnly(async () => ({ default: (await import("./drawer")).DrawerContent }), {
    lazy: true,
  }),
  Title: clientOnly(async () => ({ default: (await import("./drawer")).DrawerTitle }), {
    lazy: true,
  }),
  Description: clientOnly(async () => ({ default: (await import("./drawer")).DrawerDescription }), {
    lazy: true,
  }),
};
