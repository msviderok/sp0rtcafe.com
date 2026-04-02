import { SignInButton, useAuth, UserButton } from "clerk-solidjs";
import { useConvexClient, useMutation, useQuery } from "convex-solidjs";
import { createEffect, createMemo, createSignal, For, onCleanup, Show, untrack } from "solid-js";
import { Portal } from "solid-js/web";
import { api } from "../../convex/_generated/api";
import type { Id } from "../../convex/_generated/dataModel";
import { useConvexClerkAuth } from "../integrations/convex-clerk";
import { useCurrentUserBootstrap } from "../integrations/current-user-bootstrap";
import { resolveCharacterAnimationState } from "../lib/characterAnimationState";
import type { CharacterFacing } from "../lib/characterCatalog";
import {
  getDefaultPlayableCharacterId,
  humanizeCharacterActionName,
} from "../lib/characterCatalog";
import {
  getCharacterActionUrl,
  getPlayableCharacterManifestWithUrls,
  PLAYABLE_CHARACTER_CATALOG_WITH_URLS,
} from "../lib/characterCatalog.client";
import {
  CHARACTER_HEIGHT,
  CHARACTER_WIDTH,
  type CharacterState,
  getCharacterColor,
  getSpawnState,
  GRAVITY,
  JUMP_VELOCITY,
  MOVE_SPEED,
  resolveCharacterState,
} from "../lib/characterPhysics";
import createGameLoop from "../lib/createGameLoop";
import { getTextSpriteStyle, isTextSprite } from "../lib/textSprites";
import ChatBox from "./ChatBox";
import CharacterPickerRail from "./scene/CharacterPickerRail";
import QuickActionsBar from "./scene/QuickActionsBar";

type SceneCharacter = {
  _id: Id<"characters">;
  _creationTime: number;
  sceneId: Id<"scenes">;
  sessionId?: string;
  active: boolean;
  nickname: string | null;
  nicknameShort: string | null;
  profileOptions: {
    color?: string;
    characterSprite?: string;
  };
  actions: CharacterMovementAction[];
  x: number;
  y: number;
  vx: number;
  vy: number;
  width: number;
  height: number;
  grounded: boolean;
  currentAnimation: string;
  facing: CharacterFacing;
  isRunning: boolean;
  manualActionName: string | null;
  color: string;
  lastProcessedSequence: number;
  updatedAt: number;
  isCurrentUser: boolean;
};

type CharacterMovementAction = {
  kind: "movement";
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  timeSinceBatchStart: number;
  animationName: string | null;
  facing: CharacterFacing;
  isRunning: boolean;
  manualActionName: string | null;
};

type SceneAsset = {
  _id: Id<"sceneAssets">;
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
  isCurrentlyPlaying?: boolean;
  isNextTrack?: boolean;
  isVolumeControl?: boolean;
  animRotationSpeed?: number;
  sprite: {
    url: string;
    kind?: "image" | "text";
    text?: string;
    bgRepeat?: string;
    bgPosition?: string;
    bgSize?: string;
  };
};

const SCENE_SESSION_KEY = "__sp0rtcafeSceneSessionId";
const LAST_CHARACTER_STATE_KEY_PREFIX = "__sp0rtcafeLastCharacterState";
const MOVEMENT_SAMPLE_INTERVAL_MS = 16;
const MOVEMENT_BATCH_INTERVAL_MS = 50;
const IDLE_PRESENCE_INTERVAL_MS = 5_000;
const RUN_SPEED_MULTIPLIER = 1.5;
const RADIO_VOLUME_STORAGE_KEY = "radio_volume";
const RADIO_VOLUME_STEP = 0.05;
const RADIO_VOLUME_DRAG_SENSITIVITY = 0.005;

// Camera follow system
const CAMERA_DEAD_ZONE_X = 0.05;
const CAMERA_DEAD_ZONE_Y = 0.35;
const CAMERA_LERP_SPEED = 8;
const PLAYER_FOCUS_OFFSET_X = CHARACTER_WIDTH / 2;
const PLAYER_FOCUS_OFFSET_Y = CHARACTER_HEIGHT * 0.4;

type CharacterSyncState = CharacterState & {
  clientSequence: number;
  timeSinceBatchStart: number;
  animationName: string;
  facing: CharacterFacing;
  isRunning: boolean;
  manualActionName: string | null;
};

type StoredCharacterSnapshot = CharacterState & {
  lastProcessedSequence: number;
};

function clampRadioVolume(value: number) {
  if (!Number.isFinite(value)) {
    return 1;
  }

  return Math.min(1, Math.max(0, value));
}

function snapRadioVolume(value: number) {
  return clampRadioVolume(
    Math.round(clampRadioVolume(value) / RADIO_VOLUME_STEP) * RADIO_VOLUME_STEP
  );
}

function readStoredRadioVolume() {
  try {
    const stored = Number.parseFloat(window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY) ?? "1");
    return clampRadioVolume(stored);
  } catch {
    return 1;
  }
}

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

function shouldReuseStoredSceneSessionId() {
  try {
    const navigationEntry = performance.getEntriesByType("navigation")[0] as
      | PerformanceNavigationTiming
      | undefined;

    return navigationEntry?.type === "reload" || navigationEntry?.type === "back_forward";
  } catch {
    return false;
  }
}

function ensureSceneSessionId() {
  const sceneWindow = window as Window & { [SCENE_SESSION_KEY]?: string };
  const existing = sceneWindow[SCENE_SESSION_KEY];

  if (existing) {
    return existing;
  }

  try {
    const stored = shouldReuseStoredSceneSessionId()
      ? window.sessionStorage.getItem(SCENE_SESSION_KEY)
      : null;

    if (stored) {
      sceneWindow[SCENE_SESSION_KEY] = stored;
      return stored;
    }
  } catch {
    // Ignore storage access failures and fall back to an in-memory session id.
  }

  const next = `session-${createSceneSessionUuid()}`;
  sceneWindow[SCENE_SESSION_KEY] = next;

  try {
    window.sessionStorage.setItem(SCENE_SESSION_KEY, next);
  } catch {
    // Ignore storage access failures and keep the in-memory session id.
  }

  return next;
}

function clearSceneSessionId() {
  const sceneWindow = window as Window & { [SCENE_SESSION_KEY]?: string };

  delete sceneWindow[SCENE_SESSION_KEY];

  try {
    window.sessionStorage.removeItem(SCENE_SESSION_KEY);
  } catch {
    // Ignore storage access failures.
  }
}

function getStoredCharacterSnapshotKey(sceneId: Id<"scenes">, userId: string) {
  return `${LAST_CHARACTER_STATE_KEY_PREFIX}:${sceneId}:${userId}`;
}

function readStoredCharacterSnapshot(sceneId: Id<"scenes">, userId: string) {
  try {
    const raw = window.localStorage.getItem(getStoredCharacterSnapshotKey(sceneId, userId));

    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as Partial<StoredCharacterSnapshot>;

    if (
      typeof parsed.x !== "number" ||
      typeof parsed.y !== "number" ||
      typeof parsed.vx !== "number" ||
      typeof parsed.vy !== "number" ||
      typeof parsed.grounded !== "boolean"
    ) {
      return null;
    }

    return {
      x: parsed.x,
      y: parsed.y,
      vx: parsed.vx,
      vy: parsed.vy,
      grounded: parsed.grounded,
      lastProcessedSequence:
        typeof parsed.lastProcessedSequence === "number" ? parsed.lastProcessedSequence : 0,
    } satisfies StoredCharacterSnapshot;
  } catch {
    return null;
  }
}

function writeStoredCharacterSnapshot(
  sceneId: Id<"scenes">,
  userId: string,
  snapshot: StoredCharacterSnapshot
) {
  try {
    window.localStorage.setItem(
      getStoredCharacterSnapshotKey(sceneId, userId),
      JSON.stringify(snapshot)
    );
  } catch {
    // Ignore storage access failures.
  }
}

function isJumpKey(key: string) {
  return key === "w" || key === "arrowup" || key === " ";
}

function isMovementKey(key: string) {
  return (
    key === "a" || key === "d" || key === "arrowleft" || key === "arrowright" || isJumpKey(key)
  );
}

function isQuickActionKey(key: string) {
  return /^[1-9]$/.test(key);
}

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName.toLowerCase();

  return (
    tagName === "input" ||
    tagName === "textarea" ||
    target.isContentEditable ||
    target.closest("[contenteditable='true']") !== null
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

function toCharacterMovementAction(state: CharacterSyncState): CharacterMovementAction {
  return {
    kind: "movement",
    x: state.x,
    y: state.y,
    vx: state.vx,
    vy: state.vy,
    grounded: state.grounded,
    timeSinceBatchStart: state.timeSinceBatchStart,
    animationName: state.animationName,
    facing: state.facing,
    isRunning: state.isRunning,
    manualActionName: state.manualActionName,
  };
}

function createOptimisticCharacter(
  current: SceneCharacter[] | undefined,
  sceneId: Id<"scenes">,
  sessionId: string,
  color: string,
  states: CharacterSyncState[]
): SceneCharacter {
  const existing = current?.find((character) => character.isCurrentUser);
  const latestState = states[states.length - 1];
  const now = Date.now();

  if (!latestState) {
    throw new Error("Expected movement states for optimistic character");
  }

  return {
    _id: existing?._id ?? (`optimistic-${sessionId}` as Id<"characters">),
    _creationTime: existing?._creationTime ?? now,
    sceneId,
    sessionId,
    active: true,
    nickname: existing?.nickname ?? null,
    nicknameShort: existing?.nicknameShort ?? null,
    profileOptions: existing?.profileOptions ?? {},
    actions: states.map(toCharacterMovementAction),
    x: latestState.x,
    y: latestState.y,
    vx: latestState.vx,
    vy: latestState.vy,
    width: CHARACTER_WIDTH,
    height: CHARACTER_HEIGHT,
    grounded: latestState.grounded,
    currentAnimation: latestState.animationName,
    facing: latestState.facing,
    isRunning: latestState.isRunning,
    manualActionName: latestState.manualActionName,
    color: existing?.color ?? color,
    lastProcessedSequence: latestState.clientSequence,
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

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function formatLandingTrackName(trackName?: string) {
  if (!trackName) {
    return undefined;
  }

  return trackName
    .replace(/\.[^.]+$/, "")
    .replace(/^\d+\s*[-._)]*\s*/, "")
    .replace(/\s+/g, " ")
    .trim();
}

function updateCamera(
  playerX: number,
  playerY: number,
  currentCamX: number,
  currentCamY: number,
  vpWidth: number,
  vpHeight: number,
  sceneWidth: number,
  sceneHeight: number,
  deltaSeconds: number
): { x: number; y: number } {
  const focusX = playerX + PLAYER_FOCUS_OFFSET_X;
  const focusY = playerY + PLAYER_FOCUS_OFFSET_Y;

  const dzLeft = currentCamX + vpWidth * (0.5 - CAMERA_DEAD_ZONE_X / 2);
  const dzRight = currentCamX + vpWidth * (0.5 + CAMERA_DEAD_ZONE_X / 2);
  const dzTop = currentCamY + vpHeight * (0.5 - CAMERA_DEAD_ZONE_Y / 2);
  const dzBottom = currentCamY + vpHeight * (0.5 + CAMERA_DEAD_ZONE_Y / 2);

  let targetX = currentCamX;
  let targetY = currentCamY;

  if (focusX < dzLeft) {
    targetX = currentCamX - (dzLeft - focusX);
  } else if (focusX > dzRight) {
    targetX = currentCamX + (focusX - dzRight);
  }

  if (focusY < dzTop) {
    targetY = currentCamY - (dzTop - focusY);
  } else if (focusY > dzBottom) {
    targetY = currentCamY + (focusY - dzBottom);
  }

  const maxCamX = Math.max(0, sceneWidth - vpWidth);
  const maxCamY = Math.max(0, sceneHeight - vpHeight);
  targetX = Math.min(Math.max(0, targetX), maxCamX);
  targetY = Math.min(Math.max(0, targetY), maxCamY);

  const t = Math.min(1, CAMERA_LERP_SPEED * deltaSeconds);
  return {
    x: currentCamX + (targetX - currentCamX) * t,
    y: currentCamY + (targetY - currentCamY) * t,
  };
}

function getCenteredCamera(
  playerX: number,
  playerY: number,
  vpWidth: number,
  vpHeight: number,
  sceneWidth: number,
  sceneHeight: number
): { x: number; y: number } {
  const targetX = Math.min(
    Math.max(0, playerX + PLAYER_FOCUS_OFFSET_X - vpWidth / 2),
    Math.max(0, sceneWidth - vpWidth)
  );
  const targetY = Math.min(
    Math.max(0, playerY + PLAYER_FOCUS_OFFSET_Y - vpHeight / 2),
    Math.max(0, sceneHeight - vpHeight)
  );

  return {
    x: targetX,
    y: targetY,
  };
}

function SceneLoadingCard(props: { label: string }) {
  return (
    <div class="flex flex-col items-center gap-4 rounded-[4px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
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
    <div class="flex max-w-md flex-col items-center gap-5 rounded-[4px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
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
  const currentAccess = useQuery(api.admin.getCurrentAccess, {});
  const convexAuth = useConvexClerkAuth();
  const currentUserBootstrap = useCurrentUserBootstrap();
  const auth = useAuth();
  const [isChatOpen, setIsChatOpen] = createSignal(false);
  const [isCharacterPickerOpen, setIsCharacterPickerOpen] = createSignal(false);
  let pickerMountRef: HTMLDivElement | undefined;

  createEffect(() => {
    if (auth.isLoaded() && !auth.isSignedIn()) {
      clearSceneSessionId();
    }
  });

  return (
    <main class="flex h-screen flex-col overflow-hidden bg-[#140d0b] text-foreground">
      {/* Header */}
      <div class="flex shrink-0 items-center justify-between gap-4 border-b border-white/10 bg-[#0e0a09] px-4 py-3">
        <div class="text-[11px] uppercase tracking-[0.22em] text-white/45">
          {convexAuth.isAuthenticated()
            ? "Move: A/D or arrows. Jump: W, Up, Space. Actions: 1-9. Run: Shift."
            : "Sign in with Google or GitHub to play."}
        </div>
        <div class="flex items-center gap-3">
          <Show when={convexAuth.isAuthenticated()}>
            <Show
              when={
                currentAccess.data()?.canSelectCharacter &&
                PLAYABLE_CHARACTER_CATALOG_WITH_URLS.length > 0
              }
            >
              <button
                class={`flex items-center justify-center rounded-full border px-3 py-2 transition ${isCharacterPickerOpen() ? "border-white/25 bg-white/10 text-white" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}`}
                type="button"
                title="Toggle character picker"
                onClick={() => setIsCharacterPickerOpen((v) => !v)}
                aria-label="Toggle character picker"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M20 21a8 8 0 1 0-16 0" />
                </svg>
              </button>
            </Show>
            <button
              class={`flex items-center justify-center rounded-full border px-3 py-2 transition ${isChatOpen() ? "border-white/25 bg-white/10 text-white" : "border-white/15 bg-white/5 text-white/70 hover:bg-white/10 hover:text-white"}`}
              type="button"
              title="Toggle chat"
              onClick={() => setIsChatOpen((v) => !v)}
              aria-label="Toggle chat"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
                stroke-linecap="round"
                stroke-linejoin="round"
                aria-hidden="true"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </button>
          </Show>
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
          <Show when={currentAccess.data()?.isAdmin}>
            <a
              class="rounded-full border border-white/15 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.22em] text-white/70 transition hover:bg-white/10 hover:text-white"
              href="/editor"
            >
              Open editor
            </a>
          </Show>
        </div>
      </div>

      {/* Body: left panel + center + right panel */}
      <div class="flex min-h-0 flex-1 overflow-hidden">
        {/* Left: character picker — always in DOM so pickerMountRef is stable */}
        <div
          ref={pickerMountRef}
          class={`h-full min-w-0 shrink-0 overflow-hidden border-r bg-[#0e0a09] transform-gpu origin-left transition-[width,opacity,transform,border-color] duration-200 ease-out ${
            isCharacterPickerOpen()
              ? "w-72 border-white/10 opacity-100 translate-x-0 scale-x-100"
              : "w-0 border-transparent opacity-0 -translate-x-3 scale-x-95 pointer-events-none"
          }`}
        />

        {/* Center: scene */}
        <div class="flex min-h-0 min-w-0 flex-1 flex-col justify-center">
          <Show
            when={!convexAuth.isLoading()}
            fallback={<SceneLoadingCard label="Checking session" />}
          >
            <Show when={convexAuth.isAuthenticated()} fallback={<SceneAuthGate />}>
              <Show
                when={currentUserBootstrap.isReady()}
                fallback={<SceneLoadingCard label="Preparing profile" />}
              >
                <Show
                  when={!defaultScene.isLoading()}
                  fallback={<SceneLoadingCard label="Loading scene" />}
                >
                  <Show
                    when={defaultScene.data()}
                    fallback={
                      <div class="flex max-w-md flex-col items-center gap-4 rounded-[4px] border border-white/10 bg-black/20 px-8 py-10 text-center backdrop-blur-sm">
                        <div class="text-xs uppercase tracking-[0.22em] text-white/45">
                          No scene yet
                        </div>
                        <div class="text-sm text-white/70">
                          Create a scene first, then set it as default.
                        </div>
                        <Show when={currentAccess.data()?.isAdmin}>
                          <a
                            class="rounded-full border border-white/15 bg-white/10 px-5 py-2 text-xs uppercase tracking-[0.22em] text-white transition hover:bg-white/15"
                            href="/editor"
                          >
                            Open editor
                          </a>
                        </Show>
                      </div>
                    }
                  >
                    {(scene) => (
                      <LandingSceneCanvas
                        sceneId={scene()._id}
                        width={scene().width}
                        height={scene().height}
                        pickerMount={pickerMountRef}
                      />
                    )}
                  </Show>
                </Show>
              </Show>
            </Show>
          </Show>
        </div>

        {/* Right: chat */}
        <Show when={isChatOpen()}>
          <ChatBox onClose={() => setIsChatOpen(false)} />
        </Show>
      </div>
    </main>
  );
}

function LandingSceneCanvas(props: {
  sceneId: Id<"scenes">;
  width: number;
  height: number;
  pickerMount: HTMLElement | undefined;
}) {
  const convex = useConvexClient();
  const { userId } = useAuth();
  const currentUserBootstrap = useCurrentUserBootstrap();

  if (!convex) {
    throw new Error("Convex client unavailable");
  }

  const sessionId = ensureSceneSessionId();
  const assets = useQuery(api.sceneAssets.listByScene, () => ({ sceneId: props.sceneId }), {
    keepPreviousData: true,
  });
  const currentProfile = useQuery(api.userProfiles.getCurrent, {});
  const characters = useQuery(api.characters.listByScene, () => ({ sceneId: props.sceneId }), {
    keepPreviousData: true,
  });
  const radioState = useQuery(api.radio.getStateWithFiles, {});
  const currentAccess = useQuery(api.admin.getCurrentAccess, {});
  const ensureAutoplayState = useMutation(api.radio.ensureAutoplayState);
  const previousRadioTrack = useMutation(api.radio.previousTrack);
  const pauseRadio = useMutation(api.radio.pause);
  const resumeRadio = useMutation(api.radio.resume);
  const advanceRadioTrack = useMutation(api.radio.advanceTrack);
  const [playerState, setPlayerState] = createSignal<CharacterState | null>(null);
  const [fallbackPlayerColor, setFallbackPlayerColor] = createSignal(getCharacterColor(sessionId));
  const [currentFacing, setCurrentFacing] = createSignal<CharacterFacing>("right");
  const [activeManualActionName, setActiveManualActionName] = createSignal<string | null>(null);
  const [isRunKeyHeld, setIsRunKeyHeld] = createSignal(false);
  const [pickerPreviewCharacterId, setPickerPreviewCharacterId] = createSignal<string>(
    getDefaultPlayableCharacterId()
  );
  const [pendingSelectedCharacterId, setPendingSelectedCharacterId] = createSignal<string | null>(
    null
  );
  const [cameraX, setCameraX] = createSignal(0);
  const [cameraY, setCameraY] = createSignal(0);
  const [availableWidth, setAvailableWidth] = createSignal(props.width);
  const [availableHeight, setAvailableHeight] = createSignal(props.height);
  const [hasAttemptedAutoplaySeed, setHasAttemptedAutoplaySeed] = createSignal(false);
  const [volume, setVolume] = createSignal(readStoredRadioVolume());
  const [muted, setMuted] = createSignal(false);
  const initialConnectionState = convex.connectionState();
  const [socketConnected, setSocketConnected] = createSignal(
    initialConnectionState.isWebSocketConnected
  );
  const [socketHasEverConnected, setSocketHasEverConnected] = createSignal(
    initialConnectionState.hasEverConnected
  );
  let containerRef: HTMLDivElement | undefined;
  let cameraInitialized = false;
  let hasInitializedPickerPreview = false;
  let lastCameraViewportWidth = -1;
  let lastCameraViewportHeight = -1;

  const collisionSurfaces = createMemo(() => resolveCollisionSurfaces(assets.data() ?? []));
  const ownCharacter = createMemo(() =>
    !socketConnected()
      ? null
      : (((characters.data() as SceneCharacter[] | undefined) ?? []).find(
          (character) => character.isCurrentUser
        ) ?? null)
  );
  const otherCharacters = createMemo(() => {
    if (!socketConnected()) {
      return [];
    }

    return ((characters.data() as SceneCharacter[] | undefined) ?? []).filter(
      (character) => !character.isCurrentUser
    );
  });
  const playerColor = createMemo(() => ownCharacter()?.color ?? fallbackPlayerColor());
  const playerLabel = createMemo(
    () => currentProfile.data()?.nicknameShort ?? ownCharacter()?.nicknameShort ?? "You"
  );
  const appliedCharacterId = createMemo(
    () =>
      currentProfile.data()?.options?.characterSprite ??
      ownCharacter()?.profileOptions.characterSprite ??
      getDefaultPlayableCharacterId()
  );
  const selectedCharacterId = createMemo(
    () => pendingSelectedCharacterId() ?? appliedCharacterId()
  );
  const selectedCharacter = createMemo(
    () =>
      getPlayableCharacterManifestWithUrls(selectedCharacterId()) ??
      PLAYABLE_CHARACTER_CATALOG_WITH_URLS[0] ??
      null
  );
  const quickActionNames = createMemo(
    () => selectedCharacter()?.quickActionNames.slice(0, 9) ?? []
  );
  const quickActionHotkeys = createMemo(() =>
    quickActionNames().map((actionName, index) => ({
      key: actionName,
      label: humanizeCharacterActionName(actionName),
      slot: index + 1,
    }))
  );
  const viewportScale = createMemo(() => {
    const width = availableWidth();
    const height = availableHeight();

    if (width <= 0 || height <= 0) {
      return 1;
    }

    return Math.max(0, Math.min(width / props.width, height / props.height));
  });
  const viewportWidth = () => props.width;
  const viewportHeight = () => props.height;
  const displayedViewportWidth = createMemo(() => viewportWidth() * viewportScale());
  const displayedViewportHeight = createMemo(() => viewportHeight() * viewportScale());
  const currentAnimationState = createMemo(() => {
    const state = playerState();
    const characterId = selectedCharacterId();

    if (!state) {
      return resolveCharacterAnimationState({
        characterId,
        grounded: true,
        manualActionName: activeManualActionName(),
        previousFacing: currentFacing(),
        velocityX: 0,
        wantsRun: false,
      });
    }

    return resolveCharacterAnimationState({
      characterId,
      grounded: state.grounded,
      manualActionName: activeManualActionName(),
      previousFacing: currentFacing(),
      velocityX: state.vx,
      wantsRun: isRunKeyHeld() && Math.abs(state.vx) > 0.5,
    });
  });
  const animationSyncSignature = createMemo(
    () =>
      `${selectedCharacterId()}:${currentAnimationState().currentAnimation}:${currentAnimationState().facing}:${currentAnimationState().isRunning}:${currentAnimationState().manualActionName ?? ""}`
  );
  let activeLeft = false;
  let activeRight = false;
  let jumpQueued = false;

  createEffect(() => {
    const ownFacing = ownCharacter()?.facing;

    if (ownFacing) {
      setCurrentFacing(ownFacing);
    }
  });

  createEffect(() => {
    const currentCharacterId = selectedCharacterId();
    const previewCharacterId = pickerPreviewCharacterId();

    if (!getPlayableCharacterManifestWithUrls(previewCharacterId)) {
      setPickerPreviewCharacterId(currentCharacterId);
    }
  });

  createEffect(() => {
    const currentCharacterId = selectedCharacterId();
    const profileCharacterId = currentProfile.data()?.options?.characterSprite;
    const serverCharacterId = ownCharacter()?.profileOptions.characterSprite;

    if (hasInitializedPickerPreview || (!profileCharacterId && !serverCharacterId)) {
      return;
    }

    hasInitializedPickerPreview = true;
    setPickerPreviewCharacterId(currentCharacterId);
  });

  createEffect(() => {
    const profileCharacterId = currentProfile.data()?.options?.characterSprite ?? null;
    if (!pendingSelectedCharacterId() || pendingSelectedCharacterId() !== profileCharacterId) {
      return;
    }

    setPendingSelectedCharacterId(null);
  });

  createEffect(() => {
    try {
      window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, String(clampRadioVolume(volume())));
    } catch {
      // Ignore storage failures; volume control remains in-memory.
    }
  });

  createEffect(() => {
    if (radioState.isLoading()) {
      return;
    }

    const currentTrackUrl = radioState.data()?.currentTrackUrl;
    const nextTrackUrl = radioState.data()?.nextTrackUrl;
    if (currentTrackUrl && nextTrackUrl) {
      setHasAttemptedAutoplaySeed(false);
      return;
    }

    if (hasAttemptedAutoplaySeed()) {
      return;
    }

    setHasAttemptedAutoplaySeed(true);
    void ensureAutoplayState.mutate({});
  });

  const handleTrackEnded = () => {
    const currentTrackFileId = radioState.data()?.currentTrackFileId;
    const startedAt = radioState.data()?.startedAt;

    void advanceRadioTrack.mutate(
      currentTrackFileId
        ? {
            expectedCurrentFileId: currentTrackFileId,
            ...(startedAt !== undefined ? { expectedStartedAt: startedAt } : {}),
          }
        : {}
    );
  };
  const handleSelectCharacter = (characterId: string) => {
    if (!currentAccess.data()?.canSelectCharacter) {
      return;
    }

    setPendingSelectedCharacterId(characterId);
    setPickerPreviewCharacterId(characterId);

    void convex
      .mutation(api.userProfiles.selectCharacterSprite, {
        characterSprite: characterId,
      })
      .catch((error) => {
        console.error("character selection failed", error);
        setPendingSelectedCharacterId(null);
      });
  };
  let latestSequence = 0;
  let lastSampleAt = 0;
  let lastPresenceSentAt = 0;
  let batchStartedAt = Date.now();
  let pendingSyncStates: CharacterSyncState[] = [];
  let queuedSyncStates: CharacterSyncState[] = [];
  let activeSyncMutation: Promise<void> | null = null;
  let syncRetryTimeoutId: number | undefined;
  let syncGeneration = 0;
  let lastRequestedSocketPresence: boolean | null = null;

  const syncSocketPresence = (active: boolean) => {
    const currentUserId = userId();

    if (!currentUserId) {
      return Promise.resolve(null);
    }

    return convex.mutation(api.characters.setSocketPresence, {
      sceneId: props.sceneId,
      sessionId,
      active,
    });
  };

  createEffect(() => {
    const unsubscribe = convex.subscribeToConnectionState((connectionState) => {
      setSocketConnected(connectionState.isWebSocketConnected);
      setSocketHasEverConnected(connectionState.hasEverConnected);
    });

    onCleanup(unsubscribe);
  });

  createEffect(() => {
    socketConnected();
    syncGeneration += 1;
    batchStartedAt = Date.now();
    lastSampleAt = 0;
    lastPresenceSentAt = 0;
    pendingSyncStates = [];
    queuedSyncStates = [];
    activeSyncMutation = null;
    clearSyncRetryTimeout();
  });

  createEffect(() => {
    props.sceneId;
    const currentUserId = userId();
    const connected = socketConnected();
    const hasEverConnected = socketHasEverConnected();

    if (!currentUserId) {
      lastRequestedSocketPresence = null;
      return;
    }

    if (!connected && !hasEverConnected) {
      return;
    }

    if (lastRequestedSocketPresence === connected) {
      return;
    }

    lastRequestedSocketPresence = connected;
    void syncSocketPresence(connected).catch((error) => {
      if (lastRequestedSocketPresence === connected) {
        lastRequestedSocketPresence = null;
      }

      console.error("character presence sync failed", error);
    });
  });

  createEffect(() => {
    const sceneId = props.sceneId;

    onCleanup(() => {
      if (!socketHasEverConnected()) {
        return;
      }

      const currentUserId = userId();

      if (!currentUserId) {
        return;
      }

      void convex
        .mutation(api.characters.setSocketPresence, {
          sceneId,
          sessionId,
          active: false,
        })
        .catch((error) => {
          console.error("character scene cleanup sync failed", error);
        });
    });
  });

  createEffect(() => {
    const handlePageHide = () => {
      if (!socketHasEverConnected()) {
        return;
      }

      void syncSocketPresence(false).catch((error) => {
        console.error("character disconnect sync failed", error);
      });
    };

    window.addEventListener("pagehide", handlePageHide);

    onCleanup(() => {
      window.removeEventListener("pagehide", handlePageHide);
    });
  });

  const clearSyncRetryTimeout = () => {
    if (syncRetryTimeoutId === undefined) {
      return;
    }

    window.clearTimeout(syncRetryTimeoutId);
    syncRetryTimeoutId = undefined;
  };

  onCleanup(() => {
    lastRequestedSocketPresence = false;
    void syncSocketPresence(false).catch((error) => {
      console.error("character cleanup sync failed", error);
    });
    syncGeneration += 1;
    queuedSyncStates = [];
    activeSyncMutation = null;
    clearSyncRetryTimeout();
  });

  createEffect(() => {
    const currentUserId = userId();

    if (!currentUserId) {
      return;
    }

    const storedSnapshot = readStoredCharacterSnapshot(props.sceneId, currentUserId);

    if (storedSnapshot) {
      latestSequence = Math.max(latestSequence, storedSnapshot.lastProcessedSequence);
    }
  });

  createEffect(() => {
    const nextUserId = userId();
    const profileColor = currentProfile.data()?.options?.color;

    if (nextUserId) {
      setFallbackPlayerColor(profileColor ?? getCharacterColor(nextUserId));
    }
  });

  createEffect(() => {
    const nextOwnCharacter = ownCharacter();

    if (nextOwnCharacter?.color) {
      setFallbackPlayerColor(nextOwnCharacter.color);
    }

    if (nextOwnCharacter) {
      latestSequence = Math.max(latestSequence, nextOwnCharacter.lastProcessedSequence);
    }
  });

  createEffect(() => {
    props.sceneId;
    syncGeneration += 1;
    lastRequestedSocketPresence = null;
    activeLeft = false;
    activeRight = false;
    jumpQueued = false;
    setIsRunKeyHeld(false);
    setActiveManualActionName(null);
    setCurrentFacing("right");
    latestSequence = 0;
    lastSampleAt = 0;
    lastPresenceSentAt = 0;
    batchStartedAt = Date.now();
    pendingSyncStates = [];
    queuedSyncStates = [];
    activeSyncMutation = null;
    clearSyncRetryTimeout();
    setPlayerState(null);
    cameraInitialized = false;
    setCameraX(0);
    setCameraY(0);
  });

  // Viewport sizing via ResizeObserver
  createEffect(() => {
    const el = containerRef;
    if (!el) return;

    const ro = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width, height } = entry.contentRect;
      setAvailableWidth(Math.floor(width));
      setAvailableHeight(Math.floor(height));
    });

    ro.observe(el);
    onCleanup(() => ro.disconnect());
  });

  // Snap camera to player on first position
  createEffect(() => {
    const state = playerState();
    if (!state) return;
    if (cameraInitialized) return;

    cameraInitialized = true;

    const vpW = untrack(viewportWidth);
    const vpH = untrack(viewportHeight);
    const centeredCamera = getCenteredCamera(state.x, state.y, vpW, vpH, props.width, props.height);

    lastCameraViewportWidth = vpW;
    lastCameraViewportHeight = vpH;
    setCameraX(centeredCamera.x);
    setCameraY(centeredCamera.y);
  });

  createEffect(() => {
    const state = playerState();
    const vpW = viewportWidth();
    const vpH = viewportHeight();

    const viewportChanged = vpW !== lastCameraViewportWidth || vpH !== lastCameraViewportHeight;
    lastCameraViewportWidth = vpW;
    lastCameraViewportHeight = vpH;

    if (!viewportChanged || !state || !cameraInitialized) {
      return;
    }

    if (props.width <= vpW && props.height <= vpH) {
      setCameraX(0);
      setCameraY(0);
      return;
    }

    const adjustedCamera = updateCamera(
      state.x,
      state.y,
      untrack(cameraX),
      untrack(cameraY),
      vpW,
      vpH,
      props.width,
      props.height,
      1
    );

    setCameraX(adjustedCamera.x);
    setCameraY(adjustedCamera.y);
  });

  createEffect(() => {
    const serverCharacter = ownCharacter();
    const currentUserId = userId();

    if (playerState()) {
      return;
    }

    if (serverCharacter) {
      setPlayerState(toCharacterState(serverCharacter));
      return;
    }

    if (currentUserId) {
      const storedSnapshot = readStoredCharacterSnapshot(props.sceneId, currentUserId);

      if (storedSnapshot) {
        setPlayerState(storedSnapshot);
        return;
      }
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
    const currentUserId = userId();
    const serverCharacter = ownCharacter();

    if (!currentUserId || !serverCharacter) {
      return;
    }

    writeStoredCharacterSnapshot(props.sceneId, currentUserId, {
      x: serverCharacter.x,
      y: serverCharacter.y,
      vx: serverCharacter.vx,
      vy: serverCharacter.vy,
      grounded: serverCharacter.grounded,
      lastProcessedSequence: serverCharacter.lastProcessedSequence,
    });
  });

  createEffect(() => {
    const currentUserId = userId();
    const currentState = playerState();

    if (!currentUserId || !currentState) {
      return;
    }

    writeStoredCharacterSnapshot(props.sceneId, currentUserId, {
      ...currentState,
      lastProcessedSequence: latestSequence,
    });
  });

  createEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const key = event.key.toLowerCase();

      if (isEditableTarget(event.target)) {
        return;
      }

      if (key === "shift") {
        setIsRunKeyHeld(true);
        return;
      }

      if (isQuickActionKey(key)) {
        const actionName = quickActionNames()[Number(key) - 1] ?? null;

        if (!actionName) {
          return;
        }

        event.preventDefault();
        setActiveManualActionName(actionName);
        return;
      }

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

      if (key === "shift") {
        setIsRunKeyHeld(false);
        return;
      }

      if (isQuickActionKey(key)) {
        const actionName = quickActionNames()[Number(key) - 1] ?? null;

        if (actionName && activeManualActionName() === actionName) {
          setActiveManualActionName(null);
        }
        return;
      }

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
      setIsRunKeyHeld(false);
      jumpQueued = false;
      setActiveManualActionName(null);
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
    if (states.length === 0) {
      return;
    }

    queuedSyncStates = [...queuedSyncStates, ...states];

    if (activeSyncMutation) {
      return;
    }

    const startQueuedMovementSync = () => {
      if (activeSyncMutation || queuedSyncStates.length === 0) {
        return;
      }

      clearSyncRetryTimeout();

      const generation = syncGeneration;
      const sceneId = props.sceneId;
      const nextBatch = queuedSyncStates;
      queuedSyncStates = [];

      activeSyncMutation = convex
        .mutation(
          api.characters.syncBatch,
          {
            sceneId,
            sessionId,
            states: nextBatch,
          },
          {
            optimisticUpdate: (localStore) => {
              const current = localStore.getQuery(api.characters.listByScene, {
                sceneId,
              }) as SceneCharacter[] | undefined;
              const optimisticCharacter = createOptimisticCharacter(
                current,
                sceneId,
                sessionId,
                playerColor(),
                nextBatch
              );

              localStore.setQuery(
                api.characters.listByScene,
                { sceneId },
                [
                  ...(current ?? []).filter((character) => !character.isCurrentUser),
                  optimisticCharacter,
                ].sort((left, right) => left._creationTime - right._creationTime)
              );
            },
          }
        )
        .then(() => undefined)
        .catch((error) => {
          if (generation !== syncGeneration) {
            return;
          }

          queuedSyncStates = [...nextBatch, ...queuedSyncStates];
          console.error("character sync failed", error);

          if (syncRetryTimeoutId !== undefined) {
            return;
          }

          syncRetryTimeoutId = window.setTimeout(() => {
            syncRetryTimeoutId = undefined;

            if (generation !== syncGeneration) {
              return;
            }

            startQueuedMovementSync();
          }, MOVEMENT_BATCH_INTERVAL_MS);
        })
        .finally(() => {
          activeSyncMutation = null;

          if (generation !== syncGeneration || syncRetryTimeoutId !== undefined) {
            return;
          }

          startQueuedMovementSync();
        });
    };

    startQueuedMovementSync();
  };

  const resolveLocalAnimationForState = (state: CharacterState) => {
    const resolved = resolveCharacterAnimationState({
      characterId: selectedCharacterId(),
      grounded: state.grounded,
      manualActionName: activeManualActionName(),
      previousFacing: currentFacing(),
      velocityX: state.vx,
      wantsRun: isRunKeyHeld() && Math.abs(state.vx) > 0.5,
    });

    if (resolved.facing !== currentFacing()) {
      setCurrentFacing(resolved.facing);
    }

    return resolved;
  };

  const queueMovementState = (nextState: CharacterState, now: number) => {
    const animationState = resolveLocalAnimationForState(nextState);
    latestSequence += 1;
    pendingSyncStates.push({
      clientSequence: latestSequence,
      x: nextState.x,
      y: nextState.y,
      vx: nextState.vx,
      vy: nextState.vy,
      grounded: nextState.grounded,
      timeSinceBatchStart: now - batchStartedAt,
      animationName: animationState.currentAnimation,
      facing: animationState.facing,
      isRunning: animationState.isRunning,
      manualActionName: animationState.manualActionName,
    });
    lastSampleAt = now;
  };

  const flushPendingMovementStatesNow = (now: number) => {
    if (pendingSyncStates.length === 0) {
      return;
    }

    const nextBatch = pendingSyncStates;
    pendingSyncStates = [];
    lastPresenceSentAt = now;
    batchStartedAt = now;
    flushMovementBatch(nextBatch);
  };

  createEffect(() => {
    animationSyncSignature();
    const connected = socketConnected();
    const state = untrack(playerState);

    if (!state || !connected) {
      return;
    }

    const now = Date.now();
    queueMovementState(state, now);
    flushPendingMovementStatesNow(now);
  });

  createEffect(() => {
    const sendBatchInterval = window.setInterval(() => {
      if (!socketConnected()) {
        return;
      }

      const now = Date.now();

      if (pendingSyncStates.length === 0) {
        const currentState = playerState();

        if (currentState && now - lastPresenceSentAt >= IDLE_PRESENCE_INTERVAL_MS) {
          queueMovementState(currentState, now);
        }
      }

      if (pendingSyncStates.length === 0) {
        batchStartedAt = now;
        return;
      }

      flushPendingMovementStatesNow(now);
    }, MOVEMENT_BATCH_INTERVAL_MS);

    onCleanup(() => {
      window.clearInterval(sendBatchInterval);
    });
  });

  createGameLoop({
    fn: (_timestamp, deltaSeconds) => {
      const now = Date.now();
      const currentState = playerState();

      if (!currentState || deltaSeconds <= 0) {
        return;
      }

      const horizontalDirection = Number(activeRight) - Number(activeLeft);
      const shouldJump = jumpQueued;
      const wantsRun =
        isRunKeyHeld() && horizontalDirection !== 0 && Boolean(selectedCharacter()?.hasRun);
      const nextVelocityX =
        horizontalDirection * MOVE_SPEED * (wantsRun ? RUN_SPEED_MULTIPLIER : 1);
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

      // Update camera
      const vpW = viewportWidth();
      const vpH = viewportHeight();
      if (props.width > vpW || props.height > vpH) {
        const cam = updateCamera(
          nextState.x,
          nextState.y,
          cameraX(),
          cameraY(),
          vpW,
          vpH,
          props.width,
          props.height,
          deltaSeconds
        );
        setCameraX(cam.x);
        setCameraY(cam.y);
      }

      if (
        socketConnected() &&
        !areCharacterStatesEqual(currentState, nextState) &&
        now - lastSampleAt >= MOVEMENT_SAMPLE_INTERVAL_MS
      ) {
        queueMovementState(nextState, now);
      }
    },
  });

  return (
    <div class="flex min-h-0 w-full flex-1 flex-col">
      <Show when={currentUserBootstrap.error()}>
        {(errorMessage) => (
          <div class="mx-4 mt-4 rounded-[4px] border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
            {errorMessage()}
          </div>
        )}
      </Show>

      {/* Outer container — fills remaining space, watched by ResizeObserver */}
      <div ref={containerRef} class="flex min-h-0 flex-1 items-center justify-center p-3">
        <div
          class="relative"
          style={{
            width: `${displayedViewportWidth()}px`,
            height: `${displayedViewportHeight()}px`,
          }}
        >
          <div
            class="absolute left-0 top-0 origin-top-left overflow-hidden rounded-[4px] border border-white/10 bg-[#1e1512]"
            style={{
              width: `${viewportWidth()}px`,
              height: `${viewportHeight()}px`,
              transform: `scale(${viewportScale()})`,
              "will-change": "transform",
            }}
          >
            {/* World — positioned by camera translate */}
            <div
              class="absolute"
              style={{
                width: `${props.width}px`,
                height: `${props.height}px`,
                transform: `translate3d(${-cameraX()}px, ${-cameraY()}px, 0)`,
                "will-change": "transform",
              }}
            >
              <div class="pointer-events-none absolute inset-x-0 bottom-0 h-56" />
              <div class="pointer-events-none absolute inset-x-0 top-0 h-40" />

              <Show
                when={!assets.isLoading()}
                fallback={
                  <div class="absolute left-6 top-6 text-sm text-muted-foreground">
                    Loading scene...
                  </div>
                }
              >
                <For each={(assets.data() ?? []) as SceneAsset[]}>
                  {(asset) => (
                    <div
                      class="absolute [image-rendering:pixelated]"
                      style={{
                        left: `${asset.x}px`,
                        top: `${asset.y}px`,
                        width: `${asset.width}px`,
                        height: `${asset.height}px`,
                        transform: asset.animRotationSpeed
                          ? undefined
                          : `rotate(${asset.rotation ?? 0}deg)`,
                        animation: asset.animRotationSpeed
                          ? `spin-asset ${360 / Math.abs(asset.animRotationSpeed)}s linear infinite`
                          : undefined,
                        "animation-direction":
                          (asset.animRotationSpeed ?? 0) < 0 ? "reverse" : "normal",
                        "transform-origin": "center center",
                      }}
                    >
                      {isTextSprite(asset.sprite) ? (
                        <div
                          class="absolute inset-0 select-none"
                          style={{
                            ...getTextSpriteStyle(asset.sprite.text, asset.width, asset.height),
                            opacity: String(asset.opacity ?? 1),
                          }}
                        >
                          {asset.sprite.text}
                        </div>
                      ) : (
                        <div
                          class="absolute inset-0"
                          style={{
                            "background-image": `url(${asset.sprite.url})`,
                            "background-repeat":
                              asset.bgRepeat ?? asset.sprite.bgRepeat ?? "no-repeat",
                            ...((asset.bgPosition ?? asset.sprite.bgPosition)
                              ? {
                                  "background-position": asset.bgPosition ?? asset.sprite.bgPosition,
                                }
                              : {}),
                            "background-size": asset.bgSize ?? asset.sprite.bgSize ?? "100% 100%",
                            opacity: String(asset.opacity ?? 1),
                          }}
                        />
                      )}
                      <Show when={asset.isCurrentlyPlaying && radioState.data()?.currentTrackName}>
                        <CurrentlyPlayingOverlay
                          trackName={formatLandingTrackName(radioState.data()?.currentTrackName)}
                        />
                      </Show>
                      <Show when={asset.isNextTrack && radioState.data()?.nextTrackName}>
                        <NextTrackOverlay
                          trackName={formatLandingTrackName(radioState.data()?.nextTrackName)}
                        />
                      </Show>
                      <Show when={asset.isVolumeControl}>
                        <VolumeControlOverlay
                          volume={volume()}
                          muted={muted()}
                          onDrag={(nextVolume) => {
                            setMuted(false);
                            setVolume(nextVolume);
                          }}
                          onToggleMute={() => {
                            setMuted((current) => !current);
                          }}
                        />
                      </Show>
                    </div>
                  )}
                </For>
              </Show>

              <For each={otherCharacters()}>
                {(character, index) => (
                  <RemoteCharacterBody
                    characterSprite={character.profileOptions.characterSprite ?? null}
                    currentAnimation={character.currentAnimation}
                    facing={character.facing}
                    label={character.nicknameShort ?? character.nickname ?? `P${index() + 1}`}
                    color={character.color}
                    x={character.x}
                    y={character.y}
                    width={character.width}
                    height={character.height}
                    actions={character.actions}
                    lastProcessedSequence={character.lastProcessedSequence}
                  />
                )}
              </For>

              <Show when={socketConnected() ? playerState() : null}>
                {(state) => (
                  <CharacterBody
                    characterSprite={selectedCharacterId()}
                    currentAnimation={currentAnimationState().currentAnimation}
                    facing={currentAnimationState().facing}
                    label={playerLabel()}
                    color={playerColor()}
                    x={state().x}
                    y={state().y}
                    width={CHARACTER_WIDTH}
                    height={CHARACTER_HEIGHT}
                  />
                )}
              </Show>
            </div>

            {/* Quick actions overlay — bottom center of the scene */}
            <div class="pointer-events-none absolute inset-x-0 bottom-4 flex justify-center">
              <div class="pointer-events-auto">
                <QuickActionsBar
                  actions={quickActionHotkeys()}
                  activeActionName={activeManualActionName()}
                  isRunActive={currentAnimationState().isRunning}
                  runAvailable={selectedCharacter()?.hasRun ?? false}
                />
              </div>
            </div>
          </div>
        </div>
      </div>
      {/* end outer container div */}

      <Show
        when={
          currentAccess.data()?.isAdmin &&
          (radioState.data()?.currentTrackUrl || radioState.data()?.nextTrackUrl)
        }
      >
        <div class="px-3 pb-3">
          <div
            class="mx-auto flex w-full flex-wrap items-center gap-3 rounded-[4px] border border-white/10 bg-black/30 px-4 py-3 backdrop-blur-sm"
            style={{
              "max-width": `${displayedViewportWidth()}px`,
            }}
          >
            <div class="text-[10px] uppercase tracking-[0.18em] text-white/40">Radio</div>

            <div class="min-w-0 flex-1">
              <Show when={radioState.data()?.currentTrackName}>
                <div class="truncate text-xs text-white/70">
                  Now: {radioState.data()?.currentTrackName}
                </div>
              </Show>

              <Show when={radioState.data()?.nextTrackName}>
                <div class="truncate text-xs text-white/50">
                  Next: {radioState.data()?.nextTrackName}
                </div>
              </Show>
            </div>

            <div class="flex flex-wrap items-center gap-1.5">
              <button
                class="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/10 hover:text-white"
                type="button"
                onClick={() => {
                  void previousRadioTrack.mutate({});
                }}
              >
                Prev
              </button>
              <button
                class="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/10 hover:text-white"
                type="button"
                onClick={() => {
                  void advanceRadioTrack.mutate({});
                }}
              >
                Next
              </button>
              <button
                class="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[10px] uppercase tracking-[0.14em] text-white/70 transition hover:bg-white/10 hover:text-white"
                type="button"
                onClick={() => {
                  if (radioState.data()?.isPaused) {
                    void resumeRadio.mutate({});
                  } else {
                    void pauseRadio.mutate({});
                  }
                }}
              >
                {radioState.data()?.isPaused ? "Resume" : "Pause"}
              </button>
            </div>
          </div>
        </div>
      </Show>

      <RadioPlayer
        radioState={radioState.data() ?? null}
        isConnected={socketConnected()}
        onTrackEnded={handleTrackEnded}
        volume={volume()}
        muted={muted()}
      />

      <Show
        when={
          props.pickerMount &&
          currentAccess.data()?.canSelectCharacter &&
          PLAYABLE_CHARACTER_CATALOG_WITH_URLS.length > 0
        }
      >
        <Portal
          mount={props.pickerMount}
          ref={(el) => {
            el.style.display = "contents";
          }}
        >
          <CharacterPickerRail
            characters={PLAYABLE_CHARACTER_CATALOG_WITH_URLS}
            currentCharacterId={appliedCharacterId()}
            pendingCharacterId={pendingSelectedCharacterId()}
            onApply={handleSelectCharacter}
            onSelectPreview={setPickerPreviewCharacterId}
            selectedCharacterId={pickerPreviewCharacterId()}
          />
        </Portal>
      </Show>
    </div>
  );
}

function VolumeControlOverlay(props: {
  volume: number;
  muted: boolean;
  onDrag: (volume: number) => void;
  onToggleMute: () => void;
}) {
  let activePointerId: number | null = null;
  let startY = 0;
  let startVolume = 1;

  const resetDrag = () => {
    activePointerId = null;
  };

  const volumeLabel = createMemo(() => {
    if (props.muted) {
      return "MUTE";
    }

    return `VOL ${Math.round(clampRadioVolume(props.volume) * 100)}`;
  });

  return (
    <div
      class="absolute inset-0 cursor-ns-resize select-none"
      style={{ "touch-action": "none" }}
      onPointerDown={(event) => {
        event.preventDefault();
        event.stopPropagation();
        activePointerId = event.pointerId;
        startY = event.clientY;
        startVolume = props.volume;
        event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerMove={(event) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        const deltaY = startY - event.clientY;
        props.onDrag(snapRadioVolume(startVolume + deltaY * RADIO_VOLUME_DRAG_SENSITIVITY));
      }}
      onPointerUp={(event) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        event.preventDefault();
        resetDrag();
      }}
      onPointerCancel={(event) => {
        if (activePointerId !== event.pointerId) {
          return;
        }

        resetDrag();
      }}
      onLostPointerCapture={() => {
        resetDrag();
      }}
      onDblClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        props.onToggleMute();
      }}
    >
      <div class="absolute inset-0 border border-white/10 bg-black/12" />
      <div class="pointer-events-none absolute inset-x-0 bottom-1 flex justify-center">
        <div class="rounded-full border border-white/10 bg-black/55 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
          {volumeLabel()}
        </div>
      </div>
    </div>
  );
}

function RadioPlayer(props: {
  radioState: {
    currentTrackFileId?: Id<"files">;
    currentTrackUrl?: string;
    startedAt?: number;
    isPaused: boolean;
    pausePosition?: number;
  } | null;
  isConnected?: boolean;
  onTrackEnded?: () => void;
  volume: number;
  muted: boolean;
}) {
  let audioRef: HTMLAudioElement | undefined;
  const [autoplayBlocked, setAutoplayBlocked] = createSignal(false);
  const reportAudioDuration = useMutation(api.files.setAudioDuration);
  let lastAdvanceRequestKey: string | null = null;
  let lastAdvanceRequestAt = 0;

  const tryPlay = () => {
    if (!audioRef) return;
    const promise = audioRef.play();
    if (promise) {
      promise.then(() => setAutoplayBlocked(false)).catch(() => setAutoplayBlocked(true));
      return;
    }

    setAutoplayBlocked(false);
  };

  const seekToSync = () => {
    if (!audioRef || !props.radioState) return;
    const rs = props.radioState;
    if (rs.isPaused) {
      audioRef.currentTime = (rs.pausePosition ?? 0) / 1000;
      audioRef.pause();
    } else if (rs.startedAt) {
      audioRef.currentTime = Math.max(0, (Date.now() - rs.startedAt) / 1000);
      tryPlay();
    }
  };

  createEffect(() => {
    const rs = props.radioState;
    if (!audioRef) return;

    if (!rs?.currentTrackUrl) {
      audioRef.pause();
      audioRef.removeAttribute("src");
      audioRef.load();
      setAutoplayBlocked(false);
      return;
    }

    if (audioRef.src !== rs.currentTrackUrl || audioRef.ended) {
      audioRef.pause();
      audioRef.src = rs.currentTrackUrl;
      audioRef.load();

      const syncOnReady = () => seekToSync();
      audioRef.addEventListener("loadedmetadata", syncOnReady, { once: true });
      audioRef.addEventListener("canplay", syncOnReady, { once: true });

      queueMicrotask(() => {
        if (audioRef && audioRef.readyState >= HTMLMediaElement.HAVE_METADATA) {
          seekToSync();
        }
      });
    } else {
      seekToSync();
    }
  });

  createEffect(() => {
    const rs = props.radioState;
    const isConnected = props.isConnected;

    if (!audioRef || !isConnected || !rs?.currentTrackUrl || rs.isPaused) {
      return;
    }

    seekToSync();
  });

  createEffect(() => {
    const rs = props.radioState;
    const isConnected = props.isConnected;

    if (!audioRef || !isConnected || !rs?.currentTrackUrl || rs.isPaused) {
      return;
    }

    const resumeFromInteraction = () => {
      if (!audioRef || (!audioRef.paused && !autoplayBlocked())) {
        return;
      }

      seekToSync();
    };

    window.addEventListener("pointerdown", resumeFromInteraction, { passive: true });
    window.addEventListener("touchstart", resumeFromInteraction, { passive: true });
    window.addEventListener("keydown", resumeFromInteraction);

    onCleanup(() => {
      window.removeEventListener("pointerdown", resumeFromInteraction);
      window.removeEventListener("touchstart", resumeFromInteraction);
      window.removeEventListener("keydown", resumeFromInteraction);
    });
  });

  // Drift correction every 5s
  createEffect(() => {
    const rs = props.radioState;
    if (!rs || rs.isPaused || !rs.startedAt) return;

    const interval = setInterval(() => {
      if (!audioRef || audioRef.paused) return;
      const expected = Math.max(0, (Date.now() - rs.startedAt!) / 1000);
      if (Math.abs(audioRef.currentTime - expected) > 2) {
        audioRef.currentTime = expected;
      }
    }, 5000);

    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    const rs = props.radioState;
    if (!rs?.currentTrackFileId) {
      lastAdvanceRequestKey = null;
      lastAdvanceRequestAt = 0;
      return;
    }

    const trackKey = `${rs.currentTrackFileId}:${rs.startedAt ?? 0}`;
    if (lastAdvanceRequestKey !== trackKey) {
      lastAdvanceRequestKey = null;
      lastAdvanceRequestAt = 0;
    }
  });

  createEffect(() => {
    const rs = props.radioState;
    if (!audioRef || !rs?.currentTrackFileId || rs.isPaused) {
      return;
    }

    const interval = setInterval(() => {
      if (!audioRef?.ended) {
        return;
      }

      const trackKey = `${rs.currentTrackFileId}:${rs.startedAt ?? 0}`;
      const now = Date.now();
      if (lastAdvanceRequestKey === trackKey && now - lastAdvanceRequestAt < 3000) {
        return;
      }

      lastAdvanceRequestKey = trackKey;
      lastAdvanceRequestAt = now;
      props.onTrackEnded?.();
    }, 1000);

    onCleanup(() => clearInterval(interval));
  });

  createEffect(() => {
    if (!audioRef) {
      return;
    }

    audioRef.volume = clampRadioVolume(props.volume);
    audioRef.muted = props.muted;
  });

  return (
    <>
      {/* biome-ignore lint/a11y/useMediaCaption: hidden radio audio element has no captions */}
      <audio
        ref={audioRef}
        autoplay
        style={{ display: "none" }}
        preload="auto"
        playsInline
        onLoadedMetadata={() => {
          const fileId = props.radioState?.currentTrackFileId;
          if (
            !fileId ||
            !audioRef ||
            !Number.isFinite(audioRef.duration) ||
            audioRef.duration <= 0
          ) {
            return;
          }

          void reportAudioDuration.mutate({
            fileId,
            durationMs: Math.round(audioRef.duration * 1000),
          });
        }}
        onEnded={() => props.onTrackEnded?.()}
      />
    </>
  );
}

function CurrentlyPlayingOverlay(props: { trackName?: string }) {
  return (
    <div class="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
      <div class="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/80 backdrop-blur-sm">
        {props.trackName ?? "Now playing"}
      </div>
    </div>
  );
}

function NextTrackOverlay(props: { trackName?: string }) {
  return (
    <div class="absolute inset-x-0 bottom-1 flex justify-center pointer-events-none">
      <div class="rounded-full border border-white/10 bg-black/50 px-2.5 py-1 text-[9px] uppercase tracking-[0.16em] text-white/50 backdrop-blur-sm">
        Up next: {props.trackName ?? "—"}
      </div>
    </div>
  );
}

function applyCharacterVisual(
  spriteRef: HTMLDivElement | undefined,
  characterSprite: string | null | undefined,
  animationName: string | null | undefined,
  facing: CharacterFacing
) {
  if (!spriteRef) {
    return;
  }

  const animationUrl = getCharacterActionUrl(characterSprite, animationName);

  spriteRef.style.setProperty("transform", facing === "left" ? "scaleX(-1)" : "scaleX(1)");
  spriteRef.style.setProperty("opacity", animationUrl ? "1" : "0");

  if (animationUrl) {
    spriteRef.style.setProperty("background-image", `url(${animationUrl})`);
    return;
  }

  spriteRef.style.removeProperty("background-image");
}

function RemoteCharacterBody(props: {
  characterSprite: string | null;
  currentAnimation: string;
  facing: CharacterFacing;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
  actions: CharacterMovementAction[];
  lastProcessedSequence: number;
}) {
  let rootRef: HTMLDivElement | undefined;
  let spriteRef: HTMLDivElement | undefined;
  let lastQueuedSequence: number | null = null;
  let activeBatch: CharacterMovementAction[] | null = null;
  let activeBatchIndex = -1;
  let activeBatchStartedAt = 0;
  let activeBatchStartX = props.x;
  let activeBatchStartY = props.y;
  const pendingBatches: CharacterMovementAction[][] = [];
  let renderedX = props.x;
  let renderedY = props.y;

  const setPosition = (x: number, y: number) => {
    renderedX = x;
    renderedY = y;
    rootRef?.style.setProperty("transform", `translate3d(${x}px, ${y}px, 0)`);
  };

  const startNextBatch = (timestamp: number) => {
    const nextBatch = pendingBatches.shift();

    if (!nextBatch) {
      activeBatch = null;
      activeBatchIndex = -1;
      return;
    }

    activeBatch = nextBatch;
    activeBatchIndex = -1;
    activeBatchStartedAt = timestamp;
    activeBatchStartX = renderedX;
    activeBatchStartY = renderedY;
  };

  const setVisual = (animationName: string | null | undefined, facing: CharacterFacing) => {
    applyCharacterVisual(spriteRef, props.characterSprite, animationName, facing);
  };

  createEffect(() => {
    setVisual(props.currentAnimation, props.facing);
  });

  createEffect(() => {
    const currentSequence = props.lastProcessedSequence;

    if (lastQueuedSequence === null) {
      lastQueuedSequence = currentSequence;
      setPosition(props.x, props.y);
      setVisual(props.currentAnimation, props.facing);
      return;
    }

    if (currentSequence <= lastQueuedSequence) {
      return;
    }

    lastQueuedSequence = currentSequence;

    if (props.actions.length === 0) {
      setPosition(props.x, props.y);
      setVisual(props.currentAnimation, props.facing);
      return;
    }

    pendingBatches.push(props.actions.map((action) => ({ ...action })));
  });

  createGameLoop({
    fn: (timestamp) => {
      if (!rootRef) {
        return;
      }

      if (!activeBatch) {
        if (pendingBatches.length === 0) {
          return;
        }

        startNextBatch(timestamp);
      }

      const batch = activeBatch;

      if (!batch) {
        return;
      }

      if (batch.length === 0) {
        activeBatch = null;
        activeBatchIndex = -1;
        return;
      }

      const elapsed = Math.max(0, timestamp - activeBatchStartedAt);
      const lastAction = batch[batch.length - 1];

      while (
        activeBatch &&
        activeBatchIndex + 1 < activeBatch.length &&
        activeBatch[activeBatchIndex + 1].timeSinceBatchStart <= elapsed
      ) {
        activeBatchIndex += 1;
      }

      if (elapsed >= lastAction.timeSinceBatchStart) {
        setPosition(lastAction.x, lastAction.y);
        setVisual(lastAction.animationName, lastAction.facing);
        activeBatch = null;
        activeBatchIndex = -1;
        return;
      }

      const previousAction = activeBatchIndex >= 0 ? batch[activeBatchIndex] : null;
      const nextAction = batch[activeBatchIndex + 1];

      if (!nextAction) {
        activeBatch = null;
        activeBatchIndex = -1;
        return;
      }

      const startTime = previousAction?.timeSinceBatchStart ?? 0;
      const endTime = nextAction.timeSinceBatchStart;
      const duration = Math.max(1, endTime - startTime);
      const amount = Math.min(1, Math.max(0, (elapsed - startTime) / duration));
      const startX = previousAction?.x ?? activeBatchStartX;
      const startY = previousAction?.y ?? activeBatchStartY;

      setPosition(lerp(startX, nextAction.x, amount), lerp(startY, nextAction.y, amount));
      setVisual(
        previousAction?.animationName ?? nextAction.animationName,
        previousAction?.facing ?? nextAction.facing
      );
    },
  });

  return (
    <div
      ref={rootRef}
      class="absolute"
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
        ref={spriteRef}
        class="absolute inset-0 bg-center bg-no-repeat bg-size-[100%] [image-rendering:pixelated]"
        style={{
          "transform-origin": "center center",
        }}
      />
      <div class="absolute inset-x-0 top-35 flex justify-center">
        <div class="rounded-full border border-white/10 bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
          {props.label}
        </div>
      </div>
    </div>
  );
}

function CharacterBody(props: {
  characterSprite: string;
  currentAnimation: string;
  facing: CharacterFacing;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
  label: string;
}) {
  const animationUrl = createMemo(() =>
    getCharacterActionUrl(props.characterSprite, props.currentAnimation)
  );

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
      <Show when={animationUrl()}>
        {(url) => (
          <div
            class="absolute inset-0 bg-center bg-no-repeat bg-size-[100%] [image-rendering:pixelated]"
            style={{
              "background-image": `url(${url()})`,
              transform: props.facing === "left" ? "scaleX(-1)" : "scaleX(1)",
              "transform-origin": "center center",
            }}
          />
        )}
      </Show>
      <div class="absolute inset-x-0 flex justify-center top-35">
        <div class="rounded-full border border-white/10 bg-black/45 px-2 py-0.5 text-[10px] uppercase tracking-[0.18em] text-white/80 backdrop-blur-sm">
          {props.label}
        </div>
      </div>
    </div>
  );
}
