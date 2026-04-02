import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

export const getStateWithFiles = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("radioState").first();
    if (!state) return null;

    const currentFile = state.currentTrackFileId
      ? await ctx.db.get(state.currentTrackFileId)
      : null;
    const nextFile = state.nextTrackFileId
      ? await ctx.db.get(state.nextTrackFileId)
      : null;

    return {
      ...state,
      currentTrackUrl: currentFile?.url,
      currentTrackName: currentFile?.fileName,
      nextTrackUrl: nextFile?.url,
      nextTrackName: nextFile?.fileName,
    };
  },
});

const ensureState = async (ctx: { db: any }) => {
  const existing = await ctx.db.query("radioState").first();
  if (existing) return existing;

  const id = await ctx.db.insert("radioState", {
    isPaused: true,
    updatedAt: Date.now(),
  });
  return await ctx.db.get(id);
};

export const setTrack = mutation({
  args: {
    slot: v.union(v.literal("current"), v.literal("next")),
    fileId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const state = await ensureState(ctx);

    const patch: Record<string, unknown> = { updatedAt: Date.now() };

    if (args.slot === "current") {
      patch.currentTrackFileId = args.fileId;
      patch.startedAt = args.fileId ? Date.now() : undefined;
      patch.pausePosition = undefined;
      patch.isPaused = false;
    } else {
      patch.nextTrackFileId = args.fileId;
    }

    await ctx.db.patch(state._id, patch);
  },
});

export const pause = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const state = await ensureState(ctx);

    if (state.isPaused) return;

    const position = state.startedAt ? Date.now() - state.startedAt : 0;

    await ctx.db.patch(state._id, {
      isPaused: true,
      pausePosition: position,
      updatedAt: Date.now(),
    });
  },
});

export const resume = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const state = await ensureState(ctx);

    if (!state.isPaused) return;

    await ctx.db.patch(state._id, {
      isPaused: false,
      startedAt: Date.now() - (state.pausePosition ?? 0),
      pausePosition: undefined,
      updatedAt: Date.now(),
    });
  },
});

export const advanceTrack = mutation({
  args: {
    expectedCurrentFileId: v.optional(v.id("files")),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const state = await ensureState(ctx);

    if (
      args.expectedCurrentFileId &&
      state.currentTrackFileId !== args.expectedCurrentFileId
    ) {
      return;
    }

    await ctx.db.patch(state._id, {
      currentTrackFileId: state.nextTrackFileId,
      nextTrackFileId: undefined,
      startedAt: state.nextTrackFileId ? Date.now() : undefined,
      pausePosition: undefined,
      isPaused: !state.nextTrackFileId,
      updatedAt: Date.now(),
    });
  },
});
