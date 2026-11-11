import { defineConfig, loadEnv } from "vite";
import { aiMiddleware } from "./server/ai.js";
import { ttsMiddleware } from "./server/tts.js";

export default defineConfig(({ mode }) => {
  // ANTHROPIC_API_KEY comes from .env (never committed); without it the AI
  // routes report themselves disabled and the game uses built-in lines.
  const env = loadEnv(mode, process.cwd(), "");
  if (env.ANTHROPIC_API_KEY && !process.env.ANTHROPIC_API_KEY) {
    process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY;
  }
  // ELEVENLABS_API_KEY comes from .env.local (server only, never VITE_).
  if (env.ELEVENLABS_API_KEY && !process.env.ELEVENLABS_API_KEY) {
    process.env.ELEVENLABS_API_KEY = env.ELEVENLABS_API_KEY;
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
          server.middlewares.use(ttsMiddleware());
          server.middlewares.use(aiMiddleware());
        },
      },
    ],
  };
});
