import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

const characterFacingValidator = v.union(v.literal("left"), v.literal("right"));
const spriteKindValidator = v.union(v.literal("image"), v.literal("text"));

const userProfileOptionsValidator = v.object({
  color: v.optional(v.string()),
  characterSprite: v.optional(v.string()),
});

const characterMovementActionValidator = v.object({
  kind: v.literal("movement"),
  x: v.number(),
  y: v.number(),
  vx: v.number(),
  vy: v.number(),
  grounded: v.boolean(),
  timeSinceBatchStart: v.number(),
  animationName: v.optional(v.string()),
  facing: v.optional(characterFacingValidator),
  isRunning: v.optional(v.boolean()),
  manualActionName: v.optional(v.union(v.string(), v.null())),
});

export default defineSchema({
  radioState: defineTable({
    currentTrackFileId: v.optional(v.id("files")),
    nextTrackFileId: v.optional(v.id("files")),
    currentTrackUrl: v.optional(v.string()),
    currentTrackName: v.optional(v.string()),
    nextTrackUrl: v.optional(v.string()),
    nextTrackName: v.optional(v.string()),
    startedAt: v.optional(v.number()),
    pausePosition: v.optional(v.number()),
    isPaused: v.boolean(),
    updatedAt: v.number(),
  }),

  files: defineTable({
    uploadThingKey: v.string(),
    fileName: v.string(),
    url: v.optional(v.string()),
    size: v.optional(v.number()),
    mimeType: v.optional(v.string()),
    uploadedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
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
    .index("by_status_and_fileName", ["status", "fileName"])
    .index("by_fileName", ["fileName"]),

  sprites: defineTable({
    key: v.string(),
    kind: v.optional(spriteKindValidator),
    url: v.string(),
    text: v.optional(v.string()),
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
    gridSize: v.optional(v.number()),
    showGrid: v.optional(v.boolean()),
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
    zIndex: v.optional(v.number()),
    rotation: v.optional(v.number()),
    opacity: v.optional(v.number()),
    locked: v.optional(v.boolean()),
    collision: v.optional(v.boolean()),
    bgRepeat: v.optional(v.string()),
    bgPosition: v.optional(v.string()),
    bgSize: v.optional(v.string()),
    isCurrentlyPlaying: v.optional(v.boolean()),
    isNextTrack: v.optional(v.boolean()),
    isVolumeControl: v.optional(v.boolean()),
    animRotationSpeed: v.optional(v.number()),
  }).index("by_sceneId", ["sceneId"]),

  characters: defineTable({
    sceneId: v.id("scenes"),
    sessionId: v.string(),
    tokenIdentifier: v.optional(v.string()),
    active: v.optional(v.boolean()),
    nickname: v.optional(v.string()),
    nicknameShort: v.optional(v.string()),
    profileOptions: v.optional(userProfileOptionsValidator),
    actions: v.optional(v.array(characterMovementActionValidator)),
    x: v.number(),
    y: v.number(),
    vx: v.number(),
    vy: v.number(),
    width: v.number(),
    height: v.number(),
    grounded: v.boolean(),
    currentAnimation: v.optional(v.string()),
    facing: v.optional(characterFacingValidator),
    isRunning: v.optional(v.boolean()),
    manualActionName: v.optional(v.union(v.string(), v.null())),
    color: v.string(),
    lastProcessedSequence: v.number(),
    updatedAt: v.number(),
  })
    .index("by_sceneId", ["sceneId"])
    .index("by_tokenIdentifier", ["tokenIdentifier"])
    .index("by_sceneId_and_tokenIdentifier", ["sceneId", "tokenIdentifier"])
    .index("by_sceneId_and_active_and_updatedAt", ["sceneId", "active", "updatedAt"])
    .index("by_sceneId_and_updatedAt", ["sceneId", "updatedAt"]),

  chatMessages: defineTable({
    body: v.string(),
    tokenIdentifier: v.string(),
    nickname: v.string(),
    color: v.optional(v.string()),
  }),

  userProfiles: defineTable({
    email: v.string(),
    normalizedEmail: v.string(),
    nickname: v.string(),
    nicknameShort: v.optional(v.string()),
    isAdmin: v.optional(v.boolean()),
    isCharacterPrivileged: v.optional(v.boolean()),
    options: v.optional(userProfileOptionsValidator),
    updatedAt: v.number(),
  }).index("by_normalizedEmail", ["normalizedEmail"]),
});
