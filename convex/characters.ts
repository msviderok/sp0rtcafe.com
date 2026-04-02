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
import { getUserProfileByEmail } from "./userProfiles";

const ACTIVE_CHARACTER_WINDOW_MS = 15_000;
const MAX_STORED_MOVEMENT_ACTIONS = 200;

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

type CharacterMovementAction = {
  kind: "movement";
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  timeSinceBatchStart: number;
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

function toPublicCharacter(character: Doc<"characters">, currentTokenIdentifier: string | null) {
  return {
    _id: character._id,
    _creationTime: character._creationTime,
    sceneId: character.sceneId,
    sessionId: character.sessionId,
    nickname: character.nickname ?? null,
    profileOptions: character.profileOptions ?? {},
    actions: character.actions ?? [],
    x: character.x,
    y: character.y,
    vx: character.vx,
    vy: character.vy,
    width: character.width || CHARACTER_WIDTH,
    height: character.height || CHARACTER_HEIGHT,
    grounded: character.grounded ?? false,
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
  }
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
      q.eq("sceneId", args.sceneId).eq("tokenIdentifier", identity.tokenIdentifier)
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

  const profile = await getUserProfileByEmail(ctx, identity.email);

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
            }))
        )
      : {
          x: existing.x,
          y: existing.y,
          vx: existing.vx,
          vy: existing.vy,
          grounded: existing.grounded,
        };

  let nextState = initialState;
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
      }
    );
    lastProcessedSequence = state.clientSequence;
    acceptedActions.push({
      kind: "movement",
      x: nextState.x,
      y: nextState.y,
      vx: nextState.vx,
      vy: nextState.vy,
      grounded: nextState.grounded,
      timeSinceBatchStart: Math.max(0, state.timeSinceBatchStart ?? 0),
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
    nickname: profile?.nickname,
    profileOptions: profile?.options,
    actions: acceptedActions.slice(-MAX_STORED_MOVEMENT_ACTIONS),
    x: nextState.x,
    y: nextState.y,
    vx: nextState.vx,
    vy: nextState.vy,
    width: existing?.width ?? CHARACTER_WIDTH,
    height: existing?.height ?? CHARACTER_HEIGHT,
    grounded: nextState.grounded,
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
      identity.tokenIdentifier
    );
  }

  const characterId = await ctx.db.insert("characters", patch);
  return toPublicCharacter(
    {
      _id: characterId,
      _creationTime: now,
      ...patch,
    },
    identity.tokenIdentifier
  );
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
      .withIndex("by_sceneId_and_updatedAt", (q) => q.eq("sceneId", args.sceneId))
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
