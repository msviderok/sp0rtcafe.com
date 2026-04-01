import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

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
          rotation: asset.rotation ?? 0,
          locked: asset.locked ?? false,
          sprite,
        };
      }),
    );

    return assetsWithSprites.filter((asset) => asset !== null);
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
    const sprite = await ctx.db.get(args.spriteId);

    if (!sprite) {
      throw new Error("Sprite not found");
    }

    const size = getMeaningfulSpriteSize(sprite);

    return await ctx.db.insert("sceneAssets", {
      sceneId: args.sceneId,
      spriteId: args.spriteId,
      x: args.x,
      y: args.y,
      width: size.width,
      height: size.height,
      rotation: 0,
      locked: false,
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
    rotation: v.optional(v.number()),
    locked: v.optional(v.boolean()),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const asset = await ctx.db.get(args.assetId);

    if (!asset) {
      throw new Error("Scene asset not found");
    }

    const patch: {
      x?: number;
      y?: number;
      width?: number;
      height?: number;
      rotation?: number;
      locked?: boolean;
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
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
    if (args.rotation !== undefined) {
      patch.rotation = args.rotation;
    }
    if (args.locked !== undefined) {
      patch.locked = args.locked;
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

    await ctx.db.patch(args.assetId, patch);
  },
});

export const remove = mutation({
  args: {
    assetId: v.id("sceneAssets"),
  },
  handler: async (ctx, args) => {
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
    rotation: v.number(),
    locked: v.boolean(),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("sceneAssets", args);
  },
});
