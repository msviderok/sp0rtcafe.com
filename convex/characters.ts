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

const ACTIVE_CHARACTER_WINDOW_MS = 15_000;
const characterSyncStateValidator = v.object({
  clientSequence: v.number(),
  x: v.number(),
  y: v.number(),
  vx: v.number(),
  vy: v.number(),
  grounded: v.boolean(),
  timeSinceBatchStart: v.optional(v.number()),
});

type CharacterSyncState = {
  clientSequence: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  timeSinceBatchStart?: number;
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

function toPublicCharacter(
  character: Doc<"characters">,
  currentSessionId: string | null,
) {
  const colorKey = character.tokenIdentifier ?? character.sessionId;

  return {
    _id: character._id,
    _creationTime: character._creationTime,
    sceneId: character.sceneId,
    x: character.x,
    y: character.y,
    vx: character.vx,
    vy: character.vy,
    width: character.width || CHARACTER_WIDTH,
    height: character.height || CHARACTER_HEIGHT,
    grounded: character.grounded ?? false,
    color: character.color || getCharacterColor(colorKey),
    lastProcessedSequence: character.lastProcessedSequence,
    updatedAt: character.updatedAt,
    isCurrentUser: currentSessionId !== null && character.sessionId === currentSessionId,
  };
}

function getIdentityColorSeed(identity: {
  subject?: string | null;
  tokenIdentifier: string;
}) {
  return identity.subject ?? identity.tokenIdentifier;
}

async function syncCharacterStates(
  ctx: MutationCtx,
  args: CharacterSyncBatchArgs,
) {
  const identity = await ctx.auth.getUserIdentity();

  if (!identity) {
    throw new Error("Not authenticated");
  }

  const colorSeed = getIdentityColorSeed(identity);

  const existing = await ctx.db
    .query("characters")
    .withIndex("by_sceneId_and_sessionId", (q) =>
      q.eq("sceneId", args.sceneId).eq("sessionId", args.sessionId),
    )
    .unique();

  if (existing?.tokenIdentifier && existing.tokenIdentifier !== identity.tokenIdentifier) {
    throw new Error("Unauthorized");
  }

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

    return toPublicCharacter(existing, args.sessionId);
  }

  const scene = await ctx.db.get(args.sceneId);

  if (!scene) {
    throw new Error("Scene not found");
  }

  const sceneAssets = await ctx.db
    .query("sceneAssets")
    .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
    .take(500);
  const sceneCharacters = await ctx.db
    .query("characters")
    .withIndex("by_sceneId_and_updatedAt", (q) => q.eq("sceneId", args.sceneId))
    .order("desc")
    .take(100);
  const collisionSurfaces = getCollisionSurfaces(sceneAssets);
  const now = Date.now();
  const activeSceneCharacters = sceneCharacters.filter(
    (character) =>
      character._id !== existing?._id && now - character.updatedAt <= ACTIVE_CHARACTER_WINDOW_MS,
  );
  const initialState = getSpawnState(
    { width: scene.width, height: scene.height },
    collisionSurfaces,
    activeSceneCharacters.map((character) => ({
      x: character.x,
      y: character.y,
    })),
  );

  let nextState = {
    x: existing?.x ?? initialState.x,
    y: existing?.y ?? initialState.y,
    vx: existing?.vx ?? 0,
    vy: existing?.vy ?? 0,
    grounded: existing?.grounded ?? initialState.grounded,
  };
  let lastProcessedSequence = existing?.lastProcessedSequence ?? -1;
  let hasAcceptedState = false;
  let isInitialSpawn = !existing;

  for (const state of sortedStates) {
    if (state.clientSequence < lastProcessedSequence) {
      continue;
    }

    nextState = resolveCharacterState(
      { width: scene.width, height: scene.height },
      collisionSurfaces,
      nextState,
      isInitialSpawn
        ? {
            x: initialState.x,
            y: initialState.y,
            vx: 0,
            vy: 0,
            grounded: initialState.grounded,
          }
        : {
            x: state.x,
            y: state.y,
            vx: state.vx,
            vy: state.vy,
            grounded: state.grounded,
          },
    );
    lastProcessedSequence = state.clientSequence;
    hasAcceptedState = true;
    isInitialSpawn = false;
  }

  if (!hasAcceptedState) {
    if (!existing) {
      throw new Error("No new character state provided");
    }

    return toPublicCharacter(existing, args.sessionId);
  }

  const patch = {
    sceneId: args.sceneId,
    sessionId: args.sessionId,
    tokenIdentifier: identity.tokenIdentifier,
    x: nextState.x,
    y: nextState.y,
    vx: nextState.vx,
    vy: nextState.vy,
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    grounded: nextState.grounded,
    color: existing?.color ?? getCharacterColor(colorSeed),
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
      args.sessionId,
    );
  }

  const characterId = await ctx.db.insert("characters", patch);
  return toPublicCharacter(
    {
      _id: characterId,
      _creationTime: now,
      ...patch,
    },
    args.sessionId,
  );
}

export const listByScene = query({
  args: {
    sceneId: v.id("scenes"),
    sessionId: v.string(),
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_sceneId_and_updatedAt", (q) => q.eq("sceneId", args.sceneId))
      .order("desc")
      .take(100);

    return characters
      .filter((character) => now - character.updatedAt <= ACTIVE_CHARACTER_WINDOW_MS)
      .map((character) => toPublicCharacter(character, args.sessionId))
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
