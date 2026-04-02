import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

const DEFAULT_MAX_DROP_WIDTH = 320;
const DEFAULT_MAX_DROP_HEIGHT = 320;

function getMeaningfulSpriteSize(sprite: { width: number; height: number }) {
  const widthScale = DEFAULT_MAX_DROP_WIDTH / sprite.width;
  const heightScale = DEFAULT_MAX_DROP_HEIGHT / sprite.height;
  const scale = Math.min(1, widthScale, heightScale);

  return {
    width: Math.max(16, Math.round(sprite.width * scale)),
    height: Math.max(16, Math.round(sprite.height * scale)),
  };
}

function getAssetOrderValue(asset: { zIndex?: number; _creationTime: number }) {
  return asset.zIndex ?? asset._creationTime;
}

function sortSceneAssetsByOrder<T extends { zIndex?: number; _creationTime: number }>(assets: T[]) {
  return [...assets].sort(
    (left, right) =>
      getAssetOrderValue(left) - getAssetOrderValue(right) ||
      left._creationTime - right._creationTime,
  );
}

function normalizeOpacity(opacity?: number) {
  if (opacity === undefined || Number.isNaN(opacity)) {
    return 1;
  }

  return Math.min(1, Math.max(0, opacity));
}

export const listByScene = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    const assets = await ctx.db
      .query("sceneAssets")
      .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
      .take(500);

    const assetsWithSprites = await Promise.all(
      assets.map(async (asset) => {
        const sprite = await ctx.db.get(asset.spriteId);
        if (!sprite) {
          return null;
        }

        return {
          ...asset,
          zIndex: getAssetOrderValue(asset),
          rotation: asset.rotation ?? 0,
          opacity: normalizeOpacity(asset.opacity),
          locked: asset.locked ?? false,
          collision: asset.collision ?? false,
          sprite,
        };
      }),
    );

    return assetsWithSprites
      .filter((asset) => asset !== null)
      .sort((left, right) => left.zIndex - right.zIndex || left._creationTime - right._creationTime);
  },
});

export const place = mutation({
  args: {
    sceneId: v.id("scenes"),
    spriteId: v.id("sprites"),
    x: v.number(),
    y: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const sprite = await ctx.db.get(args.spriteId);

    if (!sprite) {
      throw new Error("Sprite not found");
    }

    const sceneAssets = await ctx.db
      .query("sceneAssets")
      .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
      .take(500);
    const orderedSceneAssets = sortSceneAssetsByOrder(sceneAssets);

    for (const [index, asset] of orderedSceneAssets.entries()) {
      const nextZIndex = index + 1;
      if (asset.zIndex !== nextZIndex) {
        await ctx.db.patch(asset._id, { zIndex: nextZIndex });
      }
    }

    const size = getMeaningfulSpriteSize(sprite);

    return await ctx.db.insert("sceneAssets", {
      sceneId: args.sceneId,
      spriteId: args.spriteId,
      x: args.x,
      y: args.y,
      width: size.width,
      height: size.height,
      zIndex: orderedSceneAssets.length + 1,
      rotation: 0,
      opacity: 1,
      locked: false,
      collision: false,
    });
  },
});

export const update = mutation({
  args: {
    assetId: v.id("sceneAssets"),
    x: v.optional(v.number()),
    y: v.optional(v.number()),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    zIndex: v.optional(v.number()),
    rotation: v.optional(v.number()),
    opacity: v.optional(v.number()),
    locked: v.optional(v.boolean()),
    collision: v.optional(v.boolean()),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
    isCurrentlyPlaying: v.optional(v.boolean()),
    isNextTrack: v.optional(v.boolean()),
    animRotationSpeed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const asset = await ctx.db.get(args.assetId);

    if (!asset) {
      throw new Error("Scene asset not found");
    }

    const patch: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      zIndex?: number;
      rotation?: number;
      opacity?: number;
      locked?: boolean;
      collision?: boolean;
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
      isCurrentlyPlaying?: boolean;
      isNextTrack?: boolean;
      animRotationSpeed?: number;
    } = {};

    if (args.x !== undefined) {
      patch.x = args.x;
    }
    if (args.y !== undefined) {
      patch.y = args.y;
    }
    if (args.width !== undefined) {
      patch.width = args.width;
    }
    if (args.height !== undefined) {
      patch.height = args.height;
    }
    if (args.zIndex !== undefined) {
      patch.zIndex = args.zIndex;
    }
    if (args.rotation !== undefined) {
      patch.rotation = args.rotation;
    }
    if (args.opacity !== undefined) {
      patch.opacity = normalizeOpacity(args.opacity);
    }
    if (args.locked !== undefined) {
      patch.locked = args.locked;
    }
    if (args.collision !== undefined) {
      patch.collision = args.collision;
    }
    if (args.bgRepeat !== undefined) {
      patch.bgRepeat = args.bgRepeat;
    }
    if (args.bgPosition !== undefined) {
      patch.bgPosition = args.bgPosition;
    }
    if (args.bgSize !== undefined) {
      patch.bgSize = args.bgSize;
    }
    if (args.isCurrentlyPlaying !== undefined) {
      patch.isCurrentlyPlaying = args.isCurrentlyPlaying;
    }
    if (args.isNextTrack !== undefined) {
      patch.isNextTrack = args.isNextTrack;
    }
    if (args.animRotationSpeed !== undefined) {
      patch.animRotationSpeed = args.animRotationSpeed;
    }

    await ctx.db.patch(args.assetId, patch);
  },
});

export const remove = mutation({
  args: {
    assetId: v.id("sceneAssets"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const asset = await ctx.db.get(args.assetId);

    if (!asset) {
      return;
    }

    await ctx.db.delete(args.assetId);
  },
});

export const restore = mutation({
  args: {
    sceneId: v.id("scenes"),
    spriteId: v.id("sprites"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    zIndex: v.number(),
    rotation: v.number(),
    opacity: v.number(),
    locked: v.boolean(),
    collision: v.optional(v.boolean()),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
    isCurrentlyPlaying: v.optional(v.boolean()),
    isNextTrack: v.optional(v.boolean()),
    animRotationSpeed: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    return await ctx.db.insert("sceneAssets", args);
  },
});

export const duplicate = mutation({
  args: {
    sceneId: v.id("scenes"),
    assets: v.array(
      v.object({
        spriteId: v.id("sprites"),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
        rotation: v.number(),
        opacity: v.number(),
        locked: v.boolean(),
        collision: v.optional(v.boolean()),
        bgRepeat: v.optional(v.string()),
        bgPosition: v.optional(v.string()),
        bgSize: v.optional(v.string()),
        isCurrentlyPlaying: v.optional(v.boolean()),
        isNextTrack: v.optional(v.boolean()),
        animRotationSpeed: v.optional(v.number()),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const sceneAssets = await ctx.db
      .query("sceneAssets")
      .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
      .take(500);
    const orderedSceneAssets = sortSceneAssetsByOrder(sceneAssets);

    for (const [index, asset] of orderedSceneAssets.entries()) {
      const nextZIndex = index + 1;
      if (asset.zIndex !== nextZIndex) {
        await ctx.db.patch(asset._id, { zIndex: nextZIndex });
      }
    }

    const insertedIds = [];
    for (const [index, asset] of args.assets.entries()) {
      const assetId = await ctx.db.insert("sceneAssets", {
        sceneId: args.sceneId,
        spriteId: asset.spriteId,
        x: asset.x,
        y: asset.y,
        width: asset.width,
        height: asset.height,
        zIndex: orderedSceneAssets.length + index + 1,
        rotation: asset.rotation,
        opacity: normalizeOpacity(asset.opacity),
        locked: asset.locked,
        collision: asset.collision ?? false,
        ...(asset.bgRepeat !== undefined ? { bgRepeat: asset.bgRepeat } : {}),
        ...(asset.bgPosition !== undefined ? { bgPosition: asset.bgPosition } : {}),
        ...(asset.bgSize !== undefined ? { bgSize: asset.bgSize } : {}),
        ...(asset.isCurrentlyPlaying !== undefined ? { isCurrentlyPlaying: asset.isCurrentlyPlaying } : {}),
        ...(asset.isNextTrack !== undefined ? { isNextTrack: asset.isNextTrack } : {}),
        ...(asset.animRotationSpeed !== undefined ? { animRotationSpeed: asset.animRotationSpeed } : {}),
      });
      insertedIds.push(assetId);
    }

    return insertedIds;
  },
});

export const reorder = mutation({
  args: {
    updates: v.array(
      v.object({
        assetId: v.id("sceneAssets"),
        zIndex: v.number(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    for (const update of args.updates) {
      const asset = await ctx.db.get(update.assetId);
      if (!asset) {
        continue;
      }

      await ctx.db.patch(update.assetId, {
        zIndex: update.zIndex,
      });
    }
  },
});
