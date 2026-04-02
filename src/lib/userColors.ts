const USER_COLOR_REFERENCE_SURFACE = "#0e0a09";
const USER_COLOR_MIN_CONTRAST = 4.5;
const LIGHT_BADGE_TEXT = "#fffaf2";
const DARK_BADGE_TEXT = "#140d08";

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function normalizeHexColor(color: string) {
  const trimmed = color.trim();

  if (/^#[0-9a-f]{3}$/i.test(trimmed)) {
    return `#${trimmed
      .slice(1)
      .split("")
      .map((part) => `${part}${part}`)
      .join("")
      .toLowerCase()}`;
  }

  if (/^#[0-9a-f]{6}$/i.test(trimmed)) {
    return trimmed.toLowerCase();
  }

  return null;
}

function parseHexColor(color: string) {
  const normalized = normalizeHexColor(color);

  if (!normalized) {
    return null;
  }

  return {
    r: Number.parseInt(normalized.slice(1, 3), 16),
    g: Number.parseInt(normalized.slice(3, 5), 16),
    b: Number.parseInt(normalized.slice(5, 7), 16),
  };
}

function toHexChannel(value: number) {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const normalizedHue = ((hue % 360) + 360) % 360;
  const normalizedSaturation = clamp(saturation / 100, 0, 1);
  const normalizedLightness = clamp(lightness / 100, 0, 1);
  const chroma =
    (1 - Math.abs(2 * normalizedLightness - 1)) * normalizedSaturation;
  const huePrime = normalizedHue / 60;
  const x = chroma * (1 - Math.abs((huePrime % 2) - 1));
  let red = 0;
  let green = 0;
  let blue = 0;

  if (huePrime >= 0 && huePrime < 1) {
    red = chroma;
    green = x;
  } else if (huePrime < 2) {
    red = x;
    green = chroma;
  } else if (huePrime < 3) {
    green = chroma;
    blue = x;
  } else if (huePrime < 4) {
    green = x;
    blue = chroma;
  } else if (huePrime < 5) {
    red = x;
    blue = chroma;
  } else {
    red = chroma;
    blue = x;
  }

  const match = normalizedLightness - chroma / 2;

  return `#${toHexChannel((red + match) * 255)}${toHexChannel(
    (green + match) * 255,
  )}${toHexChannel((blue + match) * 255)}`;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function createSeededRandom(seed: string) {
  let state = hashString(seed) || 1;

  return () => {
    state += 0x6d2b79f5;
    let next = state;
    next = Math.imul(next ^ (next >>> 15), next | 1);
    next ^= next + Math.imul(next ^ (next >>> 7), next | 61);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function getRelativeLuminance(color: string) {
  const parsed = parseHexColor(color);

  if (!parsed) {
    return null;
  }

  const toLinear = (channel: number) => {
    const normalized = channel / 255;
    return normalized <= 0.04045
      ? normalized / 12.92
      : ((normalized + 0.055) / 1.055) ** 2.4;
  };

  return (
    toLinear(parsed.r) * 0.2126 +
    toLinear(parsed.g) * 0.7152 +
    toLinear(parsed.b) * 0.0722
  );
}

export function getContrastRatio(foreground: string, background: string) {
  const foregroundLuminance = getRelativeLuminance(foreground);
  const backgroundLuminance = getRelativeLuminance(background);

  if (foregroundLuminance === null || backgroundLuminance === null) {
    return 1;
  }

  const lighter = Math.max(foregroundLuminance, backgroundLuminance);
  const darker = Math.min(foregroundLuminance, backgroundLuminance);

  return (lighter + 0.05) / (darker + 0.05);
}

function createAccessibleUserColor(nextRandom: () => number) {
  for (let attempt = 0; attempt < 24; attempt += 1) {
    const hue = Math.round(nextRandom() * 359);
    const saturation = 68 + Math.round(nextRandom() * 18);
    const lightness = 56 + Math.round(nextRandom() * 16);
    const color = hslToHex(hue, saturation, lightness);

    if (getContrastRatio(color, USER_COLOR_REFERENCE_SURFACE) >= USER_COLOR_MIN_CONTRAST) {
      return color;
    }
  }

  return "#7dd3fc";
}

export function getGeneratedUserColor(seed: string) {
  return createAccessibleUserColor(createSeededRandom(seed || "guest"));
}

export function getAccessibleUserColor(
  color: string | null | undefined,
  seed: string,
) {
  const normalized = typeof color === "string" ? normalizeHexColor(color) : null;

  if (
    normalized &&
    getContrastRatio(normalized, USER_COLOR_REFERENCE_SURFACE) >= USER_COLOR_MIN_CONTRAST
  ) {
    return normalized;
  }

  return getGeneratedUserColor(seed);
}

export function getReadableTextColor(backgroundColor: string) {
  const normalizedBackground = normalizeHexColor(backgroundColor);

  if (!normalizedBackground) {
    return LIGHT_BADGE_TEXT;
  }

  const lightContrast = getContrastRatio(LIGHT_BADGE_TEXT, normalizedBackground);
  const darkContrast = getContrastRatio(DARK_BADGE_TEXT, normalizedBackground);

  return darkContrast >= lightContrast ? DARK_BADGE_TEXT : LIGHT_BADGE_TEXT;
}

export function withColorAlpha(color: string, alpha: number) {
  const parsed = parseHexColor(color);

  if (!parsed) {
    return `rgba(255, 255, 255, ${clamp(alpha, 0, 1)})`;
  }

  return `rgba(${parsed.r}, ${parsed.g}, ${parsed.b}, ${clamp(alpha, 0, 1)})`;
}
