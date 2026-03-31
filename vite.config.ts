import { solidStart } from "@solidjs/start/config";
import { nitroV2Plugin as nitro } from "@solidjs/vite-plugin-nitro-2";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    plugins: [solidStart(), tailwindcss(), nitro()],
    environments: {
      ssr: {
        define: {
          "process.env.UPLOADTHING_TOKEN": JSON.stringify(env.UPLOADTHING_TOKEN),
        },
      },
    },
  };
});
