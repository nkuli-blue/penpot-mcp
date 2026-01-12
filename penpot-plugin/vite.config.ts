import { defineConfig } from "vite";
import livePreview from "vite-live-preview";

// Debug: Log the environment variable
console.log("MULTI_USER_MODE env:", process.env.MULTI_USER_MODE);
console.log("Will define IS_MULTI_USER_MODE as:", JSON.stringify(process.env.MULTI_USER_MODE === "true"));

export default defineConfig({
    plugins: [
        livePreview({
            reload: true,
            config: {
                build: {
                    sourcemap: true,
                },
            },
        }),
    ],
    build: {
        rollupOptions: {
            input: {
                plugin: "src/plugin.ts",
                index: "./index.html",
            },
            output: {
                entryFileNames: "[name].js",
            },
        },
    },
    preview: {
        port: 4400,
        cors: true,
        allowedHosts: process.env.PENPOT_MCP_PLUGIN_SERVER_ALLOWED_HOSTS
            ? process.env.PENPOT_MCP_PLUGIN_SERVER_ALLOWED_HOSTS.split(",").map((h) => h.trim())
            : [],
    },
    define: {
        IS_MULTI_USER_MODE: JSON.stringify(process.env.MULTI_USER_MODE === "true"),
    },
});
