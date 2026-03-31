import { ConvexHttpClient } from 'convex/browser';
import type { FileRouter } from 'uploadthing/server';
import { createUploadthing, UploadThingError } from 'uploadthing/server';
import { api } from '../../convex/_generated/api';

const f = createUploadthing();
const convex = import.meta.env.VITE_CONVEX_URL ? new ConvexHttpClient(import.meta.env.VITE_CONVEX_URL) : null;

const auth = (req: Request) => ({ id: 'fakeId' }); // Fake auth function

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
		.middleware(async ({ req }) => {
			// This code runs on your server before upload
			const user = await auth(req);

			// If you throw, the user will not be able to upload
			if (!user) throw new UploadThingError('Unauthorized');

			// Whatever is returned here is accessible in onUploadComplete as `metadata`
			return { userId: user.id };
		})
		.onUploadComplete(async ({ metadata, file }) => {
			// This code RUNS ON YOUR SERVER after upload
			console.log('Upload complete for userId:', metadata.userId);

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
			return { uploadedBy: metadata.userId };
		}),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;
