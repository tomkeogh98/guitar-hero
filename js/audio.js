let ctx;
export function audioCtx() {
  ctx ||= new (window.AudioContext || window.webkitAudioContext)();
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}

function blip(time, freq, len = 0.05, gain = 0.4) {
  const c = audioCtx();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.frequency.value = freq;
  g.gain.setValueAtTime(gain, time);
  g.gain.exponentialRampToValueAtTime(0.0001, time + len);
  osc.connect(g).connect(c.destination);
  osc.start(time);
  osc.stop(time + len + 0.02);
}

// End-of-block chime: three gentle rising notes.
export function chime() {
  const c = audioCtx(), t = c.currentTime;
  [659, 784, 988].forEach((f, i) => blip(t + i * 0.14, f, 0.5, 0.15));
}

// Look-ahead scheduler so clicks stay tight even when the tab is busy.
export class Metronome {
  constructor(onBeat) { this.bpm = 80; this.beats = 4; this.onBeat = onBeat; this.timer = null; }
  get running() { return this.timer !== null; }
  start() {
    if (this.running) return;
    const c = audioCtx();
    this.next = c.currentTime + 0.08;
    this.beat = 0;
    this.timer = setInterval(() => this.tick(), 25);
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  toggle() { this.running ? this.stop() : this.start(); }
  tick() {
    const c = audioCtx();
    while (this.next < c.currentTime + 0.1) {
      const accent = this.beat % this.beats === 0;
      blip(this.next, accent ? 1500 : 1000, 0.04, accent ? 0.5 : 0.3);
      const b = this.beat % this.beats, delay = Math.max(0, (this.next - c.currentTime) * 1000);
      setTimeout(() => this.onBeat?.(b), delay);
      this.next += 60 / this.bpm;
      this.beat++;
    }
  }
}

export const recordingSupported = () => Boolean(navigator.mediaDevices?.getUserMedia && window.MediaRecorder);

function pickMime() {
  for (const m of ["audio/webm;codecs=opus", "audio/mp4", "audio/webm", "audio/ogg;codecs=opus"]) {
    if (MediaRecorder.isTypeSupported?.(m)) return m;
  }
  return "";
}
export const extFor = (mime) => (mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm");

// Records up to maxSecs. onLevel(0..1) drives the meter, onTick(secs) the timer.
export async function startRecording({ maxSecs = 90, onLevel, onTick } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
  });
  const mime = pickMime();
  const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
  const chunks = [];
  rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);

  const c = audioCtx();
  const src = c.createMediaStreamSource(stream);
  const analyser = c.createAnalyser();
  analyser.fftSize = 512;
  src.connect(analyser);
  const buf = new Uint8Array(analyser.fftSize);
  let raf;
  const meter = () => {
    analyser.getByteTimeDomainData(buf);
    let peak = 0;
    for (const v of buf) peak = Math.max(peak, Math.abs(v - 128) / 128);
    onLevel?.(peak);
    raf = requestAnimationFrame(meter);
  };
  meter();

  const started = Date.now();
  const clock = setInterval(() => {
    const secs = (Date.now() - started) / 1000;
    onTick?.(secs);
    if (secs >= maxSecs) stop();
  }, 200);

  let resolveDone;
  const done = new Promise((r) => (resolveDone = r));
  rec.onstop = () => {
    cancelAnimationFrame(raf);
    clearInterval(clock);
    stream.getTracks().forEach((t) => t.stop());
    src.disconnect();
    const type = rec.mimeType || mime || "audio/webm";
    resolveDone({ blob: new Blob(chunks, { type }), mime: type, secs: Math.round((Date.now() - started) / 1000) });
  };
  function stop() { if (rec.state !== "inactive") rec.stop(); }
  rec.start(250);
  return { stop, done };
}
