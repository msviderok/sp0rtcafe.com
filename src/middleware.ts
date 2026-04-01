"use server";

import { createMiddleware } from "@solidjs/start/middleware";
import { clerkMiddleware } from "clerk-solidjs/start/server";

export default createMiddleware({
  onRequest: [
    clerkMiddleware({
      publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY as string,
      secretKey: process.env.CLERK_SECRET_KEY as string,
    }),
  ],
});
