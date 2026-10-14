// A different hello every visit, picked from whichever pools fit the moment,
// never repeating one of the last few shown.
import { pickRandom } from "./util.js?v=1";

const HISTORY_KEY = "gh.greetings.v1";

const POOLS = {
  any: [
    "Alright Tom, strings on?",
    "Tom! The guitar's been waiting.",
    "Welcome back to the woodshed, Tom.",
    "Fingers ready, Tom? Let's make some noise.",
    "Hey Tom. Tune up, then let's play.",
    "Tom's in the building.",
    "Plug in, Tom. Or don't, if it's the acoustic.",
    "Good to see you, Tom. Pick in hand?",
    "Calluses won't build themselves, Tom.",
    "Back for more, Tom? Excellent.",
    "Ready to sound a little better than yesterday, Tom?",
    "Tom, your future open-mic self says hi.",
  ],
  morning: [
    "Morning, Tom. Coffee, then chords.",
    "Early riser, Tom! Fresh fingers play best.",
    "Rise and shred, Tom.",
  ],
  afternoon: [
    "Afternoon, Tom. Time for a lunchtime lick?",
    "Afternoon slot, Tom. Let's make it count.",
  ],
  evening: [
    "Evening, Tom. Golden-hour guitar time.",
    "Evening session, Tom. The best kind.",
    "Day's done, Tom. Now the fun part.",
  ],
  late: [
    "Late one, Tom? Keep it quiet for the neighbours.",
    "Midnight practice, Tom? Proper musician hours.",
  ],
  monday: ["New week, new riffs, Tom.", "Monday, Tom. Set the tone for the week."],
  friday: ["Friday, Tom! Finish the week strong.", "Last lesson of the week, Tom. Make it a good one."],
  weekend: ["Weekend, Tom. No lesson scheduled, but the guitar's still here.", "Day off, Tom. Rest is part of practice too."],
  streak: [
    "{n} days on the trot, Tom. You're on fire.",
    "Streak: {n}. Don't break the chain, Tom.",
    "{n} in a row, Tom. That's how players are made.",
  ],
  returning: [
    "Tom! It's been a few days. The guitar missed you.",
    "Welcome back, Tom. Let's shake the rust off.",
  ],
  doneToday: [
    "Lesson's in the bag, Tom. Nice one.",
    "Done for today, Tom. Free play's always open.",
  ],
  first: ["Hello Tom! Page one of your guitar notebook starts here."],
};

export function greet({ hour, weekday, streak, daysAway, doneToday, firstVisit }) {
  let pools;
  if (firstVisit) pools = ["first"];
  else {
    pools = ["any", "any"];
    pools.push(hour < 12 ? "morning" : hour < 17 ? "afternoon" : hour < 23 ? "evening" : "late");
    if (hour < 5) pools.push("late");
    if (weekday === 1) pools.push("monday");
    if (weekday === 5) pools.push("friday");
    if (weekday === 0 || weekday === 6) pools.push("weekend", "weekend");
    if (streak >= 3) pools.push("streak", "streak");
    if (daysAway >= 3) pools = ["returning"];
    if (doneToday) pools = ["doneToday", "any"];
  }
  let history = [];
  try { history = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch {}
  const candidates = pools.flatMap((p) => POOLS[p]).filter((g) => !history.includes(g));
  const line = pickRandom(candidates.length ? candidates : POOLS.any);
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify([line, ...history].slice(0, 8))); } catch {}
  return line.replace("{n}", streak);
}
