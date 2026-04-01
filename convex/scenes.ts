import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";

const DEFAULT_SCENE_WIDTH = 1920;
const DEFAULT_SCENE_HEIGHT = 1000;

function normalizeScene(scene: Doc<"scenes">) {
  return {
    ...scene,
    isDefault: scene.isDefault ?? false,
  };
}

async function getScenes(ctx: MutationCtx) {
  return await ctx.db.query("scenes").take(100);
}

async function clearDefaultFlag(ctx: MutationCtx, exceptSceneId?: Id<"scenes">) {
  const defaultScenes = await ctx.db
    .query("scenes")
    .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
    .take(100);

  for (const scene of defaultScenes) {
    if (scene._id !== exceptSceneId) {
      await ctx.db.patch(scene._id, { isDefault: false });
    }
  }
}

async function chooseFallbackDefault(ctx: MutationCtx, deletedSceneId: Id<"scenes">) {
  const scenes = await getScenes(ctx);
  const fallback = scenes.find((scene) => scene._id !== deletedSceneId);

  if (fallback) {
    await clearDefaultFlag(ctx, fallback._id);
    await ctx.db.patch(fallback._id, { isDefault: true });
  }
}

export const list = query({
  args: {},
  handler: async (ctx) => {
    const scenes = await ctx.db.query("scenes").take(100);
    return scenes
      .map(normalizeScene)
      .sort((left, right) => Number(right.isDefault) - Number(left.isDefault));
  },
});

export const get = query({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);
    return scene ? normalizeScene(scene) : null;
  },
});

export const getDefault = query({
  args: {},
  handler: async (ctx) => {
    const defaultScene = await ctx.db
      .query("scenes")
      .withIndex("by_isDefault", (q) => q.eq("isDefault", true))
      .take(1);

    if (defaultScene[0]) {
      return normalizeScene(defaultScene[0]);
    }

    const firstScene = await ctx.db.query("scenes").take(1);
    return firstScene[0] ? normalizeScene(firstScene[0]) : null;
  },
});

export const ensureStarterScene = mutation({
  args: {},
  handler: async (ctx) => {
    const scenes = await getScenes(ctx);
    const defaultScene = scenes.find((scene) => scene.isDefault);

    if (defaultScene) {
      return defaultScene._id;
    }

    if (scenes[0]) {
      await ctx.db.patch(scenes[0]._id, { isDefault: true });
      return scenes[0]._id;
    }

    return await ctx.db.insert("scenes", {
      name: "main",
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      isDefault: true,
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const scenes = await getScenes(ctx);
    const sceneId = await ctx.db.insert("scenes", {
      name: args.name.trim() || "untitled",
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      isDefault: scenes.length === 0,
    });

    return sceneId;
  },
});

export const update = mutation({
  args: {
    sceneId: v.id("scenes"),
    name: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);

    if (!scene) {
      throw new Error("Scene not found");
    }

    const patch: { name?: string } = {};

    if (args.name !== undefined) {
      patch.name = args.name.trim() || "untitled";
    }

    await ctx.db.patch(args.sceneId, patch);
  },
});

export const setDefault = mutation({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);

    if (!scene) {
      throw new Error("Scene not found");
    }

    await clearDefaultFlag(ctx, args.sceneId);
    await ctx.db.patch(args.sceneId, { isDefault: true });
  },
});

export const remove = mutation({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const scene = await ctx.db.get(args.sceneId);

    if (!scene) {
      return null;
    }

    while (true) {
      const assets = await ctx.db
        .query("sceneAssets")
        .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
        .take(500);

      if (assets.length === 0) {
        break;
      }

      for (const asset of assets) {
        await ctx.db.delete(asset._id);
      }
    }

    await ctx.db.delete(args.sceneId);

    if (scene.isDefault) {
      await chooseFallbackDefault(ctx, args.sceneId);
    }

    return args.sceneId;
  },
});
