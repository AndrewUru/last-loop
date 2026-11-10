// Talks to the local AI routes (server/ai.js through the Vite dev server).
// Every call resolves, never throws: { enabled, text }. When the AI is off
// (no key, built game, offline) enabled is false and callers use their own
// built-in text.

const TIMEOUT_MS = 25000;
let statusPromise = null;

async function request(path, body) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`/api/ai/${path}`, {
      method: body ? "POST" : "GET",
      headers: body ? { "Content-Type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
    if (!response.ok || !response.headers.get("content-type")?.includes("json")) {
      return { enabled: false, text: "" };
    }
    const data = await response.json();
    return { enabled: Boolean(data.enabled), text: typeof data.text === "string" ? data.text : "", error: data.error };
  } catch {
    return { enabled: false, text: "" };
  } finally {
    clearTimeout(timer);
  }
}

export const AiClient = {
  // Asked once per session; later calls reuse the answer.
  isEnabled() {
    if (!statusPromise) {
      statusPromise = request("status").then((status) => status.enabled);
    }
    return statusPromise;
  },
  async ask(route, body) {
    if (!(await AiClient.isEnabled())) {
      return { enabled: false, text: "" };
    }
    return request(route, body);
  },
};
