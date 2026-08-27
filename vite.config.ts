// @lovable.dev/vite-tanstack-config gerekli TanStack Start,
// React, Tailwind, tsconfig paths ve Nitro yapılandırmalarını ekler.
// Pluginleri ayrıca elle eklemiyoruz.

import { defineConfig } from "@lovable.dev/vite-tanstack-config";

const isElectronBuild =
  process.env.ELECTRON_BUILD === "1";

export default defineConfig({
  tanstackStart: {
    server: {
      entry: "server",
    },
  },

  ...(isElectronBuild
    ? {
        nitro: {
          preset: "node-server",
        },
      }
    : {}),
});
