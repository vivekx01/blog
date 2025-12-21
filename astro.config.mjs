import { defineConfig } from "astro/config";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import tailwind from "@astrojs/tailwind";
import { fileURLToPath } from "url";
import path from "path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://vivekx01.github.io",
  base: "/blog",
  integrations: [mdx(), sitemap(), tailwind()],
  vite: {
    resolve: {
      alias: {
        "@layouts": path.resolve(__dirname, "./src/layouts"),
        "@components": path.resolve(__dirname, "./src/components"),
        "@consts": path.resolve(__dirname, "./src/consts"),
        "@types": path.resolve(__dirname, "./src/types"),
        "@lib": path.resolve(__dirname, "./src/lib"),
      },
    },
  },
});
