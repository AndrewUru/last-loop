// Live data from the real space world, used for immersion:
//   Launch Library 2 (thespacedevs.com): the next real launches.
//   wheretheiss.at: where the International Space Station is right now.
// Both answer browsers directly (CORS) and need no key. Launch Library's
// free tier allows only a few requests an hour, so launches are cached in
// localStorage for an hour. Every function resolves to null on failure.

const LAUNCHES_URL = "https://ll.thespacedevs.com/2.3.0/launches/upcoming/?limit=8&mode=list&hide_recent_previous=true";
const ISS_URL = "https://api.wheretheiss.at/v1/satellites/25544";
const LAUNCH_CACHE_KEY = "last-loop-real-launches-v1";
const LAUNCH_CACHE_MS = 60 * 60 * 1000;

// Game rockets that also fly for real, matched against Launch Library names.
const ROCKET_MATCHES = [
  ["falcon-heavy", /falcon heavy/i],
  ["falcon-9", /falcon 9/i],
  ["soyuz", /soyuz/i],
  ["electron", /electron/i],
  ["ariane-5", /ariane/i],
  ["sls", /\bsls\b|space launch system/i],
  ["starship", /starship|super heavy/i],
];

async function getJson(url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function readCache() {
  try {
    const cached = JSON.parse(localStorage.getItem(LAUNCH_CACHE_KEY));
    return cached && Date.now() - cached.at < LAUNCH_CACHE_MS ? cached.launches : null;
  } catch {
    return null;
  }
}

let launchesPromise = null;

// [{ name, rocket, provider, pad, net (Date), status, gameRocketId }]
export function getUpcomingLaunches() {
  if (!launchesPromise) {
    launchesPromise = (async () => {
      const cached = readCache();
      if (cached) return cached;
      const data = await getJson(LAUNCHES_URL);
      if (!data?.results) return null;
      const launches = data.results.map((launch) => {
        const name = launch.name || "";
        const [rocket, mission] = name.split(" | ");
        return {
          name: mission || name,
          rocket: rocket || "",
          provider: launch.launch_service_provider?.name || launch.lsp_name || "",
          pad: launch.pad?.location?.name || launch.location || "",
          net: launch.net,
          status: launch.status?.abbrev || "",
          gameRocketId: ROCKET_MATCHES.find(([, pattern]) => pattern.test(name))?.[0] || null,
        };
      });
      try {
        localStorage.setItem(LAUNCH_CACHE_KEY, JSON.stringify({ at: Date.now(), launches }));
      } catch {
        // Not cached; the next screen asks again.
      }
      return launches;
    })();
  }
  return launchesPromise;
}

// { latitude, longitude, altitude (km), velocity (km/h), visibility, at (ms) }
export async function getIssPosition() {
  const data = await getJson(ISS_URL, 6000);
  if (!data || typeof data.longitude !== "number") return null;
  return {
    latitude: data.latitude,
    longitude: data.longitude,
    altitude: data.altitude,
    velocity: data.velocity,
    visibility: data.visibility,
    at: Date.now(),
  };
}

// "en 2 días", "mañana", "en 5 h", "en 20 min".
export function describeWhen(net) {
  const ms = new Date(net).getTime() - Date.now();
  if (!Number.isFinite(ms)) return "";
  if (ms < 0) return "en curso";
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `en ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `en ${hours} h`;
  const days = Math.round(hours / 24);
  return days === 1 ? "mañana" : `en ${days} días`;
}

// A short, speakable summary for prompts and tickers.
export function summarizeLaunch(launch) {
  return `${launch.rocket} · ${launch.name} (${launch.provider}) ${describeWhen(launch.net)}`;
}
