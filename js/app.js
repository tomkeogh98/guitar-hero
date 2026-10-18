import { AREAS, BLOCKS, LESSON_COUNT, REFERENCE_TABS, WEEKS, getLesson, lessonLabel } from "./curriculum.js?v=7";
import { greet } from "./greetings.js?v=7";
import { GOALS, TIERS, context, currentTier, focusGoals, isDone, recordBestStreak, weakestArea } from "./goals.js?v=7";
import { REASONS, dayStatus, excuseOn, nudgeCheck, practisedOn, sessionsOn, shiftTargets, streak, weekSummary } from "./schedule.js?v=7";
import { configured, exportJSON, getAudio, importJSON, putAudio, saveSettings, stamp, store, syncNow, testConnection, update } from "./store.js?v=7";
import { Metronome, chime, extFor, recordingSupported, startRecording } from "./audio.js?v=7";
import { addDays, daysBetween, dayName, esc, fmt, monthName, mondayOf, parse, pickRandom, prettyDate, reducedMotion, shortDay, today, uid, weekday } from "./util.js?v=7";
import { icon, moodFace, pick } from "./icons.js?v=7";
import { countUps, mountStrings, setSound, soundOn, splitWords, stringsMarkup, waveform } from "./fx.js?v=7";
import { handInfo } from "./hands.js?v=7";
import { openTuner } from "./tuner.js?v=7";

const view = document.getElementById("view");
const $ = (sel, root = view) => root.querySelector(sel);
const $$ = (sel, root = view) => [...root.querySelectorAll(sel)];

const MOODS = ["Rough", "Meh", "Okay", "Good", "Buzzing"];
const STEP_NAMES = ["Guitar", ...BLOCKS.map((b) => b.label.replace(" & timing", "").replace("Fretboard & ear", "Fretboard").replace("Record a take", "Record")), "Journal"];
const pad2 = (n) => String(n).padStart(2, "0");
const mmss = (s) => `${Math.floor(s / 60)}:${pad2(Math.floor(s % 60))}`;

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
// "Find your level" shifts where the course picks up; lessons you've done stay logged.
const placement = () => store.state.prefs?.placement?.value || 0;
const nextIndex = () => Math.max(0, lessonsDone() + placement());
const lastLevels = (n) => liveSessions().filter((x) => x.lesson != null).sort((a, b) => (b.completedAt || 0) - (a.completedAt || 0)).slice(0, n).map((x) => x.journal?.level);
const statusIcon = { done: "check", missed: "x" };

// ---------- header ----------
function renderSync() {
  const el = document.getElementById("sync");
  const { status, message } = store.sync;
  el.dataset.status = configured() ? status : "off";
  el.title = configured() ? message : "Not syncing yet. Set it up in Settings";
  el.querySelector("span").textContent = configured() ? (status === "ok" ? "Synced" : status === "error" ? "Sync error" : status === "syncing" ? "Syncing…" : "Sync") : "Local only";
}
function renderNav(route) {
  const nav = document.getElementById("nav");
  let active = null;
  for (const a of nav.querySelectorAll("a")) {
    const on = a.getAttribute("href") === `#/${route}` || (["lesson", "level"].includes(route) && a.getAttribute("href") === "#/");
    a.classList.toggle("on", on);
    if (on) { a.setAttribute("aria-current", "page"); active = a; } else a.removeAttribute("aria-current");
  }
  const ink = nav.querySelector(".nav-ink");
  if (active) { ink.style.transform = `translateX(${active.offsetLeft}px)`; ink.style.width = `${active.offsetWidth}px`; ink.style.opacity = 1; }
}
const effectiveTheme = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
function renderThemeBtn() {
  const b = document.getElementById("theme");
  b.innerHTML = icon(effectiveTheme() === "dark" ? "sun" : "moon");
  b.title = effectiveTheme() === "dark" ? "Switch to light mode" : "Switch to stage (dark) mode";
}

// ---------- TODAY ----------
let greetingLine = null;
let unmountStrings = null;
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

function weekRing(practised, required) {
  const total = Math.max(required, 1), r = 22, c = 2 * Math.PI * r, gapLen = 4, seg = c / total - gapLen;
  return `<svg class="ring" viewBox="0 0 56 56" aria-hidden="true">${Array.from({ length: total }, (_, i) =>
    `<circle cx="28" cy="28" r="${r}" class="${i < practised ? "on" : ""}" stroke-dasharray="${seg.toFixed(2)} ${(c - seg).toFixed(2)}" stroke-dashoffset="${(-i * (seg + gapLen)).toFixed(2)}" style="--d:${i * 90}ms"/>`).join("")}</svg>`;
}

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
  const idx = nextIndex();
  const lesson = getLesson(idx);
  const recent = lastLevels(2);
  const tooEasy = recent.length === 2 && recent.every((l) => l === "easy");
  const tooHard = recent.length === 2 && recent.every((l) => l === "hard");
  const todays = sessionsOn(s, now).filter((x) => x.lesson != null);
  const best = Math.max(str, s.goals["_best-streak"]?.value || 0);

  const timeline = BLOCKS.map((b) => `<span class="seg seg-${b.key}" style="--m:${lesson.mins[b.key]}" title="${b.label}: ${lesson.mins[b.key]} min"></span>`).join("");
  const setlist = BLOCKS.map((b, i) => `<li class="seg-${b.key}"><span class="n">${pad2(i + 1)}</span>
      <div><b>${b.label}</b>${b.key === "free" ? "" : `<span class="tool-tag t-${handInfo(lesson.week, lesson.day, b.key, lesson.blocks[b.key], "electric").tool}">${handInfo(lesson.week, lesson.day, b.key, lesson.blocks[b.key], "electric").toolLabel}</span>`}<p>${b.key === "free" ? "Anything you like. This is the fun bit." : b.key === "rec" ? esc(lesson.blocks.rec) : esc(firstSentence(lesson.blocks[b.key]))}</p></div>
      <span class="m">${lesson.mins[b.key]}′</span></li>`).join("");

  let recap;
  if (!last) recap = `<div class="recap-item wide"><p class="eyebrow">Page one</p><p>Nothing to look back on yet. ${esc(lesson.buildsOn)}</p></div>`;
  else {
    const L = getLesson(last.lesson, last.guitar);
    const how = last.journal?.how ? `<q>${esc(last.journal.how.slice(0, 140))}${last.journal.how.length > 140 ? "…" : ""}</q>` : "";
    recap = `<div class="recap-item"><p class="eyebrow">Last time · ${dayName(last.date)}</p><p><b>${esc(L.title)}.</b> ${esc(firstSentence(L.blocks.x))}</p>${how}</div>
      <div class="recap-item"><p class="eyebrow">How today builds on it</p><p>${esc(lesson.buildsOn)}</p></div>`;
  }

  let planCard;
  if (st === "done") {
    const t = todays[0];
    planCard = `<section class="card plan state">
      <div class="state-mark done">${icon("check")}</div>
      <p class="eyebrow">Today · done</p>
      <h2 class="display">That's today in the bag.</h2>
      ${t ? `<p class="lead">You played <b>${esc(t.title)}</b> on the ${esc(t.guitar)}.${t.journal?.win ? ` Today's win: <q>${esc(t.journal.win)}</q>` : ""}</p>` : `<p class="lead">Practice logged. Nice one.</p>`}
      <p class="muted">Up next: <b>${esc(lesson.title)}</b> · ${lessonLabel(idx)}</p>
      <div class="row"><a class="btn" href="#/tapes">${icon("tape")} Listen back</a><a class="btn ghost" href="#/lesson">Fancy another? Do the next one ${icon("arrowRight")}</a></div>
    </section>`;
  } else if (st === "excused") {
    const ex = excuseOn(s, now);
    planCard = `<section class="card plan state">
      <div class="state-mark">${icon("heart")}</div>
      <p class="eyebrow">Today · ${REASONS[ex.reason].label.toLowerCase()}</p>
      <h2 class="display">${ex.reason === "sick" ? "Rest up, Tom." : ex.reason === "holiday" ? "Enjoy the break." : "Look after yourself."}</h2>
      <p class="lead">${ex.reason === "sick" ? "Your hands will be fresh when you're back." : ex.reason === "holiday" ? "If there's a guitar where you are, noodle away. No pressure." : "The guitar will be right here when you're ready."}</p>
      <div class="row"><button class="btn ghost" data-act="unexcuse" data-date="${now}">Actually, I'm fine. Remove it</button></div>
    </section>`;
  } else if (st === "off") {
    planCard = `<section class="card plan state">
      <div class="state-mark">${icon("sparkle")}</div>
      <p class="eyebrow">Today · day off</p>
      <h2 class="display">Rest is part of the practice.</h2>
      <p class="lead">No lesson today. Your brain keeps sorting out what you've learnt while you're away from the guitar.</p>
      <p class="muted">Up next: <b>${esc(lesson.title)}</b> · ${lessonLabel(idx)}</p>
      <div class="row"><a class="btn ghost" href="#/lesson">Itching to play? Do it now ${icon("arrowRight")}</a></div>
    </section>`;
  } else {
    planCard = `<section class="card plan">
      <header class="plan-head">
        <div>
          <p class="eyebrow">${lessonLabel(idx)} · ${esc(lesson.weekTitle)}</p>
          <h2 class="display">${esc(lesson.title)}</h2>
        </div>
        <div class="plan-time"><b>30</b><span>min</span></div>
      </header>
      <div class="timeline" aria-hidden="true">${timeline}</div>
      <ol class="setlist">${setlist}</ol>
      <div class="recap">${recap}</div>
      <footer class="plan-foot">
        <a class="btn primary lg" href="#/lesson">Start today's lesson ${icon("arrowRight")}</a>
        <button class="btn ghost" data-act="tuner">${icon("fork")} Tune up</button>
        <a class="link small level-link" href="#/level">${icon("compass")} Too easy? Find your level</a>
      </footer>
    </section>`;
  }

  const strip = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(wk.mon, i), ds = dayStatus(s, d), ex = excuseOn(s, d);
    const mark = ex ? `<em>${REASONS[ex.reason].mark}</em>` : statusIcon[ds] ? icon(statusIcon[ds]) : "";
    return `<a class="dpill ${ds}${d === now ? " now" : ""}" href="#/tracker" title="${prettyDate(d)}: ${ds}"><span class="dl">${shortDay(d)}</span><span class="dn">${parse(d).getDate()}</span><span class="dm">${mark}</span></a>`;
  }).join("");

  const goals = focusGoals(s, 3);

  view.innerHTML = `
    <section class="hero">
      <div class="hero-head">
        <p class="eyebrow">${prettyDate(now)}</p>
        <h1 class="greet">${splitWords(esc(greetingLine))}</h1>
      </div>
      <div class="stats">
        <div class="stat"><span class="stat-icon flame">${icon("flame")}</span><b data-count="${str}">${str}</b><span class="stat-label">day streak</span><span class="stat-foot">best ${best}</span></div>
        <div class="stat"><div class="ring-wrap">${weekRing(wk.practised, Math.max(wk.required, 1))}<b>${wk.practised}</b></div><span class="stat-label">of ${Math.max(wk.required, 1)} this week</span><span class="stat-foot">${wk.onTrack ? "on track" : "behind"}</span></div>
        <div class="stat"><span class="stat-icon">${icon("note")}</span><b data-count="${done}">${done}</b><span class="stat-label">lessons done</span><span class="bar" title="Lesson ${idx + 1} of ${LESSON_COUNT}"><i style="width:${Math.min(100, (idx / LESSON_COUNT) * 100)}%"></i></span></div>
      </div>
      <div class="strings-wrap">
        ${stringsMarkup()}
        <span class="hand strum-hint" aria-hidden="true">strum me</span>
        <button class="icon-btn sound" data-act="sound" aria-label="${soundOn() ? "Mute the strings" : "Unmute the strings"}" title="${soundOn() ? "Mute" : "Unmute"}">${icon(soundOn() ? "volume" : "volumeOff")}</button>
      </div>
    </section>
    ${tooEasy && st !== "done" ? `<aside class="nudge level-nudge" role="status"><span class="nudge-icon">${icon("compass")}</span><div><b>Feeling too easy?</b><p>Your last two lessons felt too easy. Jump ahead to the week that matches your playing.</p><a class="btn sm primary" href="#/level">Find your level ${icon("arrowRight")}</a></div></aside>` : ""}
    ${tooHard && st !== "done" ? `<aside class="nudge level-nudge" role="status"><span class="nudge-icon">${icon("heart")}</span><div><b>Two tough ones in a row</b><p>That's normal. Today, drop every metronome setting by 10 bpm and aim for clean rather than fast. It'll click.</p></div></aside>` : ""}
    ${nudge ? `<aside class="nudge" role="status"><span class="nudge-icon">${icon("heart")}</span><div><b>A warm nudge</b><p>${esc(pickRandom(NUDGES[nudge.kind]).replace("{n}", nudge.count).replace("{s}", nudge.count === 1 ? "" : "s"))}</p></div></aside>` : ""}
    <div class="cols today-grid">
      <div class="col-main">${planCard}</div>
      <aside class="col-side">
        <div class="card week-card">
          <div class="card-head"><h3>This week</h3><span class="kpi">${wk.practised}<small>/${Math.max(wk.required, 1)}</small></span></div>
          <div class="strip">${strip}</div>
          <p class="small muted">Weekdays by default. Tap a day to move a lesson or log a reason.</p>
        </div>
        <div class="card goals-card">
          <div class="card-head"><h3>Working towards</h3><a class="small link" href="#/goals">All goals ${icon("arrowRight")}</a></div>
          <ul class="goal-mini">${goals.map((g) => `<li><span class="dot"></span><div><p>${esc(g.title)}</p><span class="chip">${AREAS[g.area]}</span></div></li>`).join("") || "<li><p>Everything ticked off. Legend.</p></li>"}</ul>
        </div>
      </aside>
    </div>`;
  unmountStrings?.();
  unmountStrings = mountStrings($(".strings"), () => $(".strum-hint")?.classList.add("gone"));
  countUps(view);
}

// ---------- LESSON ----------
const LESSON_KEY = "gh.lesson.v1";
let lessonRun = null;      // { index, guitar, step, startedAt }
let pendingTake = null;    // { blob, mime, secs, url } or { skipped: true }
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
  const idx = nextIndex();
  if (!lessonRun) { try { lessonRun = JSON.parse(sessionStorage.getItem(LESSON_KEY)); } catch {} }
  if (!lessonRun || lessonRun.index !== idx) {
    lessonRun = { index: idx, guitar: null, step: 0, startedAt: Date.now() };
    pendingTake = null;
  }
  if (!pendingTake && lessonRun.step > 6) lessonRun.step = 6; // take was lost on reload
}

function lessonHead(L, index, step) {
  const steps = STEP_NAMES.map((n, i) => `<li class="${i < step ? "done" : i === step ? "now" : ""}"><span>${n}</span></li>`).join("");
  return `<header class="lesson-head">
    <a class="back-link" href="#/">${icon("arrowLeft")} Today</a>
    <p class="eyebrow">${lessonLabel(index)} · ${esc(L.weekTitle)}</p>
    <h1 class="display lesson-title">${esc(L.title)}</h1>
    <ol class="steps" aria-label="Step ${step + 1} of ${STEP_NAMES.length}">${steps}</ol>
  </header>`;
}

const RING_C = 2 * Math.PI * 54;
function timerCard(mins) {
  return `<div class="tool timer" data-total="${mins * 60}">
    <p class="eyebrow">Timer</p>
    <div class="timer-face">
      <svg viewBox="0 0 120 120" aria-hidden="true"><circle class="track" cx="60" cy="60" r="54"/><circle class="prog" cx="60" cy="60" r="54" stroke-dasharray="${RING_C.toFixed(1)}" stroke-dashoffset="0"/></svg>
      <span class="clock">${mins}:00</span>
    </div>
    <div class="row center"><button class="btn primary" data-act="timer">${icon("play")} <span>Start</span></button><button class="icon-btn" data-act="timer-reset" aria-label="Reset timer" title="Reset">${icon("reset")}</button></div>
  </div>`;
}

function metroCard(bpm) {
  return `<div class="tool metro">
    <p class="eyebrow">${icon("metronome")} Metronome</p>
    <div class="bpm"><button class="icon-btn" data-act="bpm" data-d="-5" aria-label="5 bpm slower">${icon("minus")}</button><output tabindex="0" data-bpm-edit title="Double-click to type a tempo · arrow keys for ±1" aria-label="Tempo ${bpm} bpm. Double-click or press Enter to type a tempo; arrow keys change it by 1.">${bpm}</output><button class="icon-btn" data-act="bpm" data-d="5" aria-label="5 bpm faster">${icon("plus")}</button></div>
    <span class="bpm-label">bpm · double-click to type</span>
    <div class="beats">${"<i></i>".repeat(4)}</div>
    <button class="btn" data-act="metro">${icon("play")} <span>Start click</span></button>
  </div>`;
}

function renderLesson() {
  stopAll();
  ensureRun();
  const { index, guitar, step } = lessonRun;
  const L = getLesson(index, guitar || "electric");
  const head = lessonHead(L, index, step);

  if (step === 0) {
    view.innerHTML = `<section class="lesson">${head}
      <div class="choose-intro"><h2 class="display">Which guitar today?</h2><p class="lead">The technique and tone tips will match it.</p></div>
      <div class="guitars">
        <button class="guitar-card" data-act="guitar" data-g="electric">${guitarArt("electric")}<b>Electric</b><span>Bends, palm muting, amp tone</span></button>
        <button class="guitar-card" data-act="guitar" data-g="acoustic">${guitarArt("acoustic")}<b>Acoustic</b><span>Strumming, projection, pick position</span></button>
      </div>
      <div class="prep">
        <button class="btn" data-act="tuner">${icon("fork")} Tune up first</button>
        <p class="small muted">${pick("inline-pick")} Have a plectrum handy. Most exercises use one, and every section tells you whether it's plectrum or fingers.</p>
      </div>
      <p class="builds"><span class="hand">builds on</span> ${esc(L.buildsOn)}</p>
    </section>`;
    return;
  }

  if (step <= BLOCKS.length) {
    const b = BLOCKS[step - 1];
    const text = L.blocks[b.key];
    const showMetro = ["w", "x", "r", "s", "rec"].includes(b.key);
    const mins = L.mins[b.key], bpm = L.bpmFor[b.key];
    const h = handInfo(L.week, L.day, b.key, text, guitar);
    const handBar = `<div class="hand-bar t-${h.tool}"><span class="hb-tool">${h.toolIcon === "pick" ? pick("hb-pick") : icon(h.toolIcon)}<b>${h.toolLabel}</b></span><span class="hb-how"><b>${h.label}.</b> ${esc(h.how)}</span></div>`;
    let body = `<p class="block-text">${esc(text)}</p>`;
    if (b.key === "x" && L.tab) body += `<figure class="tab-card"><figcaption class="eyebrow">Tab</figcaption><pre class="tab">${esc(L.tab)}</pre></figure>`;
    else if (b.key !== "free") {
      const ref = REFERENCE_TABS.find((r) => r.test.test(text));
      if (ref) body += `<figure class="tab-card"><figcaption class="eyebrow">Reference · ${ref.name}</figcaption><pre class="tab">${esc(ref.tab)}</pre></figure>`;
    }
    if (b.key === "x") body += `<aside class="tone"><span class="hand">tone &amp; taste · ${esc(guitar)}</span><p>${esc(L.tone)}</p></aside>`;
    if (b.key === "rec") body = recordBlock(L);
    if (b.key === "free") body = `<p class="block-text">${esc(text)}</p><p class="lead muted">Or ignore that and play whatever makes you grin. That's the whole point of free play.</p>`;
    const isLast = step === BLOCKS.length;
    view.innerHTML = `<section class="lesson">${head}
      <div class="lesson-body">
        <article class="card block seg-${b.key}">
          <p class="eyebrow"><span class="step-n">${pad2(step)}</span> ${mins} min</p>
          <h2 class="display block-title">${b.label}</h2>
          ${handBar}
          ${body}
        </article>
        <aside class="tools">
          ${b.key !== "rec" ? timerCard(mins) : ""}
          ${showMetro ? metroCard(bpm) : ""}
        </aside>
      </div>
      <footer class="lesson-nav">
        <button class="btn ghost" data-act="prev">${icon("arrowLeft")} Back</button>
        <button class="btn primary lg" data-act="next" ${b.key === "rec" && !pendingTake?.url ? "data-needs-take" : ""}>${isLast ? "Write it up" : "Next"} ${icon("arrowRight")}</button>
      </footer>
    </section>`;
    if (showMetro) bindMetro(bpm);
    return;
  }

  view.innerHTML = `<section class="lesson">${head}
    <form id="journal" class="card journal">
      <div class="journal-intro"><h2 class="display">How did it go?</h2><p class="lead">Quick notes for future Tom. Two minutes, tops.</p></div>
      <div class="journal-grid">
        <div>
          <fieldset class="moods"><legend class="eyebrow">Overall feel</legend>
            <div class="mood-row">${MOODS.map((m, i) => `<label class="mood"><input type="radio" name="mood" value="${i}" ${i === 3 ? "checked" : ""}>${moodFace(i, 34)}<span>${m}</span></label>`).join("")}</div>
          </fieldset>
          <fieldset class="levelq"><legend class="eyebrow">How was the level?</legend>
            <div class="seg-ctl wide">${[["easy", "Too easy"], ["right", "Just right"], ["hard", "Too hard"]].map(([v, l]) => `<label><input type="radio" name="level" value="${v}" ${v === "right" ? "checked" : ""}><b>${l}</b></label>`).join("")}</div>
          </fieldset>
          <fieldset class="ratings"><legend class="eyebrow">How solid did each area feel?</legend>
            ${L.areas.map((a) => `<div class="rate"><span>${AREAS[a]}</span><div class="seg-ctl">${[1, 2, 3, 4, 5].map((v) => `<label><input type="radio" name="r-${a}" value="${v}" ${v === 3 ? "checked" : ""}><b>${v}</b></label>`).join("")}</div></div>`).join("")}
            <p class="scale small muted"><span>shaky</span><span>nailed it</span></p>
          </fieldset>
        </div>
        <div>
          <label class="field"><span class="eyebrow">What happened</span><textarea name="how" rows="4" placeholder="Changes were smoother, but the bend was flat…"></textarea></label>
          <label class="field"><span class="eyebrow">What felt hard</span><textarea name="hard" rows="2" placeholder="That F chord, again"></textarea></label>
          <label class="field"><span class="eyebrow">One small win</span><input name="win" placeholder="Got through the song without stopping!"></label>
        </div>
      </div>
      <footer class="lesson-nav"><button type="button" class="btn ghost" data-act="prev">${icon("arrowLeft")} Back</button><button class="btn primary lg" type="submit">${icon("check")} Save today's page</button></footer>
    </form>
  </section>`;
}

// Proper little guitars. Frets follow a real scale length (rule of 18-ish via 2^(n/12)).
function guitarArt(kind) {
  const E = kind === "electric";
  const nut = 208, bridge = E ? 50 : 38, L = nut - bridge, heel = E ? 114 : 118;
  const fx = (n) => nut - L * (1 - Math.pow(2, -n / 12));
  const frets = [];
  for (let n = 1; fx(n) > heel + 1; n++) frets.push(n);
  const fretLines = frets.map((n) => `<line x1="${fx(n).toFixed(1)}" y1="40.2" x2="${fx(n).toFixed(1)}" y2="49.8"/>`).join("");
  const dot = (n, y = 45) => { const x = (fx(n) + fx(n - 1)) / 2; return `<circle cx="${x.toFixed(1)}" cy="${y}" r="1.1"/>`; };
  const inlays = [3, 5, 7, 9].filter((n) => frets.includes(n)).map((n) => dot(n)).join("") + (frets.includes(12) ? dot(12, 42.6) + dot(12, 47.4) : "");
  const strings = Array.from({ length: 6 }, (_, i) => `<line x1="${E ? 40 : 38}" y1="${41.2 + i * 1.52}" x2="${E ? 214 : 212}" y2="${41.9 + i * 1.24}" style="stroke-width:${(0.35 + i * 0.09).toFixed(2)}"/>`).join("");
  const tuners = [214, 222, 230].map((x) => `<circle cx="${x}" cy="${E ? 34.5 : 34}" r="2.3"/><circle cx="${x}" cy="${E ? 56 : 56.5}" r="2.3"/>`).join("");
  const id = `g-${kind}`;
  if (E) return `<svg viewBox="0 0 244 90" class="g-art" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="0.4" cy="0.5" r="0.62"><stop offset="0" stop-color="#FFC15E"/><stop offset="0.42" stop-color="#E5531B"/><stop offset="0.8" stop-color="#9A1D0C"/><stop offset="1" stop-color="#3B0B05"/></radialGradient></defs>
    <path class="ga-shadow" d="M118 41C114 29 102 22 90 23 82 24 78 28 70 28 60 28 54 18 38 18 20 18 10 32 10 48S20 78 38 78C54 78 60 69 70 69 80 69 84 73 94 73 104 73 108 67 106 61 105 57 110 55 118 55Z"/>
    <path d="M116 38C112 26 100 19 88 20 80 21 76 25 68 25 58 25 52 15 36 15 18 15 8 29 8 45S18 75 36 75C52 75 58 66 68 66 78 66 82 70 92 70 102 70 106 64 104 58 103 54 108 52 116 52Z" fill="url(#${id})" stroke="#F3E6CC" stroke-width="1.6"/>
    <rect x="108" y="39.6" width="102" height="10.8" rx="1.5" fill="#3A2417"/>
    <g class="ga-frets">${fretLines}</g><g class="ga-inlay">${inlays}</g>
    <path d="M207 39.4C214 36.5 224 33.5 233 32.4 237 32 239 34.6 238.6 38L237 52.4C236.6 56 233.6 58 230 57.6 222 56.6 214 54.4 207 50.6Z" fill="#1E1611"/>
    <g class="ga-tuners">${tuners}</g>
    <rect x="58" y="36" width="9.5" height="18" rx="2" class="ga-pickup"/><rect x="80" y="36" width="9.5" height="18" rx="2" class="ga-pickup"/>
    <g class="ga-poles">${[58, 80].map((x) => Array.from({ length: 6 }, (_, i) => `<circle cx="${x + 2.8}" cy="${38.4 + i * 2.65}" r=".7"/><circle cx="${x + 6.7}" cy="${38.4 + i * 2.65}" r=".7"/>`).join("")).join("")}</g>
    <rect x="48.5" y="37" width="3" height="16" rx="1" class="ga-metal"/><rect x="38.5" y="36" width="4.5" height="18" rx="2" class="ga-metal"/>
    <g class="ga-strings">${strings}</g>
    ${[[27, 58], [39, 63], [31, 68], [44, 69]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.2" class="ga-knob"/>`).join("")}
    <circle cx="96" cy="64" r="1.6" class="ga-metal"/>
  </svg>`;
  return `<svg viewBox="0 0 244 90" class="g-art" aria-hidden="true">
    <defs><radialGradient id="${id}" cx="0.45" cy="0.5" r="0.6"><stop offset="0" stop-color="#F6E1B2"/><stop offset="0.6" stop-color="#E2B36A"/><stop offset="0.88" stop-color="#A86A2C"/><stop offset="1" stop-color="#5A3214"/></radialGradient></defs>
    <path class="ga-shadow" d="M120 36C120 26 110 20 98 20 88 20 82 27 72 27 62 27 54 15 36 15 18 15 8 30 8 48S18 81 36 81C54 81 62 69 72 69 82 69 88 76 98 76 110 76 120 70 120 60Z"/>
    <path d="M118 33C118 23 108 17 96 17 86 17 80 24 70 24 60 24 52 12 34 12 16 12 6 27 6 45S16 78 34 78C52 78 60 66 70 66 80 66 86 73 96 73 108 73 118 67 118 57Z" fill="url(#${id})" stroke="#F7EEDC" stroke-width="1.6"/>
    <path d="M86 52C90 61 102 64 109 58 108 53 102 52 97 54Z" fill="#3B2112" opacity=".85"/>
    <circle cx="96" cy="45" r="12.2" fill="none" stroke="#7A4A22" stroke-width="1.2"/><circle cx="96" cy="45" r="10.6" fill="none" stroke="#F7EEDC" stroke-width=".8"/>
    <circle cx="96" cy="45" r="9" fill="#1C120B"/>
    <rect x="114" y="39.6" width="96" height="10.8" rx="1.5" fill="#3A2417"/>
    <g class="ga-frets">${fretLines}</g><g class="ga-inlay">${inlays}</g>
    <path d="M207 38.6L232 35C236 34.6 238 36.6 238 40V50C238 53.4 236 55.4 232 55L207 51.4Z" fill="#2A1A10"/>
    <g class="ga-tuners">${tuners}</g>
    <rect x="31" y="33" width="9" height="24" rx="3.5" fill="#2A1A10"/><rect x="36.4" y="36" width="1.4" height="18" rx=".7" fill="#F2EAD8"/>
    <g class="ga-strings">${strings}</g>
  </svg>`;
}

const BPM_MIN = 30, BPM_MAX = 250;
function setBpm(v) {
  if (!metro || !Number.isFinite(v)) return;
  metro.bpm = Math.min(BPM_MAX, Math.max(BPM_MIN, Math.round(v)));
  const out = $(".bpm output");
  if (out && !out.querySelector("input")) out.textContent = metro.bpm;
  out?.setAttribute("aria-label", `Tempo ${metro.bpm} bpm. Double-click or press Enter to type a tempo; arrow keys change it by 1.`);
}
// Double-click the number (or press Enter on it) to type any tempo, e.g. 122.
function editBpm(out) {
  if (out.querySelector("input")) return;
  const before = metro.bpm;
  out.innerHTML = `<input class="bpm-input" type="number" inputmode="numeric" min="${BPM_MIN}" max="${BPM_MAX}" step="1" value="${before}" aria-label="Type a tempo in bpm">`;
  const input = out.querySelector("input");
  input.focus(); input.select();
  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    const v = Number(input.value);
    out.textContent = before;
    setBpm(commit && input.value !== "" ? v : before);
    out.focus();
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") { e.preventDefault(); finish(true); }
    if (e.key === "Escape") { e.preventDefault(); finish(false); }
    e.stopPropagation();
  });
  input.addEventListener("blur", () => finish(true));
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
    <p class="muted">Up to ${L.recSecs >= 120 ? `${Math.round(L.recSecs / 60)} minutes` : `${L.recSecs} seconds`}. Count yourself in, play it, done. It becomes evidence of your progress, so no noodling. If the take asks for the click, start the metronome on the right first and keep it running while you record.</p>
    <div class="recorder">
      <button class="rec-btn" data-act="rec" aria-label="Start recording"><span></span></button>
      <div class="live-wave" aria-hidden="true">${"<i></i>".repeat(40)}</div>
      <span class="rec-time">0:00</span>
    </div>
    <div class="take">${pendingTake?.url ? `<audio controls src="${pendingTake.url}"></audio><button class="btn" data-act="retake">${icon("reset")} Retake</button>` : ""}</div>
    ${pendingTake?.url ? "" : `<button class="link small" data-act="skip-rec">Can't record today? Skip it</button>`}`;
}

async function toggleRecord(btn, maxSecs = 90) {
  if (recorder) { recorder.stop(); return; }
  try {
    btn.classList.add("live");
    btn.setAttribute("aria-label", "Stop recording");
    const timeEl = $(".rec-time"), bars = $$(".live-wave i"), levels = new Array(bars.length).fill(0);
    let last = 0;
    recorder = await startRecording({
      maxSecs,
      onLevel: (v) => {
        const t = performance.now();
        if (t - last < 60) return;
        last = t;
        levels.shift(); levels.push(Math.min(1, v * 1.6));
        bars.forEach((b, i) => b.style.setProperty("--h", Math.max(0.06, levels[i]).toFixed(2)));
      },
      onTick: (s) => { if (timeEl) timeEl.textContent = mmss(s); },
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

function paintTimer() {
  const el = $(".timer .clock"), prog = $(".timer .prog");
  if (!timer || !el) return;
  el.textContent = mmss(timer.left);
  prog.style.strokeDashoffset = (RING_C * (1 - timer.left / timer.total)).toFixed(1);
}
function tickTimer() {
  if (!timer || !$(".timer")) return;
  timer.left = Math.max(0, timer.left - 1);
  paintTimer();
  if (timer.left === 0) {
    clearInterval(timer.handle);
    timer.running = false;
    $(".timer").classList.add("ding");
    $("[data-act=timer]").innerHTML = `${icon("check")} <span>Time's up</span>`;
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
      journal: { mood: Number(fd.get("mood")), level: fd.get("level") || "right", ratings, how: fd.get("how").trim(), hard: fd.get("hard").trim(), win: fd.get("win").trim() },
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
  const colours = ["var(--accent)", "var(--highlight)", "var(--done)", "var(--biro)", "var(--ink)"];
  for (let i = 0; i < 46; i++) {
    const p = document.createElement("span");
    p.innerHTML = pick();
    p.style.left = `${Math.random() * 100}vw`;
    p.style.color = colours[i % colours.length];
    p.style.animationDelay = `${Math.random() * 0.5}s`;
    p.style.animationDuration = `${2.2 + Math.random() * 1.2}s`;
    p.style.setProperty("--spin", `${Math.random() * 900 - 450}deg`);
    p.style.setProperty("--drift", `${Math.random() * 160 - 80}px`);
    p.style.setProperty("--s", (0.6 + Math.random() * 0.8).toFixed(2));
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 4000);
}

// ---------- TRACKER ----------
let cal = null; // { y, m }
let selected = null;

function renderTracker() {
  const s = store.state, now = today();
  if (!cal) { const d = parse(now); cal = { y: d.getFullYear(), m: d.getMonth() }; }
  selected ||= now;
  const first = fmt(new Date(cal.y, cal.m, 1));
  const gridStart = mondayOf(first);
  const days = [];
  for (let d = gridStart; ; d = addDays(d, 1)) {
    const inMonth = parse(d).getMonth() === cal.m;
    if (!inMonth && days.length >= 28 && days.length % 7 === 0) break;
    days.push(d);
  }
  const cells = days.map((d, n) => {
    const st = dayStatus(s, d), ex = excuseOn(s, d), inMonth = parse(d).getMonth() === cal.m;
    const hasRec = sessionsOn(s, d).some((x) => x.recording);
    const mark = ex ? `<span class="mark">${REASONS[ex.reason].mark}</span>` : statusIcon[st] ? `<span class="glyph">${icon(statusIcon[st])}</span>` : "";
    return `<button class="day ${st}${inMonth ? "" : " out"}${d === now ? " now" : ""}${d === selected ? " sel" : ""}" style="--n:${n}" data-act="day" data-date="${d}" aria-label="${prettyDate(d)}: ${st}" aria-pressed="${d === selected}">
      <span class="num">${parse(d).getDate()}</span>${mark}${hasRec ? `<span class="recdot" title="Has a recording"></span>` : ""}</button>`;
  }).join("");

  const weeks = [];
  for (let i = 0; i < days.length; i += 7) {
    const w = weekSummary(s, days[i]);
    if (days[i] > now) break;
    if (days[i + 6] < s.startDate) continue;
    weeks.push(`<li><span class="wk">${parse(days[i]).getDate()} ${monthName(parse(days[i]).getMonth()).slice(0, 3)}</span><span class="tallies-row">${tally(w.practised)}</span><b class="${w.practised >= w.required ? "ok" : days[i + 6] < now ? "short" : ""}">${w.practised}/${w.required}</b></li>`);
  }

  let practised = 0, missed = 0, excused = 0;
  for (let d = s.startDate; d <= now; d = addDays(d, 1)) {
    const st = dayStatus(s, d);
    if (st === "done") practised++; else if (st === "missed") missed++; else if (st === "excused") excused++;
  }

  view.innerHTML = `
    <header class="page-head"><p class="eyebrow">Tracker</p><h1 class="display">Every day, accounted for.</h1></header>
    <div class="cols tracker-grid">
    <section class="card cal-card">
      <div class="cal-head">
        <h2 class="display">${monthName(cal.m)} <span>${cal.y}</span></h2>
        <div class="row"><button class="icon-btn" data-act="month" data-d="-1" aria-label="Previous month">${icon("chevronLeft")}</button><button class="icon-btn" data-act="month" data-d="1" aria-label="Next month">${icon("chevronRight")}</button></div>
      </div>
      <div class="cal">
        ${["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => `<span class="dow">${d}</span>`).join("")}
        ${cells}
      </div>
      <div class="legend">
        <span><i class="done"></i>Practised</span><span><i class="missed"></i>Missed</span><span><i class="off"></i>Not scheduled</span>
        <span><i class="excused"></i>Excused <small>S sick · H holiday · E emergency</small></span><span><i class="planned"></i>Coming up</span>
      </div>
    </section>
    <aside class="col-side">
      <div class="card day-card" id="day-panel">${dayPanel(selected)}</div>
      <div class="card">
        <div class="statgrid">
          <div><b data-count="${practised}">${practised}</b><small>days practised</small></div>
          <div><b data-count="${streak(s)}">${streak(s)}</b><small>current streak</small></div>
          <div><b class="red" data-count="${missed}">${missed}</b><small>missed</small></div>
          <div><b data-count="${excused}">${excused}</b><small>excused</small></div>
        </div>
      </div>
      <div class="card">
        <div class="card-head"><h3>Weekly tally</h3><span class="small muted">target 5</span></div>
        <ul class="tallies">${weeks.join("") || "<li class='muted'>Your first tally mark is one lesson away.</li>"}</ul>
        <p class="small muted">Sick, holiday and emergency days lower that week's target.</p>
      </div>
    </aside>
    </div>`;
  countUps(view);
}

const STATUS_LABEL = { done: "Practised", missed: "Missed", excused: "Excused", off: "Day off", today: "Today", planned: "Scheduled", pre: "Before you started" };
function dayPanel(d) {
  const s = store.state, now = today(), st = dayStatus(s, d);
  const sess = sessionsOn(s, d);
  const reasonBtns = Object.entries(REASONS).map(([k, r]) => `<button class="btn sm" data-act="excuse" data-date="${d}" data-reason="${k}">${r.label}</button>`).join("");
  const targets = shiftTargets(s, d).map((t) => `<button class="btn sm" data-act="shift" data-from="${d}" data-to="${t}">${icon("move")} ${shortDay(t)} ${parse(t).getDate()}</button>`).join("");
  const movedHere = Object.entries(s.shifts).find(([, v]) => !v.deleted && v.to === d);
  const movedAway = s.shifts[d] && !s.shifts[d].deleted ? s.shifts[d] : null;
  let body = "";
  if (st === "done") {
    body = sess.map((x) => `<div class="day-sess">${x.journal?.mood != null ? moodFace(x.journal.mood, 30) : ""}<div><b>${x.lesson != null ? esc(x.title) : "Free practice"}</b><span class="small muted">${x.lesson != null ? lessonLabel(x.lesson) : ""}${x.guitar ? ` · ${esc(x.guitar)}` : ""}</span></div></div>`).join("") + `<a class="link small" href="#/tapes">Open in Tapes ${icon("arrowRight")}</a>`;
  } else if (st === "excused") {
    body = `<p>Logged as <b>${REASONS[excuseOn(s, d).reason].label.toLowerCase()}</b>.</p><button class="btn sm" data-act="unexcuse" data-date="${d}">${icon("x")} Remove</button>`;
  } else if (st === "missed") {
    body = `<p>Scheduled, but nothing logged.</p>
      <p class="eyebrow">Was there a reason?</p><div class="row">${reasonBtns}</div>
      ${targets ? `<p class="eyebrow">Or make it up this week</p><div class="row">${targets}</div>` : ""}
      <p class="small">Played but forgot to log it? <button class="link" data-act="logfree" data-date="${d}">Log a free practice</button></p>`;
  } else if (st === "today" || st === "planned") {
    body = `${st === "today" ? `<a class="btn primary" href="#/lesson">Start today's lesson ${icon("arrowRight")}</a>` : ""}
      ${movedHere ? `<p class="small muted">Moved here from ${shortDay(movedHere[0])}. <button class="link" data-act="unshift" data-from="${movedHere[0]}">Undo</button></p>` : ""}
      ${targets ? `<p class="eyebrow">Move it to</p><div class="row">${targets}</div>` : `<p class="small muted">No free days left this week to move it to.</p>`}
      <p class="eyebrow">Can't do it?</p><div class="row">${reasonBtns}</div>`;
  } else if (st === "off") {
    body = movedAway ? `<p>Lesson moved to ${prettyDate(movedAway.to)}.</p><button class="btn sm" data-act="unshift" data-from="${d}">${icon("reset")} Undo the move</button>`
      : `<p class="muted">${d <= now ? `Not scheduled. <button class="link" data-act="logfree" data-date="${d}">Played anyway? Log it</button>` : "Not scheduled. Enjoy the day off."}</p>`;
  } else body = `<p class="muted">Before you started.</p>`;
  return `<div class="panel"><div class="panel-head"><h3>${prettyDate(d)}</h3><span class="badge ${st}">${STATUS_LABEL[st]}</span></div>${body}</div>`;
}

// ---------- GOALS ----------
function renderGoals() {
  const s = store.state, ctx = context(s), tier = currentTier(s, ctx), weak = weakestArea(s);
  const next = TIERS[tier + 1];
  const tierDone = GOALS.filter((g) => g.tier === tier && isDone(s, g, ctx)).length;
  const focus = focusGoals(s, 3);
  const pct = next ? Math.round(100 * (Math.min(ctx.lessons / next.from, 1) + Math.min(tierDone / 2, 1)) / 2) : 100;
  const goalItem = (g) => {
    const done = isDone(s, g, ctx);
    return `<li class="${done ? "done" : ""}">
      <label><input type="checkbox" data-act="goal" data-id="${g.id}" ${done ? "checked" : ""} ${g.auto ? "disabled" : ""}><span class="box">${icon("check")}</span>
      <span class="gt">${esc(g.title)}${g.auto ? ` <small class="muted">· ticks itself</small>` : ""}</span></label>
      <span class="chip">${AREAS[g.area]}</span></li>`;
  };
  view.innerHTML = `
    <header class="page-head"><p class="eyebrow">Goals</p><h1 class="display">From bedroom to open mic.</h1></header>
    <section class="road" aria-label="Your levels">
      ${TIERS.map((t, i) => `<div class="stop ${i < tier ? "past" : i === tier ? "here" : ""}" style="--i:${i}"><span class="node">${i < tier ? icon("check") : i === tier ? pick() : ""}</span><b>${t.name}</b><small>${i === 0 ? "from day one" : `lesson ${t.from}+`}</small>${i === tier ? `<span class="hand you">you are here</span>` : ""}</div>`).join("")}
    </section>
    <div class="goals-top">
      <section class="card level-card">
        <p class="eyebrow">Current level</p>
        <h2 class="display">${TIERS[tier].name}</h2>
        ${next ? `<p>Next up: <b>${next.name}</b>. Reach lesson ${next.from} <span class="muted">(${Math.min(ctx.lessons, next.from)}/${next.from})</span> and tick off two ${TIERS[tier].name} goals <span class="muted">(${Math.min(tierDone, 2)}/2)</span>.</p>
          <div class="bar lg"><i style="width:${pct}%"></i></div><p class="small muted">${pct}% of the way there</p>` : "<p>Top of the notebook. Time to write the next one.</p>"}
      </section>
      ${weak ? `<aside class="card weak"><span class="hand">a note from your journal</span><p><b>${esc(weak.label)}</b> has felt shakiest lately (averaging ${weak.avg.toFixed(1)}/5).</p><p class="muted">${esc(weak.tip)}</p></aside>`
        : `<aside class="card weak"><span class="hand">a note from your journal</span><p>Rate a few lessons in your journal and I'll point out the area that needs most love.</p></aside>`}
    </div>
    <section class="focus-wrap">
      <div class="card-head"><h2 class="display sm">Focus on these next</h2></div>
      <div class="focus">${focus.map((g, i) => `<div class="card focus-card"><span class="big-n">${pad2(i + 1)}</span><p>${esc(g.title)}</p><div class="row between"><span class="chip">${AREAS[g.area]}</span>${g.auto ? `<span class="small muted">ticks itself</span>` : `<button class="btn sm primary" data-act="goal-done" data-id="${g.id}">${icon("check")} Done it</button>`}</div></div>`).join("") || "<p>All clear. Pick your own next challenge!</p>"}</div>
    </section>
    <div class="tiers">${TIERS.map((t, i) => `<section class="card tier ${i > tier ? "future" : ""}">
      <div class="card-head"><h3>${t.name}</h3>${i > tier ? `<span class="small muted">unlocks around lesson ${t.from}</span>` : i === tier ? `<span class="badge today">You're here</span>` : `<span class="badge done">Cleared</span>`}</div>
      <ul class="goal-list">${GOALS.filter((g) => g.tier === i).map(goalItem).join("")}</ul>
    </section>`).join("")}</div>`;
}

// ---------- TAPES ----------
let tapeFilter = "all";
let nowPlaying = null; // { audio, btn }

function renderTapes() {
  const list = liveSessions().sort((a, b) => b.date.localeCompare(a.date) || (b.completedAt || 0) - (a.completedAt || 0))
    .filter((x) => tapeFilter === "all" || x.recording);
  const firstTake = liveSessions().filter((x) => x.recording).sort((a, b) => a.date.localeCompare(b.date))[0];
  const takes = liveSessions().filter((x) => x.recording).length;
  view.innerHTML = `
    <header class="page-head row between">
      <div><p class="eyebrow">Tapes</p><h1 class="display">Proof you're getting better.</h1><p class="lead muted">${takes} take${takes === 1 ? "" : "s"} and every journal entry, newest first.</p></div>
      <div class="seg-ctl filter"><button class="${tapeFilter === "all" ? "on" : ""}" data-act="filter" data-f="all">Everything</button><button class="${tapeFilter === "rec" ? "on" : ""}" data-act="filter" data-f="rec">Recordings</button></div>
    </header>
    <section class="tapes">
      ${list.map((x, i) => `<article class="card tape-card" style="--i:${Math.min(i, 8)}">
        <header>
          <div><p class="eyebrow">${x.lesson != null ? lessonLabel(x.lesson) : "Free practice"}${x.guitar ? ` · ${esc(x.guitar)}` : ""}</p><h3 class="display sm">${esc(x.title || "Free practice")}</h3><span class="small muted">${prettyDate(x.date)}</span></div>
          ${x.journal?.mood != null ? `<span class="mood-badge m${x.journal.mood}" title="${MOODS[x.journal.mood]}">${moodFace(x.journal.mood, 30)}</span>` : ""}
        </header>
        ${x.recording ? `<button class="wave-btn" data-act="play" data-name="${esc(x.recording.name)}" aria-label="Play recording"><span class="pb">${icon("play")}</span>${waveform(x.recording.name)}<span class="dur">${x.recording.secs ? mmss(x.recording.secs) : ""}</span></button>
          ${firstTake && firstTake.id !== x.id ? `<button class="link small compare" data-act="play" data-name="${esc(firstTake.recording.name)}" data-compare="1">${icon("play")} Compare with your first take</button>` : ""}`
          : `<div class="no-rec small muted">${icon("mic")} No recording this time</div>`}
        <p class="player small muted" aria-live="polite"></p>
        ${x.journal?.how ? `<blockquote>${esc(x.journal.how)}</blockquote>` : ""}
        <div class="notes">
          ${x.journal?.hard ? `<p><span class="tag hard">Hard</span> ${esc(x.journal.hard)}</p>` : ""}
          ${x.journal?.win ? `<p><span class="tag win">Win</span> ${esc(x.journal.win)}</p>` : ""}
        </div>
      </article>`).join("") || `<div class="card empty">${icon("tape")}<p>Nothing here yet. Finish a lesson and your first take lands here.</p></div>`}
    </section>`;
}

async function playTape(btn) {
  const card = btn.closest(".tape-card");
  const waveBtn = card.querySelector(".wave-btn");
  const status = card.querySelector(".player");
  if (nowPlaying?.btn === btn) {
    if (nowPlaying.audio.paused) nowPlaying.audio.play(); else nowPlaying.audio.pause();
    return;
  }
  stopTape();
  status.textContent = "Loading…";
  try {
    const blob = await getAudio(btn.dataset.name);
    if (!blob) { status.textContent = "Couldn't find that recording. It may not have synced from the device you made it on yet."; return; }
    const audio = new Audio(URL.createObjectURL(blob));
    nowPlaying = { audio, btn };
    const target = btn.dataset.compare ? null : waveBtn;
    status.textContent = btn.dataset.compare ? "Playing your first take…" : "";
    const bars = target ? [...target.querySelectorAll(".wave i")] : [];
    const light = (p) => { const n = Math.round(p * bars.length); bars.forEach((b, i) => b.classList.toggle("lit", i < n)); };
    audio.addEventListener("timeupdate", () => { if (audio.duration && isFinite(audio.duration)) light(audio.currentTime / audio.duration); });
    audio.addEventListener("play", () => { target?.classList.add("playing"); if (target) target.querySelector(".pb").innerHTML = icon("pause"); });
    audio.addEventListener("pause", () => { target?.classList.remove("playing"); if (target) target.querySelector(".pb").innerHTML = icon("play"); });
    audio.addEventListener("ended", () => { status.textContent = ""; light(0); stopTape(); });
    await audio.play();
  } catch (e) { status.textContent = `Couldn't play it: ${e.message}`; }
}
function stopTape() {
  if (!nowPlaying) return;
  nowPlaying.audio.pause();
  URL.revokeObjectURL(nowPlaying.audio.src);
  nowPlaying = null;
}

// ---------- SETTINGS ----------
function renderSettings() {
  const st = store.settings;
  view.innerHTML = `
    <header class="page-head"><p class="eyebrow">Settings</p><h1 class="display">Under the hood.</h1></header>
    <div class="cols settings-grid"><div class="col-main">
    <section class="card">
      <div class="card-head"><h2 class="display sm">${icon("cloud")} Sync between devices</h2><span class="badge ${configured() && store.sync.status === "ok" ? "done" : "off"}">${configured() ? (store.sync.status === "ok" ? "Connected" : "Set up") : "Not connected"}</span></div>
      <p>Your log, journal and recordings live in a <b>private</b> GitHub repo, so your laptop and phone stay in step. Each device needs its own token:</p>
      <ol class="steps-list">
        <li>Open <a class="link" href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener">GitHub → new fine-grained token ${icon("link")}</a></li>
        <li>Name it “Guitar Hero (this device)” and set it to expire in 1 year.</li>
        <li><b>Repository access:</b> only select <code>guitar-hero-data</code>.</li>
        <li><b>Permissions → Contents:</b> Read and write. Nothing else.</li>
        <li>Generate it and paste it below. It stays in this browser only.</li>
      </ol>
      <form id="sync-form" class="stack">
        <label class="field"><span class="eyebrow">Data repo</span><input name="repo" value="${esc(st.repo)}" autocomplete="off" spellcheck="false"></label>
        <label class="field"><span class="eyebrow">Token</span><input name="token" type="password" value="${esc(st.token)}" autocomplete="off" placeholder="github_pat_…"></label>
        <div class="row"><button class="btn primary">Save &amp; test</button><button type="button" class="btn" data-act="sync">${icon("reset")} Sync now</button>${st.token ? `<button type="button" class="btn ghost" data-act="disconnect">Forget token</button>` : ""}</div>
        <p class="sync-msg small" data-status="${store.sync.status}">${configured() ? esc(store.sync.message || "") + (store.sync.lastSynced ? ` · last synced ${store.sync.lastSynced.toLocaleTimeString()}` : "") : "Not connected: everything stays on this device for now."}</p>
      </form>
    </section></div><div class="col-side">
    <section class="card">
      <h3>Warm nudges by email</h3>
      <p class="small muted">Every weekday evening your data repo checks the log. If lessons are slipping, it opens an issue that @mentions you, so GitHub emails you. Close it once you've read it.</p>
    </section>
    <section class="card">
      <h3>Your plan</h3>
      <form id="start-form" class="row end"><label class="field grow"><span class="eyebrow">Started on</span><input type="date" name="start" value="${store.state.startDate}"></label><button class="btn">Update</button></form>
      <p class="small muted">Weekdays on, weekends off. Minimum five a week, unless you're sick, on holiday or dealing with an emergency.</p>
    </section>
    <section class="card">
      <h3>Backup</h3>
      <div class="row"><button class="btn" data-act="export">${icon("download")} Download</button><label class="btn">${icon("upload")} Restore<input type="file" accept="application/json" data-act="import" hidden></label></div>
      <p class="small muted">Backups hold your log and journal. Recordings live in the data repo and this browser.</p>
    </section></div></div>`;
}

// ---------- FIND YOUR LEVEL ----------
function renderLevel() {
  const curWeek = Math.floor((nextIndex() % LESSON_COUNT) / 5) + 1;
  view.innerHTML = `
    <header class="page-head"><a class="back-link" href="#/">${icon("arrowLeft")} Today</a><p class="eyebrow">Find your level</p><h1 class="display">Start where you actually are.</h1>
      <p class="lead muted">Skim each week. If you could already do most of it comfortably, skip past it. Pick the first week that looks like a real stretch. Lessons you've done stay in your log, and you can move back any time.</p></header>
    <div class="weeks">${WEEKS.map((w, i) => `<article class="card week-pick${i + 1 === curWeek ? " current" : ""}" style="--i:${i}">
      <div class="card-head"><p class="eyebrow">Week ${i + 1}</p>${i + 1 === curWeek ? `<span class="badge today">You're here</span>` : ""}</div>
      <h3 class="display sm">${esc(w.title)}</h3>
      <ul>${w.days.map((d) => `<li>${esc(d.t)}</li>`).join("")}</ul>
      <div class="row between"><span class="small muted">${w.areas.map((a) => AREAS[a]).slice(0, 3).join(" · ")}</span>${i + 1 === curWeek ? "" : `<button class="btn sm ${i + 1 > curWeek ? "primary" : ""}" data-act="place" data-week="${i + 1}">Start here</button>`}</div>
    </article>`).join("")}</div>`;
}

// ---------- routing & events ----------
const ROUTES = { "": renderToday, level: renderLevel, lesson: renderLesson, tracker: renderTracker, goals: renderGoals, tapes: renderTapes, settings: renderSettings };
const currentRoute = () => (location.hash.replace(/^#\/?/, "").split("/")[0]) || "";

function render({ animate = false } = {}) {
  const r = currentRoute();
  if (r !== "lesson") stopAll();
  if (r !== "tapes") stopTape();
  if (r !== "") { unmountStrings?.(); unmountStrings = null; }
  (ROUTES[r] || renderToday)();
  if (animate && !reducedMotion()) { view.classList.remove("enter"); void view.offsetWidth; view.classList.add("enter"); }
  renderNav(r);
  renderSync();
}

window.addEventListener("hashchange", () => { render({ animate: true }); window.scrollTo(0, 0); });
window.addEventListener("resize", () => renderNav(currentRoute()));
store.subscribe(() => { renderSync(); if (!["lesson", "settings"].includes(currentRoute())) render(); });

view.addEventListener("click", async (e) => {
  const el = e.target.closest("[data-act]");
  if (!el) return;
  const a = el.dataset.act;
  const lessonStep = (fn) => { fn(); saveRun(); render({ animate: true }); window.scrollTo(0, 0); };
  switch (a) {
    case "guitar": lessonStep(() => { lessonRun.guitar = el.dataset.g; lessonRun.step = 1; }); break;
    case "next":
      if (el.hasAttribute("data-needs-take") && !confirm("No take recorded yet. Skip the recording this time?")) return;
      lessonStep(() => { if (el.hasAttribute("data-needs-take")) pendingTake = { skipped: true }; lessonRun.step++; });
      break;
    case "prev": lessonStep(() => { if (lessonRun.step > 0) lessonRun.step--; }); break;
    case "timer": {
      const box = $(".timer");
      if (!timer) timer = { left: Number(box.dataset.total), total: Number(box.dataset.total), running: false };
      if (timer.left === 0) return;
      timer.running = !timer.running;
      if (timer.running) timer.handle = setInterval(tickTimer, 1000); else clearInterval(timer.handle);
      box.classList.toggle("running", timer.running);
      el.innerHTML = timer.running ? `${icon("pause")} <span>Pause</span>` : `${icon("play")} <span>Resume</span>`;
      break;
    }
    case "timer-reset": {
      if (timer?.handle) clearInterval(timer.handle);
      const box = $(".timer"), total = Number(box.dataset.total);
      timer = null;
      box.classList.remove("ding", "running");
      $(".timer .clock").textContent = mmss(total);
      $(".timer .prog").style.strokeDashoffset = 0;
      $("[data-act=timer]").innerHTML = `${icon("play")} <span>Start</span>`;
      break;
    }
    case "metro":
      metro.toggle();
      el.innerHTML = metro.running ? `${icon("stop")} <span>Stop click</span>` : `${icon("play")} <span>Start click</span>`;
      el.classList.toggle("primary", metro.running);
      if (!metro.running) $$(".beats i").forEach((i) => i.classList.remove("on"));
      break;
    case "bpm": setBpm(metro.bpm + Number(el.dataset.d)); break;
    case "rec": toggleRecord(el, getLesson(lessonRun.index, lessonRun.guitar || "electric").recSecs); break;
    case "tuner": metro?.stop(); openTuner(); break;
    case "place": {
      const w = Number(el.dataset.week);
      if (!confirm(`Jump to Week ${w}: ${WEEKS[w - 1].title}? Your next lesson will be Week ${w}, Day 1.`)) return;
      update((st) => { st.prefs ||= {}; st.prefs.placement = stamp({ value: (w - 1) * 5 - lessonsDone() }); });
      lessonRun = null; try { sessionStorage.removeItem(LESSON_KEY); } catch {}
      location.hash = "#/";
      break;
    }
    case "retake": if (pendingTake?.url) URL.revokeObjectURL(pendingTake.url); pendingTake = null; renderLesson(); break;
    case "skip-rec": lessonStep(() => { pendingTake = { skipped: true }; lessonRun.step++; }); break;
    case "sound": setSound(!soundOn()); el.innerHTML = icon(soundOn() ? "volume" : "volumeOff"); el.title = soundOn() ? "Mute" : "Unmute"; el.setAttribute("aria-label", soundOn() ? "Mute the strings" : "Unmute the strings"); break;
    case "day": selected = el.dataset.date; renderTracker(); break;
    case "month": { const d = new Date(cal.y, cal.m + Number(el.dataset.d), 1); cal = { y: d.getFullYear(), m: d.getMonth() }; renderTracker(); break; }
    case "excuse": update((st) => { st.excuses[el.dataset.date] = stamp({ reason: el.dataset.reason }); }); break;
    case "unexcuse": update((st) => { st.excuses[el.dataset.date] = stamp({ deleted: true }); }); break;
    case "shift": selected = el.dataset.to; update((st) => { st.shifts[el.dataset.from] = stamp({ to: el.dataset.to }); }); break;
    case "unshift": update((st) => { st.shifts[el.dataset.from] = stamp({ deleted: true }); }); break;
    case "logfree": {
      const id = uid();
      update((st) => { st.sessions[id] = stamp({ id, date: el.dataset.date, lesson: null, title: "Free practice", completedAt: Date.now(), recording: null, journal: { how: "" } }); });
      break;
    }
    case "goal-done": update((st) => { st.goals[el.dataset.id] = stamp({ done: true, date: today() }); }); break;
    case "filter": tapeFilter = el.dataset.f; stopTape(); renderTapes(); break;
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

view.addEventListener("dblclick", (e) => {
  const out = e.target.closest("[data-bpm-edit]");
  if (out && metro) { e.preventDefault(); editBpm(out); }
});
view.addEventListener("keydown", (e) => {
  const out = e.target.closest?.("[data-bpm-edit]");
  if (!out || !metro || out.querySelector("input")) return;
  if (e.key === "ArrowUp" || e.key === "ArrowRight") { e.preventDefault(); setBpm(metro.bpm + 1); }
  if (e.key === "ArrowDown" || e.key === "ArrowLeft") { e.preventDefault(); setBpm(metro.bpm - 1); }
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); editBpm(out); }
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
    msg.dataset.status = "syncing";
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

// header wiring
for (const a of document.querySelectorAll("nav a[data-icon]")) a.insertAdjacentHTML("afterbegin", icon(a.dataset.icon));
document.getElementById("sync").addEventListener("click", () => { location.hash = "#/settings"; });
document.getElementById("tuner-btn").addEventListener("click", () => { metro?.stop(); openTuner(); });
document.getElementById("theme").addEventListener("click", () => {
  const next = effectiveTheme() === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("gh.theme", next); } catch {}
  renderThemeBtn();
});
addEventListener("scroll", () => document.body.classList.toggle("scrolled", scrollY > 8), { passive: true });
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") syncNow(); });

renderThemeBtn();
render({ animate: true });
syncNow();
// Fonts change tab widths once they load; re-measure the sliding nav indicator.
document.fonts?.ready.then(() => renderNav(currentRoute()));
