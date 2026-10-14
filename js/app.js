import { AREAS, BLOCKS, getLesson, lessonLabel } from "./curriculum.js?v=1";
import { greet } from "./greetings.js?v=1";
import { GOALS, TIERS, context, currentTier, focusGoals, isDone, recordBestStreak, weakestArea } from "./goals.js?v=1";
import { REASONS, dayStatus, excuseOn, nudgeCheck, practisedOn, sessionsOn, shiftTargets, streak, weekSummary } from "./schedule.js?v=1";
import { configured, exportJSON, getAudio, importJSON, putAudio, saveSettings, stamp, store, syncNow, testConnection, update } from "./store.js?v=1";
import { Metronome, chime, extFor, recordingSupported, startRecording } from "./audio.js?v=1";
import { addDays, daysBetween, dayName, esc, fmt, monthName, mondayOf, parse, pickRandom, prettyDate, reducedMotion, shortDay, today, uid, weekday } from "./util.js?v=1";

const view = document.getElementById("view");
const $ = (sel, root = view) => root.querySelector(sel);
const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];

// ---------- doodles ----------
const MOODS = ["Rough", "Meh", "Okay", "Good", "Buzzing"];
function face(n, size = 44) {
  const mouths = [
    "M14 33 Q22 25 30 33",      // frown
    "M14 31 L30 30",             // flat
    "M14 29 Q22 33 30 29",       // slight smile
    "M13 27 Q22 37 31 27",       // smile
    "M12 26 Q22 40 32 26 Z",     // grin
  ];
  const eyes = n === 4
    ? `<path d="M13 15 l2 4 l2 -4 M27 15 l2 4 l2 -4" class="ink" fill="none"/>`
    : `<circle cx="16" cy="18" r="2.2" class="fill"/><circle cx="28" cy="18" r="2.2" class="fill"/>`;
  return `<svg class="face" viewBox="0 0 44 44" width="${size}" height="${size}" aria-hidden="true">
    <path d="M22 3 C35 2 42 11 41 23 C40 35 31 42 21 41 C10 40 3 32 3 21 C4 10 11 4 22 3 Z" class="ink" fill="none"/>
    ${eyes}<path d="${mouths[n]}" class="ink" fill="${n === 4 ? "currentColor" : "none"}"/></svg>`;
}
const PICK_PATH = "M12 1 C19 1 23 5 23 10 C23 17 16 23 12 23 C8 23 1 17 1 10 C1 5 5 1 12 1 Z";
const pickSvg = (cls = "") => `<svg class="pick ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PICK_PATH}"/></svg>`;
const squiggle = `<svg class="squiggle" viewBox="0 0 300 14" preserveAspectRatio="none" aria-hidden="true"><path d="M2 9 C30 2 50 13 80 7 S130 3 160 8 S220 12 250 6 S290 5 298 8"/></svg>`;

function tally(n) {
  let out = "";
  for (let left = n; left > 0; left -= 5) {
    const g = Math.min(5, left);
    out += `<span class="tally${g === 5 ? " five" : ""}">${"<i></i>".repeat(Math.min(g, 4))}</span>`;
  }
  return out || `<span class="muted">—</span>`;
}

const firstSentence = (t) => (t.match(/^.*?[.!?](\s|$)/) || [t])[0].trim();
const liveSessions = () => Object.values(store.state.sessions).filter((s) => !s.deleted);
const lessonsDone = () => liveSessions().filter((s) => s.lesson != null).length;

// ---------- header ----------
function renderSync() {
  const el = document.getElementById("sync");
  const { status, message } = store.sync;
  el.dataset.status = configured() ? status : "off";
  el.title = configured() ? message : "Not syncing yet. Set it up in Settings";
  el.querySelector("span").textContent = configured() ? (status === "ok" ? "synced" : status === "error" ? "sync error" : status === "syncing" ? "syncing…" : "sync") : "local only";
}
function renderNav(route) {
  for (const a of document.querySelectorAll("nav a")) a.classList.toggle("on", a.getAttribute("href") === `#/${route}`);
}

// ---------- TODAY ----------
let greetingLine = null;
const NUDGES = {
  excuses: [
    "Hey Tom, {n} days off with a reason in the last four weeks. Life happens, and that's fine. But guitar loves routine. How about ten easy minutes today, just for the fun of it?",
    "Tom, I've noticed {n} excused days lately. If you're genuinely unwell or away, look after yourself. If it's more 'meh' than 'sick', pick the guitar up for five minutes. That's usually all it takes.",
  ],
  missed: [
    "{n} missed days in the last fortnight, Tom. No guilt trip, just a nudge: even a short session keeps the momentum alive. Your fingertips will thank you.",
    "Psst, Tom. The guitar's been looking a bit lonely ({n} missed days recently). Today's lesson is only 30 minutes, and free play is the best bit.",
  ],
  behind: [
    "This week's looking light, Tom. You need {n} more session{s} to hit five. You can move a lesson to the weekend from the tracker.",
    "Five a week is the deal, Tom, and you're {n} short. Squeeze one in or shift one to Saturday. You've got this.",
  ],
};

function renderToday() {
  const s = store.state, now = today();
  const done = lessonsDone();
  const st = dayStatus(s, now);
  const sessionsSorted = liveSessions().sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0));
  const last = sessionsSorted.find((x) => x.lesson != null && x.date < now) || null;
  const lastAny = sessionsSorted[0];
  const str = streak(s);
  if (!greetingLine) {
    greetingLine = greet({
      hour: new Date().getHours(), weekday: weekday(now), streak: str,
      daysAway: lastAny ? daysBetween(lastAny.date, now) : 0,
      doneToday: practisedOn(s, now), firstVisit: liveSessions().length === 0,
    });
  }
  const nudge = nudgeCheck(s);
  const wk = weekSummary(s, now);
  const lesson = getLesson(done);
  const todays = sessionsOn(s, now).filter((x) => x.lesson != null);

  const runSheet = BLOCKS.map((b) => `<li><b>${b.label}</b> <span class="mins">${b.mins}m</span> ${b.key === "free" ? "Anything you like. This is the fun bit." : b.key === "rec" ? "Record: " + esc(lesson.blocks.rec) : esc(firstSentence(lesson.blocks[b.key]))}</li>`).join("");

  let lastPara;
  if (!last) lastPara = `<p>This is page one, so there's nothing to look back on yet. ${esc(lesson.buildsOn)}</p>`;
  else {
    const L = getLesson(last.lesson, last.guitar);
    const how = last.journal?.how ? ` You wrote: <q>${esc(last.journal.how.slice(0, 140))}${last.journal.how.length > 140 ? "…" : ""}</q>` : "";
    lastPara = `<p><span class="hl">Last time</span> (${dayName(last.date)}) was <b>${esc(L.title)}</b>: ${esc(firstSentence(L.blocks.x)).toLowerCase()}${how}</p>
      <p><span class="hl green">Today builds on it:</span> ${esc(lesson.buildsOn)}</p>`;
  }

  let planCard;
  if (st === "done") {
    const t = todays[0];
    planCard = `<section class="page card plan">
      <div class="tape"></div>
      <h2>Done for today ${pickSvg("inline")}</h2>
      ${t ? `<p>You did <b>${esc(t.title)}</b> (${lessonLabel(t.lesson)}) on the ${esc(t.guitar)}.${t.journal?.win ? ` Today's win: <q>${esc(t.journal.win)}</q>` : ""}</p>` : `<p>Practice logged. Nice one.</p>`}
      <p class="muted">Tomorrow's page: <b>${esc(lesson.title)}</b> (${lessonLabel(done)}).</p>
      <div class="row"><a class="btn ghost" href="#/tapes">Listen back</a><a class="btn ghost" href="#/lesson">Fancy another? Do the next one now</a></div>
    </section>`;
  } else if (st === "excused") {
    const ex = excuseOn(s, now);
    planCard = `<section class="page card plan"><div class="tape"></div>
      <h2>Logged as: ${REASONS[ex.reason].label.toLowerCase()}</h2>
      <p>${ex.reason === "sick" ? "Rest up, Tom. Your hands will be fresh when you're back." : ex.reason === "holiday" ? "Enjoy the break, Tom! If there's a guitar where you are, noodle away." : "Hope everything's okay, Tom. The guitar will be here when you're ready."}</p>
      <div class="row"><button class="btn ghost" data-act="unexcuse" data-date="${now}">Actually, I'm fine. Remove it</button></div>
    </section>`;
  } else if (st === "off") {
    planCard = `<section class="page card plan"><div class="tape"></div>
      <h2>Day off</h2>
      <p>No lesson scheduled today. Rest counts as practice too: your brain sorts out what you've learnt while you're away from the guitar.</p>
      <p class="muted">Next lesson: <b>${esc(lesson.title)}</b> (${lessonLabel(done)}).</p>
      <div class="row"><a class="btn ghost" href="#/lesson">Itching to play? Do it now</a></div>
    </section>`;
  } else {
    planCard = `<section class="page card plan"><div class="tape"></div>
      <p class="tag">${lessonLabel(done)} · ${esc(lesson.weekTitle)}</p>
      <h2>Today: ${esc(lesson.title)}</h2>
      <ol class="runsheet">${runSheet}</ol>
      ${lastPara}
      <div class="row"><a class="btn big" href="#/lesson">Start today's lesson →</a><span class="muted small">30 minutes · electric or acoustic</span></div>
    </section>`;
  }

  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(wk.mon, i), ds = dayStatus(s, d);
    const ex = excuseOn(s, d);
    return `<a class="mini ${ds}${d === now ? " now" : ""}" href="#/tracker" title="${prettyDate(d)}: ${ds}"><small>${shortDay(d)[0]}</small>${ex ? REASONS[ex.reason].mark : ""}</a>`;
  }).join("");

  const goals = focusGoals(s, 2);

  view.innerHTML = `
    <section class="hero">
      <p class="date">${prettyDate(now)}</p>
      <h1 class="greet">${esc(greetingLine)}</h1>${squiggle}
      <div class="stickers">
        <span class="sticker streak" title="Practice streak">${pickSvg()}<b>${str}</b><small>day streak</small></span>
        <span class="sticker week"><b>${wk.practised}/${Math.max(wk.required, 1)}</b><small>this week</small></span>
        <span class="sticker lessons"><b>${done}</b><small>lessons done</small></span>
      </div>
    </section>
    ${nudge ? `<aside class="sticky pink nudge" role="status"><b>A warm nudge</b><p>${esc(pickRandom(NUDGES[nudge.kind]).replace("{n}", nudge.count).replace("{s}", nudge.count === 1 ? "" : "s"))}</p></aside>` : ""}
    ${planCard}
    <section class="split">
      <div class="card">
        <h3>This week</h3>
        <div class="strip">${strip}</div>
        <p class="small muted">Five a week, weekdays by default. Tap a day to move or excuse a lesson.</p>
      </div>
      <div class="card">
        <h3>Working towards</h3>
        ${goals.map((g) => `<div class="sticky ${g.tier % 2 ? "blue" : "yellow"} mini-goal">${esc(g.title)}</div>`).join("") || "<p>Everything ticked off. Legend.</p>"}
        <a class="small" href="#/goals">All goals →</a>
      </div>
    </section>`;
}

// ---------- LESSON ----------
const LESSON_KEY = "gh.lesson.v1";
let lessonRun = null;      // { index, guitar, step, startedAt }
let pendingTake = null;    // { blob, mime, secs, url }
let timer = null;          // { left, total, running, handle }
let metro = null;
let recorder = null;

function saveRun() { try { sessionStorage.setItem(LESSON_KEY, JSON.stringify(lessonRun)); } catch {} }
function stopAll() {
  if (timer?.handle) clearInterval(timer.handle);
  timer = null;
  metro?.stop();
  recorder?.stop();
  recorder = null;
}

function ensureRun() {
  const idx = lessonsDone();
  if (!lessonRun) { try { lessonRun = JSON.parse(sessionStorage.getItem(LESSON_KEY)); } catch {} }
  if (!lessonRun || lessonRun.index !== idx) {
    lessonRun = { index: idx, guitar: null, step: 0, startedAt: Date.now() };
    pendingTake = null;
  }
  if (!pendingTake && lessonRun.step > 6) lessonRun.step = 6; // take was lost on reload
}

function renderLesson() {
  stopAll();
  ensureRun();
  const { index, guitar, step } = lessonRun;
  const L = getLesson(index, guitar || "electric");
  const steps = BLOCKS.length + 2; // guitar pick + blocks + journal
  const progress = `<div class="progress" aria-label="Step ${step + 1} of ${steps}">${Array.from({ length: steps }, (_, i) => `<i class="${i < step ? "done" : i === step ? "now" : ""}"></i>`).join("")}</div>`;
  const head = `<p class="tag">${lessonLabel(index)} · ${esc(L.weekTitle)}</p><h1 class="lesson-title">${esc(L.title)}</h1>${progress}`;

  if (step === 0) {
    view.innerHTML = `<section class="page card">${head}
      <h2>Which guitar today?</h2>
      <p>I'll tailor the technique and tone tips to it.</p>
      <div class="guitars">
        <button class="guitar-btn" data-act="guitar" data-g="electric">${guitarDoodle("electric")}<b>Electric</b></button>
        <button class="guitar-btn" data-act="guitar" data-g="acoustic">${guitarDoodle("acoustic")}<b>Acoustic</b></button>
      </div>
      <p class="muted small">Builds on: ${esc(L.buildsOn)}</p>
    </section>`;
    return;
  }

  if (step <= BLOCKS.length) {
    const b = BLOCKS[step - 1];
    const text = L.blocks[b.key];
    const showMetro = ["w", "x", "r", "s"].includes(b.key);
    let body = `<p class="block-text">${esc(text)}</p>`;
    if (b.key === "x" && L.tab) body += `<pre class="tab">${esc(L.tab)}</pre>`;
    if (b.key === "x") body += `<p class="tone"><b>Tone &amp; taste (${esc(guitar)}):</b> ${esc(L.tone)}</p>`;
    if (b.key === "rec") body = recordBlock(L);
    if (b.key === "free") body = `<p class="block-text">${esc(text)}</p><p class="muted">Or ignore that and play whatever makes you grin. That's the point of free play.</p>`;
    view.innerHTML = `<section class="page card lesson">${head}
      <div class="block-head"><h2>${b.label}</h2><span class="mins">${b.mins} min</span></div>
      <div class="block-grid">
        <div>${body}</div>
        <div class="tools">
          ${b.key !== "rec" ? `<div class="timer" data-total="${b.mins * 60}"><span class="clock">${b.mins}:00</span><div class="row"><button class="btn small" data-act="timer">Start timer</button><button class="btn small ghost" data-act="timer-reset">Reset</button></div></div>` : ""}
          ${showMetro ? metroWidget(L.bpm) : ""}
        </div>
      </div>
      <div class="row nav-row">
        <button class="btn ghost" data-act="prev">← Back</button>
        <button class="btn" data-act="next" ${b.key === "rec" && !pendingTake?.url ? "data-needs-take" : ""}>${step === BLOCKS.length ? "Write it up →" : "Next →"}</button>
      </div>
    </section>`;
    if (showMetro) bindMetro(L.bpm);
    return;
  }

  // Journal
  view.innerHTML = `<section class="page card lesson">${head}
    <h2>Journal</h2>
    <p>Quick notes for future Tom. Two minutes, tops.</p>
    <form id="journal">
      <fieldset class="moods"><legend>How did it feel overall?</legend>
        ${MOODS.map((m, i) => `<label class="mood"><input type="radio" name="mood" value="${i}" ${i === 3 ? "checked" : ""}>${face(i)}<span>${m}</span></label>`).join("")}
      </fieldset>
      <fieldset class="ratings"><legend>How solid did each area feel? (1 = shaky, 5 = nailed it)</legend>
        ${L.areas.map((a) => `<div class="rate"><span>${AREAS[a]}</span>${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="r-${a}" value="${v}" ${v === 3 ? "checked" : ""}><b>${v}</b></label>`).join("")}</div>`).join("")}
      </fieldset>
      <label class="field">How did it go?<textarea name="how" rows="3" placeholder="e.g. Changes were smoother, but the bend was flat…"></textarea></label>
      <label class="field">What felt hard?<textarea name="hard" rows="2"></textarea></label>
      <label class="field">One small win<input name="win" placeholder="e.g. Got through the song without stopping!"></label>
      <div class="row nav-row"><button type="button" class="btn ghost" data-act="prev">← Back</button><button class="btn big" type="submit">Save today's page ✓</button></div>
    </form>
  </section>`;
}

function guitarDoodle(kind) {
  return kind === "electric"
    ? `<svg viewBox="0 0 120 60" class="g-doodle" aria-hidden="true"><path class="ink" fill="none" d="M8 34 C6 22 18 16 28 22 C34 14 46 14 50 24 C56 30 54 44 44 46 C36 52 22 50 16 46 C10 44 9 40 8 34 Z M50 30 L112 26 M50 34 L112 30 M104 20 L116 20 L116 36 L104 36"/><circle class="fill" cx="30" cy="34" r="3"/><path class="ink" d="M36 28 L36 40" /></svg>`
    : `<svg viewBox="0 0 120 60" class="g-doodle" aria-hidden="true"><path class="ink" fill="none" d="M6 32 C4 16 22 10 32 20 C40 12 58 16 56 32 C58 48 40 54 32 46 C22 56 4 48 6 32 Z M56 29 L112 27 M56 35 L112 33 M104 21 L116 21 L116 39 L104 39"/><circle class="ink" fill="none" cx="34" cy="32" r="7"/></svg>`;
}

function metroWidget(bpm) {
  return `<div class="metro"><button class="btn small" data-act="metro">▶ Metronome</button>
    <div class="bpm"><button data-act="bpm" data-d="-5" aria-label="Slower">−</button><output>${bpm}</output><span>bpm</span><button data-act="bpm" data-d="5" aria-label="Faster">+</button></div>
    <div class="beats">${"<i></i>".repeat(4)}</div></div>`;
}
function bindMetro(bpm) {
  metro = new Metronome((b) => {
    $$(".beats i").forEach((el, i) => el.classList.toggle("on", i === b));
  });
  metro.bpm = bpm;
}

function recordBlock(L) {
  if (!recordingSupported()) return `<p class="block-text">${esc(L.blocks.rec)}</p><p class="warn">This browser can't record audio. Try Chrome or Safari, or skip this take.</p>`;
  return `<p class="block-text"><b>Record this:</b> ${esc(L.blocks.rec)}</p>
    <p class="muted small">Up to 90 seconds. Count yourself in, play it, done. This becomes evidence of your progress, so no noodling!</p>
    <div class="recorder">
      <button class="rec-btn" data-act="rec" aria-label="Record"><span></span></button>
      <div class="meter"><i></i></div><span class="rec-time">0:00</span>
    </div>
    <div class="take">${pendingTake?.url ? `<audio controls src="${pendingTake.url}"></audio><button class="btn small ghost" data-act="retake">Retake</button>` : ""}</div>
    ${pendingTake?.url ? "" : `<button class="linkish small" data-act="skip-rec">Can't record today? Skip it</button>`}`;
}

async function toggleRecord(btn) {
  if (recorder) { recorder.stop(); return; }
  try {
    btn.classList.add("live");
    metro?.stop();
    const timeEl = $(".rec-time"), bar = $(".meter i");
    recorder = await startRecording({
      maxSecs: 90,
      onLevel: (v) => { if (bar) bar.style.transform = `scaleX(${Math.min(1, v * 1.4)})`; },
      onTick: (s) => { if (timeEl) timeEl.textContent = `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`; },
    });
    const take = await recorder.done;
    recorder = null;
    if (pendingTake?.url) URL.revokeObjectURL(pendingTake.url);
    pendingTake = { ...take, url: URL.createObjectURL(take.blob) };
    renderLesson();
  } catch (e) {
    recorder = null;
    btn.classList.remove("live");
    alert(e.name === "NotAllowedError" ? "Microphone access was blocked. Allow it in the browser's address bar, then try again." : `Recording didn't work: ${e.message}`);
  }
}

function tickTimer() {
  const el = $(".timer .clock");
  if (!timer || !el) return;
  timer.left = Math.max(0, timer.left - 1);
  el.textContent = `${Math.floor(timer.left / 60)}:${String(timer.left % 60).padStart(2, "0")}`;
  if (timer.left === 0) {
    clearInterval(timer.handle);
    timer.running = false;
    $(".timer").classList.add("ding");
    $("[data-act=timer]").textContent = "Time's up!";
    chime();
  }
}

async function saveJournal(form) {
  const fd = new FormData(form);
  const L = getLesson(lessonRun.index, lessonRun.guitar);
  const date = today();
  const id = uid();
  const ratings = Object.fromEntries(L.areas.map((a) => [a, Number(fd.get(`r-${a}`))]));
  let recording = null;
  if (pendingTake && !pendingTake.skipped) {
    const name = `${date}-lesson${String(lessonRun.index + 1).padStart(3, "0")}-${id.slice(-4)}.${extFor(pendingTake.mime)}`;
    await putAudio(name, pendingTake.blob);
    recording = { name, mime: pendingTake.mime, secs: pendingTake.secs, uploaded: false };
  }
  update((s) => {
    s.sessions[id] = stamp({
      id, date, lesson: lessonRun.index, title: L.title, guitar: lessonRun.guitar,
      startedAt: lessonRun.startedAt, completedAt: Date.now(), recording,
      journal: { mood: Number(fd.get("mood")), ratings, how: fd.get("how").trim(), hard: fd.get("hard").trim(), win: fd.get("win").trim() },
    });
    const best = recordBestStreak(s);
    if (best) s.goals["_best-streak"] = stamp({ value: best });
  });
  lessonRun = null;
  pendingTake = null;
  try { sessionStorage.removeItem(LESSON_KEY); } catch {}
  greetingLine = null;
  confetti();
  location.hash = "#/";
}

function confetti() {
  if (reducedMotion()) return;
  const layer = document.createElement("div");
  layer.className = "confetti";
  const colours = ["#ff6b4a", "#ffd23f", "#3bb273", "#4d7cfe", "#ff8fc7"];
  for (let i = 0; i < 40; i++) {
    const p = document.createElement("span");
    p.innerHTML = pickSvg();
    p.style.left = `${Math.random() * 100}vw`;
    p.style.color = colours[i % colours.length];
    p.style.animationDelay = `${Math.random() * 0.6}s`;
    p.style.setProperty("--spin", `${Math.random() * 720 - 360}deg`);
    p.style.setProperty("--drift", `${Math.random() * 120 - 60}px`);
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 3200);
}

// ---------- TRACKER ----------
let cal = null; // { y, m }
let selected = null;

function renderTracker() {
  const s = store.state, now = today();
  if (!cal) { const d = parse(now); cal = { y: d.getFullYear(), m: d.getMonth() }; }
  const first = fmt(new Date(cal.y, cal.m, 1));
  const gridStart = mondayOf(first);
  const days = [];
  for (let d = gridStart; ; d = addDays(d, 1)) {
    const inMonth = parse(d).getMonth() === cal.m;
    if (!inMonth && days.length >= 28 && days.length % 7 === 0) break;
    days.push(d);
  }
  const cells = days.map((d) => {
    const st = dayStatus(s, d), ex = excuseOn(s, d), inMonth = parse(d).getMonth() === cal.m;
    const hasRec = sessionsOn(s, d).some((x) => x.recording);
    return `<button class="day ${st}${inMonth ? "" : " out"}${d === now ? " now" : ""}${d === selected ? " sel" : ""}" data-act="day" data-date="${d}" aria-label="${prettyDate(d)}: ${st}">
      <span class="num">${parse(d).getDate()}</span>${ex ? `<span class="mark">${REASONS[ex.reason].mark}</span>` : ""}${hasRec ? `<span class="recdot" title="Has a recording"></span>` : ""}</button>`;
  }).join("");

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const w = weekSummary(s, days[i]);
    if (days[i] > now) break;
    if (days[i + 6] < s.startDate) continue;
    weeks.push(`<li><span>w/c ${parse(days[i]).getDate()} ${monthName(parse(days[i]).getMonth()).slice(0, 3)}</span>${tally(w.practised)}<b class="${w.practised >= w.required ? "ok" : days[i + 6] < now ? "short" : ""}">${w.practised}/${w.required}</b>${w.excused ? `<small>${w.excused} excused</small>` : ""}</li>`);
  }

  // all-time stats
  let practised = 0, missed = 0, excused = 0;
  for (let d = s.startDate; d <= now; d = addDays(d, 1)) {
    const st = dayStatus(s, d);
    if (st === "done") practised++; else if (st === "missed") missed++; else if (st === "excused") excused++;
  }

  view.innerHTML = `
    <section class="page card">
      <div class="cal-head">
        <button class="btn small ghost" data-act="month" data-d="-1" aria-label="Previous month">←</button>
        <h1>${monthName(cal.m)} <small>${cal.y}</small></h1>
        <button class="btn small ghost" data-act="month" data-d="1" aria-label="Next month">→</button>
      </div>
      <div class="cal">
        ${["M", "T", "W", "T", "F", "S", "S"].map((d) => `<span class="dow">${d}</span>`).join("")}
        ${cells}
      </div>
      <div class="legend">
        <span><i class="done"></i>Practised</span><span><i class="missed"></i>Missed</span><span><i class="off"></i>Not scheduled</span>
        <span><i class="excused"></i>Excused (S sick · H holiday · E emergency)</span><span><i class="planned"></i>Coming up</span>
      </div>
      <div id="day-panel">${selected ? dayPanel(selected) : `<p class="muted small">Tap a day to move a lesson, log a reason, or see what you played.</p>`}</div>
    </section>
    <section class="split">
      <div class="card stats">
        <h3>The numbers</h3>
        <div class="statgrid">
          <div><b>${practised}</b><small>days practised</small></div>
          <div><b>${streak(s)}</b><small>current streak</small></div>
          <div><b class="red">${missed}</b><small>missed</small></div>
          <div><b>${excused}</b><small>excused</small></div>
        </div>
      </div>
      <div class="card">
        <h3>Weekly tally</h3>
        <ul class="tallies">${weeks.join("") || "<li class='muted'>Nothing yet. Your first tally mark is one lesson away.</li>"}</ul>
        <p class="small muted">Five a week minimum. Sick, holiday and emergency days lower the target.</p>
      </div>
    </section>`;
}

function dayPanel(d) {
  const s = store.state, now = today(), st = dayStatus(s, d);
  const sess = sessionsOn(s, d);
  const reasonBtns = Object.entries(REASONS).map(([k, r]) => `<button class="btn small ghost" data-act="excuse" data-date="${d}" data-reason="${k}">${r.label}</button>`).join("");
  const targets = shiftTargets(s, d).map((t) => `<button class="btn small" data-act="shift" data-from="${d}" data-to="${t}">${shortDay(t)} ${parse(t).getDate()}</button>`).join("");
  const movedHere = Object.entries(s.shifts).find(([, v]) => !v.deleted && v.to === d);
  const movedAway = s.shifts[d] && !s.shifts[d].deleted ? s.shifts[d] : null;
  let body = "";
  if (st === "done") {
    body = sess.map((x) => `<p>${x.lesson != null ? `<b>${esc(x.title)}</b> · ${lessonLabel(x.lesson)}` : "<b>Free practice</b>"} ${x.guitar ? `on the ${esc(x.guitar)}` : ""} ${x.journal?.mood != null ? face(x.journal.mood, 28) : ""}</p>`).join("") + `<a class="small" href="#/tapes">See it in Tapes →</a>`;
  } else if (st === "excused") {
    body = `<p>Logged as <b>${REASONS[excuseOn(s, d).reason].label.toLowerCase()}</b>.</p><button class="btn small ghost" data-act="unexcuse" data-date="${d}">Remove</button>`;
  } else if (st === "missed") {
    body = `<p>Scheduled, but no practice logged.</p>
      <p class="small">Was there a reason?</p><div class="row">${reasonBtns}</div>
      ${targets ? `<p class="small">Or make it up later this week:</p><div class="row">${targets}</div>` : ""}
      <p class="small">Actually played but forgot to log it? <button class="linkish" data-act="logfree" data-date="${d}">Log a free practice</button></p>`;
  } else if (st === "today" || st === "planned") {
    body = `${st === "today" ? `<a class="btn small" href="#/lesson">Start today's lesson →</a>` : ""}<p>${st === "today" ? "Today's lesson." : "Lesson scheduled."}${movedHere ? " (Moved here from " + shortDay(movedHere[0]) + ")" : ""}</p>
      ${targets ? `<p class="small">Move it to:</p><div class="row">${targets}</div>` : `<p class="small muted">No free days left this week to move it to.</p>`}
      ${movedHere ? `<button class="btn small ghost" data-act="unshift" data-from="${movedHere[0]}">Undo the move</button>` : ""}
      <p class="small">Can't do it?</p><div class="row">${reasonBtns}</div>`;
  } else if (st === "off") {
    body = movedAway ? `<p>Lesson moved to ${prettyDate(movedAway.to)}.</p><button class="btn small ghost" data-act="unshift" data-from="${d}">Undo the move</button>`
      : `<p>Not scheduled. ${d <= now ? `<button class="linkish" data-act="logfree" data-date="${d}">Played anyway? Log it</button>` : "Enjoy the day off."}</p>`;
  } else body = `<p class="muted">Before you started.</p>`;
  return `<div class="panel"><h3>${prettyDate(d)}</h3>${body}</div>`;
}

// ---------- GOALS ----------
function renderGoals() {
  const s = store.state, ctx = context(s), tier = currentTier(s, ctx), weak = weakestArea(s);
  const next = TIERS[tier + 1];
  const tierDone = GOALS.filter((g) => g.tier === tier && isDone(s, g, ctx)).length;
  const focus = focusGoals(s, 3);
  const goalItem = (g) => {
    const done = isDone(s, g, ctx), locked = g.tier > tier;
    return `<li class="${done ? "done" : ""}${locked ? " locked" : ""}">
      <label><input type="checkbox" data-act="goal" data-id="${g.id}" ${done ? "checked" : ""} ${g.auto ? "disabled" : ""}><span class="box"></span>
      <span>${esc(g.title)} ${g.auto ? `<small class="muted">(ticks itself)</small>` : ""} <small class="area">${AREAS[g.area]}</small></span></label>
      ${done && s.goals[g.id]?.date ? `<small class="muted">${prettyDate(s.goals[g.id].date)}</small>` : ""}</li>`;
  };
  view.innerHTML = `
    <section class="page card level">
      <div class="tape"></div>
      <p class="tag">Current level</p>
      <h1>${TIERS[tier].name}</h1>
      ${next ? `<p>To reach <b>${next.name}</b>: get to lesson ${next.from} (${Math.min(ctx.lessons, next.from)}/${next.from}) and tick off 2 ${TIERS[tier].name} goals (${Math.min(tierDone, 2)}/2).</p>
        <div class="pencil-bar"><i style="width:${Math.round(100 * (Math.min(ctx.lessons / next.from, 1) + Math.min(tierDone / 2, 1)) / 2)}%"></i></div>`
        : "<p>Top of the notebook. Time to write the next one.</p>"}
    </section>
    ${weak ? `<aside class="sticky blue"><b>Your journal says ${esc(weak.label.toLowerCase())} feels shakiest</b> (averaging ${weak.avg.toFixed(1)}/5).<p>${esc(weak.tip)}</p></aside>` : ""}
    <section class="card">
      <h2>Focus on these next</h2>
      <div class="focus">${focus.map((g, i) => `<div class="sticky ${["yellow", "pink", "green"][i]}"><p>${esc(g.title)}</p><small>${AREAS[g.area]}</small>${g.auto ? "" : `<button class="btn small" data-act="goal-done" data-id="${g.id}">Done it!</button>`}</div>`).join("") || "<p>All clear. Pick your own next challenge!</p>"}</div>
    </section>
    ${TIERS.map((t, i) => `<section class="card tier ${i > tier ? "future" : ""}">
      <h3>${t.name} ${i > tier ? `<small class="muted">unlocks around lesson ${t.from}</small>` : i === tier ? `<small class="hl">you are here</small>` : ""}</h3>
      <ul class="goal-list">${GOALS.filter((g) => g.tier === i).map(goalItem).join("")}</ul>
    </section>`).join("")}`;
}

// ---------- TAPES ----------
let tapeFilter = "all";
function renderTapes() {
  const list = liveSessions().sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt || 0) - (a.completedAt || 0))
    .filter((x) => tapeFilter === "all" || x.recording);
  const firstTake = liveSessions().filter((x) => x.recording).sort((a, b) => a.date.localeCompare(b.date))[0];
  view.innerHTML = `
    <section class="tapes-head">
      <h1>Tapes &amp; notes</h1>
      <p>Every lesson's take and journal entry, newest first. Proof you're getting better.</p>
      <div class="row"><button class="btn small ${tapeFilter === "all" ? "" : "ghost"}" data-act="filter" data-f="all">Everything</button><button class="btn small ${tapeFilter === "rec" ? "" : "ghost"}" data-act="filter" data-f="rec">Just recordings</button></div>
    </section>
    <section class="polaroids">
      ${list.map((x, i) => `<article class="polaroid" style="--tilt:${((i * 37) % 7) - 3}deg">
        <div class="snap">${x.journal?.mood != null ? face(x.journal.mood, 56) : pickSvg("big")}
          ${x.recording ? `<button class="btn small play" data-act="play" data-name="${esc(x.recording.name)}">▶ Play ${x.recording.secs ? `(${x.recording.secs}s)` : ""}</button>${firstTake && firstTake.id !== x.id ? `<button class="linkish small" data-act="play" data-name="${esc(firstTake.recording.name)}">vs. your first take</button>` : ""}` : `<span class="muted small">no recording</span>`}
          <div class="player"></div>
        </div>
        <h3>${prettyDate(x.date)}</h3>
        <p class="small"><b>${esc(x.title || "Free practice")}</b>${x.lesson != null ? ` · ${lessonLabel(x.lesson)}` : ""}${x.guitar ? ` · ${esc(x.guitar)}` : ""}</p>
        ${x.journal?.how ? `<p class="hand">${esc(x.journal.how)}</p>` : ""}
        ${x.journal?.hard ? `<p class="small"><span class="hl pink">Hard:</span> ${esc(x.journal.hard)}</p>` : ""}
        ${x.journal?.win ? `<p class="small"><span class="hl green">Win:</span> ${esc(x.journal.win)}</p>` : ""}
      </article>`).join("") || `<p class="muted">Nothing here yet. Finish a lesson and your first take shows up here.</p>`}
    </section>`;
}

async function playTape(btn) {
  const player = btn.closest(".snap").querySelector(".player");
  player.textContent = "Loading…";
  try {
    const blob = await getAudio(btn.dataset.name);
    if (!blob) { player.textContent = "Couldn't find that recording. It may not have synced from the device you made it on yet."; return; }
    player.innerHTML = `<audio controls autoplay src="${URL.createObjectURL(blob)}"></audio>`;
  } catch (e) { player.textContent = `Couldn't load it: ${e.message}`; }
}

// ---------- SETTINGS ----------
function renderSettings() {
  const st = store.settings;
  view.innerHTML = `
    <section class="page card">
      <div class="tape"></div>
      <h1>Settings</h1>
      <h2>Sync between devices</h2>
      <p>Your log, journal and recordings are saved to a <b>private</b> GitHub repo, so your laptop and phone stay in step. You'll need a token on each device:</p>
      <ol class="small steps">
        <li>Open <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → new fine-grained token</a>.</li>
        <li>Name it “Guitar Hero (this device)”, and set expiration to 1 year.</li>
        <li><b>Repository access:</b> Only select repositories → <code>guitar-hero-data</code>.</li>
        <li><b>Permissions → Repository → Contents:</b> Read and write. Nothing else.</li>
        <li>Generate it and paste it below. It's stored only in this browser.</li>
      </ol>
      <form id="sync-form" class="stack">
        <label class="field">Data repo<input name="repo" value="${esc(st.repo)}" autocomplete="off" spellcheck="false"></label>
        <label class="field">Token<input name="token" type="password" value="${esc(st.token)}" autocomplete="off" placeholder="github_pat_…"></label>
        <div class="row"><button class="btn">Save &amp; test</button><button type="button" class="btn ghost" data-act="sync">Sync now</button>${st.token ? `<button type="button" class="btn ghost" data-act="disconnect">Forget token</button>` : ""}</div>
        <p class="sync-msg small" data-status="${store.sync.status}">${configured() ? esc(store.sync.message || "") + (store.sync.lastSynced ? ` · last synced ${store.sync.lastSynced.toLocaleTimeString()}` : "") : "Not connected: everything stays on this device for now."}</p>
      </form>
    </section>
    <section class="card">
      <h2>Warm nudges by email</h2>
      <p class="small">The data repo checks your log every weekday evening. If you're missing lessons or logging lots of excused days, it opens an issue that @mentions you, so GitHub sends you a notification and an email. Close the issue once you've read it.</p>
    </section>
    <section class="card">
      <h2>Your plan</h2>
      <form id="start-form" class="row"><label class="field">Started on<input type="date" name="start" value="${store.state.startDate}"></label><button class="btn small ghost">Update</button></form>
      <p class="small muted">Lessons on weekdays; weekends off. Minimum five a week, unless you're sick, on holiday or dealing with an emergency.</p>
    </section>
    <section class="card">
      <h2>Backup</h2>
      <div class="row"><button class="btn ghost" data-act="export">Download backup (.json)</button><label class="btn ghost">Restore from backup<input type="file" accept="application/json" data-act="import" hidden></label></div>
      <p class="small muted">Backups hold your log and journal. Recordings live in the data repo and this browser.</p>
    </section>`;
}

// ---------- routing & events ----------
const ROUTES = { "": renderToday, lesson: renderLesson, tracker: renderTracker, goals: renderGoals, tapes: renderTapes, settings: renderSettings };
const currentRoute = () => (location.hash.replace(/^#\/?/, "").split("/")[0]) || "";

function render() {
  const r = currentRoute();
  if (r !== "lesson") stopAll();
  (ROUTES[r] || renderToday)();
  renderNav(r);
  renderSync();
}

window.addEventListener("hashchange", () => { render(); window.scrollTo(0, 0); });
store.subscribe(() => { renderSync(); if (!["lesson", "settings"].includes(currentRoute())) render(); });

view.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act, s = store.state;
  switch (a) {
    case "guitar": lessonRun.guitar = el.dataset.g; lessonRun.step = 1; saveRun(); renderLesson(); window.scrollTo(0, 0); break;
    case "next":
      if (el.hasAttribute("data-needs-take") && !confirm("No take recorded yet. Skip the recording this time?")) return;
      if (el.hasAttribute("data-needs-take")) pendingTake = { skipped: true };
      lessonRun.step++; saveRun(); renderLesson(); window.scrollTo(0, 0); break;
    case "prev":
      if (lessonRun.step > 0) lessonRun.step--;
      saveRun(); renderLesson(); window.scrollTo(0, 0); break;
    case "timer": {
      const box = $(".timer");
      if (!timer) timer = { left: Number(box.dataset.total), running: false };
      if (timer.left === 0) return;
      timer.running = !timer.running;
      if (timer.running) timer.handle = setInterval(tickTimer, 1000); else clearInterval(timer.handle);
      el.textContent = timer.running ? "Pause" : "Resume";
      break;
    }
    case "timer-reset": {
      if (timer?.handle) clearInterval(timer.handle);
      timer = null;
      const box = $(".timer"), total = Number(box.dataset.total);
      box.classList.remove("ding");
      $(".timer .clock").textContent = `${Math.floor(total / 60)}:00`;
      $("[data-act=timer]").textContent = "Start timer";
      break;
    }
    case "metro": metro.toggle(); el.textContent = metro.running ? "■ Stop" : "▶ Metronome"; if (!metro.running) $$(".beats i").forEach((i) => i.classList.remove("on")); break;
    case "bpm": metro.bpm = Math.min(220, Math.max(30, metro.bpm + Number(el.dataset.d))); $(".bpm output").textContent = metro.bpm; break;
    case "rec": toggleRecord(el); break;
    case "retake": if (pendingTake?.url) URL.revokeObjectURL(pendingTake.url); pendingTake = null; renderLesson(); break;
    case "skip-rec": pendingTake = { skipped: true }; lessonRun.step++; saveRun(); renderLesson(); break;
    case "day": selected = el.dataset.date; renderTracker(); break;
    case "month": { const d = new Date(cal.y, cal.m + Number(el.dataset.d), 1); cal = { y: d.getFullYear(), m: d.getMonth() }; renderTracker(); break; }
    case "excuse": update((st) => { st.excuses[el.dataset.date] = stamp({ reason: el.dataset.reason }); }); break;
    case "unexcuse": update((st) => { st.excuses[el.dataset.date] = stamp({ deleted: true }); }); break;
    case "shift": update((st) => { st.shifts[el.dataset.from] = stamp({ to: el.dataset.to }); }); selected = el.dataset.to; break;
    case "unshift": update((st) => { st.shifts[el.dataset.from] = stamp({ deleted: true }); }); break;
    case "logfree": {
      const id = uid();
      update((st) => { st.sessions[id] = stamp({ id, date: el.dataset.date, lesson: null, title: "Free practice", completedAt: Date.now(), recording: null, journal: { how: "" } }); });
      break;
    }
    case "goal-done": update((st) => { st.goals[el.dataset.id] = stamp({ done: true, date: today() }); }); break;
    case "filter": tapeFilter = el.dataset.f; renderTapes(); break;
    case "play": playTape(el); break;
    case "sync": syncNow(); break;
    case "disconnect": saveSettings({ token: "" }); store.sync = { status: "off", message: "", lastSynced: null }; renderSettings(); break;
    case "export": {
      const link = document.createElement("a");
      link.href = URL.createObjectURL(exportJSON());
      link.download = `guitar-hero-backup-${today()}.json`;
      link.click();
      break;
    }
  }
});

view.addEventListener("change", async (e) => {
  const el = e.target;
  if (el.dataset.act === "goal") update((st) => { st.goals[el.dataset.id] = stamp({ done: el.checked, date: today() }); });
  if (el.dataset.act === "import" && el.files[0]) {
    try { importJSON(await el.files[0].text()); alert("Backup restored."); } catch (err) { alert(err.message); }
  }
});

view.addEventListener("submit", async (e) => {
  e.preventDefault();
  const f = e.target;
  if (f.id === "journal") { f.querySelector("[type=submit]").disabled = true; await saveJournal(f); }
  if (f.id === "start-form") update((st) => { st.startDate = f.start.value || st.startDate; });
  if (f.id === "sync-form") {
    const msg = f.querySelector(".sync-msg");
    saveSettings({ repo: f.repo.value.trim(), token: f.token.value.trim() });
    msg.textContent = "Testing…";
    try {
      const name = await testConnection();
      msg.dataset.status = "ok";
      msg.textContent = `Connected to ${name}. Syncing…`;
      await syncNow();
      msg.textContent = store.sync.status === "ok" ? `Connected to ${name} and synced ✓` : store.sync.message;
    } catch (err) {
      msg.dataset.status = "error";
      msg.textContent = err.message;
    }
  }
});

document.getElementById("sync").addEventListener("click", () => { location.hash = "#/settings"; });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });

render();
syncNow();
