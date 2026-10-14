import { addDays, daysBetween, mondayOf, today, weekday } from "./util.js?v=1";

export const REASONS = {
  sick: { label: "Sick", mark: "S" },
  holiday: { label: "Holiday", mark: "H" },
  emergency: { label: "Emergency", mark: "E" },
};
export const WEEKLY_MIN = 5;

const live = (rec) => rec && !rec.deleted;

export function sessionsOn(state, date) {
  return Object.values(state.sessions).filter((s) => live(s) && s.date === date);
}
export const practisedOn = (state, date) => sessionsOn(state, date).length > 0;
export const excuseOn = (state, date) => (live(state.excuses[date]) ? state.excuses[date] : null);

export function isScheduled(state, date) {
  if (live(state.shifts[date])) return false; // moved away
  if (Object.values(state.shifts).some((s) => live(s) && s.to === date)) return true; // moved here
  const wd = weekday(date);
  return wd >= 1 && wd <= 5;
}

// done (green) · off (grey) · missed (red) · excused · today · planned · pre
export function dayStatus(state, date, now = today()) {
  if (state.startDate && date < state.startDate) return "pre";
  if (practisedOn(state, date)) return "done";
  if (excuseOn(state, date)) return "excused";
  if (!isScheduled(state, date)) return "off";
  if (date < now) return "missed";
  if (date === now) return "today";
  return "planned";
}

export function weekSummary(state, anyDate, now = today()) {
  const mon = mondayOf(anyDate);
  let practised = 0, excused = 0, scheduledLeft = 0, beforeStart = 0;
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    const st = dayStatus(state, d, now);
    if (st === "done") practised++;
    else if (st === "excused") excused++;
    else if (st === "today" || st === "planned") scheduledLeft++;
    else if (st === "pre" && isScheduled(state, d)) beforeStart++; // first week is pro-rated
  }
  const required = Math.max(0, WEEKLY_MIN - excused - beforeStart);
  return { mon, practised, excused, required, scheduledLeft, onTrack: practised + scheduledLeft >= required };
}

// Consecutive scheduled days practised, counting back. Off and excused days don't break it;
// today only counts once it's done.
export function streak(state, now = today()) {
  let n = 0;
  for (let d = now, guard = 0; guard < 800; d = addDays(d, -1), guard++) {
    const st = dayStatus(state, d, now);
    if (st === "pre") break;
    if (st === "done") n++;
    else if (st === "missed") break;
  }
  return n;
}

// A lesson can move to a non-scheduled, unpractised day in the same Mon–Sun week, today or later.
export function shiftTargets(state, from, now = today()) {
  const mon = mondayOf(from);
  const out = [];
  for (let i = 0; i < 7; i++) {
    const d = addDays(mon, i);
    if (d === from || d < now) continue;
    if (!isScheduled(state, d) && !practisedOn(state, d) && !excuseOn(state, d)) out.push(d);
  }
  return out;
}

// Warm-nudge detection. Shared logic with the GitHub Action (scripts/nudge.py mirrors this).
export function nudgeCheck(state, now = today()) {
  if (!state.startDate) return null;
  let excused28 = 0, missed14 = 0;
  for (let i = 1; i <= 28; i++) {
    const d = addDays(now, -i);
    const st = dayStatus(state, d, now);
    if (st === "excused") excused28++;
    if (st === "missed" && i <= 14) missed14++;
  }
  const wk = weekSummary(state, now, now);
  if (excused28 >= 4) return { kind: "excuses", count: excused28 };
  if (missed14 >= 2) return { kind: "missed", count: missed14 };
  if (!wk.onTrack && daysBetween(state.startDate, now) >= 3) return { kind: "behind", count: wk.required - wk.practised };
  return null;
}
