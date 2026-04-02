import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { getUserProfileByEmail } from "./userProfiles";

export const list = query({
  args: {},
  handler: async (ctx) => {
    const messages = await ctx.db.query("chatMessages").order("desc").take(50);
    return messages.reverse();
  },
});

export const send = mutation({
  args: { body: v.string() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Authentication required");
    }

    const body = args.body.trim();

    if (!body) {
      throw new Error("Message cannot be empty");
    }

    if (body.length > 500) {
      throw new Error("Message too long");
    }

    const profile = await getUserProfileByEmail(ctx, identity.email);

    return await ctx.db.insert("chatMessages", {
      body,
      tokenIdentifier: identity.tokenIdentifier,
      nickname: profile?.nickname ?? identity.name ?? "Anonymous",
      color: profile?.options?.color,
    });
  },
});
