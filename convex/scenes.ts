import { v } from "convex/values";
import { mutation } from "./_generated/server";

export const ensure = mutation({
  args: {
    name: v.string(),
    width: v.number(),
    height: v.number(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("scenes")
      .withIndex("by_name", (q) => q.eq("name", args.name))
      .unique();

    if (existing) {
      return existing._id;
    }

    return await ctx.db.insert("scenes", args);
  },
});
