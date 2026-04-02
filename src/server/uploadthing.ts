import { ConvexHttpClient } from 'convex/browser';
import type { FileRouter } from 'uploadthing/server';
import { createUploadthing } from 'uploadthing/server';
import { api } from '../../convex/_generated/api';

const f = createUploadthing();
const convex = import.meta.env.VITE_CONVEX_URL ? new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL) : null;

export const uploadRouter = {
	// Define as many FileRoutes as you like, each with a unique routeSlug
	imageUploader: f({
		image: {
			/**
			 * For full list of options and defaults, see the File Route API reference
			 * @see https://docs.uploadthing.com/file-routes#route-config
			 */
			maxFileSize: '4MB',
			maxFileCount: 10,
		},
	})
		// Set permissions and file types for this FileRoute
		.middleware(async () => {
			return { authorized: true };
		})
		.onUploadComplete(async ({ file }) => {
			// This code RUNS ON YOUR SERVER after upload
			console.log('file url', file.ufsUrl);

			if (convex) {
				await convex.mutation(api.files.upsertUploadThingFiles, {
					files: [
						{
							uploadThingKey: file.key,
							fileName: file.name,
							url: file.ufsUrl,
							size: file.size,
							mimeType: file.type,
							uploadedAt: Date.now(),
							status: 'uploaded',
							progress: 100,
						},
					],
					createSprites: true,
				});
			}

			// !!! Whatever is returned here is sent to the clientside `onClientUploadComplete` callback
			return { uploaded: true };
		}),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
