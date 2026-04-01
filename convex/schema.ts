import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  files: defineTable({
    uploadThingKey: v.string(),
    fileName: v.string(),
    url: v.optional(v.string()),
    size: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    uploadedAt: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("uploading"),
      v.literal("uploaded"),
      v.literal("failed"),
    ),
    progress: v.number(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    error: v.optional(v.string()),
  })
    .index("by_uploadThingKey", ["uploadThingKey"])
    .index("by_status", ["status"])
    .index("by_fileName", ["fileName"]),

  sprites: defineTable({
    key: v.string(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
  })
    .index("by_url", ["url"])
    .index("by_key", ["key"]),

  scenes: defineTable({
    name: v.string(),
    width: v.number(),
    height: v.number(),
    isDefault: v.optional(v.boolean()),
  })
    .index("by_name", ["name"])
    .index("by_isDefault", ["isDefault"]),

  sceneAssets: defineTable({
    sceneId: v.id("scenes"),
    spriteId: v.id("sprites"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    rotation: v.optional(v.number()),
    locked: v.optional(v.boolean()),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
  }).index("by_sceneId", ["sceneId"]),
});
