import { SignInButton, useAuth, UserButton } from "clerk-solidjs";
import { useConvexClient, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, onCleanup, Show } from "solid-js";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useConvexClerkAuth } from "../integrations/convex-clerk";
import {
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  getCharacterColor,
  getSpawnState,
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  resolveCharacterState,
  type CharacterState,
} from "../lib/characterPhysics";
import createGameLoop from "../lib/createGameLoop";
import { getSpriteBackgroundStyle } from "../lib/sceneStyles";

type SceneCharacter = {
  _id: Id<"characters">;
  _creationTime: number;
  sceneId: Id<"scenes">;
  sessionId?: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  color: string;
  lastProcessedSequence: number;
  updatedAt: number;
  isCurrentUser: boolean;
};

type SceneAsset = {
  x: number;
  y: number;
  width: number;
  height: number;
  collision?: boolean;
  rotation?: number;
  opacity?: number;
  bgRepeat?: string;
  bgPosition?: string;
  bgSize?: string;
  sprite: {
    url: string;
    bgRepeat?: string;
    bgPosition?: string;
    bgSize?: string;
  };
};

const SCENE_SESSION_KEY = "__sp0rtcafeSceneSessionId";
const MOVEMENT_SAMPLE_INTERVAL_MS = 100;
const MOVEMENT_BATCH_INTERVAL_MS = 100;
const IDLE_PRESENCE_INTERVAL_MS = 5_000;
const REMOTE_PREDICTION_WINDOW_MS = 120;

type CharacterSyncState = CharacterState & {
  clientSequence: number;
  timeSinceBatchStart: number;
};

function createSceneSessionUuid() {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }

  if (typeof globalThis.crypto?.getRandomValues === "function") {
    const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));

    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
  }

  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function ensureSceneSessionId() {
  const sceneWindow = window as Window & { [SCENE_SESSION_KEY]?: string };
  const existing = sceneWindow[SCENE_SESSION_KEY];

  if (existing) {
    return existing;
  }

  const next = `session-${createSceneSessionUuid()}`;
  sceneWindow[SCENE_SESSION_KEY] = next;
  return next;
}

function isJumpKey(key: string) {
  return key === "w" || key === "arrowup" || key === " ";
}

function isMovementKey(key: string) {
  return (
    key === "a" || key === "d" || key === "arrowleft" || key === "arrowright" || isJumpKey(key)
  );
}

function toCharacterState(character: SceneCharacter): CharacterState {
  return {
    x: character.x,
    y: character.y,
    vx: character.vx,
    vy: character.vy,
    grounded: character.grounded,
  };
}

function predictRemoteCharacter(
  character: SceneCharacter,
  now: number,
  width: number,
  height: number,
  collisionSurfaces: ReturnType<typeof resolveCollisionSurfaces>
) {
  const elapsedSeconds =
    Math.min(REMOTE_PREDICTION_WINDOW_MS, Math.max(0, now - character.updatedAt)) / 1000;

  return resolveCharacterState({ width, height }, collisionSurfaces, toCharacterState(character), {
    x: character.x + character.vx * elapsedSeconds,
    y:
      character.y + character.vy * elapsedSeconds + 0.5 * GRAVITY * elapsedSeconds * elapsedSeconds,
    vx: character.vx,
    vy: character.vy + GRAVITY * elapsedSeconds,
    grounded: character.grounded,
  });
}

function resolveCollisionSurfaces(assets: SceneAsset[]) {
  return assets
    .filter((asset) => asset.collision)
    .map((asset) => ({
      x: asset.x,
      y: asset.y,
      width: asset.width,
      height: asset.height,
    }));
}

function createOptimisticCharacter(
  current: SceneCharacter[] | undefined,
  sceneId: Id<"scenes">,
  sessionId: string,
  color: string,
  clientSequence: number,
  state: CharacterState
): SceneCharacter {
  const existing = current?.find((character) => character.isCurrentUser);
  const now = Date.now();

  return {
    _id: existing?._id ?? (`optimistic-${sessionId}` as Id<"characters">),
    _creationTime: existing?._creationTime ?? now,
    sceneId,
    sessionId,
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    width: existing?.width ?? CHARACTER_WIDTH,
    height: existing?.height ?? CHARACTER_HEIGHT,
    grounded: state.grounded,
    color: existing?.color ?? color,
    lastProcessedSequence: clientSequence,
    updatedAt: now,
    isCurrentUser: true,
  };
}

function areCharacterStatesEqual(left: CharacterState, right: CharacterState) {
  return (
    left.x === right.x &&
    left.y === right.y &&
    left.vx === right.vx &&
    left.vy === right.vy &&
    left.grounded === right.grounded
  );
}

function SceneLoadingCard(props: { label: string }) {
  return (
    <div class="flex flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
      <div class="flex gap-1.5">
        <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:0ms]" />
        <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:150ms]" />
        <div class="h-2 w-2 animate-bounce rounded-full bg-white/50 [animation-delay:300ms]" />
      </div>
      <p class="text-xs uppercase tracking-[0.22em] text-white/30">{props.label}</p>
    </div>
  );
}

function SceneAuthGate() {
  return (
    <div class="flex max-w-md flex-col items-center gap-5 rounded-[32px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
      <div class="text-xs uppercase tracking-[0.22em] text-white/45">Sign in required</div>
      <div class="text-sm text-white/70">
        Sign in with Google or GitHub to spawn and control your character in the cafe.
      </div>
      <SignInButton
        mode="modal"
        forceRedirectUrl="/"
        fallbackRedirectUrl="/"
        class="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15"
      >
        Sign in to play
      </SignInButton>
    </div>
  );
}

export default function SceneLanding() {
  const defaultScene = useQuery(api.scenes.getDefault, {});
  const convexAuth = useConvexClerkAuth();

  return (
    <main class="min-h-screen bg-[#140d0b] px-4 py-8 text-foreground">
      <div class="mx-auto mb-4 flex max-w-[2200px] items-center justify-between gap-4">
        <div class="text-[11px] uppercase tracking-[0.22em] text-white/45">
          {convexAuth.isAuthenticated()
            ? "Move: A/D or arrows. Jump: W, Up, Space."
            : "Sign in with Google or GitHub to play."}
        </div>
        <div class="flex items-center gap-3">
          <Show
            when={convexAuth.isAuthenticated()}
            fallback={
              <SignInButton
                mode="modal"
                forceRedirectUrl="/"
                fallbackRedirectUrl="/"
                class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10 hover:text-white"
              >
                Sign in
              </SignInButton>
            }
          >
            <UserButton />
          </Show>
          <a
            class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10 hover:text-white"
            href="/editor"
          >
            Open editor
          </a>
        </div>
      </div>

      <div class="mx-auto flex min-h-[calc(100vh-8rem)] max-w-[2200px] items-center justify-center">
        <Show
          when={!convexAuth.isLoading()}
          fallback={<SceneLoadingCard label="Checking session" />}
        >
          <Show when={convexAuth.isAuthenticated()} fallback={<SceneAuthGate />}>
            <Show
              when={!defaultScene.isLoading()}
              fallback={<SceneLoadingCard label="Loading scene" />}
            >
              <Show
                when={defaultScene.data()}
                fallback={
                  <div class="flex max-w-md flex-col items-center gap-4 rounded-[32px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
                    <div class="text-xs uppercase tracking-[0.22em] text-white/45">
                      No scene yet
                    </div>
                    <div class="text-sm text-white/70">
                      Create a scene first, then set it as default.
                    </div>
                    <a
                      class="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15"
                      href="/editor"
                    >
                      Open editor
                    </a>
                  </div>
                }
              >
                {(scene) => (
                  <LandingSceneCanvas
                    sceneId={scene()._id}
                    width={scene().width}
                    height={scene().height}
                  />
                )}
              </Show>
            </Show>
          </Show>
        </Show>
      </div>
    </main>
  );
}

function LandingSceneCanvas(props: { sceneId: Id<"scenes">; width: number; height: number }) {
  const convex = useConvexClient();
  const { userId } = useAuth();

  if (!convex) {
    throw new Error("Convex client unavailable");
  }

  const sessionId = ensureSceneSessionId();
  const assets = useQuery(api.sceneAssets.listByScene, () => ({ sceneId: props.sceneId }), {
    keepPreviousData: true,
  });
  const characters = useQuery(
    api.characters.listByScene,
    () => ({ sceneId: props.sceneId, sessionId }),
    {
      keepPreviousData: true,
    }
  );
  const [playerState, setPlayerState] = createSignal<CharacterState | null>(null);
  const [frameNow, setFrameNow] = createSignal(Date.now());
  const [fallbackPlayerColor, setFallbackPlayerColor] = createSignal(getCharacterColor(sessionId));

  const collisionSurfaces = createMemo(() => resolveCollisionSurfaces(assets.data() ?? []));
  const ownCharacter = createMemo(
    () =>
      ((characters.data() as SceneCharacter[] | undefined) ?? []).find(
        (character) => character.isCurrentUser
      ) ?? null
  );
  const otherCharacters = createMemo(() =>
    ((characters.data() as SceneCharacter[] | undefined) ?? []).filter(
      (character) => !character.isCurrentUser
    )
  );
  const remoteCharacters = createMemo(() =>
    otherCharacters().map((character) => ({
        ...character,
        predicted: predictRemoteCharacter(
          character,
          frameNow(),
          props.width,
          props.height,
          collisionSurfaces()
        ),
      }))
  );
  const hasRemoteCharacters = createMemo(() => otherCharacters().length > 0);
  const playerColor = createMemo(() => ownCharacter()?.color ?? fallbackPlayerColor());

  let activeLeft = false;
  let activeRight = false;
  let jumpQueued = false;
  let latestSequence = 0;
  let lastSampleAt = 0;
  let lastPresenceSentAt = 0;
  let batchStartedAt = Date.now();
  let pendingSyncStates: CharacterSyncState[] = [];

  createEffect(() => {
    const nextUserId = userId();

    if (nextUserId) {
      setFallbackPlayerColor(getCharacterColor(nextUserId));
    }
  });

  createEffect(() => {
    const nextOwnCharacter = ownCharacter();

    if (nextOwnCharacter?.color) {
      setFallbackPlayerColor(nextOwnCharacter.color);
    }
  });

  createEffect(() => {
    props.sceneId;
    activeLeft = false;
    activeRight = false;
    jumpQueued = false;
    latestSequence = 0;
    lastSampleAt = 0;
    lastPresenceSentAt = 0;
    batchStartedAt = Date.now();
    pendingSyncStates = [];
    setPlayerState(null);
  });

  createEffect(() => {
    const serverCharacter = ownCharacter();

    if (playerState()) {
      return;
    }

    if (serverCharacter) {
      setPlayerState(toCharacterState(serverCharacter));
      return;
    }

    if (assets.isLoading() || characters.isLoading()) {
      return;
    }

    setPlayerState(
      getSpawnState(
        { width: props.width, height: props.height },
        collisionSurfaces(),
        ((characters.data() as SceneCharacter[] | undefined) ?? [])
          .filter((character) => !character.isCurrentUser)
          .map((character) => ({
            x: character.x,
            y: character.y,
          }))
      )
    );
  });

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (!isMovementKey(key)) {
        return;
      }

      event.preventDefault();

      if (key === "a" || key === "arrowleft") {
        activeLeft = true;
        return;
      }

      if (key === "d" || key === "arrowright") {
        activeRight = true;
        return;
      }

      if (!event.repeat && isJumpKey(key)) {
        jumpQueued = true;
      }
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (key === "a" || key === "arrowleft") {
        activeLeft = false;
        return;
      }

      if (key === "d" || key === "arrowright") {
        activeRight = false;
      }
    };

    const clearInputState = () => {
      activeLeft = false;
      activeRight = false;
      jumpQueued = false;
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    window.addEventListener("blur", clearInputState);

    onCleanup(() => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      window.removeEventListener("blur", clearInputState);
    });
  });

  const flushMovementBatch = (states: CharacterSyncState[]) => {
    const latestState = states[states.length - 1];

    if (!latestState) {
      return;
    }

    void convex
      .mutation(
        api.characters.syncBatch,
        {
          sceneId: props.sceneId,
          sessionId,
          states,
        },
        {
          optimisticUpdate: (localStore) => {
            const current = localStore.getQuery(api.characters.listByScene, {
              sceneId: props.sceneId,
              sessionId,
            }) as SceneCharacter[] | undefined;
            const optimisticCharacter = createOptimisticCharacter(
              current,
              props.sceneId,
              sessionId,
              playerColor(),
              latestState.clientSequence,
              latestState
            );

            localStore.setQuery(
              api.characters.listByScene,
              { sceneId: props.sceneId, sessionId },
              [
                ...(current ?? []).filter((character) => !character.isCurrentUser),
                optimisticCharacter,
              ].sort((left, right) => left._creationTime - right._creationTime)
            );
          },
        }
      )
      .catch((error) => {
        console.error("character sync failed", error);
      });
  };

  const queueMovementState = (nextState: CharacterState, now: number) => {
    latestSequence += 1;
    pendingSyncStates.push({
      clientSequence: latestSequence,
      x: nextState.x,
      y: nextState.y,
      vx: nextState.vx,
      vy: nextState.vy,
      grounded: nextState.grounded,
      timeSinceBatchStart: now - batchStartedAt,
    });
    lastSampleAt = now;
  };

  createEffect(() => {
    const sendBatchInterval = window.setInterval(() => {
      const now = Date.now();

      if (pendingSyncStates.length === 0) {
        const currentState = playerState();

        if (currentState && now - lastPresenceSentAt >= IDLE_PRESENCE_INTERVAL_MS) {
          queueMovementState(currentState, now);
        }
      }

      batchStartedAt = now;

      if (pendingSyncStates.length === 0) {
        return;
      }

      const nextBatch = pendingSyncStates;
      pendingSyncStates = [];
      lastPresenceSentAt = now;
      flushMovementBatch(nextBatch);
    }, MOVEMENT_BATCH_INTERVAL_MS);

    onCleanup(() => {
      window.clearInterval(sendBatchInterval);
    });
  });

  createGameLoop({
    fn: (_timestamp, deltaSeconds) => {
      const now = Date.now();

      if (hasRemoteCharacters()) {
        setFrameNow(now);
      }

      const currentState = playerState();

      if (!currentState || deltaSeconds <= 0) {
        return;
      }

      const horizontalDirection = Number(activeRight) - Number(activeLeft);
      const shouldJump = jumpQueued;
      const nextVelocityX = horizontalDirection * MOVE_SPEED;
      let nextVelocityY = currentState.vy + GRAVITY * deltaSeconds;
      let currentGrounded = currentState.grounded;

      jumpQueued = false;

      if (shouldJump && currentGrounded) {
        nextVelocityY = -JUMP_VELOCITY;
        currentGrounded = false;
      }

      const nextState = resolveCharacterState(
        { width: props.width, height: props.height },
        collisionSurfaces(),
        currentState,
        {
          x: currentState.x + nextVelocityX * deltaSeconds,
          y: currentState.y + nextVelocityY * deltaSeconds,
          vx: nextVelocityX,
          vy: nextVelocityY,
          grounded: currentGrounded,
        }
      );

      setPlayerState(nextState);

      if (
        !areCharacterStatesEqual(currentState, nextState) &&
        now - lastSampleAt >= MOVEMENT_SAMPLE_INTERVAL_MS
      ) {
        queueMovementState(nextState, now);
      }
    },
  });

  return (
    <div class="overflow-auto rounded-[32px] border border-white/10 bg-black/20 p-4 backdrop-blur-sm">
      <div
        class="relative overflow-hidden rounded-[24px] border border-white/10 bg-[#1e1512]"
        style={{
          width: `${props.width}px`,
          height: `${props.height}px`,
        }}
      >
        <div class="pointer-events-none absolute inset-x-0 bottom-0 h-56 bg-black/30" />
        <div class="pointer-events-none absolute inset-x-0 top-0 h-40 bg-white/[0.04]" />

        <Show
          when={!assets.isLoading()}
          fallback={
            <div class="absolute left-6 top-6 text-sm text-muted-foreground">Loading scene...</div>
          }
        >
          <For each={assets.data() ?? []}>
            {(asset) => (
              <div
                class="absolute [image-rendering:pixelated]"
                style={{
                  left: `${asset.x}px`,
                  top: `${asset.y}px`,
                  width: `${asset.width}px`,
                  height: `${asset.height}px`,
                  transform: `rotate(${asset.rotation ?? 0}deg)`,
                  "transform-origin": "center center",
                }}
              >
                <div
                  class="absolute inset-0"
                  style={{
                    ...getSpriteBackgroundStyle({
                      url: asset.sprite.url,
                      bgRepeat: asset.bgRepeat ?? asset.sprite.bgRepeat,
                      bgPosition: asset.bgPosition ?? asset.sprite.bgPosition,
                      bgSize: asset.bgSize ?? asset.sprite.bgSize,
                    }),
                    opacity: String(asset.opacity ?? 1),
                  }}
                />
              </div>
            )}
          </For>
        </Show>

        <For each={remoteCharacters()}>
          {(character, index) => (
            <CharacterBody
              label={`P${index() + 1}`}
              color={character.color}
              x={character.predicted.x}
              y={character.predicted.y}
              width={character.width}
              height={character.height}
            />
          )}
        </For>

        <Show when={playerState()}>
          {(state) => (
            <CharacterBody
              label="You"
              color={playerColor()}
              x={state().x}
              y={state().y}
              width={CHARACTER_WIDTH}
              height={CHARACTER_HEIGHT}
            />
          )}
        </Show>
      </div>
    </div>
  );
}

function CharacterBody(props: {
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}) {
  return (
    <div
      class="pointer-events-none absolute"
      style={{
        left: "0",
        top: "0",
        width: `${props.width}px`,
        height: `${props.height}px`,
        transform: `translate3d(${props.x}px, ${props.y}px, 0)`,
        "will-change": "transform",
        "z-index": 40,
      }}
    >
      <div
        class="absolute inset-0 rounded-[14px] border border-black/30 shadow-[0_10px_30px_rgba(0,0,0,0.28)]"
        style={{
          background: `linear-gradient(180deg, ${props.color}, color-mix(in srgb, ${props.color} 70%, #0f0907))`,
        }}
      />
      <div class="absolute inset-x-0 -top-6 flex justify-center">
        <div class="rounded-full border border-white/10 bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
          {props.label}
        </div>
      </div>
    </div>
  );
}
