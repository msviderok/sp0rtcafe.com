import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Doc } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import { mutation, query } from "./_generated/server";
import { requireAdminAccess } from "./admin";

const fileStatusValidator = v.union(
  v.literal("pending"),
  v.literal("uploading"),
  v.literal("uploaded"),
  v.literal("failed"),
);

const fileSyncValidator = v.object({
  uploadThingKey: v.string(),
  fileName: v.string(),
  status: fileStatusValidator,
  progress: v.number(),
  url: v.optional(v.string()),
  size: v.optional(v.number()),
  mimeType: v.optional(v.string()),
  uploadedAt: v.optional(v.number()),
  durationMs: v.optional(v.number()),
  width: v.optional(v.number()),
  height: v.optional(v.number()),
  error: v.optional(v.string()),
});

type FileStatus = "pending" | "uploading" | "uploaded" | "failed";
type FileSync = {
  uploadThingKey: string;
  fileName: string;
  status: FileStatus;
  progress: number;
  url?: string;
  size?: number;
  mimeType?: string;
  uploadedAt?: number;
  durationMs?: number;
  width?: number;
  height?: number;
  error?: string;
};

function clampProgress(status: FileStatus, progress: number) {
  if (status === "uploaded") {
    return 100;
  }

  return Math.max(0, Math.min(100, Math.round(progress)));
}

function resolveStatus(existing: Doc<"files"> | null, incoming: FileSync): FileStatus {
  if (existing?.status === "uploaded") {
    return "uploaded";
  }

  if (incoming.status === "uploaded") {
    return "uploaded";
  }

  if (existing?.status === "failed") {
    return "failed";
  }

  if (existing?.status === "uploading" && incoming.status === "pending") {
    return "uploading";
  }

  return incoming.status;
}

function isImageFile(file: {
  fileName: string;
  mimeType?: string;
  url?: string;
  width?: number;
  height?: number;
}) {
  if (file.width === undefined || file.height === undefined) {
    return false;
  }

  const mimeType = file.mimeType?.toLowerCase();
  if (mimeType?.startsWith("image/")) {
    return true;
  }

  const target = (file.url ?? file.fileName).toLowerCase();
  return /\.(avif|gif|jpe?g|png|svg|webp)$/.test(target);
}

function spriteKeyFromFileName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "");
}

async function syncSpriteForFile(ctx: MutationCtx, file: Doc<"files">) {
  if (!file.url || !isImageFile(file)) {
    return null;
  }

  const existingSprite = await ctx.db
    .query("sprites")
    .withIndex("by_url", (q) => q.eq("url", file.url!))
    .unique();

  const spriteData = {
    key: spriteKeyFromFileName(file.fileName),
    kind: "image" as const,
    url: file.url,
    width: file.width!,
    height: file.height!,
  };

  if (existingSprite) {
    await ctx.db.patch(existingSprite._id, spriteData);
    return existingSprite._id;
  }

  return await ctx.db.insert("sprites", spriteData);
}

async function upsertFile(ctx: MutationCtx, incoming: FileSync, createSprites: boolean) {
  const existing = await ctx.db
    .query("files")
    .withIndex("by_uploadThingKey", (q) => q.eq("uploadThingKey", incoming.uploadThingKey))
    .unique();

  const nextStatus = resolveStatus(existing, incoming);
  const nextProgress = existing
    ? nextStatus === "uploaded"
      ? 100
      : Math.max(existing.progress, clampProgress(nextStatus, incoming.progress))
    : clampProgress(nextStatus, incoming.progress);

  const upsertPatch: {
    fileName?: string;
    status?: FileStatus;
    progress?: number;
    url?: string;
    size?: number;
    mimeType?: string;
    uploadedAt?: number;
    durationMs?: number;
    width?: number;
    height?: number;
    error?: string;
  } = {
    fileName: incoming.fileName,
    status: nextStatus,
    progress: nextProgress,
  };

  if (incoming.url !== undefined) {
    upsertPatch.url = incoming.url;
  }
  if (incoming.size !== undefined) {
    upsertPatch.size = incoming.size;
  }
  if (incoming.mimeType !== undefined) {
    upsertPatch.mimeType = incoming.mimeType;
  }
  if (incoming.uploadedAt !== undefined) {
    upsertPatch.uploadedAt = incoming.uploadedAt;
  }
  if (incoming.durationMs !== undefined) {
    upsertPatch.durationMs = incoming.durationMs;
  }
  if (incoming.width !== undefined) {
    upsertPatch.width = incoming.width;
  }
  if (incoming.height !== undefined) {
    upsertPatch.height = incoming.height;
  }
  if (incoming.error !== undefined) {
    upsertPatch.error = incoming.error;
  }

  const insertData: {
    uploadThingKey: string;
    fileName: string;
    status: FileStatus;
    progress: number;
    url?: string;
    size?: number;
    mimeType?: string;
    uploadedAt?: number;
    durationMs?: number;
    width?: number;
    height?: number;
    error?: string;
  } = {
    uploadThingKey: incoming.uploadThingKey,
    fileName: incoming.fileName,
    status: nextStatus,
    progress: nextProgress,
  };

  if (incoming.url !== undefined) {
    insertData.url = incoming.url;
  }
  if (incoming.size !== undefined) {
    insertData.size = incoming.size;
  }
  if (incoming.mimeType !== undefined) {
    insertData.mimeType = incoming.mimeType;
  }
  if (incoming.uploadedAt !== undefined) {
    insertData.uploadedAt = incoming.uploadedAt;
  }
  if (incoming.durationMs !== undefined) {
    insertData.durationMs = incoming.durationMs;
  }
  if (incoming.width !== undefined) {
    insertData.width = incoming.width;
  }
  if (incoming.height !== undefined) {
    insertData.height = incoming.height;
  }
  if (incoming.error !== undefined) {
    insertData.error = incoming.error;
  }

  const fileId = existing
    ? (await ctx.db.patch(existing._id, upsertPatch), existing._id)
    : await ctx.db.insert("files", insertData);

  const file = await ctx.db.get(fileId);
  if (!file) {
    throw new Error("Uploaded file record missing after upsert");
  }

  const spriteId =
    createSprites && file.status === "uploaded" ? await syncSpriteForFile(ctx, file) : null;

  return { fileId, spriteId };
}

export const upsertUploadThingFiles = mutation({
  args: {
    files: v.array(fileSyncValidator),
    createSprites: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const createSprites = args.createSprites ?? false;
    const results = [];

    for (const file of args.files) {
      results.push(await upsertFile(ctx, file, createSprites));
    }

    return results;
  },
});

export const syncUploadedImagesToSprites = mutation({
  args: {
    limit: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdminAccess(ctx);
    const limit = Math.max(1, Math.min(Math.round(args.limit ?? 200), 200));
    const files = await ctx.db
      .query("files")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .take(limit);

    let synced = 0;

    for (const file of files) {
      if (!file.url || !isImageFile(file)) {
        continue;
      }

      await syncSpriteForFile(ctx, file);
      synced += 1;
    }

    return {
      scanned: files.length,
      synced,
    };
  },
});

export const listAudio = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const files = await ctx.db
      .query("files")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .take(500);
    return files.filter(
      (f) => f.mimeType?.startsWith("audio/") || /\.(mp3|ogg|wav|aac)$/i.test(f.fileName),
    );
  },
});

export const setAudioDuration = mutation({
  args: {
    fileId: v.id("files"),
    durationMs: v.number(),
  },
  handler: async (ctx, args) => {
    const file = await ctx.db.get(args.fileId);
    if (!file) {
      return;
    }

    if (
      file.status !== "uploaded" ||
      !(file.mimeType?.startsWith("audio/") || /\.(mp3|ogg|wav|aac)$/i.test(file.fileName))
    ) {
      return;
    }

    if (!Number.isFinite(args.durationMs) || args.durationMs <= 0) {
      return;
    }

    if (file.durationMs === args.durationMs) {
      return;
    }

    await ctx.db.patch(file._id, {
      durationMs: args.durationMs,
    });

    const radioState = await ctx.db.query("radioState").first();
    if (
      radioState?.currentTrackFileId === file._id &&
      !radioState.isPaused &&
      radioState.startedAt !== undefined
    ) {
      const remainingMs = Math.max(
        0,
        args.durationMs - Math.max(0, Date.now() - radioState.startedAt),
      );

      await ctx.scheduler.runAfter(remainingMs, api.radio.advanceTrack, {
        expectedCurrentFileId: file._id,
        expectedStartedAt: radioState.startedAt,
      });
    }
  },
});

export const listRecent = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    return await ctx.db.query("files").order("desc").take(200);
  },
});

export const listActiveUploads = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const [pending, uploading, failed] = await Promise.all([
      ctx.db.query("files").withIndex("by_status", (q) => q.eq("status", "pending")).take(20),
      ctx.db.query("files").withIndex("by_status", (q) => q.eq("status", "uploading")).take(20),
      ctx.db.query("files").withIndex("by_status", (q) => q.eq("status", "failed")).take(20),
    ]);

    return [...pending, ...uploading, ...failed]
      .sort((left, right) => right._creationTime - left._creationTime)
      .slice(0, 20);
  },
});
