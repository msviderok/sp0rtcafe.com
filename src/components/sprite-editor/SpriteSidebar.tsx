import { useMutation, useQuery } from 'convex-solidjs';
import { future_genUploader } from 'uploadthing/client-future';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { api } from '../../../convex/_generated/api';
import type { UploadRouter } from '~/server/uploadthing';
import DraggableSprite from './DraggableSprite';

const uploadThing = future_genUploader<UploadRouter>({
	url: '/api/uploadthing',
});

function getFileFingerprint(file: Pick<File, 'name' | 'size' | 'lastModified'>) {
	return `${file.name}:${file.size}:${file.lastModified}`;
}

function getFileDimensions(file: File): Promise<{ width: number; height: number }> {
	return new Promise((resolve, reject) => {
		const objectUrl = URL.createObjectURL(file);
		const image = new Image();
		image.onload = () => {
			URL.revokeObjectURL(objectUrl);
			resolve({
				width: image.naturalWidth,
				height: image.naturalHeight,
			});
		};
		image.onerror = () => {
			URL.revokeObjectURL(objectUrl);
			reject(new Error('Failed to read image dimensions'));
		};
		image.src = objectUrl;
	});
}

function compactUploadRecord(record: {
	uploadThingKey: string;
	fileName: string;
	status: 'pending' | 'uploading' | 'uploaded' | 'failed';
	progress: number;
	url?: string;
	size?: number;
	mimeType?: string;
	uploadedAt?: number;
	width?: number;
	height?: number;
	error?: string;
}) {
	return {
		uploadThingKey: record.uploadThingKey,
		fileName: record.fileName,
		status: record.status,
		progress: record.progress,
		...(record.url !== undefined ? { url: record.url } : {}),
		...(record.size !== undefined ? { size: record.size } : {}),
		...(record.mimeType !== undefined ? { mimeType: record.mimeType } : {}),
		...(record.uploadedAt !== undefined ? { uploadedAt: record.uploadedAt } : {}),
		...(record.width !== undefined ? { width: record.width } : {}),
		...(record.height !== undefined ? { height: record.height } : {}),
		...(record.error !== undefined ? { error: record.error } : {}),
	};
}

export default function SpriteSidebar() {
	const sprites = useQuery(api.sprites.list, {});
	const syncFiles = useMutation(api.files.upsertUploadThingFiles);
	const syncUploadedSprites = useMutation(api.files.syncUploadedImagesToSprites);
	const activeUploads = useQuery(api.files.listActiveUploads, {});
	const [errorMessage, setErrorMessage] = createSignal<string>();
	const [isUploading, setIsUploading] = createSignal(false);
	let fileInputRef: HTMLInputElement | undefined;

	const sortedSprites = createMemo(() =>
		[...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key)),
	);
	const visibleUploads = createMemo(() => activeUploads.data() ?? []);

	onMount(() => {
		void syncUploadedSprites.mutate({ limit: 200 });
	});

	const syncUploadBatch = async (
		files: Array<{
			uploadThingKey: string;
			fileName: string;
			status: 'pending' | 'uploading' | 'uploaded' | 'failed';
			progress: number;
			url?: string;
			size?: number;
			mimeType?: string;
			uploadedAt?: number;
			width?: number;
			height?: number;
			error?: string;
		}>,
	) => {
		if (files.length === 0) {
			return;
		}

		await syncFiles.mutate({
			files: files.map(compactUploadRecord),
			createSprites: true,
		});
	};

	const handleFileSelection = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];

		if (files.length === 0) {
			return;
		}

		const imageFiles = files.filter((file) => file.type.startsWith('image/'));
		if (imageFiles.length !== files.length) {
			setErrorMessage('images only');
			input.value = '';
			return;
		}

		setErrorMessage(undefined);
		setIsUploading(true);

		try {
			const imageMetadata = new Map<string, { width: number; height: number }>();
			await Promise.all(
				imageFiles.map(async (file) => {
					imageMetadata.set(getFileFingerprint(file), await getFileDimensions(file));
				}),
			);

			const lastSyncedProgress = new Map<string, number>();

			await uploadThing.uploadFiles('imageUploader', {
				files: imageFiles,
				onEvent: (uploadEvent) => {
					if (uploadEvent.type === 'presigned-received') {
						void syncUploadBatch(
							uploadEvent.files
								.filter((file) => file.key)
								.map((file) => {
									const metadata = imageMetadata.get(getFileFingerprint(file));

									return {
										uploadThingKey: file.key!,
										fileName: file.name,
										status: 'pending' as const,
										progress: 0,
										size: file.size,
										mimeType: file.type || undefined,
										width: metadata?.width,
										height: metadata?.height,
									};
								}),
						);
						return;
					}

					if (uploadEvent.type === 'upload-started') {
						const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
						void syncUploadBatch([
							{
								uploadThingKey: uploadEvent.file.key,
								fileName: uploadEvent.file.name,
								status: 'uploading',
								progress: 0,
								size: uploadEvent.file.size,
								mimeType: uploadEvent.file.type || undefined,
								width: metadata?.width,
								height: metadata?.height,
							},
						]);
						return;
					}

					if (uploadEvent.type === 'upload-progress') {
						const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
						const nextProgress = Math.min(
							99,
							Math.max(1, Math.round((uploadEvent.file.sent / uploadEvent.file.size) * 100)),
						);
						const previousProgress = lastSyncedProgress.get(uploadEvent.file.key) ?? -1;

						if (nextProgress - previousProgress < 5 && nextProgress !== 99) {
							return;
						}

						lastSyncedProgress.set(uploadEvent.file.key, nextProgress);
						void syncUploadBatch([
							{
								uploadThingKey: uploadEvent.file.key,
								fileName: uploadEvent.file.name,
								status: 'uploading',
								progress: nextProgress,
								size: uploadEvent.file.size,
								mimeType: uploadEvent.file.type || undefined,
								width: metadata?.width,
								height: metadata?.height,
							},
						]);
						return;
					}

					if (uploadEvent.type === 'upload-completed') {
						const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
						void syncUploadBatch([
							{
								uploadThingKey: uploadEvent.file.key,
								fileName: uploadEvent.file.name,
								status: 'uploaded',
								progress: 100,
								url: uploadEvent.file.url,
								size: uploadEvent.file.size,
								mimeType: uploadEvent.file.type || undefined,
								uploadedAt: Date.now(),
								width: metadata?.width,
								height: metadata?.height,
							},
						]);
						return;
					}

					if (uploadEvent.type === 'upload-failed') {
						const metadata = imageMetadata.get(getFileFingerprint(uploadEvent.file));
						void syncUploadBatch([
							{
								uploadThingKey: uploadEvent.file.key,
								fileName: uploadEvent.file.name,
								status: 'failed',
								progress:
									uploadEvent.file.size > 0 ? Math.round((uploadEvent.file.sent / uploadEvent.file.size) * 100) : 0,
								size: uploadEvent.file.size,
								mimeType: uploadEvent.file.type || undefined,
								width: metadata?.width,
								height: metadata?.height,
								error: uploadEvent.file.reason.message,
							},
						]);
						setErrorMessage('upload fail');
						return;
					}

					if (uploadEvent.type === 'upload-aborted') {
						void syncUploadBatch(
							uploadEvent.files
								.filter((file) => file.key)
								.map((file) => {
									const metadata = imageMetadata.get(getFileFingerprint(file));

									return {
										uploadThingKey: file.key!,
										fileName: file.name,
										status: 'failed' as const,
										progress: file.size > 0 ? Math.round((file.sent / file.size) * 100) : 0,
										size: file.size,
										mimeType: file.type || undefined,
										width: metadata?.width,
										height: metadata?.height,
										error: 'upload aborted',
									};
								}),
						);
						setErrorMessage('upload aborted');
					}
				},
			});
		} catch {
			setErrorMessage('upload fail');
		} finally {
			setIsUploading(false);
			input.value = '';
		}
	};

	return (
		<aside class="fixed right-0 top-0 z-40 flex h-screen w-20 flex-col border-l border-border bg-background/80 backdrop-blur-sm">
			<div class="flex-1 overflow-y-auto overflow-x-hidden p-2">
				<Show when={!sprites.isLoading()} fallback={<div class="p-2 text-xs text-muted-foreground">...</div>}>
					<div class="flex flex-wrap gap-1">
						<For each={sortedSprites()}>{(sprite) => <DraggableSprite sprite={sprite} />}</For>
					</div>
				</Show>

				<Show when={visibleUploads().length > 0}>
					<div class="mt-2 space-y-1 px-1">
						<For each={visibleUploads()}>
							{(file) => (
								<div class="relative h-12 w-12 rounded-lg bg-muted" title={file.fileName}>
									<div
										class="absolute inset-x-0 bottom-0 h-1 rounded-b-lg bg-primary transition-[width] duration-150"
										style={{ width: `${file.progress}%` }}
									/>
									<Show when={file.status === 'failed'}>
										<div class="flex h-full items-center justify-center text-[10px] text-destructive">!</div>
									</Show>
								</div>
							)}
						</For>
					</div>
				</Show>
			</div>

			<div class="border-t border-border p-2">
				<input
					ref={fileInputRef}
					class="hidden"
					type="file"
					accept="image/*"
					multiple
					onChange={handleFileSelection}
				/>
				<button
					class="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-muted-foreground/30 text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
					type="button"
					title={isUploading() ? 'Uploading...' : 'Upload images'}
					disabled={isUploading()}
					onClick={() => fileInputRef?.click()}
				>
					<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
				</button>
				<Show when={errorMessage()}>
					<div class="mt-1 text-[10px] leading-tight text-destructive">{errorMessage()}</div>
				</Show>
			</div>
		</aside>
	);
}
