import {
  CHARACTER_CATALOG,
  getCharacterManifest,
  type CharacterManifest,
} from "./characterCatalog";

const characterAnimationModules = import.meta.glob("../sprites/characters_animated/*/*.gif", {
  eager: true,
  import: "default",
}) as Record<string, string>;

export type CharacterActionWithUrl = CharacterManifest["actions"][number] & {
  url: string;
};

export type CharacterManifestWithUrls = Omit<CharacterManifest, "actions"> & {
  actions: CharacterActionWithUrl[];
  previewUrl: string | null;
};

function resolveCharacterAnimationPath(path: string) {
  const match = path.match(/characters_animated\/(.+?)\/([^/]+)\.gif$/);
  if (!match) {
    return null;
  }

  return {
    characterId: match[1],
    actionName: match[2],
  };
}

const characterAnimationUrlMap = new Map<string, string>();

for (const [path, url] of Object.entries(characterAnimationModules)) {
  const parsed = resolveCharacterAnimationPath(path);
  if (!parsed) {
    continue;
  }

  characterAnimationUrlMap.set(`${parsed.characterId}::${parsed.actionName}`, url);
}

function resolveAnimationUrl(characterId: string, actionName: string) {
  return characterAnimationUrlMap.get(`${characterId}::${actionName}`) ?? null;
}

export function getCharacterAnimationUrl(
  characterId: string | null | undefined,
  actionName: string | null | undefined,
) {
  if (!characterId || !actionName) {
    return null;
  }

  return resolveAnimationUrl(characterId, actionName);
}

function decorateCharacterManifest(character: CharacterManifest): CharacterManifestWithUrls {
  const previewUrl =
    resolveAnimationUrl(character.id, character.canonicalAnimations.idle ?? "") ??
    resolveAnimationUrl(character.id, character.actions[0]?.name ?? "") ??
    null;

  return {
    ...character,
    actions: character.actions
      .map((action) => {
        const url = resolveAnimationUrl(character.id, action.name);
        if (!url) {
          return null;
        }

        return {
          ...action,
          url,
        } satisfies CharacterActionWithUrl;
      })
      .filter((action) => action !== null),
    previewUrl,
  };
}

export const CHARACTER_CATALOG_WITH_URLS = CHARACTER_CATALOG.map(decorateCharacterManifest);

const CHARACTER_CATALOG_WITH_URLS_BY_ID = new Map(
  CHARACTER_CATALOG_WITH_URLS.map((character) => [character.id, character]),
);

export const PLAYABLE_CHARACTER_CATALOG_WITH_URLS = CHARACTER_CATALOG_WITH_URLS.filter(
  (character) => character.isPlayable,
);

export function getCharacterManifestWithUrls(characterId: string | null | undefined) {
  if (!characterId) {
    return null;
  }

  return CHARACTER_CATALOG_WITH_URLS_BY_ID.get(characterId) ?? null;
}

export function getPlayableCharacterManifestWithUrls(characterId: string | null | undefined) {
  const manifest = getCharacterManifestWithUrls(characterId);
  if (!manifest?.isPlayable) {
    return null;
  }

  return manifest;
}

export function getCharacterActionUrl(
  characterId: string | null | undefined,
  actionName: string | null | undefined,
) {
  if (!characterId || !actionName) {
    return null;
  }

  const manifest = getCharacterManifest(characterId);
  if (!manifest) {
    return null;
  }

  return resolveAnimationUrl(manifest.id, actionName);
}
