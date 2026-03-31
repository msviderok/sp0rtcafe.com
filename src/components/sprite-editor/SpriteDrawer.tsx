import { useMutation, useQuery } from 'convex-solidjs';
import { future_genUploader } from 'uploadthing/client-future';
import { createEffect, createMemo, createSignal, For, Show } from 'solid-js';
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

export default function SpriteDrawer(props: { open: boolean; onClose: () => void }) {
	const sprites = useQuery(api.sprites.list, {});
	const syncFiles = useMutation(api.files.upsertUploadThingFiles);
	const syncUploadedSprites = useMutation(api.files.syncUploadedImagesToSprites);
	const activeUploads = useQuery(api.files.listActiveUploads, {});
	const [errorMessage, setErrorMessage] = createSignal<string>();
	const [isUploading, setIsUploading] = createSignal(false);
	const [didBackfillSprites, setDidBackfillSprites] = createSignal(false);
	let fileInputRef: HTMLInputElement | undefined;

	const sortedSprites = createMemo(() =>
		[...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key)),
	);
	const visibleUploads = createMemo(() => activeUploads.data() ?? []);

	createEffect(() => {
		if (!props.open || didBackfillSprites()) {
			return;
		}

		setDidBackfillSprites(true);
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
		<>
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
					<input
						ref={fileInputRef}
						class="hidden"
						type="file"
						accept="image/*"
						multiple
						onChange={handleFileSelection}
					/>
					<button
						class="w-full rounded-xl border-0 bg-[#f2bb55] px-3 py-2 text-sm font-semibold text-[#2d190f] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-70"
						type="button"
						disabled={isUploading()}
						onClick={() => fileInputRef?.click()}
					>
						{isUploading() ? 'Uploading...' : 'Upload images'}
					</button>
					<Show when={errorMessage()}>
						<div class="text-xs text-amber-200/90">{errorMessage()}</div>
					</Show>
					<Show when={visibleUploads().length > 0}>
						<div class="mt-3 space-y-2">
							<For each={visibleUploads()}>
								{(file) => (
									<div class="rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs text-white/70">
										<div class="flex items-center justify-between gap-3">
											<div class="truncate text-white/90">{file.fileName}</div>
											<div>{file.status === 'failed' ? 'failed' : `${file.progress}%`}</div>
										</div>
										<Show when={file.status !== 'failed'}>
											<div class="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
												<div
													class="h-full rounded-full bg-[#f2bb55] transition-[width] duration-150"
													style={{ width: `${file.progress}%` }}
												/>
											</div>
										</Show>
										<Show when={file.error}>
											<div class="mt-2 truncate text-[11px] text-amber-200/80">{file.error}</div>
										</Show>
									</div>
								)}
							</For>
						</div>
					</Show>
				</div>

				<div class="flex-1 overflow-y-auto px-5 py-4">
					<Show when={!sprites.isLoading()} fallback={<div class="text-sm text-white/55">Loading sprites...</div>}>
						<div class="grid grid-cols-2 gap-3">
							<For each={sortedSprites()}>{(sprite) => <DraggableSprite sprite={sprite} />}</For>
						</div>
					</Show>
				</div>
			</aside>
		</>
	);
}
