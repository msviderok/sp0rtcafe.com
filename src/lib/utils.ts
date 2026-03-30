import { type ClassValue, clsx } from "clsx";
import { mergeProps, onCleanup, onMount } from "solid-js";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function observeSize<T extends HTMLElement>(el: T) {
  onMount(() => {
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        // console.log(entry.contentRect);
      }
    });

    ro.observe(el);

    onCleanup(() => {
      ro.disconnect();
    });
  });
}

type Simplify<T> = T extends any ? { [K in keyof T]: T[K] } : T;
type OnlyDeclaredProps<P, D extends Partial<P>> = {
  -readonly [K in keyof D]-?: D[K] | Exclude<P[K extends keyof P ? K : never], undefined>;
};

export type PropsMergeWithDefault<P, D extends Partial<P>> = Simplify<{
  [K in keyof (P & OnlyDeclaredProps<P, D>)]: K extends keyof D
    ? OnlyDeclaredProps<P, D>[K]
    : P[K extends keyof P ? K : never];
}>;

export function defaultProps<
  P,
  D extends Partial<P>,
  C extends { [K in Extract<keyof D, keyof P> as keyof D]?: D[K] },
>(props: P, defaults: D extends C ? D : C) {
  // eslint-disable-next-line solid/reactivity
  return mergeProps(defaults, props) as PropsMergeWithDefault<P, D>;
}
