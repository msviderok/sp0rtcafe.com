import type { APIEvent } from '@solidjs/start/server';

import { createRouteHandler } from 'uploadthing/server';

import { uploadRouter } from '~/server/uploadthing';

const uploadThingToken = process.env.UPLOADTHING_TOKEN;

if (!uploadThingToken) {
	throw new Error('UPLOADTHING_TOKEN is missing');
}

const handler = createRouteHandler({
	router: uploadRouter,
	config: {
		token: uploadThingToken,
	},
});

export const GET = (event: APIEvent) => handler(event.request);
export const POST = (event: APIEvent) => handler(event.request);
