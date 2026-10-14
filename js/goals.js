// Milestones grouped into ability tiers. Which ones you see depends on how many lessons
// you've done, what you've already ticked off, and which area your journal says is weakest.
import { AREAS } from "./curriculum.js?v=2";
import { streak } from "./schedule.js?v=2";

export const TIERS = [
  { name: "Bedroom Player", from: 0 },
  { name: "Song Finisher", from: 10 },
  { name: "Jam Ready", from: 25 },
  { name: "Open-Mic Ready", from: 45 },
  { name: "Songwriter", from: 60 },
];

// auto: completes itself from your log. area: what it builds.
export const GOALS = [
  { id: "first-five", tier: 0, area: "rhythm", title: "Finish your first 5 lessons", auto: (c) => c.lessons >= 5 },
  { id: "song-start-finish", tier: 0, area: "songs", title: "Play one song start to finish without stopping" },
  { id: "changes-40", tier: 0, area: "technique", title: "40 clean chord changes in one minute (any pair)" },
  { id: "notes-ea", tier: 0, area: "fretboard", title: "Name any note on the E and A strings in 3 seconds" },
  { id: "streak-10", tier: 0, area: "rhythm", title: "Practise 10 scheduled days in a row", auto: (c) => c.bestStreak >= 10 },

  { id: "three-songs", tier: 1, area: "songs", title: "Have 3 songs you can play start to finish" },
  { id: "barre-f", tier: 1, area: "technique", title: "Play a clean F barre chord with every string ringing" },
  { id: "pent-impro", tier: 1, area: "ear", title: "Improvise for a minute over a 12-bar using box 1" },
  { id: "bend-in-tune", tier: 1, area: "technique", title: "Bend a whole tone in tune (check it against the fretted note)" },
  { id: "play-along", tier: 1, area: "ensemble", title: "Play a whole song along with the original recording" },
  { id: "ten-takes", tier: 1, area: "tone", title: "Record 10 takes", auto: (c) => c.recordings >= 10 },

  { id: "by-ear", tier: 2, area: "ear", title: "Work out a melody or riff by ear" },
  { id: "jam-10", tier: 2, area: "ensemble", title: "Jam with someone (or a looper) for 10 minutes" },
  { id: "sixteenths-100", tier: 2, area: "rhythm", title: "Clean 16th-note strumming at 100 bpm" },
  { id: "learn-solo", tier: 2, area: "technique", title: "Learn a solo (8 bars or more) note for note" },
  { id: "set-three", tier: 2, area: "songs", title: "Play and record a 3-song set back to back" },

  { id: "write-riff", tier: 3, area: "songs", title: "Write and record an original riff" },
  { id: "scout-open-mic", tier: 3, area: "ensemble", title: "Go to an open mic and scout it out" },
  { id: "play-for-people", tier: 3, area: "ensemble", title: "Play a song for friends or family" },
  { id: "open-mic", tier: 3, area: "ensemble", title: "Play an open mic!" },

  { id: "write-song", tier: 4, area: "songs", title: "Write a full song (verse + chorus) and record it" },
  { id: "gig-set", tier: 4, area: "tone", title: "Play a 20-minute set somewhere" },
  { id: "next-quarter", tier: 4, area: "songs", title: "Set your goals for the next 3 months" },
];

export const AREA_TIPS = {
  rhythm: "Do 5 minutes of the 'clicks on 2 and 4' metronome drill before every lesson this week.",
  fretboard: "Name 10 random notes every day this week while the kettle boils.",
  technique: "Run the slow accuracy pass (play everything at 50% tempo) for a week.",
  ear: "Work out one riff by ear this week, even a 3-note one.",
  tone: "Spend free play this week tweaking your tone until a single chord sounds great.",
  ensemble: "Play along with a full record at least twice this week, with no stopping.",
  songs: "Play your best song start to finish once a day this week.",
};

function bestStreak(state) {
  // Cheap: the current streak is good enough as a lower bound, plus any stored best.
  return Math.max(streak(state), state.goals["_best-streak"]?.value || 0);
}

export function context(state) {
  const sessions = Object.values(state.sessions).filter((s) => !s.deleted);
  return {
    lessons: sessions.filter((s) => s.lesson != null).length,
    recordings: sessions.filter((s) => s.recording).length,
    bestStreak: bestStreak(state),
  };
}

export const isDone = (state, g, ctx) => Boolean(state.goals[g.id]?.done) || Boolean(g.auto && g.auto(ctx));

// Lesson count unlocks tiers, but you only "level up" once you've ticked off
// at least 2 goals from the tier below. Skills before mileage.
export function currentTier(state, ctx = context(state)) {
  let tier = 0;
  for (let t = 1; t < TIERS.length; t++) {
    const prevDone = GOALS.filter((g) => g.tier === t - 1 && isDone(state, g, ctx)).length;
    if (ctx.lessons >= TIERS[t].from && prevDone >= 2) tier = t;
    else break;
  }
  return tier;
}

// Average journal rating per area over the last 10 sessions; lowest = weakest.
export function weakestArea(state) {
  const sessions = Object.values(state.sessions).filter((s) => !s.deleted && s.journal?.ratings)
    .sort((a, b) => b.date.localeCompare(a.date)).slice(0, 10);
  const totals = {};
  for (const s of sessions) for (const [a, v] of Object.entries(s.journal.ratings)) {
    (totals[a] ||= []).push(Number(v));
  }
  const avgs = Object.entries(totals).filter(([, v]) => v.length >= 2)
    .map(([a, v]) => [a, v.reduce((x, y) => x + y, 0) / v.length]).sort((x, y) => x[1] - y[1]);
  if (!avgs.length || avgs[0][1] >= 4) return null;
  return { area: avgs[0][0], label: AREAS[avgs[0][0]], avg: avgs[0][1], tip: AREA_TIPS[avgs[0][0]] };
}

// The three goals to focus on now: unfinished goals from your tier, with your weakest area first.
export function focusGoals(state, n = 3) {
  const ctx = context(state);
  const tier = currentTier(state, ctx);
  const weak = weakestArea(state);
  const open = GOALS.filter((g) => g.tier <= tier && !isDone(state, g, ctx));
  open.sort((a, b) => (weak && b.area === weak.area) - (weak && a.area === weak.area) || a.tier - b.tier);
  return open.slice(0, n);
}

export function recordBestStreak(state) {
  const s = streak(state);
  const prev = state.goals["_best-streak"]?.value || 0;
  return s > prev ? s : null;
}
