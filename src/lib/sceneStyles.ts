import type { JSX } from "solid-js";

export const DEFAULT_BG_REPEAT = "no-repeat";
export const DEFAULT_BG_SIZE = "100% 100%";

export type SpriteBackgroundPreset = {
  url: string;
  bgRepeat?: string;
  bgPosition?: string;
  bgSize?: string;
};

export function getSpriteBackgroundStyle(
  sprite: SpriteBackgroundPreset,
): JSX.CSSProperties {
  return {
    "background-image": `url(${sprite.url})`,
    "background-repeat": sprite.bgRepeat ?? DEFAULT_BG_REPEAT,
    ...(sprite.bgPosition ? { "background-position": sprite.bgPosition } : {}),
    "background-size": sprite.bgSize ?? DEFAULT_BG_SIZE,
  };
}
