# ChatBox — Single-Channel Chat

## Context
Add a small chatbox widget to the scene landing page. Single global channel. Anyone can read, only signed-in users can write. Wired to Convex backend. UI-only focus — minimal event listeners (open/close toggle, input binding, form submit, keyboard stopPropagation).

## Files

### 1. Modify `convex/schema.ts` — add `chatMessages` table

```ts
chatMessages: defineTable({
  body: v.string(),
  tokenIdentifier: v.string(),
  nickname: v.string(),
  color: v.optional(v.string()),
})
```

No custom index needed — default `_creationTime` ordering is sufficient for a single-channel chat.

### 2. Create `convex/chat.ts` — query + mutation

**`list` query** (public, no args):
- `ctx.db.query("chatMessages").order("desc").take(50)` then reverse
- No auth required (anyone can read)

**`send` mutation** (public, args: `{ body: v.string() }`):
- `ctx.auth.getUserIdentity()` — throw if null
- Look up profile via `getUserProfileByEmail(ctx, identity.email)` (imported from `./userProfiles`)
- Trim body, reject empty, cap at 500 chars
- Insert: `{ body, tokenIdentifier: identity.tokenIdentifier, nickname: profile?.nickname ?? identity.name ?? "Anonymous", color: profile?.options?.color }`

### 3. Create `src/components/ChatBox.tsx`

Fixed bottom-right overlay (z-50). Two states: collapsed button / expanded panel.

**Collapsed**: Small pill button "Chat" — onClick toggles open.

**Expanded** (~320w x 400h):
- Header: "Chat" title + close button
- Messages area (scrollable, auto-scroll on new messages): `<For each={messages}>` showing color dot, nickname, body, relative time
- Footer:
  - Authenticated: input + send button, form onSubmit calls `sendMessage({ body })`, input has `onKeyDown={e => e.stopPropagation()}` to prevent scene movement keys
  - Unauthenticated: `<SignInButton>` prompt

**Styling** — match existing dark theme:
- Panel: `rounded-[4px] border border-white/10 bg-black/20 backdrop-blur-sm`
- Text: `text-xs uppercase tracking-[0.22em] text-white/45` for labels
- Messages: `text-sm text-white/70` for body, `text-[10px] text-white/80` for nicknames
- Input/button: `border border-white/15 bg-white/10 text-white`

### 4. Modify `src/components/SceneLanding.tsx`

- Import `ChatBox` from `./ChatBox`
- Add `<ChatBox />` before closing `</main>` tag (line ~488), outside auth gates so everyone sees it

## Key Details

- **Keyboard conflict**: Chat input MUST `stopPropagation()` on keydown — scene listens on `window` for A/D/W/Space/arrows (SceneLanding:858)
- **Denormalized nickname/color**: Same pattern as `characters.ts` — resolved from userProfile at write time
- **50 message limit**: `.take(50)` prevents unbounded reads
- **No `clientOnly` wrapper needed**: SceneLanding is already loaded via `clientOnly` at route level

## Verification
1. `npx convex dev` should deploy schema + functions without errors
2. Open the app — chatbox toggle visible in bottom-right
3. Click to open — messages area visible (empty initially)
4. Sign in — input field appears
5. Type a message, submit — appears in the list
6. Open in second browser/incognito — message visible to both, unauthenticated user sees sign-in prompt
7. Type A/D/W in chat input — character should NOT move
