import { v } from "convex/values";
import {
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  getCharacterColor,
  getSpawnState,
  resolveCharacterState,
} from "../src/lib/characterPhysics";
import type { Doc, Id } from "./_generated/dataModel";
import { mutation, query, type MutationCtx } from "./_generated/server";
import { ensureCurrentUserProfile } from "./userProfiles";

const ACTIVE_CHARACTER_WINDOW_MS = 15_000;
const MAX_STORED_MOVEMENT_ACTIONS = 200;
const characterFacingValidator = v.union(v.literal("left"), v.literal("right"));

const characterSyncStateValidator = v.object({
  clientSequence: v.number(),
  x: v.number(),
  y: v.number(),
  vx: v.number(),
  vy: v.number(),
  grounded: v.boolean(),
  timeSinceBatchStart: v.optional(v.number()),
  animationName: v.optional(v.string()),
  facing: v.optional(characterFacingValidator),
  isRunning: v.optional(v.boolean()),
  manualActionName: v.optional(v.union(v.string(), v.null())),
});

type CharacterFacing = "left" | "right";

type CharacterSyncState = {
  clientSequence: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  timeSinceBatchStart?: number;
  animationName?: string;
  facing?: CharacterFacing;
  isRunning?: boolean;
  manualActionName?: string | null;
};

type CharacterMovementAction = {
  kind: "movement";
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  timeSinceBatchStart: number;
  animationName?: string;
  facing?: CharacterFacing;
  isRunning?: boolean;
  manualActionName?: string | null;
};

type CharacterSyncBatchArgs = {
  sceneId: Id<"scenes">;
  sessionId: string;
  states: CharacterSyncState[];
};

function getCollisionSurfaces(sceneAssets: Doc<"sceneAssets">[]) {
  return sceneAssets
    .filter((asset) => asset.collision)
    .map((asset) => ({
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
    }));
}

function sortCharactersByRecency(characters: Doc<"characters">[]) {
  return [...characters].sort((left, right) => {
    if (left.updatedAt !== right.updatedAt) {
      return right.updatedAt - left.updatedAt;
    }

    return right._creationTime - left._creationTime;
  });
}

function getLatestCharacter(characters: Doc<"characters">[]) {
  return sortCharactersByRecency(characters)[0] ?? null;
}

function resolveFacing(
  preferredFacing: CharacterFacing | undefined,
  velocityX: number,
  fallbackFacing: CharacterFacing | undefined,
): CharacterFacing {
  if (preferredFacing) {
    return preferredFacing;
  }

  if (velocityX < 0) {
    return "left";
  }

  if (velocityX > 0) {
    return "right";
  }

  return fallbackFacing ?? "right";
}

function toPublicCharacter(character: Doc<"characters">, currentTokenIdentifier: string | null) {
  const facing = resolveFacing(character.facing, character.vx, "right");
  const currentAnimation = character.currentAnimation ?? "Idle";

  return {
    _id: character._id,
    _creationTime: character._creationTime,
    sceneId: character.sceneId,
    sessionId: character.sessionId,
    active: character.active ?? false,
    nickname: character.nickname ?? null,
    nicknameShort: character.nicknameShort ?? null,
    profileOptions: character.profileOptions ?? {},
    actions: (character.actions ?? []).map((action) => ({
      ...action,
      animationName: action.animationName ?? currentAnimation,
      facing: resolveFacing(action.facing, action.vx, facing),
      isRunning: action.isRunning ?? false,
      manualActionName: action.manualActionName ?? null,
    })),
    x: character.x,
    y: character.y,
    vx: character.vx,
    vy: character.vy,
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    grounded: character.grounded ?? false,
    currentAnimation,
    facing,
    isRunning: character.isRunning ?? false,
    manualActionName: character.manualActionName ?? null,
    color: character.color || getCharacterColor(character.tokenIdentifier ?? character.sessionId),
    lastProcessedSequence: character.lastProcessedSequence,
    updatedAt: character.updatedAt,
    isCurrentUser:
      currentTokenIdentifier !== null && character.tokenIdentifier === currentTokenIdentifier,
  };
}

function getIdentityColorSeed(identity: { subject?: string | null; tokenIdentifier: string }) {
  return identity.subject ?? identity.tokenIdentifier;
}

function resolveCharacterColor(
  existing: Doc<"characters"> | null,
  profile: Doc<"userProfiles"> | null,
  identity: {
    subject?: string | null;
    tokenIdentifier: string;
  },
) {
  return (
    profile?.options?.color ??
    existing?.profileOptions?.color ??
    existing?.color ??
    getCharacterColor(getIdentityColorSeed(identity))
  );
}

async function syncCharacterStates(ctx: MutationCtx, args: CharacterSyncBatchArgs) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated");
  }

  const existingCharacters = await ctx.db
    .query("characters")
    .withIndex("by_sceneId_and_tokenIdentifier", (q) =>
      q.eq("sceneId", args.sceneId).eq("tokenIdentifier", identity.tokenIdentifier),
    )
    .take(10);
  const existing = getLatestCharacter(existingCharacters);
  const sortedStates = [...args.states].sort((left, right) => {
    if (left.clientSequence !== right.clientSequence) {
      return left.clientSequence - right.clientSequence;
    }

    return (left.timeSinceBatchStart ?? 0) - (right.timeSinceBatchStart ?? 0);
  });

  if (sortedStates.length === 0) {
    if (!existing) {
      throw new Error("No character state provided");
    }

    return toPublicCharacter(existing, identity.tokenIdentifier);
  }

  const scene = await ctx.db.get(args.sceneId);

  if (!scene) {
    throw new Error("Scene not found");
  }

  const profile = await ensureCurrentUserProfile(ctx);

  const sceneAssets = await ctx.db
    .query("sceneAssets")
    .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
    .take(500);
  const collisionSurfaces = getCollisionSurfaces(sceneAssets);
  const now = Date.now();
  const characters = await ctx.db
    .query("characters")
    .withIndex("by_sceneId_and_updatedAt", (q) => q.eq("sceneId", args.sceneId))
    .order("desc")
    .take(100);

  const initialState =
    existing === null
      ? getSpawnState(
          { width: scene.width, height: scene.height },
          collisionSurfaces,
          characters
            .filter((character) => character.tokenIdentifier !== identity.tokenIdentifier)
            .map((character) => ({
              x: character.x,
              y: character.y,
            })),
        )
      : {
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          grounded: existing.grounded,
        };

  let nextState = initialState;
  let nextFacing = resolveFacing(existing?.facing, initialState.vx, "right");
  let nextAnimation = existing?.currentAnimation ?? "Idle";
  let nextIsRunning = existing?.isRunning ?? false;
  let nextManualActionName = existing?.manualActionName ?? null;
  let lastProcessedSequence = existing?.lastProcessedSequence ?? -1;
  const acceptedActions: CharacterMovementAction[] = [];

  for (const state of sortedStates) {
    if (state.clientSequence <= lastProcessedSequence) {
      continue;
    }

    nextState = resolveCharacterState(
      { width: scene.width, height: scene.height },
      collisionSurfaces,
      nextState,
      {
        x: state.x,
        y: state.y,
        vx: state.vx,
        vy: state.vy,
        grounded: state.grounded,
      },
    );
    nextFacing = resolveFacing(state.facing, nextState.vx, nextFacing);
    nextAnimation = state.animationName ?? nextAnimation;
    nextIsRunning = state.isRunning ?? false;
    nextManualActionName = state.manualActionName ?? null;
    lastProcessedSequence = state.clientSequence;
    acceptedActions.push({
      kind: "movement",
      x: nextState.x,
      y: nextState.y,
      vx: nextState.vx,
      vy: nextState.vy,
      grounded: nextState.grounded,
      timeSinceBatchStart: Math.max(0, state.timeSinceBatchStart ?? 0),
      animationName: nextAnimation,
      facing: nextFacing,
      isRunning: nextIsRunning,
      manualActionName: nextManualActionName,
    });
  }

  if (acceptedActions.length === 0) {
    if (!existing) {
      throw new Error("No new character state provided");
    }

    return toPublicCharacter(existing, identity.tokenIdentifier);
  }

  const patch = {
    sceneId: args.sceneId,
    sessionId: args.sessionId,
    tokenIdentifier: identity.tokenIdentifier,
    active: true,
    nickname: profile.nickname,
    nicknameShort: profile.nicknameShort ?? createShortFallback(profile.nickname),
    profileOptions: profile.options,
    actions: acceptedActions.slice(-MAX_STORED_MOVEMENT_ACTIONS),
    x: nextState.x,
    y: nextState.y,
    vx: nextState.vx,
    vy: nextState.vy,
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    grounded: nextState.grounded,
    currentAnimation: nextAnimation,
    facing: nextFacing,
    isRunning: nextIsRunning,
    manualActionName: nextManualActionName,
    color: resolveCharacterColor(existing, profile, identity),
    lastProcessedSequence,
    updatedAt: now,
  };

  if (existing) {
    await ctx.db.patch(existing._id, patch);
    return toPublicCharacter(
      {
        ...existing,
        ...patch,
      },
      identity.tokenIdentifier,
    );
  }

  const characterId = await ctx.db.insert("characters", patch);
  return toPublicCharacter(
    {
      _id: characterId,
      _creationTime: now,
      ...patch,
    },
    identity.tokenIdentifier,
  );
}

export const setSocketPresence = mutation({
  args: {
    sceneId: v.id("scenes"),
    sessionId: v.string(),
    active: v.boolean(),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existingCharacters = await ctx.db
      .query("characters")
      .withIndex("by_sceneId_and_tokenIdentifier", (q) =>
        q.eq("sceneId", args.sceneId).eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .take(10);
    const existing = getLatestCharacter(existingCharacters);

    if (!existing) {
      return null;
    }

    if (!args.active && existing.sessionId !== args.sessionId) {
      return toPublicCharacter(existing, identity.tokenIdentifier);
    }

    const now = Date.now();

    if (args.active) {
      const profile = await ensureCurrentUserProfile(ctx);
      const patch = {
        sessionId: args.sessionId,
        tokenIdentifier: identity.tokenIdentifier,
        active: true,
        nickname: profile.nickname ?? existing.nickname,
        nicknameShort:
          profile.nicknameShort ?? existing.nicknameShort ?? createShortFallback(existing.nickname),
        profileOptions: profile.options ?? existing.profileOptions,
        width: CHARACTER_WIDTH,
        height: CHARACTER_HEIGHT,
        color: resolveCharacterColor(existing, profile, identity),
        updatedAt: now,
      };

      await ctx.db.patch(existing._id, patch);
      return toPublicCharacter(
        {
          ...existing,
          ...patch,
        },
        identity.tokenIdentifier,
      );
    }

    const patch = {
      active: false,
      updatedAt: now,
    };

    await ctx.db.patch(existing._id, patch);
    return toPublicCharacter(
      {
        ...existing,
        ...patch,
      },
      identity.tokenIdentifier,
    );
  },
});

function createShortFallback(value: string | null | undefined) {
  if (!value) {
    return "Player";
  }

  return value.replace(/\s+/g, "").slice(0, 14) || "Player";
}

export const listByScene = query({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const now = Date.now();
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_sceneId_and_active_and_updatedAt", (q) =>
        q
          .eq("sceneId", args.sceneId)
          .eq("active", true)
          .gte("updatedAt", now - ACTIVE_CHARACTER_WINDOW_MS),
      )
      .order("desc")
      .take(100);

    return characters
      .map((character) => toPublicCharacter(character, identity?.tokenIdentifier ?? null))
      .sort((left, right) => left._creationTime - right._creationTime);
  },
});

export const sync = mutation({
  args: {
    sceneId: v.id("scenes"),
    sessionId: v.string(),
    clientSequence: v.number(),
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),
    grounded: v.boolean(),
    animationName: v.optional(v.string()),
    facing: v.optional(characterFacingValidator),
    isRunning: v.optional(v.boolean()),
    manualActionName: v.optional(v.union(v.string(), v.null())),
  },
  handler: async (ctx, args) => {
    return syncCharacterStates(ctx, {
      sceneId: args.sceneId,
      sessionId: args.sessionId,
      states: [
        {
          clientSequence: args.clientSequence,
          x: args.x,
          y: args.y,
          vx: args.vx,
          vy: args.vy,
          grounded: args.grounded,
          timeSinceBatchStart: 0,
          animationName: args.animationName,
          facing: args.facing,
          isRunning: args.isRunning,
          manualActionName: args.manualActionName,
        },
      ],
    });
  },
});

export const syncBatch = mutation({
  args: {
    sceneId: v.id("scenes"),
    sessionId: v.string(),
    states: v.array(characterSyncStateValidator),
  },
  handler: async (ctx, args) => {
    return syncCharacterStates(ctx, args);
  },
});
