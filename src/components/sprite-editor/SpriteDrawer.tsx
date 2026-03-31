import { UploadButton } from '@uploadthing/solid';
import { useMutation, useQuery } from 'convex-solidjs';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { UploadRouter } from '~/server/uploadthing';
import DraggableSprite from './DraggableSprite';
import { SPRITE_CATALOG } from './spriteCatalog';

function getImageDimensions(url: string): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const image = new Image();
		image.onload = () =>
			resolve({
				width: image.naturalWidth,
				height: image.naturalHeight,
			});
		image.onerror = () => reject(new Error('Failed to load image'));
		image.src = url;
	});
}

function CatalogSpriteSync(props: { sprite: (typeof SPRITE_CATALOG)[number] }) {
	const cachedSprite = useQuery(api.sprites.getByUrl, () => ({ url: props.sprite.url }));
	const createSprite = useMutation(api.sprites.create);
	const [isCreating, setIsCreating] = createSignal(false);

	createEffect(() => {
		if (cachedSprite.isLoading() || cachedSprite.data() !== null || isCreating()) {
			return;
		}

		setIsCreating(true);
		void getImageDimensions(props.sprite.url)
			.then(({ width, height }) =>
				createSprite.mutate({
					key: props.sprite.key,
					url: props.sprite.url,
					width,
					height,
				}),
			)
			.finally(() => setIsCreating(false));
	});

	return null;
}

export default function SpriteDrawer(props: {
	open: boolean;
	onClose: () => void;
	onDragStateChange: (isDragging: boolean) => void;
}) {
	const sprites = useQuery(api.sprites.list, {});
	const createSprite = useMutation(api.sprites.create);
	const [errorMessage, setErrorMessage] = createSignal<string>();

	const sortedSprites = createMemo(() =>
		[...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key)),
	);

	const createSpriteFromUpload = async (file: { name: string; ufsUrl: string }) => {
		const { width, height } = await getImageDimensions(file.ufsUrl);
		const key = file.name.replace(/\.[^.]+$/, '');

		await createSprite.mutate({
			key,
			url: file.ufsUrl,
			width,
			height,
		});
	};

	return (
		<>
			<For each={SPRITE_CATALOG}>{(sprite) => <CatalogSpriteSync sprite={sprite} />}</For>

			<aside
				class="fixed right-0 top-0 z-40 flex h-screen w-[360px] max-w-[92vw] flex-col border-l border-white/10 bg-[#17110d]/95 text-white shadow-2xl transition-transform duration-200"
				style={{
					transform: props.open ? 'translateX(0)' : 'translateX(100%)',
				}}
			>
				<div class="flex justify-end px-5 pt-4">
					<button
						class="rounded-full border border-white/10 px-3 py-1 text-sm text-white/70 transition hover:bg-white/10"
						type="button"
						onClick={props.onClose}
					>
						Collapse
					</button>
				</div>

				<div class="border-b border-white/10 px-5 py-4">
					<UploadButton<UploadRouter>
						endpoint="imageUploader"
						class="ut-button:w-full ut-button:rounded-xl ut-button:border-0 ut-button:bg-[#f2bb55] ut-button:px-3 ut-button:py-2 ut-button:text-sm ut-button:font-semibold ut-button:text-[#2d190f] ut-button:transition ut-button:hover:brightness-105 ut-allowed-content:text-white/40"
						appearance={{
							container: 'w-full',
							button: 'w-full',
							allowedContent: 'hidden',
						}}
						content={{
							button({ isUploading }) {
								return isUploading() ? 'Uploading...' : 'Upload images';
							},
						}}
						onClientUploadComplete={async (files) => {
							try {
								setErrorMessage(undefined);
								await Promise.all(files.map(createSpriteFromUpload));
							} catch {
								setErrorMessage('sprite save fail');
							}
						}}
						onUploadError={() => {
							setErrorMessage('upload fail');
						}}
					/>
					<Show when={errorMessage()}>
						<div class="text-xs text-amber-200/90">{errorMessage()}</div>
					</Show>
				</div>

				<div class="flex-1 overflow-y-auto px-5 py-4">
					<Show when={!sprites.isLoading()} fallback={<div class="text-sm text-white/55">Loading sprites...</div>}>
						<div class="grid grid-cols-2 gap-3">
							<For each={sortedSprites()}>
								{(sprite) => (
									<DraggableSprite
										sprite={sprite}
										onDragStart={() => props.onDragStateChange(true)}
										onDragEnd={() => props.onDragStateChange(false)}
									/>
								)}
							</For>
						</div>
					</Show>
				</div>
			</aside>
		</>
	);
}
