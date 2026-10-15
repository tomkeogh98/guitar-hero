// Delight layer: playable strings, plucked-string synthesis, count-ups, waveforms.
import { audioCtx } from "./audio.js?v=4";
import { reducedMotion } from "./util.js?v=4";

// ---------- sound preference ----------
const SOUND_KEY = "gh.sound";
export const soundOn = () => { try { return localStorage.getItem(SOUND_KEY) !== "off"; } catch { return true; } };
export const setSound = (on) => { try { localStorage.setItem(SOUND_KEY, on ? "on" : "off"); } catch {} };

// Browsers only allow audio after the visitor has clicked/tapped something.
let activated = false;
addEventListener("pointerdown", () => { activated = true; }, { capture: true, once: true });
addEventListener("keydown", () => { activated = true; }, { capture: true, once: true });
const canPlay = () => soundOn() && (activated || navigator.userActivation?.hasBeenActive);

// ---------- Karplus–Strong plucked string ----------
// Standard tuning, drawn tab-style: high e on top.
export const STRINGS = [
  { name: "e", freq: 329.63, gauge: 1.0 },
  { name: "B", freq: 246.94, gauge: 1.2 },
  { name: "G", freq: 196.0, gauge: 1.5 },
  { name: "D", freq: 146.83, gauge: 1.9 },
  { name: "A", freq: 110.0, gauge: 2.3 },
  { name: "E", freq: 82.41, gauge: 2.8 },
];
const buffers = new Map();
function ksBuffer(ctx, freq) {
  if (buffers.has(freq)) return buffers.get(freq);
  const sr = ctx.sampleRate, len = Math.floor(sr * 2.4);
  const buf = ctx.createBuffer(1, len, sr), out = buf.getChannelData(0);
  const N = Math.round(sr / freq), ring = new Float32Array(N);
  for (let i = 0; i < N; i++) ring[i] = Math.random() * 2 - 1;
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < N; i++) ring[i] = (ring[i] + ring[i - 1]) / 2; // soften the attack
  const decay = 0.9965 - freq / 120000;
  for (let i = 0, idx = 0; i < len; i++) {
    const a = ring[idx], b = ring[(idx + 1) % N];
    out[i] = a;
    ring[idx] = (a + b) * 0.5 * decay;
    idx = (idx + 1) % N;
  }
  buffers.set(freq, buf);
  return buf;
}
export function pluck(freq, velocity = 0.6) {
  if (!canPlay()) return;
  try {
    const ctx = audioCtx();
    const src = ctx.createBufferSource();
    src.buffer = ksBuffer(ctx, freq);
    const tone = ctx.createBiquadFilter();
    tone.type = "lowpass";
    tone.frequency.value = 2600 + velocity * 2400;
    const g = ctx.createGain();
    g.gain.value = 0.08 + velocity * 0.16;
    src.connect(tone).connect(g).connect(ctx.destination);
    src.start();
  } catch { /* audio unavailable: strings still vibrate visually */ }
}

// ---------- the six strings ----------
// Sweep the pointer across them to strum; each crossing plucks that string.
export function mountStrings(root, onFirstStrum) {
  if (!root) return () => {};
  const svg = root.querySelector("svg");
  const paths = [...svg.querySelectorAll("path.string")];
  const W = 1000, H = Number(svg.dataset.h), gap = H / (STRINGS.length + 1);
  const ys = STRINGS.map((_, i) => gap * (i + 1));
  const live = new Map(); // i -> { t0, amp }
  let raf = 0, lastY = null, lastT = 0, strummed = false;
  const still = (y) => `M0 ${y} L${W} ${y}`;

  function frame(now) {
    for (const [i, v] of live) {
      const dt = (now - v.t0) / 1000;
      const amp = v.amp * Math.exp(-dt / 0.42);
      if (amp < 0.25) { live.delete(i); paths[i].setAttribute("d", still(ys[i])); paths[i].classList.remove("hum"); continue; }
      const f = 15 - i * 1.4, wob = Math.sin(2 * Math.PI * f * dt);
      let d = `M0 ${ys[i]}`;
      for (let k = 1; k <= 48; k++) {
        const x = (k / 48) * W;
        const env = Math.sin(Math.PI * (x / W));
        d += ` L${x.toFixed(1)} ${(ys[i] + amp * env * wob).toFixed(2)}`;
      }
      paths[i].setAttribute("d", d);
    }
    raf = live.size ? requestAnimationFrame(frame) : 0;
  }
  function hit(i, velocity) {
    pluck(STRINGS[i].freq, velocity);
    if (!strummed) { strummed = true; onFirstStrum?.(); }
    if (reducedMotion()) { paths[i].classList.add("hum"); setTimeout(() => paths[i].classList.remove("hum"), 250); return; }
    live.set(i, { t0: performance.now(), amp: 3 + velocity * 7 });
    paths[i].classList.add("hum");
    if (!raf) raf = requestAnimationFrame(frame);
  }
  const toY = (e) => { const r = svg.getBoundingClientRect(); return ((e.clientY - r.top) / r.height) * H; };

  function onMove(e) {
    const y = toY(e), t = performance.now();
    if (lastY !== null) {
      const lo = Math.min(lastY, y), hi = Math.max(lastY, y);
      const speed = Math.min(1, Math.abs(y - lastY) / Math.max(1, t - lastT) / 0.9);
      ys.forEach((sy, i) => { if (sy > lo && sy <= hi) hit(i, 0.35 + speed * 0.65); });
    }
    lastY = y; lastT = t;
  }
  function onDown(e) {
    const y = toY(e);
    let best = -1, dist = Infinity;
    ys.forEach((sy, i) => { const d = Math.abs(sy - y); if (d < dist) { dist = d; best = i; } });
    if (dist < gap * 0.6) hit(best, 0.8);
    lastY = y;
  }
  const onLeave = () => { lastY = null; };
  // Keyboard: focus the strings and press 1–6 (or arrow keys to strum).
  function onKey(e) {
    if (/^[1-6]$/.test(e.key)) hit(Number(e.key) - 1, 0.7);
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const order = e.key === "ArrowDown" ? [0, 1, 2, 3, 4, 5] : [5, 4, 3, 2, 1, 0];
      order.forEach((i, n) => setTimeout(() => hit(i, 0.6), n * 28));
    }
  }
  svg.addEventListener("pointermove", onMove);
  svg.addEventListener("pointerdown", onDown);
  svg.addEventListener("pointerleave", onLeave);
  root.addEventListener("keydown", onKey);
  return () => { cancelAnimationFrame(raf); };
}

export function stringsMarkup(h = 132) {
  const gap = h / (STRINGS.length + 1);
  return `<div class="strings" tabindex="0" role="group" aria-label="Six guitar strings. Sweep across them to strum, or press keys 1 to 6.">
    <div class="string-names" aria-hidden="true">${STRINGS.map((s) => `<span>${s.name}</span>`).join("")}</div>
    <svg viewBox="0 0 1000 ${h}" preserveAspectRatio="none" data-h="${h}" aria-hidden="true">
      ${STRINGS.map((s, i) => `<path class="string s${i}" d="M0 ${gap * (i + 1)} L1000 ${gap * (i + 1)}" style="--gauge:${s.gauge}"/>`).join("")}
    </svg>
  </div>`;
}

// ---------- numbers that count up ----------
export function countUps(root) {
  for (const el of root.querySelectorAll("[data-count]")) {
    const to = Number(el.dataset.count);
    if (reducedMotion() || !to) { el.textContent = to; continue; }
    const t0 = performance.now(), dur = 650 + Math.min(500, to * 25);
    const step = (now) => {
      const p = Math.min(1, (now - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e);
      if (p < 1) requestAnimationFrame(step);
    };
    el.textContent = "0";
    requestAnimationFrame(step);
  }
}

// ---------- deterministic waveform for a recording ----------
function hash(s) { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return h >>> 0; }
export function waveform(seed, n = 56) {
  let x = hash(seed) || 1;
  const rnd = () => ((x = Math.imul(x ^ (x >>> 15), 2246822507) ^ Math.imul(x ^ (x >>> 13), 3266489909)) >>> 0) / 4294967296;
  const bars = [];
  for (let i = 0; i < n; i++) {
    const env = Math.min(1, i / 5) * Math.min(1, (n - i) / 9);   // fade in, ring out
    const body = 0.35 + 0.65 * Math.abs(Math.sin(i * 0.37 + rnd() * 1.2));
    bars.push(Math.max(0.08, Math.min(1, env * body * (0.55 + rnd() * 0.6))));
  }
  return `<span class="wave" aria-hidden="true">${bars.map((h) => `<i style="--h:${h.toFixed(2)}"></i>`).join("")}</span>`;
}

// ---------- headline that sets itself word by word ----------
export const splitWords = (text) =>
  text.split(" ").map((w, i) => `<span class="w" style="--i:${i}">${w}</span>`).join(" ");
