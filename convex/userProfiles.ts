import { v } from "convex/values";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, query } from "./_generated/server";

export const userProfileOptionsValidator = v.object({
  color: v.optional(v.string()),
  characterSprite: v.optional(v.string()),
});

export function normalizeEmailAddress(email: string) {
  return email.trim().toLowerCase();
}

export async function getUserProfileByEmail(
  ctx: QueryCtx | MutationCtx,
  email: string | null | undefined,
) {
  const normalizedEmail =
    typeof email === "string" && email.trim().length > 0 ? normalizeEmailAddress(email) : null;

  if (!normalizedEmail) {
    return null;
  }

  return await ctx.db
    .query("userProfiles")
    .withIndex("by_normalizedEmail", (q) => q.eq("normalizedEmail", normalizedEmail))
    .unique();
}

function toPublicUserProfile(profile: Doc<"userProfiles">) {
  return {
    _id: profile._id,
    _creationTime: profile._creationTime,
    email: profile.email,
    nickname: profile.nickname,
    options: profile.options ?? {},
    updatedAt: profile.updatedAt,
  };
}

export const getCurrent = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity?.email) {
      return null;
    }

    const profile = await getUserProfileByEmail(ctx, identity.email);
    return profile ? toPublicUserProfile(profile) : null;
  },
});

export const upsertByEmail = internalMutation({
  args: {
    email: v.string(),
    nickname: v.string(),
    options: v.optional(userProfileOptionsValidator),
  },
  handler: async (ctx, args) => {
    const normalizedEmail = normalizeEmailAddress(args.email);
    const now = Date.now();
    const existing = await getUserProfileByEmail(ctx, normalizedEmail);
    const patch = {
      email: args.email.trim(),
      normalizedEmail,
      nickname: args.nickname.trim(),
      options: args.options,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", patch);
  },
});
