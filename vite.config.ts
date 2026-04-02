import { solidStart } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";
import { nitroV2PluginFixed as nitro } from "./tooling/nitro-v2-plugin-fixed";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  console.log({
    UPLOADTHING_TOKEN: !!env.UPLOADTHING_TOKEN,
    CLERK_FRONTEND_API_URL: !!env.CLERK_FRONTEND_API_URL,
    CLERK_PUBLISHABLE_KEY: !!env.CLERK_PUBLISHABLE_KEY,
    CLERK_SECRET_KEY: !!env.CLERK_SECRET_KEY,
    CLERK_JWT_ISSUER_DOMAIN: !!env.CLERK_JWT_ISSUER_DOMAIN,
  });

  return {
    plugins: [
      solidStart({
        middleware: "./src/middleware.ts",
      }),
      tailwindcss(),
      nitro({
        preset: "vercel",
        vercel: {
          functions: {
            runtime: "bun1.x",
          },
        },
      }),
    ],
    environments: {
      ssr: {
        define: {
          "process.env.UPLOADTHING_TOKEN": JSON.stringify(env.UPLOADTHING_TOKEN),
          "process.env.CLERK_FRONTEND_API_URL": JSON.stringify(env.CLERK_FRONTEND_API_URL),
          "process.env.CLERK_PUBLISHABLE_KEY": JSON.stringify(env.CLERK_PUBLISHABLE_KEY),
          "process.env.CLERK_SECRET_KEY": JSON.stringify(env.CLERK_SECRET_KEY),
          "process.env.CLERK_JWT_ISSUER_DOMAIN": JSON.stringify(env.CLERK_JWT_ISSUER_DOMAIN),
        },
      },
    },
  };
});
