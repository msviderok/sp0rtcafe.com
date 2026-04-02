import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import { type MutationCtx, type QueryCtx, mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

type TrackLookupCtx = Pick<QueryCtx, "db"> | Pick<MutationCtx, "db">;

function isAudioTrackFile(file: Pick<Doc<"files">, "fileName" | "mimeType" | "status">) {
  return (
    file.status === "uploaded" &&
    (file.mimeType?.startsWith("audio/") || /\.(mp3|ogg|wav|aac)$/i.test(file.fileName))
  );
}

async function getPlayableTrackById(
  ctx: TrackLookupCtx,
  fileId: Doc<"radioState">["currentTrackFileId"],
) {
  if (!fileId) {
    return null;
  }

  const file = await ctx.db.get(fileId);
  return file && isAudioTrackFile(file) ? file : null;
}

async function findFirstAudioTrack(ctx: TrackLookupCtx) {
  const query = ctx.db
    .query("files")
    .withIndex("by_status_and_fileName", (q) => q.eq("status", "uploaded"));

  for await (const file of query) {
    if (isAudioTrackFile(file)) {
      return file;
    }
  }

  return null;
}

async function findNextAudioTrack(ctx: TrackLookupCtx, afterFileName: string) {
  const query = ctx.db
    .query("files")
    .withIndex("by_status_and_fileName", (q) =>
      q.eq("status", "uploaded").gt("fileName", afterFileName),
    );

  for await (const file of query) {
    if (isAudioTrackFile(file)) {
      return file;
    }
  }

  return await findFirstAudioTrack(ctx);
}

async function findLastAudioTrack(ctx: TrackLookupCtx) {
  const query = ctx.db
    .query("files")
    .withIndex("by_status_and_fileName", (q) => q.eq("status", "uploaded"))
    .order("desc");

  for await (const file of query) {
    if (isAudioTrackFile(file)) {
      return file;
    }
  }

  return null;
}

async function findPreviousAudioTrack(ctx: TrackLookupCtx, beforeFileName: string) {
  const query = ctx.db
    .query("files")
    .withIndex("by_status_and_fileName", (q) =>
      q.eq("status", "uploaded").lt("fileName", beforeFileName),
    )
    .order("desc");

  for await (const file of query) {
    if (isAudioTrackFile(file)) {
      return file;
    }
  }

  return await findLastAudioTrack(ctx);
}

async function getRadioTracks(ctx: TrackLookupCtx, state: Doc<"radioState"> | null) {
  const currentFile = state ? await getPlayableTrackById(ctx, state.currentTrackFileId) : null;
  const nextFile = state ? await getPlayableTrackById(ctx, state.nextTrackFileId) : null;

  return {
    currentFile,
    nextFile,
  };
}

async function ensureState(ctx: MutationCtx) {
  const existing = await ctx.db.query("radioState").first();
  if (existing) {
    return existing;
  }

  const id = await ctx.db.insert("radioState", {
    isPaused: true,
    updatedAt: Date.now(),
  });
  const state = await ctx.db.get(id);

  if (!state) {
    throw new Error("Radio state missing after initialization");
  }

  return state;
}

async function ensureAutoplayStateInternal(ctx: MutationCtx) {
  const state = await ensureState(ctx);
  const { currentFile: existingCurrentFile, nextFile: existingNextFile } = await getRadioTracks(
    ctx,
    state,
  );

  const currentFile = existingCurrentFile ?? (await findFirstAudioTrack(ctx));
  const nextFile = currentFile ? await findNextAudioTrack(ctx, currentFile.fileName) : null;

  const patch: {
    currentTrackFileId?: Doc<"files">["_id"];
    nextTrackFileId?: Doc<"files">["_id"];
    startedAt?: number;
    pausePosition?: number;
    isPaused?: boolean;
    updatedAt?: number;
  } = {};

  if (!currentFile) {
    if (
      state.currentTrackFileId !== undefined ||
      state.nextTrackFileId !== undefined ||
      state.startedAt !== undefined ||
      state.pausePosition !== undefined ||
      !state.isPaused
    ) {
      patch.currentTrackFileId = undefined;
      patch.nextTrackFileId = undefined;
      patch.startedAt = undefined;
      patch.pausePosition = undefined;
      patch.isPaused = true;
    }
  } else {
    const currentChanged = state.currentTrackFileId !== currentFile._id;

    if (currentChanged) {
      patch.currentTrackFileId = currentFile._id;
    }

    if (state.nextTrackFileId !== nextFile?._id) {
      patch.nextTrackFileId = nextFile?._id;
    }

    if (currentChanged) {
      patch.startedAt = Date.now();
      patch.pausePosition = undefined;
      patch.isPaused = false;
    } else if (!state.isPaused && state.startedAt === undefined) {
      patch.startedAt = Date.now();
      patch.pausePosition = undefined;
      patch.isPaused = false;
    } else if (!existingNextFile && nextFile) {
      patch.nextTrackFileId = nextFile._id;
    }
  }

  if (Object.keys(patch).length === 0) {
    return {
      state,
      currentFile,
      nextFile,
      hasTracks: currentFile !== null,
    };
  }

  patch.updatedAt = Date.now();
  await ctx.db.patch(state._id, patch);

  const nextState = await ctx.db.get(state._id);
  if (!nextState) {
    throw new Error("Radio state missing after patch");
  }

  const { currentFile: patchedCurrentFile, nextFile: patchedNextFile } = await getRadioTracks(
    ctx,
    nextState,
  );

  return {
    state: nextState,
    currentFile: patchedCurrentFile,
    nextFile: patchedNextFile,
    hasTracks: patchedCurrentFile !== null,
  };
}

function serializeStateWithTracks(
  state: Doc<"radioState">,
  currentFile: Doc<"files"> | null,
  nextFile: Doc<"files"> | null,
) {
  return {
    ...state,
    currentTrackUrl: currentFile?.url,
    currentTrackName: currentFile?.fileName,
    nextTrackUrl: nextFile?.url,
    nextTrackName: nextFile?.fileName,
  };
}

async function scheduleTrackAdvance(
  ctx: MutationCtx,
  state: Pick<Doc<"radioState">, "currentTrackFileId" | "startedAt" | "isPaused">,
  currentFile: Doc<"files"> | null,
) {
  if (!currentFile?.durationMs || state.isPaused || state.startedAt === undefined) {
    return;
  }

  const remainingMs = Math.max(0, currentFile.durationMs - Math.max(0, Date.now() - state.startedAt));

  await ctx.scheduler.runAfter(remainingMs, api.radio.advanceTrack, {
    expectedCurrentFileId: currentFile._id,
    expectedStartedAt: state.startedAt,
  });
}

export const getStateWithFiles = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("radioState").first();
    if (!state) {
      return null;
    }

    const { currentFile, nextFile } = await getRadioTracks(ctx, state);
    return serializeStateWithTracks(state, currentFile, nextFile);
  },
});

export const ensureAutoplayState = mutation({
  args: {},
  handler: async (ctx) => {
    const ensured = await ensureAutoplayStateInternal(ctx);
    await scheduleTrackAdvance(ctx, ensured.state, ensured.currentFile);

    return {
      hasTracks: ensured.hasTracks,
      state: serializeStateWithTracks(ensured.state, ensured.currentFile, ensured.nextFile),
    };
  },
});

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
      const file = await getPlayableTrackById(ctx, args.fileId);
      const nextFile = file ? await findNextAudioTrack(ctx, file.fileName) : null;

      patch.currentTrackFileId = file?._id;
      patch.nextTrackFileId = nextFile?._id;
      patch.startedAt = file ? Date.now() : undefined;
      patch.pausePosition = undefined;
      patch.isPaused = !file;
    } else {
      const file = await getPlayableTrackById(ctx, args.fileId);
      patch.nextTrackFileId = file?._id;
    }

    await ctx.db.patch(state._id, patch);

    const nextState = await ctx.db.get(state._id);
    if (nextState) {
      const currentFile = await getPlayableTrackById(ctx, nextState.currentTrackFileId);
      await scheduleTrackAdvance(ctx, nextState, currentFile);
    }
  },
});

export const pause = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const ensured = await ensureAutoplayStateInternal(ctx);
    const state = ensured.state;

    if (state.isPaused || !state.currentTrackFileId) return;

    const position = state.startedAt ? Math.max(0, Date.now() - state.startedAt) : 0;

    await ctx.db.patch(state._id, {
      isPaused: true,
      startedAt: undefined,
      pausePosition: position,
      updatedAt: Date.now(),
    });
  },
});

export const resume = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const ensured = await ensureAutoplayStateInternal(ctx);
    const state = ensured.state;

    if (!state.isPaused || !state.currentTrackFileId) return;

    await ctx.db.patch(state._id, {
      isPaused: false,
      startedAt: Date.now() - (state.pausePosition ?? 0),
      pausePosition: undefined,
      updatedAt: Date.now(),
    });

    const nextState = await ctx.db.get(state._id);
    if (nextState) {
      const currentFile = await getPlayableTrackById(ctx, nextState.currentTrackFileId);
      await scheduleTrackAdvance(ctx, nextState, currentFile);
    }
  },
});

export const advanceTrack = mutation({
  args: {
    expectedCurrentFileId: v.optional(v.id("files")),
    expectedStartedAt: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    if (args.expectedCurrentFileId === undefined && args.expectedStartedAt === undefined) {
      await requireAdminAccess(ctx);
    }

    const ensured = await ensureAutoplayStateInternal(ctx);
    const state = ensured.state;
    const currentFile = ensured.currentFile;
    const nextFile = ensured.nextFile;

    if (
      args.expectedCurrentFileId !== undefined &&
      state.currentTrackFileId !== args.expectedCurrentFileId
    ) {
      return;
    }

    if (args.expectedStartedAt !== undefined && state.startedAt !== args.expectedStartedAt) {
      return;
    }

    const newCurrentFile = nextFile ?? currentFile;
    const newNextFile = newCurrentFile
      ? await findNextAudioTrack(ctx, newCurrentFile.fileName)
      : null;

    await ctx.db.patch(state._id, {
      currentTrackFileId: newCurrentFile?._id,
      nextTrackFileId: newNextFile?._id,
      startedAt: newCurrentFile ? Date.now() : undefined,
      pausePosition: undefined,
      isPaused: !newCurrentFile,
      updatedAt: Date.now(),
    });

    const nextState = await ctx.db.get(state._id);
    if (nextState) {
      await scheduleTrackAdvance(ctx, nextState, newCurrentFile);
    }
  },
});

export const previousTrack = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const ensured = await ensureAutoplayStateInternal(ctx);
    const state = ensured.state;
    const currentFile = ensured.currentFile;

    if (!currentFile) {
      return;
    }

    const newCurrentFile = await findPreviousAudioTrack(ctx, currentFile.fileName);
    const newNextFile = newCurrentFile
      ? await findNextAudioTrack(ctx, newCurrentFile.fileName)
      : null;

    await ctx.db.patch(state._id, {
      currentTrackFileId: newCurrentFile?._id,
      nextTrackFileId: newNextFile?._id,
      startedAt: newCurrentFile ? Date.now() : undefined,
      pausePosition: undefined,
      isPaused: !newCurrentFile,
      updatedAt: Date.now(),
    });

    const nextState = await ctx.db.get(state._id);
    if (nextState) {
      await scheduleTrackAdvance(ctx, nextState, newCurrentFile);
    }
  },
});
