// Chromatic guitar tuner: microphone → autocorrelation pitch detection → note + cents.
// Reference tones use the same plucked-string synth as the strings on Today.
import { audioCtx } from "./audio.js?v=5";
import { pluck } from "./fx.js?v=5";
import { icon } from "./icons.js?v=5";

const NOTE_NAMES = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
const TUNING = [
  { name: "E", oct: 2, freq: 82.41 }, { name: "A", oct: 2, freq: 110.0 }, { name: "D", oct: 3, freq: 146.83 },
  { name: "G", oct: 3, freq: 196.0 }, { name: "B", oct: 3, freq: 246.94 }, { name: "e", oct: 4, freq: 329.63 },
];
const IN_TUNE = 5; // cents

// Autocorrelation (after Chris Wilson's ACF2+), limited to guitar range for speed.
export function detectPitch(buf, sr) {
  let n = buf.length, rms = 0;
  for (let i = 0; i < n; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / n);
  if (rms < 0.008) return -1;
  let r1 = 0, r2 = n - 1;
  for (let i = 0; i < n / 2; i++) if (Math.abs(buf[i]) < 0.2) { r1 = i; break; }
  for (let i = 1; i < n / 2; i++) if (Math.abs(buf[n - i]) < 0.2) { r2 = n - i; break; }
  const b = buf.subarray(r1, r2);
  n = b.length;
  const maxLag = Math.min(n - 1, Math.floor(sr / 60)), minLag = Math.floor(sr / 1400);
  const c = new Float32Array(maxLag + 2);
  for (let lag = 0; lag <= maxLag + 1; lag++) {
    let sum = 0;
    for (let j = 0; j < n - lag; j++) sum += b[j] * b[j + lag];
    c[lag] = sum;
  }
  let d = 0;
  while (d < maxLag && c[d] > c[d + 1]) d++;
  let best = -1, pos = -1;
  for (let i = Math.max(d, minLag); i <= maxLag; i++) if (c[i] > best) { best = c[i]; pos = i; }
  if (pos <= 0 || best < c[0] * 0.3) return -1;
  const x1 = c[pos - 1], x2 = c[pos], x3 = c[pos + 1] ?? x2;
  const a = (x1 + x3 - 2 * x2) / 2, bb = (x3 - x1) / 2;
  const t0 = a ? pos - bb / (2 * a) : pos;
  return sr / t0;
}

const midiOf = (f) => 69 + 12 * Math.log2(f / 440);
const centsOff = (f, target) => 1200 * Math.log2(f / target);

let dlg, stream, raf, analyser, data, history = [], target = null;

function markup() {
  return `<form method="dialog" class="tuner">
    <header class="tuner-head"><p class="eyebrow">${icon("fork")} Tuner · standard tuning</p><button class="icon-btn" value="close" aria-label="Close tuner">${icon("x")}</button></header>
    <div class="tuner-face">
      <svg class="gauge" viewBox="0 0 300 170" aria-hidden="true">
        <path class="arc" d="M30 150 A120 120 0 0 1 270 150"/>
        <path class="zone" d="M137.5 31.6 A120 120 0 0 1 162.5 31.6"/>
        ${Array.from({ length: 21 }, (_, i) => {
          const ang = (-60 + i * 6) * Math.PI / 180, big = i % 5 === 0;
          const r1 = big ? 102 : 108, r2 = 118;
          return `<line class="tick${big ? " big" : ""}" x1="${150 + r1 * Math.sin(ang)}" y1="${150 - r1 * Math.cos(ang)}" x2="${150 + r2 * Math.sin(ang)}" y2="${150 - r2 * Math.cos(ang)}"/>`;
        }).join("")}
        <text x="34" y="168" class="lbl">flat</text><text x="266" y="168" class="lbl" text-anchor="end">sharp</text>
        <g class="needle"><line x1="150" y1="150" x2="150" y2="40"/><circle cx="150" cy="150" r="7"/></g>
      </svg>
      <div class="readout"><b class="note">–</b><span class="cents">Play a string</span><span class="hz"></span></div>
    </div>
    <div class="tuner-strings" role="group" aria-label="Choose a string to tune, and hear its reference note">
      <button type="button" class="on" data-s="auto">Auto</button>
      ${TUNING.map((t, i) => `<button type="button" data-s="${i}" title="Play reference ${t.name}${t.oct}">${t.name}</button>`).join("")}
    </div>
    <p class="tuner-msg small muted">Tap a string to hear its reference note and lock the tuner to it.</p>
  </form>`;
}

function setTarget(i) {
  target = i === "auto" ? null : Number(i);
  for (const b of dlg.querySelectorAll("[data-s]")) b.classList.toggle("on", b.dataset.s === String(i));
  if (target !== null) pluck(TUNING[target].freq, 0.75);
}

function frame() {
  analyser.getFloatTimeDomainData(data);
  const f = detectPitch(data, audioCtx().sampleRate);
  const face = dlg.querySelector(".tuner-face");
  if (f > 60 && f < 1400) {
    history.push(f);
    if (history.length > 7) history.shift();
    const sorted = [...history].sort((a, b) => a - b), freq = sorted[Math.floor(sorted.length / 2)];
    let ref, label;
    if (target !== null) { ref = TUNING[target].freq; label = TUNING[target].name; }
    else {
      const m = Math.round(midiOf(freq));
      ref = 440 * Math.pow(2, (m - 69) / 12);
      label = NOTE_NAMES[((m % 12) + 12) % 12];
      // Snap the label to the nearest open string when you're close to one.
      const near = TUNING.find((t) => Math.abs(centsOff(freq, t.freq)) < 60);
      if (near) { ref = near.freq; label = near.name; }
    }
    const cents = Math.max(-50, Math.min(50, centsOff(freq, ref)));
    dlg.querySelector(".note").textContent = label;
    dlg.querySelector(".hz").textContent = `${freq.toFixed(1)} Hz`;
    dlg.querySelector(".cents").textContent = Math.abs(cents) <= IN_TUNE ? "In tune" : cents < 0 ? `${Math.round(-cents)}¢ flat · tune up` : `${Math.round(cents)}¢ sharp · tune down`;
    dlg.querySelector(".needle").style.transform = `rotate(${cents * 1.2}deg)`;
    face.classList.toggle("good", Math.abs(cents) <= IN_TUNE);
    face.classList.add("live");
  } else if (history.length) {
    history = [];
    face.classList.remove("live", "good");
  }
  raf = requestAnimationFrame(frame);
}

async function startMic() {
  const msg = dlg.querySelector(".tuner-msg");
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    const ctx = audioCtx();
    const src = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    data = new Float32Array(analyser.fftSize);
    src.connect(analyser);
    msg.textContent = "Play one string at a time and let it ring. Tap a string below to hear its reference note.";
    raf = requestAnimationFrame(frame);
  } catch (e) {
    msg.textContent = e.name === "NotAllowedError"
      ? "Microphone access is blocked, so the tuner can't listen. You can still tune by ear with the reference notes below."
      : "Couldn't open the microphone. You can still tune by ear with the reference notes below.";
  }
}

function stopMic() {
  cancelAnimationFrame(raf);
  stream?.getTracks().forEach((t) => t.stop());
  stream = null; history = [];
}

export function openTuner() {
  if (!dlg) {
    dlg = document.createElement("dialog");
    dlg.className = "tuner-dialog";
    dlg.innerHTML = markup();
    dlg.addEventListener("close", stopMic);
    dlg.addEventListener("click", (e) => {
      const b = e.target.closest("[data-s]");
      if (b) setTarget(b.dataset.s);
      if (e.target === dlg) dlg.close(); // click on the backdrop
    });
    document.body.appendChild(dlg);
  }
  setTarget("auto");
  dlg.showModal();
  startMic();
}
