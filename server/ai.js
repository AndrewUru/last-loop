// Mission Control's brain: the Claude calls behind /api/ai/*. Runs only on
// the dev server (see vite.config.js), so the API key stays on this machine
// and never reaches the browser. Without a key every route answers
// { enabled: false } and the game falls back to its built-in lines.
import Anthropic from "@anthropic-ai/sdk";

const MODEL = "claude-opus-5-5";
// Refused requests are retried on another model inside the same call.
const FALLBACK = { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" };

const GAME_CONTEXT = `Last Loop es un juego 2D de cohetes en español. El jugador pilota cohetes
históricos (Soyuz, Saturno V, Transbordador, Energía, Ariane 5, Falcon 9, Electron,
Falcon Heavy, SLS, Starship) hasta la órbita, separando etapas con la tecla S; algunas
misiones siguen después: subir a una órbita alta o acelerar rumbo a la Luna. En este
mundo simplificado la órbita baja empieza en 170 km y hace falta 6 km/s de velocidad
lateral. También hay una misión de aterrizaje de propulsores.`;

const PROMPTS = {
  comms: `Eres el Control de Misión de ${"Last Loop"}: un controlador de vuelo veterano,
sereno y cálido, que habla por radio con el piloto. ${GAME_CONTEXT}
Te llega un evento del vuelo con su telemetría. Responde con UNA sola transmisión de radio
en español, de 6 a 18 palabras, sin comillas ni prefijos ("Control:"), sin emojis.
Suena a radio real (jerga breve: "confirmado", "nominal", "buen trabajo") y usa el dato
más relevante de la telemetría. Si el evento es un fallo, sé tranquilo y útil.`,
  briefing: `Eres el Control de Misión de Last Loop dando el briefing previo al despegue.
${GAME_CONTEXT}
Recibes el cohete, la misión del jugador y noticias espaciales reales de hoy (próximos
lanzamientos reales y la posición de la Estación Espacial Internacional).
Escribe en español 2 o 3 frases cortas (máximo 55 palabras en total), para leer en voz
alta: saluda al piloto, resume el objetivo y sus etapas, y conecta con UNA noticia real
concreta (nombre y fecha aproximada). Sin listas, sin emojis, sin comillas.`,
  debrief: `Eres el director de vuelo de Last Loop analizando la telemetría de un vuelo.
${GAME_CONTEXT}
Escribe en español un informe breve para el piloto (máximo 70 palabras, 3 frases):
1) qué pasó y por qué, con datos concretos de la telemetría; 2) el error o el acierto
principal; 3) UN consejo accionable para el próximo intento. Tono de mentor, directo.
Sin listas, sin títulos, sin emojis.`,
  engineer: `Eres Marta, ingeniera de propulsión del hangar de Last Loop. Respondes preguntas del
piloto sobre cohetes reales, física orbital y cómo se juega. ${GAME_CONTEXT}
Responde en español, claro y con entusiasmo, en 2-5 frases (máximo 110 palabras),
pensando en alguien curioso sin formación técnica. Si preguntan por el juego, da consejos
concretos (separar etapas a tiempo, girar pronto hacia la derecha, soltar el motor al
llegar a 6 km/s). Sin markdown.`,
};

// Per route: how hard to think and how long the reply may be.
const SETTINGS = {
  comms: { effort: "low", max_tokens: 1500 },
  briefing: { effort: "low", max_tokens: 2000 },
  debrief: { effort: "medium", max_tokens: 3000 },
  engineer: { effort: "medium", max_tokens: 3000 },
};

let client = null;
function getClient() {
  if (!client && process.env.ANTHROPIC_API_KEY) {
    client = new Anthropic();
  }
  return client;
}

export function isAiEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

// messages: Anthropic message params (user/assistant turns).
async function ask(route, messages) {
  const anthropic = getClient();
  if (!anthropic) {
    return { enabled: false };
  }
  const { effort, max_tokens } = SETTINGS[route];
  const response = await anthropic.beta.messages.create({
    model: MODEL,
    max_tokens,
    system: PROMPTS[route],
    output_config: { effort },
    messages,
    ...FALLBACK,
  });
  if (response.stop_reason === "refusal") {
    return { enabled: true, text: "" };
  }
  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
  return { enabled: true, text };
}

const asJson = (value) => JSON.stringify(value, null, 1);

export const aiRoutes = {
  status: async () => ({ enabled: isAiEnabled(), model: MODEL }),
  comms: async ({ event, telemetry }) =>
    ask("comms", [{ role: "user", content: `Evento: ${event}\nTelemetría:\n${asJson(telemetry)}` }]),
  briefing: async ({ rocket, mission, news }) =>
    ask("briefing", [
      { role: "user", content: `Cohete: ${asJson(rocket)}\nMisión: ${asJson(mission)}\nNoticias reales:\n${asJson(news)}` },
    ]),
  debrief: async ({ telemetry }) => ask("debrief", [{ role: "user", content: `Telemetría del vuelo:\n${asJson(telemetry)}` }]),
  // history: [{ role: "user" | "assistant", content: string }], last one from the user.
  engineer: async ({ history, rocket }) => {
    const turns = (Array.isArray(history) ? history : [])
      .filter((turn) => (turn.role === "user" || turn.role === "assistant") && typeof turn.content === "string")
      .slice(-12)
      .map((turn) => ({ role: turn.role, content: turn.content.slice(0, 1500) }));
    if (!turns.length || turns[0].role !== "user") {
      return { enabled: isAiEnabled(), text: "" };
    }
    if (rocket) {
      turns[turns.length - 1] = {
        role: "user",
        content: `(Cohete seleccionado en el hangar: ${asJson(rocket)})\n${turns[turns.length - 1].content}`,
      };
    }
    return ask("engineer", turns);
  },
};

function isLocal(req) {
  const address = req.socket?.remoteAddress || "";
  return address === "127.0.0.1" || address === "::1" || address === "::ffff:127.0.0.1";
}

// Connect-style middleware for the Vite dev server.
export function aiMiddleware() {
  return async (req, res, next) => {
    const match = req.url?.match(/^\/api\/ai\/([a-z]+)/);
    if (!match) {
      return next();
    }
    const send = (status, body) => {
      res.statusCode = status;
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.end(JSON.stringify(body));
    };
    // The dev server listens on the local network too; only this computer
    // may spend the API credit.
    if (!isLocal(req)) {
      return send(403, { enabled: false, error: "Solo disponible desde este ordenador." });
    }
    const handler = aiRoutes[match[1]];
    if (!handler) {
      return send(404, { error: "Ruta desconocida" });
    }
    let body = {};
    if (req.method === "POST") {
      try {
        const raw = await new Promise((resolve, reject) => {
          let data = "";
          req.on("data", (chunk) => {
            data += chunk;
            if (data.length > 64_000) reject(new Error("too large"));
          });
          req.on("end", () => resolve(data));
          req.on("error", reject);
        });
        body = raw ? JSON.parse(raw) : {};
      } catch {
        return send(400, { error: "JSON no válido" });
      }
    }
    try {
      send(200, await handler(body));
    } catch (error) {
      if (error instanceof Anthropic.AuthenticationError) {
        send(200, { enabled: false, error: "Clave de API no válida" });
      } else if (error instanceof Anthropic.RateLimitError) {
        send(200, { enabled: true, text: "", error: "Límite de peticiones; reintenta luego" });
      } else if (error instanceof Anthropic.APIError) {
        send(200, { enabled: true, text: "", error: `Error de la API (${error.status})` });
      } else {
        send(200, { enabled: true, text: "", error: "Sin conexión con la IA" });
      }
    }
  };
}
