# Plan: Synchronized Radio Player + Currently Playing Overlays + Sprite Rotation Animations

## Context
Adding three interconnected features:
1. **Synchronized radio player** — all connected users hear the same track at the same position. Admins upload mp3s and control playback (pause/unpause). Clients play independently but sync their start time from Convex.
2. **"Currently playing" / "next track" overlays** — admin marks any scene asset as the "now playing" or "up next" display surface. Text is auto-derived from the global radio state.
3. **Sprite rotation animation** — per-asset `animRotationSpeed` (deg/s) drives a CSS spin animation, configurable via the style editor popover.

---

## Phase 1 — Schema (`convex/schema.ts`)

### Add `radioState` table (singleton)
```typescript
radioState: defineTable({
  currentTrackFileId: v.optional(v.id("files")),
  nextTrackFileId:    v.optional(v.id("files")),
  startedAt:          v.optional(v.number()),  // epoch ms; position = Date.now() - startedAt
  pausePosition:      v.optional(v.number()),  // ms offset at time of pause
  isPaused:           v.boolean(),
  updatedAt:          v.number(),
})
```

### Add to `sceneAssets` table
```typescript
isCurrentlyPlaying: v.optional(v.boolean()),
isNextTrack:        v.optional(v.boolean()),
animRotationSpeed:  v.optional(v.number()),  // deg/s; positive=CW, negative=CCW
```
All optional → no migration needed.

---

## Phase 2 — New file: `convex/radio.ts`

```typescript
// Public — used by SceneLanding (no auth required)
export const getStateWithFiles = query({
  args: {},
  handler: async (ctx) => {
    const state = await ctx.db.query("radioState").first();
    if (!state) return null;
    const currentFile = state.currentTrackFileId ? await ctx.db.get(state.currentTrackFileId) : null;
    const nextFile    = state.nextTrackFileId     ? await ctx.db.get(state.nextTrackFileId)     : null;
    return {
      ...state,
      currentTrackUrl:  currentFile?.url,
      currentTrackName: currentFile?.fileName,
      nextTrackUrl:     nextFile?.url,
      nextTrackName:    nextFile?.fileName,
    };
  },
});

// Admin mutations: ensureState, setTrack, pause, resume, advanceTrack
```

**Playback math:**
- Playing: `audio.currentTime = (Date.now() - startedAt) / 1000`
- Paused: `audio.currentTime = pausePosition / 1000`
- Resume: `startedAt = Date.now() - pausePosition`, clear `pausePosition`

**`advanceTrack`** — promotes `nextTrackFileId` → `currentTrackFileId`, resets `startedAt = Date.now()`. Takes optional `expectedCurrentFileId` arg as race guard (only applies if db still matches).

---

## Phase 3 — `convex/files.ts`: add `listAudio`

```typescript
export const listAudio = query({
  args: {},
  handler: async (ctx) => {
    await requireAdminAccess(ctx);
    const files = await ctx.db.query("files")
      .withIndex("by_status", (q) => q.eq("status", "uploaded"))
      .take(500);
    return files.filter(f =>
      f.mimeType?.startsWith("audio/") || /\.(mp3|ogg|wav|aac)$/i.test(f.fileName)
    );
  },
});
```

---

## Phase 4 — `convex/sceneAssets.ts`: thread new fields

- **`update`** — add `isCurrentlyPlaying`, `isNextTrack`, `animRotationSpeed` to args + patch builder
- **`restore`** — add same three to args (passed straight to `ctx.db.insert`)
- **`duplicate`** — add same three to the per-asset `v.object(...)` and `ctx.db.insert` call
- **`listByScene`** — no change needed (already spreads `...asset`)

---

## Phase 5 — `src/server/uploadthing.ts`: add `audioUploader`

```typescript
audioUploader: f({ audio: { maxFileSize: "32MB", maxFileCount: 5 } })
  .middleware(async () => ({ authorized: true }))
  .onUploadComplete(async ({ file }) => {
    if (convex) {
      await convex.mutation(api.files.upsertUploadThingFiles, {
        files: [{ uploadThingKey: file.key, fileName: file.name, url: file.ufsUrl,
                  size: file.size, mimeType: file.type, uploadedAt: Date.now(),
                  status: "uploaded", progress: 100 }],
        createSprites: false,  // don't create a sprite for audio files
      });
    }
    return { uploaded: true };
  }),
```

---

## Phase 6 — `src/components/SceneLanding.tsx`

### 6a. Update `SceneAsset` type (~line 56)
Add: `_id: Id<"sceneAssets">`, `isCurrentlyPlaying?: boolean`, `isNextTrack?: boolean`, `animRotationSpeed?: number`

### 6b. `@keyframes spin-asset` in global CSS (`src/app.css`)
```css
@keyframes spin-asset {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
```

### 6c. Subscribe to radio state in `LandingSceneCanvas`
```typescript
const radioState = useQuery(api.radio.getStateWithFiles, {});
```

### 6d. New `RadioPlayer` component
- Hidden `<audio>` ref
- `createEffect` on `[currentTrackUrl, startedAt, isPaused, pausePosition]`:
  - On track change: set `audio.src`, after `canplay` event: seek + play
  - Seek: `audio.currentTime = isPaused ? pausePosition/1000 : (Date.now() - startedAt)/1000`
  - Drift correction: if `|actual - expected| > 2s`, re-seek
  - `audio.onended` → calls `onTrackEnded()` prop
- Catch rejected `play()` (autoplay block) → show "click to enable audio" prompt

### 6e. Asset rendering — animation + overlays
```tsx
<div style={{
  transform: asset.animRotationSpeed ? undefined : `rotate(${asset.rotation ?? 0}deg)`,
  animation: asset.animRotationSpeed
    ? `spin-asset ${360 / Math.abs(asset.animRotationSpeed)}s linear infinite`
    : undefined,
  "animation-direction": (asset.animRotationSpeed ?? 0) < 0 ? "reverse" : "normal",
}}>
  {/* existing background div */}
  <Show when={asset.isCurrentlyPlaying}>
    <CurrentlyPlayingOverlay trackName={radioState.data()?.currentTrackName} />
  </Show>
  <Show when={asset.isNextTrack}>
    <NextTrackOverlay trackName={radioState.data()?.nextTrackName} />
  </Show>
</div>
```

### 6f. Admin radio controls (floating panel, shown when `isAdmin`)
Pause/Resume + current track name + dropdowns to pick current/next track from `api.files.listAudio` + "Set track" button.

---

## Phase 7 — Editor

### `PlacedSprite.tsx`
- Add props: `isCurrentlyPlaying?`, `isNextTrack?`, `onToggleCurrentlyPlaying`, `onToggleNextTrack`
- Add two buttons to the pill toolbar (after Collision, before Lock): "Now playing" + "Up next" toggles (green when active)
- Add `animRotationSpeed` text input to the Style Editor popover: label "Rotation (deg/s)", placeholder "0 = off, + = CW, − = CCW"

### `SceneCanvas.tsx`
- Add `animRotationSpeedDraft` / `setAnimRotationSpeedDraft` signals (mirror `opacityDraft` pattern ~line 219)
- Hydrate in the `createEffect` that initializes draft values from the selected asset
- Include in `handleCommitStyleEditor` → `updateAsset.mutate({ animRotationSpeed: parseFloat(draft) || undefined })`
- Wire `onToggleCurrentlyPlaying` / `onToggleNextTrack` → `updateAsset.mutate({ isCurrentlyPlaying: !asset.isCurrentlyPlaying })`
- Add `animRotationSpeed?`, `isCurrentlyPlaying?`, `isNextTrack?` to `DeletedAssetSnapshot` and `CopiedAssetSnapshot` types + populate/restore through undo/paste

### `SpriteSidebar.tsx` — Audio section
- Upload button wired to `audioUploader` route
- List uploaded audio files from `api.files.listAudio`
- Buttons to set current/next track + pause/resume radio state

---

## Files changed

| File | Change |
|---|---|
| `convex/schema.ts` | Add `radioState` table + 3 fields to `sceneAssets` |
| `convex/radio.ts` | **New** — `getStateWithFiles` + 5 admin mutations |
| `convex/files.ts` | Add `listAudio` query |
| `convex/sceneAssets.ts` | Thread 3 new fields through `update`, `restore`, `duplicate` |
| `src/server/uploadthing.ts` | Add `audioUploader` route |
| `src/app.css` | Add `@keyframes spin-asset` |
| `src/components/SceneLanding.tsx` | RadioPlayer, overlays, animation, admin controls |
| `src/components/sprite-editor/PlacedSprite.tsx` | 2 new toolbar buttons + rotation input in style popover |
| `src/components/sprite-editor/SceneCanvas.tsx` | Wire new fields, draft signals, undo/copy snapshot types |
| `src/components/sprite-editor/SpriteSidebar.tsx` | Audio upload + radio management panel |

---

## Verification

1. Deploy schema → no validation errors in Convex dashboard
2. Upload mp3 via audio panel → appears in `listAudio`, no sprite created
3. Set current track → `radioState` document updates
4. Open two tabs (non-admin) → both play from same position within ~1s
5. Admin pauses → both tabs pause; resume → both resume from same position
6. Mark asset `isCurrentlyPlaying` → overlay appears in landing with track name
7. Set `animRotationSpeed = 45` → asset spins at 1 rotation/8s
8. Undo deleted asset with `animRotationSpeed` → rotation speed restored
