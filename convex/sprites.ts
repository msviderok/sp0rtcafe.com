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

export const list = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("sprites").order("desc").take(200);
  },
});
