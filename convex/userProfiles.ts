import { v } from "convex/values";
import {
  deriveNicknameFromIdentity,
  generateNickname,
  createShortNickname,
} from "../src/lib/generateNickname";
import {
  getCanonicalCharacterAnimationName,
  getDefaultPlayableCharacterId,
  getRandomPlayableCharacterId,
  isPlayableCharacterId,
} from "../src/lib/characterCatalog";
import { normalizeEmailAddress } from "../src/lib/email";
import { getAccessibleUserColor } from "../src/lib/userColors";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx, QueryCtx } from "./_generated/server";
import { internalMutation, mutation, query } from "./_generated/server";

export const userProfileOptionsValidator = v.object({
  color: v.optional(v.string()),
  characterSprite: v.optional(v.string()),
});

function mergeProfileOptions(
  current: Doc<"userProfiles">["options"] | undefined,
  incoming: {
    color?: string;
    characterSprite?: string;
  } | undefined,
) {
  const next = {
    ...(current ?? {}),
    ...(incoming ?? {}),
  };

  return Object.keys(next).length > 0 ? next : undefined;
}

function toPublicUserProfile(profile: Doc<"userProfiles">) {
  return {
    _id: profile._id,
    _creationTime: profile._creationTime,
    email: profile.email,
    nickname: profile.nickname,
    nicknameShort: profile.nicknameShort ?? createShortNickname(profile.nickname),
    isAdmin: profile.isAdmin ?? false,
    isCharacterPrivileged: profile.isCharacterPrivileged ?? false,
    options: profile.options ?? {},
    updatedAt: profile.updatedAt,
  };
}

function resolveStoredCharacterSprite(
  currentCharacterSprite: string | undefined,
  isCharacterPrivileged: boolean,
) {
  if (isPlayableCharacterId(currentCharacterSprite)) {
    return currentCharacterSprite;
  }

  return isCharacterPrivileged
    ? getDefaultPlayableCharacterId()
    : getRandomPlayableCharacterId();
}

function buildProfilePatch(args: {
  email: string;
  nickname: string;
  nicknameShort?: string;
  isAdmin?: boolean;
  isCharacterPrivileged?: boolean;
  options?: {
    color?: string;
    characterSprite?: string;
  };
  existing: Doc<"userProfiles"> | null;
}) {
  const normalizedEmail = normalizeEmailAddress(args.email);
  const nickname = args.nickname.trim();
  const nicknameShort = (args.nicknameShort ?? createShortNickname(nickname)).trim();
  const isCharacterPrivileged =
    args.isCharacterPrivileged ?? args.existing?.isCharacterPrivileged ?? false;
  const nextCharacterSprite = resolveStoredCharacterSprite(
    args.options?.characterSprite ?? args.existing?.options?.characterSprite,
    isCharacterPrivileged,
  );
  const nextOptions = mergeProfileOptions(args.existing?.options, {
    ...(args.options ?? {}),
    characterSprite: nextCharacterSprite,
  });
  const patch = {
    email: args.email.trim(),
    normalizedEmail,
    nickname,
    nicknameShort,
    isAdmin: args.isAdmin ?? args.existing?.isAdmin ?? false,
    isCharacterPrivileged,
    updatedAt: Date.now(),
  };

  return nextOptions ? { ...patch, options: nextOptions } : patch;
}

async function requireAdminAccessFromProfiles(ctx: QueryCtx | MutationCtx) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.email) {
    throw new Error("Not authenticated");
  }

  const profile = await getUserProfileByEmail(ctx, identity.email);

  if (!profile?.isAdmin) {
    throw new Error("Forbidden");
  }

  return {
    identity,
    profile,
  };
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

export async function ensureCurrentUserProfile(ctx: MutationCtx): Promise<Doc<"userProfiles">> {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity?.email) {
    throw new Error("Not authenticated");
  }

  const existing = await getUserProfileByEmail(ctx, identity.email);
  const storedColor = getAccessibleUserColor(existing?.options?.color, identity.tokenIdentifier);

  if (existing) {
    const derivedIdentityNickname = deriveNicknameFromIdentity(identity.name, identity.email);
    const nextNickname = existing.nickname.trim() || derivedIdentityNickname.full;
    const nextNicknameShort =
      existing.nicknameShort?.trim() || createShortNickname(nextNickname);
    const nextCharacterSprite = resolveStoredCharacterSprite(
      existing.options?.characterSprite,
      existing.isCharacterPrivileged ?? false,
    );
    const shouldPatch =
      existing.nickname !== nextNickname ||
      (existing.nicknameShort ?? "") !== nextNicknameShort ||
      existing.options?.characterSprite !== nextCharacterSprite ||
      existing.options?.color !== storedColor;

    if (!shouldPatch) {
      return existing;
    }

    const patch = buildProfilePatch({
      email: existing.email,
      nickname: nextNickname,
      nicknameShort: nextNicknameShort,
      isAdmin: existing.isAdmin,
      isCharacterPrivileged: existing.isCharacterPrivileged,
      options: {
        ...existing.options,
        color: storedColor,
        characterSprite: nextCharacterSprite,
      },
      existing,
    });

    await ctx.db.patch(existing._id, patch);

    return {
      ...existing,
      ...patch,
    };
  }

  const generatedNickname = generateNickname();
  const profile = buildProfilePatch({
    email: identity.email,
    nickname: generatedNickname.full,
    nicknameShort: generatedNickname.short,
    options: {
      color: storedColor,
      characterSprite: getRandomPlayableCharacterId(),
    },
    existing: null,
  });

  const profileId = await ctx.db.insert("userProfiles", profile);

  return {
    _id: profileId,
    _creationTime: Date.now(),
    ...profile,
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

export const ensureCurrent = mutation({
  args: {},
  handler: async (ctx) => {
    const profile = await ensureCurrentUserProfile(ctx);
    return toPublicUserProfile(profile);
  },
});

export const selectCharacterSprite = mutation({
  args: {
    characterSprite: v.string(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity?.email) {
      throw new Error("Not authenticated");
    }

    const profile = await ensureCurrentUserProfile(ctx);
    const canSelectCharacter =
      (profile.isAdmin ?? false) || (profile.isCharacterPrivileged ?? false);

    if (!canSelectCharacter) {
      throw new Error("Forbidden");
    }

    if (!isPlayableCharacterId(args.characterSprite)) {
      throw new Error("Character not available");
    }

    const nextOptions = mergeProfileOptions(profile.options, {
      characterSprite: args.characterSprite,
    });
    const updatedAt = Date.now();

    await ctx.db.patch(profile._id, {
      options: nextOptions,
      updatedAt,
    });

    const activeCharacters = await ctx.db
      .query("characters")
      .withIndex("by_tokenIdentifier", (q) => q.eq("tokenIdentifier", identity.tokenIdentifier))
      .take(50);
    const defaultIdleAnimation =
      getCanonicalCharacterAnimationName(args.characterSprite, "idle") ?? "Idle";

    for (const character of activeCharacters) {
      await ctx.db.patch(character._id, {
        nickname: profile.nickname,
        nicknameShort: profile.nicknameShort ?? createShortNickname(profile.nickname),
        profileOptions: {
          ...(character.profileOptions ?? {}),
          ...(nextOptions ?? {}),
        },
        currentAnimation: defaultIdleAnimation,
        manualActionName: null,
        isRunning: false,
        updatedAt,
      });
    }

    return {
      ...toPublicUserProfile({
        ...profile,
        options: nextOptions,
        updatedAt,
      }),
      currentAnimation: defaultIdleAnimation,
    };
  },
});

export const setCharacterPrivilegeByEmail = mutation({
  args: {
    email: v.string(),
    isCharacterPrivileged: v.boolean(),
    nickname: v.optional(v.string()),
    nicknameShort: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccessFromProfiles(ctx);

    const existing = await getUserProfileByEmail(ctx, args.email);
    const identityNickname = deriveNicknameFromIdentity(null, args.email);
    const patch = buildProfilePatch({
      email: args.email,
      nickname: args.nickname ?? existing?.nickname ?? identityNickname.full,
      nicknameShort:
        args.nicknameShort ??
        existing?.nicknameShort ??
        createShortNickname(args.nickname ?? existing?.nickname ?? identityNickname.full),
      isAdmin: existing?.isAdmin,
      isCharacterPrivileged: args.isCharacterPrivileged,
      options: existing?.options,
      existing,
    });

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return toPublicUserProfile({
        ...existing,
        ...patch,
      });
    }

    const profileId = await ctx.db.insert("userProfiles", patch);

    return toPublicUserProfile({
      _id: profileId,
      _creationTime: Date.now(),
      ...patch,
    });
  },
});

export const upsertByEmail = internalMutation({
  args: {
    email: v.string(),
    nickname: v.string(),
    nicknameShort: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
    isCharacterPrivileged: v.optional(v.boolean()),
    options: v.optional(userProfileOptionsValidator),
  },
  handler: async (ctx, args) => {
    const existing = await getUserProfileByEmail(ctx, args.email);
    const patch = buildProfilePatch({
      email: args.email,
      nickname: args.nickname,
      nicknameShort: args.nicknameShort,
      isAdmin: args.isAdmin,
      isCharacterPrivileged: args.isCharacterPrivileged,
      options: args.options,
      existing,
    });

    if (existing) {
      await ctx.db.patch(existing._id, patch);
      return existing._id;
    }

    return await ctx.db.insert("userProfiles", patch);
  },
});
