export type DndDebugSnapshot = {
	lastEvent?: string;
	activeSpriteKey?: string;
	sourceId?: string;
	sceneId?: string;
	spritePointer?: string;
	hookDragging?: string;
	canvasInside?: boolean;
	pointer?: string;
	drop?: string;
};

export type DndDebugReporter = (event: string, detail?: string) => void;
export type DndDebugSnapshotReporter = (snapshot: DndDebugSnapshot) => void;
