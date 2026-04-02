const AUTO_ANIMATION_NAMES = ["idle", "walk", "run", "jump"] as const;

export type CharacterFacing = "left" | "right";
export type CharacterAutoAnimationName = (typeof AUTO_ANIMATION_NAMES)[number];

export type CharacterActionManifest = {
  name: string;
  normalizedName: string;
  label: string;
  isAuto: boolean;
  isQuickAction: boolean;
};

export type CharacterManifest = {
  id: string;
  label: string;
  animationCount: number;
  actions: CharacterActionManifest[];
  canonicalAnimations: Partial<Record<CharacterAutoAnimationName, string>>;
  quickActionNames: string[];
  hasRun: boolean;
  hasJump: boolean;
  isPlayable: boolean;
};

export const RAW_CHARACTER_ANIMATION_FILES = {
  Archer: [
    "Attack_1",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Shot_1",
    "Shot_2",
    "Walk",
  ],
  Black_Werewolf: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "walk",
  ],
  Blue_Slime: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "walk",
  ],
  City_men_1: ["Attack", "Dead", "Hurt", "Idle", "Run", "Walk"],
  City_men_2: ["Attack", "Dead", "Hurt", "Idle", "Run", "Walk"],
  City_men_3: ["Attack", "Dead", "Hurt", "Idle", "Run", "Walk"],
  Converted_Vampire: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Protect",
    "Run",
    "Walk",
  ],
  Countess_Vampire: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Destroyer: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Enabling",
    "Hurt",
    "Idle",
    "Shot_1",
    "Shot_2",
    "Shutdown",
    "Walk",
  ],
  Enchantress: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Fighter: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Shield",
    "Walk",
  ],
  Fire_Spirit: [
    "Attack",
    "Dead",
    "Explosion",
    "Flame",
    "Hurt",
    "Idle",
    "Idle_2",
    "Run",
    "Shot",
    "Walk",
  ],
  Gangsters_1: [
    "Attack_1",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Recharge",
    "Run",
    "Shot",
    "Walk",
  ],
  Gangsters_2: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Gangsters_3: [
    "Attack",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Recharge",
    "Run",
    "Shot",
    "Walk",
  ],
  Girl_1: ["Attack", "Dialogue", "Idle", "Protection", "Walk"],
  Girl_2: ["Attack", "Dialogue", "Idle", "Protection", "Walk"],
  Girl_3: ["Attack", "Dialogue", "Idle", "Protection", "Walk"],
  Gorgon_1: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Run",
    "Special",
    "Walk",
  ],
  Gorgon_2: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Run",
    "Special",
    "Walk",
  ],
  Gorgon_3: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Run",
    "Special",
    "Walk",
  ],
  Gotoku: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Scream",
    "Walk",
  ],
  Green_Slime: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Homeless_1: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Special",
    "Walk",
  ],
  Homeless_2: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Homeless_3: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Special",
    "Walk",
  ],
  Infantryman: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Enabling",
    "Hurt",
    "Idle",
    "Shot_1",
    "Shot_2",
    "Shutdown",
    "Walk",
  ],
  Karasu_tengu: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Kitsune: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Knight: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Minotaur_1: ["Attack", "Dead", "Hurt", "Idle", "Walk"],
  Minotaur_2: ["Attack", "Dead", "Hurt", "Idle", "Walk"],
  Minotaur_3: ["Attack", "Dead", "Hurt", "Idle", "Walk"],
  Musketeer: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Onre: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Flight",
    "Hurt",
    "Idle",
    "Run",
    "Scream",
    "Walk",
  ],
  Orc_Berserk: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Orc_Shaman: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Magic_1",
    "Magic_2",
    "Run",
    "Walk",
  ],
  Orc_Warrior: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Plent: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_Disquise",
    "Cloud_posion",
    "Dead",
    "Disguise",
    "Hurt",
    "Idle",
    "Poison",
    "Walk",
  ],
  Raider_1: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Recharge",
    "Run",
    "Shot",
    "Walk",
  ],
  Raider_2: [
    "Attack",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Recharge",
    "Run",
    "Shot_1",
    "Shot_2",
    "Walk",
  ],
  Raider_3: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Red_Slime: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Red_Werewolf: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Samurai: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Protection",
    "Run",
    "Walk",
  ],
  Samurai_2: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Shield",
    "Walk",
  ],
  Samurai_Archer: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Shot",
    "Walk",
  ],
  Samurai_Commander: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Protect",
    "Run",
    "Walk",
  ],
  Satyr_1: ["Attack", "Charge", "Dead", "Hurt", "Idle", "Walk"],
  Satyr_2: ["Attack", "Charge", "Dead", "Hurt", "Idle", "Walk"],
  Satyr_3: ["Attack", "Dead", "Hurt", "Idle", "Walk"],
  Shinobi: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Shield",
    "Walk",
  ],
  Skeleton: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Special_attack",
    "Walk",
  ],
  Swordsman: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Enabling",
    "Hurt",
    "Idle",
    "Pick_Up",
    "Shutdown",
  ],
  Swordsman_2: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Trader_1: ["Approval", "Dialogue", "Idle", "Idle_2", "Idle_3"],
  Trader_2: ["Approval", "Dialogue", "Idle", "Idle_2", "Idle_3"],
  Trader_3: ["Approval", "Dialogue", "Idle", "Idle_2", "Idle_3"],
  Vampire_Girl: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Warrior_1: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Warrior_2: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Protect",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  Warrior_3: [
    "Attack_1",
    "Attack_2",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Protect",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  White_Werewolf: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Run+Attack",
    "Walk",
  ],
  "Wild Zombie": [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Eating",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  Wizard: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Yamabushi_tengu: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Idle_2",
    "Jump",
    "Run",
    "Walk",
  ],
  Yurei: [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Attack_4",
    "Dead",
    "Hurt",
    "Idle",
    "Run",
    "Scream",
    "Walk",
  ],
  "Zombie Man": [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Bite",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Walk",
  ],
  "Zombie Woman": [
    "Attack_1",
    "Attack_2",
    "Attack_3",
    "Dead",
    "Hurt",
    "Idle",
    "Jump",
    "Run",
    "Scream",
    "Walk",
  ],
} as const;

export type KnownCharacterId = keyof typeof RAW_CHARACTER_ANIMATION_FILES;

export function normalizeCharacterActionName(name: string) {
  return name.trim().toLowerCase();
}

export function humanizeCharacterName(name: string) {
  return name.replace(/_/g, " ");
}

export function humanizeCharacterActionName(name: string) {
  return name
    .replace(/[+_]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\s+/g, " ")
    .trim();
}

export function isAutoCharacterActionName(name: string) {
  return AUTO_ANIMATION_NAMES.includes(
    normalizeCharacterActionName(name) as CharacterAutoAnimationName,
  );
}

function resolveCanonicalAnimations(names: readonly string[]) {
  const canonical: Partial<Record<CharacterAutoAnimationName, string>> = {};

  for (const name of names) {
    const normalizedName = normalizeCharacterActionName(name);
    if (AUTO_ANIMATION_NAMES.includes(normalizedName as CharacterAutoAnimationName)) {
      canonical[normalizedName as CharacterAutoAnimationName] = name;
    }
  }

  return canonical;
}

function createCharacterManifest(id: KnownCharacterId): CharacterManifest {
  const names = RAW_CHARACTER_ANIMATION_FILES[id];
  const canonicalAnimations = resolveCanonicalAnimations(names);
  const actions = names.map((name) => {
    const normalizedName = normalizeCharacterActionName(name);
    const isAuto = isAutoCharacterActionName(name);

    return {
      name,
      normalizedName,
      label: humanizeCharacterActionName(name),
      isAuto,
      isQuickAction: !isAuto,
    } satisfies CharacterActionManifest;
  });

  return {
    id,
    label: humanizeCharacterName(id),
    animationCount: names.length,
    actions,
    canonicalAnimations,
    quickActionNames: actions
      .filter((action) => action.isQuickAction)
      .map((action) => action.name),
    hasRun: canonicalAnimations.run !== undefined,
    hasJump: canonicalAnimations.jump !== undefined,
    isPlayable: canonicalAnimations.idle !== undefined && canonicalAnimations.walk !== undefined,
  };
}

export const CHARACTER_CATALOG = (Object.keys(RAW_CHARACTER_ANIMATION_FILES) as KnownCharacterId[])
  .sort((left, right) => left.localeCompare(right))
  .map((id) => createCharacterManifest(id));

const CHARACTER_CATALOG_BY_ID = new Map(
  CHARACTER_CATALOG.map((character) => [character.id, character]),
);

export const PLAYABLE_CHARACTER_CATALOG = CHARACTER_CATALOG.filter((character) => character.isPlayable);
export const PLAYABLE_CHARACTER_IDS = PLAYABLE_CHARACTER_CATALOG.map((character) => character.id);
export const DEFAULT_PLAYABLE_CHARACTER_ID = PLAYABLE_CHARACTER_IDS[0] ?? "Archer";

export function isKnownCharacterId(value: string | null | undefined): value is KnownCharacterId {
  return value !== null && value !== undefined && CHARACTER_CATALOG_BY_ID.has(value);
}

export function isPlayableCharacterId(value: string | null | undefined) {
  if (!isKnownCharacterId(value)) {
    return false;
  }

  return CHARACTER_CATALOG_BY_ID.get(value)?.isPlayable === true;
}

export function getCharacterManifest(characterId: string | null | undefined) {
  if (!characterId || !isKnownCharacterId(characterId)) {
    return null;
  }

  return CHARACTER_CATALOG_BY_ID.get(characterId) ?? null;
}

export function getPlayableCharacterManifest(characterId: string | null | undefined) {
  const character = getCharacterManifest(characterId);
  if (!character?.isPlayable) {
    return null;
  }

  return character;
}

export function getDefaultPlayableCharacterId() {
  return DEFAULT_PLAYABLE_CHARACTER_ID;
}

export function getRandomPlayableCharacterId() {
  const randomIndex = Math.floor(Math.random() * PLAYABLE_CHARACTER_IDS.length);
  return PLAYABLE_CHARACTER_IDS[randomIndex] ?? DEFAULT_PLAYABLE_CHARACTER_ID;
}

export function getCanonicalCharacterAnimationName(
  characterId: string | null | undefined,
  kind: CharacterAutoAnimationName,
) {
  return getCharacterManifest(characterId)?.canonicalAnimations[kind] ?? null;
}

export function getCharacterQuickActionNames(characterId: string | null | undefined) {
  return getCharacterManifest(characterId)?.quickActionNames ?? [];
}

export function hasCharacterAction(
  characterId: string | null | undefined,
  actionName: string | null | undefined,
) {
  if (!actionName) {
    return false;
  }

  const normalizedActionName = normalizeCharacterActionName(actionName);
  return (
    getCharacterManifest(characterId)?.actions.some(
      (action) => action.normalizedName === normalizedActionName,
    ) ?? false
  );
}
