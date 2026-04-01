import { v } from "convex/values";
import { mutation, query } from "./_generated/server";

export const getByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("sprites")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
  },
});

export const create = mutation({
  args: {
    key: v.string(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("sprites")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sprites", args);
  },
});

export const updatePresetStyle = mutation({
  args: {
    spriteId: v.id("sprites"),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const sprite = await ctx.db.get(args.spriteId);

    if (!sprite) {
      throw new Error("Sprite not found");
    }

    const patch: {
      bgRepeat?: string;
      bgPosition?: string;
      bgSize?: string;
    } = {};

    if (args.bgRepeat !== undefined) {
      patch.bgRepeat = args.bgRepeat;
    }
    if (args.bgPosition !== undefined) {
      patch.bgPosition = args.bgPosition;
    }
    if (args.bgSize !== undefined) {
      patch.bgSize = args.bgSize;
    }

    await ctx.db.patch(args.spriteId, patch);
  },
});

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sprites").order("desc").take(200);
  },
});
