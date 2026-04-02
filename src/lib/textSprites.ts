import type { JSX } from "solid-js";

const DEFAULT_TEXT_SPRITE_WIDTH = 192;
const DEFAULT_TEXT_SPRITE_HEIGHT = 64;
const BASE_TEXT_SPRITE_FONT_SIZE = 48;

export type TextSpriteLike = {
  kind?: "image" | "text";
  text?: string | null;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

export function isTextSprite(
  sprite: TextSpriteLike | null | undefined
): sprite is TextSpriteLike & { kind: "text"; text: string } {
  return sprite?.kind === "text" && typeof sprite.text === "string" && sprite.text.trim().length > 0;
}

export function summarizeTextSprite(text: string, maxLength = 32) {
  const flattened = text.replace(/\s+/g, " ").trim();

  if (!flattened) {
    return "Text";
  }

  const characters = Array.from(flattened);
  if (characters.length <= maxLength) {
    return flattened;
  }

  return `${characters.slice(0, Math.max(1, maxLength - 3)).join("")}...`;
}

export async function measureTextSprite(text: string) {
  const trimmed = text.trim();
  if (!trimmed) {
    return {
      width: DEFAULT_TEXT_SPRITE_WIDTH,
      height: DEFAULT_TEXT_SPRITE_HEIGHT,
    };
  }

  if (typeof document !== "undefined" && "fonts" in document) {
    try {
      await document.fonts.load(`${BASE_TEXT_SPRITE_FONT_SIZE}px "Pixelify Sans"`);
    } catch {
      // Fall back to browser defaults if the font isn't ready yet.
    }
  }

  const canvas = typeof document !== "undefined" ? document.createElement("canvas") : null;
  const context = canvas?.getContext("2d");

  if (!context) {
    return {
      width: DEFAULT_TEXT_SPRITE_WIDTH,
      height: DEFAULT_TEXT_SPRITE_HEIGHT,
    };
  }

  context.font = `${BASE_TEXT_SPRITE_FONT_SIZE}px "Pixelify Sans", sans-serif`;

  const lines = trimmed.replace(/\r/g, "").split("\n");
  const longestLine = Math.max(
    ...lines.map((line) => context.measureText(line.length > 0 ? line : " ").width)
  );

  return {
    width: clamp(Math.ceil(longestLine + BASE_TEXT_SPRITE_FONT_SIZE), 96, 640),
    height: clamp(
      Math.ceil(lines.length * BASE_TEXT_SPRITE_FONT_SIZE * 0.96 + BASE_TEXT_SPRITE_FONT_SIZE * 0.6),
      48,
      320
    ),
  };
}

export function getTextSpriteFontSize(text: string, width: number, height: number) {
  const lines = text.replace(/\r/g, "").split("\n");
  const longestLineLength = Math.max(...lines.map((line) => Array.from(line || " ").length), 1);
  const usableWidth = Math.max(8, width - 12);
  const usableHeight = Math.max(8, height - 10);
  const widthFit = usableWidth / Math.max(1, longestLineLength * 0.62);
  const heightFit = usableHeight / Math.max(1, lines.length * 1.08);

  return Math.floor(clamp(Math.min(widthFit, heightFit), 12, 160));
}

export function getTextSpriteStyle(
  text: string,
  width: number,
  height: number
): JSX.CSSProperties {
  const padding = Math.max(4, Math.min(16, Math.round(Math.min(width, height) * 0.08)));

  return {
    display: "flex",
    width: "100%",
    height: "100%",
    "align-items": "center",
    "justify-content": "center",
    padding: `${padding}px`,
    "font-family": 'var(--font-pixel, "Pixelify Sans"), sans-serif',
    "font-size": `${getTextSpriteFontSize(text, width, height)}px`,
    "font-weight": "700",
    "line-height": "1",
    "letter-spacing": "0.03em",
    "text-align": "center",
    "white-space": "pre-wrap",
    "overflow-wrap": "anywhere",
    overflow: "hidden",
    color: "#fff6cc",
    background: "rgba(28, 18, 12, 0.82)",
    border: "2px solid rgba(244, 217, 137, 0.92)",
    "border-radius": `${Math.max(8, Math.min(18, Math.round(Math.min(width, height) * 0.18)))}px`,
    "box-shadow":
      "inset 0 1px 0 rgba(255,255,255,0.08), 0 10px 24px rgba(0,0,0,0.28)",
    "text-shadow":
      "1px 0 0 rgba(49, 28, 13, 0.95), -1px 0 0 rgba(49, 28, 13, 0.95), 0 1px 0 rgba(49, 28, 13, 0.95), 0 -1px 0 rgba(49, 28, 13, 0.95), 2px 2px 0 rgba(49, 28, 13, 0.75)",
  };
}
