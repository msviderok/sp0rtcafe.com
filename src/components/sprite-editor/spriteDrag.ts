import type { Id } from '../../../convex/_generated/dataModel';

export const DRAWER_SPRITE_DRAG_TYPE = 'drawer-sprite';

export type DrawerSprite = {
	_id: Id<'sprites'>;
	key: string;
	url: string;
	kind?: 'image' | 'text';
	text?: string;
	width: number;
	height: number;
	bgRepeat?: string;
	bgPosition?: string;
	bgSize?: string;
};

export type DrawerSpriteDragData = {
	kind: 'drawer-sprite';
	spriteId: Id<'sprites'>;
	sprite: DrawerSprite;
};

export function isDrawerSpriteDragData(value: unknown): value is DrawerSpriteDragData {
	return typeof value === 'object' && value !== null && (value as { kind?: unknown }).kind === 'drawer-sprite';
}
