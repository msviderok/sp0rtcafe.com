import { v } from "convex/values";
import {
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  getCharacterColor,
  getSpawnState,
  resolveCharacterState,
} from "../src/lib/characterPhysics";
import type { Doc } from "./_generated/dataModel";
import { mutation, query } from "./_generated/server";

const ACTIVE_CHARACTER_WINDOW_MS = 15_000;

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
  currentTokenIdentifier: string | null,
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
    isCurrentUser:
      currentTokenIdentifier !== null && character.tokenIdentifier === currentTokenIdentifier,
  };
}

export const listByScene = query({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    const currentTokenIdentifier = identity?.tokenIdentifier ?? null;
    const now = Date.now();
    const characters = await ctx.db
      .query("characters")
      .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
      .take(100);

    return characters
      .filter((character) => now - character.updatedAt <= ACTIVE_CHARACTER_WINDOW_MS)
      .map((character) => toPublicCharacter(character, currentTokenIdentifier))
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
    const identity = await ctx.auth.getUserIdentity();

    if (!identity) {
      throw new Error("Not authenticated");
    }

    const existing = await ctx.db
      .query("characters")
      .withIndex("by_sceneId_and_tokenIdentifier", (q) =>
        q.eq("sceneId", args.sceneId).eq("tokenIdentifier", identity.tokenIdentifier),
      )
      .unique();

    if (existing && args.clientSequence < existing.lastProcessedSequence) {
      return toPublicCharacter(existing, identity.tokenIdentifier);
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
      .withIndex("by_sceneId", (q) => q.eq("sceneId", args.sceneId))
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
    const previousState = {
      x: existing?.x ?? initialState.x,
      y: existing?.y ?? initialState.y,
      vx: existing?.vx ?? 0,
      vy: existing?.vy ?? 0,
      grounded: existing?.grounded ?? initialState.grounded,
    };
    const nextState = resolveCharacterState(
      { width: scene.width, height: scene.height },
      collisionSurfaces,
      previousState,
      {
        x: existing ? args.x : initialState.x,
        y: existing ? args.y : initialState.y,
        vx: existing ? args.vx : 0,
        vy: existing ? args.vy : 0,
        grounded: existing ? args.grounded : initialState.grounded,
      },
    );
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
      color: existing?.color ?? getCharacterColor(identity.tokenIdentifier),
      lastProcessedSequence: args.clientSequence,
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
  },
});
