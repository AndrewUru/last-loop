import { defineConfig, loadEnv } from "vite";
import { aiMiddleware } from "./server/ai.js";

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY comes from .env (never committed); without it the AI
  // routes report themselves disabled and the game uses built-in lines.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }

  return {
    server: {
      host: "0.0.0.0",
      port: 5173,
    },
    plugins: [
      {
        name: "last-loop-ai",
        configureServer(server) {
          server.middlewares.use(aiMiddleware());
        },
      },
    ],
  };
});
