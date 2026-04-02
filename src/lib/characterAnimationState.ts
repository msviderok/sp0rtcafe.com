import {
  getCharacterManifest,
  hasCharacterAction,
  type CharacterFacing,
} from "./characterCatalog";

export type ResolvedCharacterAnimationState = {
  facing: CharacterFacing;
  isRunning: boolean;
  manualActionName: string | null;
  currentAnimation: string;
};

export function resolveCharacterAnimationState(args: {
  characterId: string | null | undefined;
  grounded: boolean;
  manualActionName: string | null;
  previousFacing: CharacterFacing;
  velocityX: number;
  wantsRun: boolean;
}) {
  const manifest = getCharacterManifest(args.characterId);
  const facing: CharacterFacing =
    args.velocityX < 0 ? "left" : args.velocityX > 0 ? "right" : args.previousFacing;
  const idleAnimation =
    manifest?.canonicalAnimations.idle ?? manifest?.actions[0]?.name ?? "Idle";
  const hasHorizontalMovement = Math.abs(args.velocityX) > 0.5;

  if (
    args.manualActionName &&
    hasCharacterAction(args.characterId, args.manualActionName)
  ) {
    return {
      currentAnimation: args.manualActionName,
      facing,
      isRunning: false,
      manualActionName: args.manualActionName,
    } satisfies ResolvedCharacterAnimationState;
  }

  if (!args.grounded && manifest?.canonicalAnimations.jump) {
    return {
      currentAnimation: manifest.canonicalAnimations.jump,
      facing,
      isRunning: false,
      manualActionName: null,
    } satisfies ResolvedCharacterAnimationState;
  }

  if (hasHorizontalMovement && args.wantsRun && manifest?.canonicalAnimations.run) {
    return {
      currentAnimation: manifest.canonicalAnimations.run,
      facing,
      isRunning: true,
      manualActionName: null,
    } satisfies ResolvedCharacterAnimationState;
  }

  if (hasHorizontalMovement && manifest?.canonicalAnimations.walk) {
    return {
      currentAnimation: manifest.canonicalAnimations.walk,
      facing,
      isRunning: false,
      manualActionName: null,
    } satisfies ResolvedCharacterAnimationState;
  }

  return {
    currentAnimation: idleAnimation,
    facing,
    isRunning: false,
    manualActionName: null,
  } satisfies ResolvedCharacterAnimationState;
}
