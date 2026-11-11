// Mission Control's voice: POST /api/tts { text } -> audio/mpeg from
// ElevenLabs. Runs only on the dev server (see vite.config.js), so the key
// stays on this machine. Without ELEVENLABS_API_KEY it answers 503 and the
// game falls back to the browser's speech synthesis.
import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

const VOICE_ID = "onwK4e9ZLuTAKqWW03F9"; // Daniel: calm, authoritative
// Flash keeps the delay between the event and the radio call short.
const MODEL_ID = "eleven_flash_v2_5";

let client = null;
function getClient() {
  if (!client && process.env.ELEVENLABS_API_KEY) client = new ElevenLabsClient();
  return client;
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 10000) reject(new Error("too large"));
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(body || "{}"));
      } catch (e) {
        reject(e);
      }
    });
    req.on("error", reject);
  });
}

export function ttsMiddleware() {
  return async (req, res, next) => {
    if (req.url !== "/api/tts") return next();
    if (req.method !== "POST") {
      res.statusCode = 405;
      return res.end();
    }
    const tts = getClient();
    if (!tts) {
      res.statusCode = 503;
      return res.end("tts disabled");
    }
    try {
      const { text } = await readJson(req);
      if (typeof text !== "string" || !text.trim() || text.length > 600) {
        res.statusCode = 400;
        return res.end("bad text");
      }
      const audio = await tts.textToSpeech.convert(VOICE_ID, {
        text,
        modelId: MODEL_ID,
        languageCode: "es",
        outputFormat: "mp3_44100_64",
        voiceSettings: { stability: 0.55, similarityBoost: 0.75 },
      });
      const chunks = [];
      for await (const chunk of audio) chunks.push(Buffer.from(chunk));
      res.setHeader("Content-Type", "audio/mpeg");
      res.end(Buffer.concat(chunks));
    } catch (error) {
      console.warn("[tts]", error?.message || error);
      res.statusCode = 502;
      res.end("tts failed");
    }
  };
}
