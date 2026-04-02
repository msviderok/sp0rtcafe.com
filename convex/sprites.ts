import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

export const getByUrl = query({
  args: { url: v.string() },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    return await ctx.db
      .query("sprites")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();
  },
});

export const create = mutation({
  args: {
    kind: v.optional(v.union(v.literal("image"), v.literal("text"))),
    key: v.string(),
    url: v.optional(v.string()),
    text: v.optional(v.string()),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const kind = args.kind ?? "image";

    if (kind === "text") {
      const text = args.text?.trim();

      if (!text) {
        throw new Error("Text sprite requires text");
      }

      return await ctx.db.insert("sprites", {
        key: args.key,
        kind: "text",
        url: "",
        text,
        width: args.width,
        height: args.height,
      });
    }

    if (!args.url) {
      throw new Error("Image sprite requires url");
    }

    const existing = await ctx.db
      .query("sprites")
      .withIndex("by_url", (q) => q.eq("url", args.url))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("sprites", {
      key: args.key,
      kind: "image",
      url: args.url,
      width: args.width,
      height: args.height,
    });
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
    await requireAdminAccess(ctx);
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
    await requireAdminAccess(ctx);
    return await ctx.db.query("sprites").order("desc").take(200);
  },
});
