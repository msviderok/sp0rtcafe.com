import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

const DEFAULT_SCENE_WIDTH = 1920;
const DEFAULT_SCENE_HEIGHT = 1000;
const DEFAULT_GRID_SIZE = 32;
const MIN_GRID_SIZE = 4;
const MAX_GRID_SIZE = 64;

function normalizeGridSize(gridSize?: number) {
  if (typeof gridSize !== "number" || !Number.isFinite(gridSize)) {
    return DEFAULT_GRID_SIZE;
  }

  return Math.min(Math.max(gridSize, MIN_GRID_SIZE), MAX_GRID_SIZE);
}

function normalizeScene(scene: Doc<"scenes">) {
  return {
    ...scene,
    gridSize: normalizeGridSize(scene.gridSize),
    showGrid: scene.showGrid ?? true,
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
    await requireAdminAccess(ctx);
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
    await requireAdminAccess(ctx);
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
    await requireAdminAccess(ctx);
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
      gridSize: DEFAULT_GRID_SIZE,
      showGrid: true,
      isDefault: true,
    });
  },
});

export const create = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const scenes = await getScenes(ctx);
    const sceneId = await ctx.db.insert("scenes", {
      name: args.name.trim() || "untitled",
      width: DEFAULT_SCENE_WIDTH,
      height: DEFAULT_SCENE_HEIGHT,
      gridSize: DEFAULT_GRID_SIZE,
      showGrid: true,
      isDefault: scenes.length === 0,
    });

    return sceneId;
  },
});

export const update = mutation({
  args: {
    sceneId: v.id("scenes"),
    name: v.optional(v.string()),
    gridSize: v.optional(v.number()),
    showGrid: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const scene = await ctx.db.get(args.sceneId);

    if (!scene) {
      throw new Error("Scene not found");
    }

    const patch: { name?: string; gridSize?: number; showGrid?: boolean } = {};

    if (args.name !== undefined) {
      patch.name = args.name.trim() || "untitled";
    }

    if (args.gridSize !== undefined) {
      patch.gridSize = normalizeGridSize(args.gridSize);
    }

    if (args.showGrid !== undefined) {
      patch.showGrid = args.showGrid;
    }

    await ctx.db.patch(args.sceneId, patch);
  },
});

export const setDefault = mutation({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
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
    await requireAdminAccess(ctx);
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
