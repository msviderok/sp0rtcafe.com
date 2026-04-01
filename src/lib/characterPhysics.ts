export type SceneBounds = {
  width: number;
  height: number;
};

export type CollisionSurface = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type CharacterState = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
};

export type SpawnOccupant = {
  x: number;
  y: number;
};

export const CHARACTER_WIDTH = 48;
export const CHARACTER_HEIGHT = 72;
export const MOVE_SPEED = 320;
export const JUMP_VELOCITY = 720;
export const GRAVITY = 1800;

const CHARACTER_PALETTE = [
  "#ff8a65",
  "#4dd0e1",
  "#ffd54f",
  "#81c784",
  "#ba68c8",
  "#64b5f6",
];

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function intersectsRect(
  x: number,
  y: number,
  width: number,
  height: number,
  surface: CollisionSurface,
) {
  return (
    x < surface.x + surface.width &&
    x + width > surface.x &&
    y < surface.y + surface.height &&
    y + height > surface.y
  );
}

function getHorizontalSurfaceOrder(
  surfaces: CollisionSurface[],
  direction: number,
) {
  return [...surfaces].sort((left, right) =>
    direction >= 0 ? left.x - right.x : right.x + right.width - (left.x + left.width),
  );
}

function getVerticalSurfaceOrder(
  surfaces: CollisionSurface[],
  direction: number,
) {
  return [...surfaces].sort((left, right) =>
    direction >= 0 ? left.y - right.y : right.y + right.height - (left.y + left.height),
  );
}

export function getCharacterColor(sessionId: string) {
  let hash = 0;

  for (const character of sessionId) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }

  return CHARACTER_PALETTE[hash % CHARACTER_PALETTE.length];
}

export function getSpawnState(
  bounds: SceneBounds,
  surfaces: CollisionSurface[],
  occupied: SpawnOccupant[] = [],
): CharacterState {
  const orderedSurfaces = [...surfaces].sort((left, right) => {
    if (left.y !== right.y) {
      return right.y - left.y;
    }

    if (left.width !== right.width) {
      return right.width - left.width;
    }

    return left.x - right.x;
  });

  const ground = orderedSurfaces[0];
  const maxX = Math.max(0, bounds.width - CHARACTER_WIDTH);
  const maxY = Math.max(0, bounds.height - CHARACTER_HEIGHT);
  const fallbackMinX = clamp(48, 0, maxX);
  const slotSpacing = CHARACTER_WIDTH + 20;

  if (!ground) {
    const fallbackSlot = occupied.length;

    return {
      x: clamp(fallbackMinX + fallbackSlot * slotSpacing, 0, maxX),
      y: maxY,
      vx: 0,
      vy: 0,
      grounded: true,
    };
  }

  const spawnY = clamp(ground.y - CHARACTER_HEIGHT, 0, maxY);
  const slotMinX = clamp(
    ground.x + 32,
    ground.x,
    Math.max(ground.x, ground.x + ground.width - CHARACTER_WIDTH),
  );
  const slotMaxX = clamp(ground.x + ground.width - CHARACTER_WIDTH, 0, maxX);
  const slotCount = Math.max(1, Math.floor((slotMaxX - slotMinX) / slotSpacing) + 1);
  const occupiedSlots = new Set(
    occupied
      .filter((character) => Math.abs(character.y - spawnY) <= CHARACTER_HEIGHT + 8)
      .map((character) =>
        Math.max(
          0,
          Math.min(slotCount - 1, Math.round((character.x - slotMinX) / slotSpacing)),
        ),
      ),
  );

  let chosenSlot = 0;

  for (let slotIndex = 0; slotIndex < slotCount; slotIndex += 1) {
    if (!occupiedSlots.has(slotIndex)) {
      chosenSlot = slotIndex;
      break;
    }

    chosenSlot = (slotIndex + 1) % slotCount;
  }

  const preferredX = clamp(slotMinX + chosenSlot * slotSpacing, 0, slotMaxX);

  return {
    x: clamp(preferredX, 0, maxX),
    y: spawnY,
    vx: 0,
    vy: 0,
    grounded: true,
  };
}

export function resolveCharacterState(
  bounds: SceneBounds,
  surfaces: CollisionSurface[],
  previous: CharacterState,
  desired: CharacterState,
): CharacterState {
  const maxX = Math.max(0, bounds.width - CHARACTER_WIDTH);
  const maxY = Math.max(0, bounds.height - CHARACTER_HEIGHT);
  const horizontalDirection =
    Math.sign(desired.x - previous.x) || Math.sign(desired.vx);
  const verticalDirection =
    Math.sign(desired.y - previous.y) || Math.sign(desired.vy);

  let x = clamp(desired.x, 0, maxX);
  let y = clamp(previous.y, 0, maxY);
  let vx = desired.vx;
  let vy = desired.vy;
  let grounded = false;

  for (const surface of getHorizontalSurfaceOrder(surfaces, horizontalDirection)) {
    if (!intersectsRect(x, y, CHARACTER_WIDTH, CHARACTER_HEIGHT, surface)) {
      continue;
    }

    if (horizontalDirection > 0) {
      x = Math.min(x, surface.x - CHARACTER_WIDTH);
      vx = 0;
      continue;
    }

    if (horizontalDirection < 0) {
      x = Math.max(x, surface.x + surface.width);
      vx = 0;
    }
  }

  x = clamp(x, 0, maxX);
  y = clamp(desired.y, 0, maxY);

  for (const surface of getVerticalSurfaceOrder(surfaces, verticalDirection)) {
    if (!intersectsRect(x, y, CHARACTER_WIDTH, CHARACTER_HEIGHT, surface)) {
      continue;
    }

    if (verticalDirection > 0) {
      y = Math.min(y, surface.y - CHARACTER_HEIGHT);
      vy = 0;
      grounded = true;
      continue;
    }

    if (verticalDirection < 0) {
      y = Math.max(y, surface.y + surface.height);
      vy = 0;
      continue;
    }

    const topDistance = Math.abs(y + CHARACTER_HEIGHT - surface.y);
    const bottomDistance = Math.abs(surface.y + surface.height - y);

    if (topDistance <= bottomDistance) {
      y = surface.y - CHARACTER_HEIGHT;
      grounded = true;
    } else {
      y = surface.y + surface.height;
    }

    vy = 0;
  }

  y = clamp(y, 0, maxY);

  if (y >= maxY) {
    y = maxY;
    vy = 0;
    grounded = true;
  }

  return {
    x,
    y,
    vx,
    vy,
    grounded,
  };
}
