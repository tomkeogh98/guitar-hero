// State lives in localStorage (works offline) and syncs to data.json in a private GitHub repo.
// Recordings are cached in IndexedDB and uploaded to recordings/ in the same repo.
import { today } from "./util.js?v=7";

const STATE_KEY = "gh.state.v1";
const SETTINGS_KEY = "gh.settings.v1";
const DEFAULT_REPO = "tomkeogh98/guitar-hero-data";

const blank = () => ({ version: 1, startDate: null, sessions: {}, excuses: {}, shifts: {}, goals: {}, prefs: {} });

function readJSON(key, fallback) {
  try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
function writeJSON(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* storage full or blocked */ }
}

const listeners = new Set();
export const store = {
  state: Object.assign(blank(), readJSON(STATE_KEY, {})),
  settings: Object.assign({ token: "", repo: DEFAULT_REPO }, readJSON(SETTINGS_KEY, {})),
  sync: { status: "off", message: "", lastSynced: null },
  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },
  emit() { listeners.forEach((fn) => fn()); },
};
if (!store.state.startDate) { store.state.startDate = today(); writeJSON(STATE_KEY, store.state); }

export function update(mutator) {
  mutator(store.state);
  writeJSON(STATE_KEY, store.state);
  store.emit();
  scheduleSync();
}
export function stamp(rec) { return Object.assign(rec, { updatedAt: Date.now() }); }

// Tokens and repo names are plain ASCII; pasting (especially on phones) can drag in
// spaces, line breaks or invisible characters that break the request.
const clean = (v) => String(v).replace(/[^\x21-\x7e]/g, "");

export function saveSettings(patch) {
  if ("token" in patch) patch.token = clean(patch.token);
  if ("repo" in patch) patch.repo = clean(patch.repo).replace(/^https:\/\/github\.com\//, "").replace(/\.git$|\/$/g, "");
  Object.assign(store.settings, patch);
  writeJSON(SETTINGS_KEY, store.settings);
  store.emit();
}

// ---------- merge ----------
function mergeMap(a = {}, b = {}) {
  const out = { ...a };
  for (const [k, v] of Object.entries(b)) {
    if (!out[k] || (v.updatedAt || 0) > (out[k].updatedAt || 0)) out[k] = v;
  }
  return out;
}
export function merge(local, remote) {
  if (!remote) return local;
  const starts = [local.startDate, remote.startDate].filter(Boolean).sort();
  return {
    version: 1,
    startDate: starts[0] || null,
    sessions: mergeMap(local.sessions, remote.sessions),
    excuses: mergeMap(local.excuses, remote.excuses),
    shifts: mergeMap(local.shifts, remote.shifts),
    goals: mergeMap(local.goals, remote.goals),
    prefs: mergeMap(local.prefs, remote.prefs),
  };
}

// ---------- IndexedDB for audio ----------
let dbPromise;
function db() {
  dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("guitar-hero", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("audio");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}
async function idb(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const tx = d.transaction("audio", mode);
    const req = fn(tx.objectStore("audio"));
    tx.oncomplete = () => resolve(req && req.result);
    tx.onerror = () => reject(tx.error);
  });
}
export const putAudio = (name, blob) => idb("readwrite", (s) => s.put(blob, name));
const getLocalAudio = (name) => idb("readonly", (s) => s.get(name)).catch(() => null);

export async function getAudio(name) {
  const local = await getLocalAudio(name);
  if (local) return local;
  if (!configured()) return null;
  const res = await gh(`contents/recordings/${encodeURIComponent(name)}`, { headers: { Accept: "application/vnd.github.raw" } });
  if (!res.ok) return null;
  const blob = await res.blob();
  await putAudio(name, blob).catch(() => {});
  return blob;
}

// ---------- GitHub sync ----------
export const configured = () => Boolean(store.settings.token && store.settings.repo);

async function gh(path, opts = {}) {
  const url = `https://api.github.com/repos/${store.settings.repo}${path ? `/${path}` : ""}`;
  try {
    return await fetch(url, {
    ...opts,
    headers: {
      Authorization: `Bearer ${store.settings.token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      Accept: "application/vnd.github+json",
      ...(opts.headers || {}),
    },
  });
  } catch (e) {
    throw new Error(navigator.onLine === false
      ? "You're offline. Changes are saved on this device and will sync when you're back online"
      : "Couldn't reach GitHub. Check your connection, or turn off any content blocker for this site");
  }
}

const toB64 = (bytes) => {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};
const fromB64Text = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));

let remoteSha = null;

async function pull() {
  const res = await gh(`contents/data.json?ref=main&t=${Date.now()}`);
  if (res.status === 404) { remoteSha = null; return null; }
  if (!res.ok) throw new Error(await errText(res));
  const body = await res.json();
  remoteSha = body.sha;
  return JSON.parse(fromB64Text(body.content));
}

async function push(data) {
  const res = await gh("contents/data.json", {
    method: "PUT",
    body: JSON.stringify({
      message: `Practice log update ${new Date().toISOString()}`,
      content: toB64(new TextEncoder().encode(JSON.stringify(data, null, 1))),
      ...(remoteSha ? { sha: remoteSha } : {}),
    }),
  });
  if (res.status === 409 || res.status === 422) return false; // someone else wrote first
  if (!res.ok) throw new Error(await errText(res));
  remoteSha = (await res.json()).content.sha;
  return true;
}

async function errText(res) {
  if (res.status === 401) return "GitHub rejected the token (expired or wrong?)";
  if (res.status === 403) return "The token doesn't have write access to the data repo";
  if (res.status === 404) return "Data repo not found. Check the name and token access";
  try { return (await res.json()).message || res.statusText; } catch { return res.statusText; }
}

async function uploadPendingRecordings() {
  for (const s of Object.values(store.state.sessions)) {
    const r = s.recording;
    if (!r || r.uploaded || s.deleted) continue;
    const blob = await getLocalAudio(r.name);
    if (!blob) continue;
    const content = toB64(new Uint8Array(await blob.arrayBuffer()));
    const res = await gh(`contents/recordings/${encodeURIComponent(r.name)}`, {
      method: "PUT",
      body: JSON.stringify({ message: `Recording ${r.name}`, content }),
    });
    if (res.ok || res.status === 422) { // 422: already exists
      r.uploaded = true;
      stamp(s);
    } else {
      throw new Error(`Recording upload failed: ${await errText(res)}`);
    }
  }
}

let syncing = null, timer = null, again = false;
function scheduleSync() {
  if (!configured()) return;
  clearTimeout(timer);
  timer = setTimeout(() => syncNow(), 1500);
}

export function syncNow() {
  if (!configured()) { store.sync = { status: "off", message: "Not connected", lastSynced: null }; store.emit(); return Promise.resolve(); }
  if (syncing) { again = true; return syncing; }
  store.sync = { ...store.sync, status: "syncing", message: "Syncing…" };
  store.emit();
  syncing = (async () => {
    try {
      await uploadPendingRecordings();
      for (let attempt = 0; attempt < 3; attempt++) {
        const remote = await pull();
        const merged = merge(store.state, remote);
        store.state = merged;
        writeJSON(STATE_KEY, merged);
        if (JSON.stringify(remote) === JSON.stringify(merged)) break;
        if (await push(merged)) break;
      }
      store.sync = { status: "ok", message: "Synced", lastSynced: new Date() };
    } catch (e) {
      store.sync = { status: "error", message: e.message || String(e), lastSynced: store.sync.lastSynced };
    } finally {
      syncing = null;
      store.emit();
      if (again) { again = false; scheduleSync(); }
    }
  })();
  return syncing;
}

export async function testConnection() {
  const res = await gh("");
  if (!res.ok) throw new Error(await errText(res));
  const repo = await res.json();
  if (!repo.private) throw new Error("That repo is public! Your journal and recordings would be visible to anyone. Use a private repo.");
  if (!repo.permissions?.push) throw new Error("The token can read the repo but not write to it. Give it Contents: Read and write.");
  return repo.full_name;
}

// ---------- backup ----------
export function exportJSON() {
  return new Blob([JSON.stringify(store.state, null, 2)], { type: "application/json" });
}
export function importJSON(text) {
  const data = JSON.parse(text);
  if (!data || typeof data.sessions !== "object") throw new Error("That doesn't look like a Guitar Hero backup.");
  update((s) => Object.assign(s, merge(s, data)));
}
