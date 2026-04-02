import { createMiddleware } from '@solidjs/start/middleware';
import { clerkMiddleware } from 'clerk-solidjs/start/server';

const clerkPublishableKey = process.env.VITE_CLERK_PUBLISHABLE_KEY;
const clerkSecretKey = process.env.CLERK_SECRET_KEY;

const onRequest = [];

if (clerkPublishableKey && clerkSecretKey) {
	onRequest.push(
		clerkMiddleware({
			publishableKey: clerkPublishableKey,
			secretKey: clerkSecretKey,
		}),
	);
}

export default createMiddleware({
	onRequest,
});
