import { setupConvex } from "convex-solidjs";

export const client = setupConvex(import.meta.env.VITE_CONVEX_URL);
