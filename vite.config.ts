import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [
      solidStart({
        middleware: "./src/middleware.ts",
      }),
      tailwindcss(),
      nitro({
        preset: "vercel",
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
