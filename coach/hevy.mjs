// ESM, node 18+, aucune dépendance externe.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

let cachedKey = null;

function envValue(name) {
  if (process.env[name]) return process.env[name];
  const envPath = path.join(ROOT, ".env");
  const raw = readFileSync(envPath, "utf8");
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    if (trimmed.slice(0, eq).trim() === name) return trimmed.slice(eq + 1).trim();
  }
  return null;
}

export function apiKey() {
  if (cachedKey) return cachedKey;
  cachedKey = envValue("HEVY_API_KEY");
  if (!cachedKey) throw new Error(`HEVY_API_KEY absent de ${path.join(ROOT, ".env")}`);
  return cachedKey;
}

// Bascule vers l'API auto-hébergée : mettre HEVY_API_BASE dans .env.
// Par défaut, comportement inchangé.
const BASE = envValue("HEVY_API_BASE") ?? "https://api.hevyapp.com/v1";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function request(method, pathAndQuery, body) {
  const url = `${BASE}${pathAndQuery}`;
  const backoffs = [1000, 4000, 10000];
  let lastErr;
  for (let attempt = 0; attempt <= backoffs.length; attempt++) {
    let res;
    try {
      res = await fetch(url, {
        method,
        headers: {
          "api-key": apiKey(),
          accept: "application/json",
          ...(body ? { "content-type": "application/json" } : {}),
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } catch (err) {
      lastErr = err;
      if (attempt < backoffs.length) {
        await sleep(backoffs[attempt]);
        continue;
      }
      throw err;
    }

    if (res.ok) {
      if (res.status === 204) return null;
      return res.json();
    }

    const text = await res.text().catch(() => "");
    if ((res.status === 429 || res.status >= 500) && attempt < backoffs.length) {
      await sleep(backoffs[attempt]);
      continue;
    }
    throw new Error(`Hevy API ${method} ${pathAndQuery} -> ${res.status} ${text}`);
  }
  throw lastErr ?? new Error(`Hevy API ${method} ${pathAndQuery} failed`);
}

export async function hevyGet(pathAndQuery) {
  return request("GET", pathAndQuery);
}

export async function hevyPut(pathAndQuery, body) {
  return request("PUT", pathAndQuery, body);
}

// Pagine page=1..page_count sur basePath (qui peut déjà contenir des query params).
// stopWhen(accumulatedItems) peut interrompre tôt. Retourne le tableau d'items accumulés.
export async function fetchPages(basePath, itemsKey, { pageSize = 10, maxPages = 6, stopWhen } = {}) {
  const sep = basePath.includes("?") ? "&" : "?";
  let items = [];
  let page = 1;
  let pageCount = 1;

  while (page <= pageCount && page <= maxPages) {
    const data = await hevyGet(`${basePath}${sep}page=${page}&pageSize=${pageSize}`);
    const pageItems = data[itemsKey] ?? [];
    items = items.concat(pageItems);
    pageCount = data.page_count ?? 1;
    if (stopWhen && stopWhen(items)) break;
    page++;
  }

  return items;
}
