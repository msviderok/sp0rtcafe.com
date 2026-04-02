import { useMutation, useQuery } from 'convex-solidjs';
import { createMemo, createSignal, For, onMount, Show } from 'solid-js';
import { future_genUploader } from 'uploadthing/client-future';
import type { UploadRouter } from '~/server/uploadthing';
import { api } from '../../../convex/_generated/api';
import type { Id } from '../../../convex/_generated/dataModel';
import DraggableSprite from './DraggableSprite';
import GridSizeControl from './GridSizeControl';

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

export default function SpriteSidebar(props: {
	scenes: Array<{
		_id: Id<'scenes'>;
		name: string;
		width: number;
		height: number;
		isDefault?: boolean;
	}>;
	isOpen: boolean;
	selectedSceneId?: Id<'scenes'>;
	sceneName: string;
	createName: string;
	gridSize: number;
	showGrid: boolean;
	onOpenChange: (value: boolean) => void;
	onGridSizeChange: (value: number) => void;
	onGridSizeCommit?: (value: number) => void;
	onToggleGrid: () => void;
	onSelectScene: (sceneId: Id<'scenes'>) => void;
	onSceneNameChange: (value: string) => void;
	onCreateNameChange: (value: string) => void;
	onCreateScene: () => void;
	onRenameScene: () => void;
	onSetDefaultScene: () => void;
	onDeleteScene: () => void;
}) {
	const sprites = useQuery(api.sprites.list, {});
	const syncFiles = useMutation(api.files.upsertUploadThingFiles);
	const syncUploadedSprites = useMutation(api.files.syncUploadedImagesToSprites);
	const activeUploads = useQuery(api.files.listActiveUploads, {});
	const audioFiles = useQuery(api.files.listAudio, {});
	const radioState = useQuery(api.radio.getStateWithFiles, {});
	const setRadioTrack = useMutation(api.radio.setTrack);
	const pauseRadio = useMutation(api.radio.pause);
	const resumeRadio = useMutation(api.radio.resume);
	const [errorMessage, setErrorMessage] = createSignal<string>();
	const [audioErrorMessage, setAudioErrorMessage] = createSignal<string>();
	const [isUploading, setIsUploading] = createSignal(false);
	const [isUploadingAudio, setIsUploadingAudio] = createSignal(false);
	const [isScenesSectionOpen, setIsScenesSectionOpen] = createSignal(false);
	const [isAssetsSectionOpen, setIsAssetsSectionOpen] = createSignal(true);
	const [isAudioSectionOpen, setIsAudioSectionOpen] = createSignal(false);
	let fileInputRef: HTMLInputElement | undefined;
	let audioFileInputRef: HTMLInputElement | undefined;

	const sortedSprites = createMemo(() =>
		[...(sprites.data() ?? [])].sort((left, right) => left.key.localeCompare(right.key)),
	);
	const visibleUploads = createMemo(() => activeUploads.data() ?? []);
	const selectedScene = createMemo(() => props.scenes.find((scene) => scene._id === props.selectedSceneId) ?? null);

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

	const handleAudioFileSelection = async (event: Event) => {
		const input = event.currentTarget as HTMLInputElement;
		const files = [...(input.files ?? [])];

		if (files.length === 0) {
			return;
		}

		const audioFilesSelected = files.filter(
			(file) => file.type.startsWith('audio/') || /\.(mp3|ogg|wav|aac)$/i.test(file.name),
		);
		if (audioFilesSelected.length !== files.length) {
			setAudioErrorMessage('audio files only');
			input.value = '';
			return;
		}

		setAudioErrorMessage(undefined);
		setIsUploadingAudio(true);

		try {
			await uploadThing.uploadFiles('audioUploader', {
				files: audioFilesSelected,
				onEvent: (uploadEvent) => {
					if (uploadEvent.type === 'presigned-received') {
						void syncUploadBatch(
							uploadEvent.files
								.filter((file) => file.key)
								.map((file) => ({
									uploadThingKey: file.key!,
									fileName: file.name,
									status: 'pending' as const,
									progress: 0,
									size: file.size,
									mimeType: file.type || undefined,
								})),
						);
					} else if (uploadEvent.type === 'upload-completed') {
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
							},
						]);
					} else if (uploadEvent.type === 'upload-failed') {
						void syncUploadBatch([
							{
								uploadThingKey: uploadEvent.file.key,
								fileName: uploadEvent.file.name,
								status: 'failed',
								progress: 0,
								size: uploadEvent.file.size,
								mimeType: uploadEvent.file.type || undefined,
								error: uploadEvent.file.reason.message,
							},
						]);
						setAudioErrorMessage('upload fail');
					}
				},
			});
		} catch {
			setAudioErrorMessage('upload fail');
		} finally {
			setIsUploadingAudio(false);
			input.value = '';
		}
	};

	return (
		<aside
			class={`flex min-h-80 min-w-0 shrink-0 flex-col overflow-hidden border-r border-border transition-[width] duration-300 ease-in-out xl:sticky xl:top-6 xl:h-[calc(100vh-3rem)] ${props.isOpen ? 'w-full xl:w-72' : 'w-10'}`}
			onKeyDown={(e) => e.key === 'Escape' && props.onOpenChange(false)}
		>
			{/* Collapsed strip */}
			<Show when={!props.isOpen}>
				<button
					class="flex h-full min-h-80 w-full cursor-pointer items-center justify-center text-[11px] uppercase tracking-[0.22em] text-muted-foreground transition hover:bg-accent hover:text-foreground [writing-mode:vertical-rl]"
					type="button"
					onClick={() => props.onOpenChange(true)}
					aria-label="Open assets panel"
				>
					Assets
				</button>
			</Show>
			<Show when={props.isOpen}>
				<div class="flex items-center justify-between border-b border-border px-4 py-3">
					<span class="text-[11px] uppercase tracking-[0.28em] text-muted-foreground">Editor</span>
					<button
						class="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition hover:bg-accent hover:text-foreground"
						type="button"
						onClick={() => props.onOpenChange(false)}
						aria-label="Collapse"
					>
						<svg
							class="rotate-180"
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
							<path d="m9 18 6-6-6-6" />
						</svg>
					</button>
				</div>

				<div class="flex-1 overflow-y-auto p-2">
					<section class="border-b border-border px-3 py-3">
						<div class="grid gap-3">
							<div class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Canvas</div>
							<GridSizeControl
								gridSize={props.gridSize}
								onChange={props.onGridSizeChange}
								onCommit={props.onGridSizeCommit}
							/>
							<button
								class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
								type="button"
								onClick={props.onToggleGrid}
							>
								{props.showGrid ? 'Hide grid' : 'Show grid'}
							</button>
						</div>
					</section>

					<section class="border-b border-border">
						<button
							class="flex w-full items-center justify-between px-4 py-3 text-left"
							type="button"
							onClick={() => setIsScenesSectionOpen((current) => !current)}
						>
							<span class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Scenes</span>
							<svg
								class={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isScenesSectionOpen() ? 'rotate-180' : ''}`}
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M4 6l4 4 4-4" />
							</svg>
						</button>
						<Show when={isScenesSectionOpen()}>
							<div class="border-t border-border px-3 py-3">
								<div class="flex flex-wrap gap-2">
									<For each={props.scenes}>
										{(scene) => (
											<button
												class={`rounded-full border px-3 py-2 text-xs transition ${
													props.selectedSceneId === scene._id
														? 'border-primary bg-primary/10 text-foreground'
														: 'border-border bg-background/70 text-muted-foreground hover:bg-accent hover:text-foreground'
												}`}
												type="button"
												onClick={() => props.onSelectScene(scene._id)}
											>
												{scene.name}
												{scene.isDefault ? ' *' : ''}
											</button>
										)}
									</For>
								</div>

								<div class="mt-3 grid gap-2">
									<input
										class="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
										value={props.createName}
										placeholder="new scene name"
										onInput={(event) => props.onCreateNameChange(event.currentTarget.value)}
									/>
									<button
										class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
										type="button"
										onClick={() => void props.onCreateScene()}
									>
										Create scene
									</button>
								</div>

								<Show when={selectedScene()}>
									{(scene) => (
										<div class="mt-3 grid gap-2 border-t border-border pt-3">
											<input
												class="rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
												value={props.sceneName}
												onInput={(event) => props.onSceneNameChange(event.currentTarget.value)}
											/>
											<div class="rounded-xl border border-border px-3 py-2 text-xs text-muted-foreground">
												{scene().width} x {scene().height}
												{scene().isDefault ? ' / default' : ''}
											</div>
											<button
												class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
												type="button"
												onClick={() => void props.onRenameScene()}
											>
												Save name
											</button>
											<button
												class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent disabled:opacity-50"
												type="button"
												disabled={scene().isDefault}
												onClick={() => void props.onSetDefaultScene()}
											>
												{scene().isDefault ? 'Default scene' : 'Set default'}
											</button>
											<button
												class="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-200 transition hover:bg-rose-500/20"
												type="button"
												onClick={() => void props.onDeleteScene()}
											>
												Delete scene
											</button>
										</div>
									)}
								</Show>
							</div>
						</Show>
					</section>

					<section class="overflow-hidden">
						<button
							class="flex w-full items-center justify-between px-4 py-3 text-left"
							type="button"
							onClick={() => setIsAssetsSectionOpen((current) => !current)}
						>
							<span class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Assets</span>
							<svg
								class={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isAssetsSectionOpen() ? 'rotate-180' : ''}`}
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M4 6l4 4 4-4" />
							</svg>
						</button>
						<Show when={isAssetsSectionOpen()}>
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
									class="mb-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
									type="button"
									title={isUploading() ? 'Uploading...' : 'Upload new assets'}
									disabled={isUploading()}
									onClick={() => fileInputRef?.click()}
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
										<path d="M12 5v14" />
										<path d="M5 12h14" />
									</svg>
									{isUploading() ? 'Uploading...' : 'Upload new assets'}
								</button>
								<Show when={errorMessage()}>
									<div class="mb-2 text-[10px] leading-tight text-destructive">{errorMessage()}</div>
								</Show>

								<Show when={!sprites.isLoading()} fallback={<div class="p-2 text-xs text-muted-foreground">...</div>}>
									<div class="flex flex-col gap-0.5">
										<For each={sortedSprites()}>
											{(sprite) => <DraggableSprite sprite={sprite} />}
										</For>
									</div>
								</Show>

								<Show when={visibleUploads().length > 0}>
									<div class="mt-2 flex flex-col gap-0.5">
										<For each={visibleUploads()}>
											{(file) => (
												<div class="flex items-center gap-2.5 rounded-lg bg-muted/50 p-1.5">
													<div
														class="relative h-10 w-10 shrink-0 overflow-hidden rounded bg-muted"
														title={file.fileName}
													>
														<div
															class="absolute inset-x-0 bottom-0 h-1 rounded-b bg-primary transition-[width] duration-150"
															style={{ width: `${file.progress}%` }}
														/>
													</div>
													<div class="min-w-0 flex-1">
														<div class="truncate text-[11px] leading-tight text-foreground/50">{file.fileName}</div>
														<div class="mt-0.5 text-[10px] text-muted-foreground">
															{file.status === 'failed' ? (
																<span class="text-destructive">failed</span>
															) : (
																`${file.progress}%`
															)}
														</div>
													</div>
												</div>
											)}
										</For>
									</div>
								</Show>
							</div>
						</Show>
					</section>

					<section class="overflow-hidden">
						<button
							class="flex w-full items-center justify-between px-4 py-3 text-left"
							type="button"
							onClick={() => setIsAudioSectionOpen((current) => !current)}
						>
							<span class="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Audio / Radio</span>
							<svg
								class={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${isAudioSectionOpen() ? 'rotate-180' : ''}`}
								viewBox="0 0 16 16"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
							>
								<path d="M4 6l4 4 4-4" />
							</svg>
						</button>
						<Show when={isAudioSectionOpen()}>
							<div class="border-t border-border p-2">
								<input
									ref={audioFileInputRef}
									class="hidden"
									type="file"
									accept="audio/*"
									multiple
									onChange={handleAudioFileSelection}
								/>
								<button
									class="mb-2 flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-dashed border-muted-foreground/30 text-xs text-muted-foreground transition hover:border-primary hover:text-primary disabled:opacity-50"
									type="button"
									title={isUploadingAudio() ? 'Uploading...' : 'Upload audio files'}
									disabled={isUploadingAudio()}
									onClick={() => audioFileInputRef?.click()}
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
										<path d="M12 5v14" />
										<path d="M5 12h14" />
									</svg>
									{isUploadingAudio() ? 'Uploading...' : 'Upload audio'}
								</button>
								<Show when={audioErrorMessage()}>
									<div class="mb-2 text-[10px] leading-tight text-destructive">{audioErrorMessage()}</div>
								</Show>

								<div class="mt-2 grid gap-2">
									<div class="text-[10px] uppercase tracking-widest text-muted-foreground">Radio controls</div>

									<Show when={radioState.data()?.currentTrackName}>
										<div class="truncate text-xs text-foreground/70">
											Playing: {radioState.data()?.currentTrackName}
										</div>
									</Show>

									<button
										class="rounded-xl border border-border bg-background px-4 py-2 text-sm transition hover:bg-accent"
										type="button"
										onClick={() => {
											if (radioState.data()?.isPaused) {
												void resumeRadio.mutate({});
											} else {
												void pauseRadio.mutate({});
											}
										}}
									>
										{radioState.data()?.isPaused ? 'Resume' : 'Pause'}
									</button>

									<label class="text-[10px] text-muted-foreground">
										Current track
										<select
											class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
											value={radioState.data()?.currentTrackFileId ?? ''}
											onChange={(e) => {
												const val = e.currentTarget.value;
												void setRadioTrack.mutate({
													slot: 'current',
													fileId: val ? (val as Id<'files'>) : undefined,
												});
											}}
										>
											<option value="">None</option>
											<For each={audioFiles.data() ?? []}>
												{(file) => <option value={file._id}>{file.fileName}</option>}
											</For>
										</select>
									</label>

									<label class="text-[10px] text-muted-foreground">
										Next track
										<select
											class="mt-1 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none transition focus:border-primary"
											value={radioState.data()?.nextTrackFileId ?? ''}
											onChange={(e) => {
												const val = e.currentTarget.value;
												void setRadioTrack.mutate({
													slot: 'next',
													fileId: val ? (val as Id<'files'>) : undefined,
												});
											}}
										>
											<option value="">None</option>
											<For each={audioFiles.data() ?? []}>
												{(file) => <option value={file._id}>{file.fileName}</option>}
											</For>
										</select>
									</label>
								</div>

								<Show when={(audioFiles.data() ?? []).length > 0}>
									<div class="mt-3 flex flex-col gap-0.5">
										<div class="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Audio files</div>
										<For each={audioFiles.data() ?? []}>
											{(file) => (
												<div class="flex items-center gap-2 rounded-lg bg-muted/50 p-1.5">
													<div class="min-w-0 flex-1">
														<div class="truncate text-[11px] leading-tight text-foreground/50">{file.fileName}</div>
													</div>
												</div>
											)}
										</For>
									</div>
								</Show>
							</div>
						</Show>
					</section>
				</div>
			</Show>
		</aside>
	);
}
