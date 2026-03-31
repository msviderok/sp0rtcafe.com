import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  sprites: defineTable({
    key: v.string(),
    url: v.string(),
    width: v.number(),
    height: v.number(),
  })
    .index("by_url", ["url"])
    .index("by_key", ["key"]),

  scenes: defineTable({
    name: v.string(),
    width: v.number(),
    height: v.number(),
  }).index("by_name", ["name"]),

  sceneAssets: defineTable({
    sceneId: v.id("scenes"),
    spriteId: v.id("sprites"),
    x: v.number(),
    y: v.number(),
    width: v.number(),
    height: v.number(),
    rotation: v.optional(v.number()),
    locked: v.optional(v.boolean()),
  }).index("by_sceneId", ["sceneId"]),
});
