// What your picking hand should be doing in each lesson block.
// Rules read the instruction text; OVERRIDES fix the cases rules get wrong.
// Keys are "week-day-block", all 1-based week/day, e.g. "1-3-x".

export const HANDS = {
  alt: { label: "Alternate picking", how: "Pick down-up-down-up, strictly alternating, even when you change strings. Small movements from the wrist." },
  down: { label: "Downstrokes only", how: "Pick every note downwards. It gives a tighter, heavier sound for riffs and muted chugs." },
  strum: { label: "Strum", how: "Strum with the plectrum. Keep your arm swinging down-up in time, even when you miss the strings." },
  arp: { label: "Pick each string", how: "Hold the chord shape and pick one string at a time, letting the notes ring into each other." },
  legato: { label: "Pick the first note only", how: "Pick once, then hammer-ons and pull-offs sound the rest. Your fretting hand does the work." },
  bend: { label: "Pick once, then bend", how: "Pick the note a single time, then push the string with your fretting hand to change the pitch. No re-picking." },
  notes: { label: "Single notes, slowly", how: "Pick each note with a downstroke. Speed doesn't matter here; the point is knowing which note you're playing." },
  none: { label: "No pick needed", how: "This one's for your ears, voice or brain. Pluck a note gently if you need to hear it." },
  choice: { label: "Your call", how: "Pick, strum or fingerpick: whatever the music needs." },
  slide: { label: "Pick once, then slide", how: "Pick the first note, then slide your fretting finger to the next one without picking again." },
  shuffleLicks: { label: "Downstrokes, then alternate", how: "Downstrokes for the shuffle riff; switch to alternate picking for the licks." },
  riffSong: { label: "Alternate picking, then strum", how: "Alternate picking for the riff, then strum the song's chords." },
  rhythmLead: { label: "Strum, then alternate", how: "Strum the rhythm part, then switch to alternate picking for the lead." },
};

const OVERRIDES = {
  "1-1-x": "alt", "1-1-r": "strum", "1-1-s": "strum", "1-1-rec": "strum",
  "1-2-x": "strum", "1-2-rec": "strum",
  "1-3-x": "arp", "1-3-rec": "strum",
  "1-4-x": "strum", "1-4-f": "notes",
  "1-5-x": "strum", "1-5-f": "none",
  "2-1-s": "strum", "2-4-x": "down", "2-4-r": "down", "2-4-rec": "down", "2-4-f": "none", "2-5-f": "none",
  "3-1-s": "none", "3-2-x": "down", "3-2-r": "down", "3-2-s": "down", "3-2-rec": "down",
  "3-3-w": "down", "3-3-r": "alt", "3-4-r": "down", "3-4-f": "strum", "3-5-rec": "alt", "3-5-f": "none", "3-5-s": "strum",
  "4-1-x": "arp", "4-1-r": "strum", "4-1-f": "strum", "4-1-s": "strum", "4-1-rec": "arp",
  "4-2-x": "notes", "4-2-r": "strum", "4-2-f": "strum", "4-2-s": "strum", "4-2-rec": "strum",
  "4-3-f": "bend", "4-4-f": "strum", "4-5-x": "strum", "4-5-r": "strum", "4-5-f": "none", "4-5-s": "strum", "4-5-rec": "strum",
  "5-1-w": "bend", "5-1-f": "notes", "5-1-s": "bend", "5-2-r": "notes", "5-2-f": "notes",
  "5-3-s": "alt", "5-3-rec": "alt", "5-3-f": "notes", "5-4-w": "bend", "5-4-r": "notes", "5-4-f": "strum",
  "5-5-x": "notes", "5-5-r": "alt", "5-5-f": "none",
  "6-2-r": "alt", "6-2-f": "notes", "6-3-x": "alt", "6-3-f": "none", "6-3-s": "alt", "6-3-rec": "alt",
  "6-4-x": "alt", "6-4-w": "bend", "6-4-r": "alt", "6-4-f": "strum", "6-4-s": "choice", "6-4-rec": "alt", "6-5-f": "none",
  "7-1-s": "none", "7-2-x": "notes", "7-2-r": "alt", "7-2-f": "none", "7-2-s": "strum", "7-2-rec": "alt",
  "7-3-x": "strum", "7-3-r": "strum", "7-3-f": "none", "7-3-s": "strum", "7-3-rec": "strum",
  "7-4-x": "notes", "7-4-r": "down", "7-4-f": "none", "7-4-rec": "down",
  "7-5-x": "notes", "7-5-r": "strum", "7-5-f": "notes", "7-5-s": "strum", "7-5-rec": "alt",
  "8-1-x": "none", "8-1-r": "strum", "8-1-f": "none", "8-1-s": "strum", "8-1-rec": "strum",
  "8-2-x": "strum", "8-2-r": "strum", "8-2-f": "none", "8-2-s": "strum", "8-2-rec": "strum",
  "8-3-x": "none", "8-3-r": "strum", "8-3-f": "strum", "8-3-s": "strum", "8-3-rec": "strum",
  "8-4-x": "strum", "8-4-r": "strum", "8-4-f": "none", "8-4-s": "strum", "8-4-rec": "strum",
  "8-5-x": "strum", "8-5-r": "strum", "8-5-f": "none", "8-5-s": "strum", "8-5-rec": "strum",
  "9-1-x": "strum", "9-1-r": "strum", "9-1-f": "none", "9-1-s": "strum", "9-1-rec": "arp",
  "9-2-x": "strum", "9-2-r": "strum", "9-2-f": "none", "9-2-s": "strum", "9-2-rec": "strum",
  "9-3-f": "legato", "9-4-f": "none", "9-4-s": "arp", "9-4-rec": "arp",
  "9-5-x": "strum", "9-5-r": "strum", "9-5-f": "none", "9-5-s": "strum", "9-5-rec": "strum",
  "10-1-x": "alt", "10-1-r": "alt", "10-1-f": "notes", "10-1-s": "alt", "10-1-rec": "alt",
  "10-2-x": "alt", "10-2-f": "none", "10-2-s": "alt", "10-2-rec": "alt", "10-3-r": "alt", "10-3-f": "none", "10-3-rec": "alt",
  "10-4-w": "bend", "10-4-r": "alt", "10-4-f": "none", "10-5-r": "alt", "10-5-f": "notes", "10-5-s": "choice", "10-5-rec": "alt",
  "11-1-x": "strum", "11-1-f": "strum", "11-1-s": "strum", "11-1-rec": "strum",
  "11-2-x": "strum", "11-2-r": "strum", "11-2-f": "none", "11-2-s": "strum", "11-2-rec": "strum",
  "11-3-x": "strum", "11-3-r": "strum", "11-3-f": "strum", "11-3-s": "strum", "11-3-rec": "strum",
  "11-4-x": "choice", "11-4-r": "choice", "11-4-f": "none", "11-4-s": "choice", "11-4-rec": "choice",
  "11-5-x": "none", "11-5-r": "choice", "11-5-f": "none", "11-5-s": "choice", "11-5-rec": "choice",
  "12-1-x": "strum", "12-1-r": "strum", "12-1-f": "none", "12-1-s": "strum", "12-1-rec": "strum",
  "12-2-x": "alt", "12-2-r": "alt", "12-2-f": "none", "12-2-rec": "alt",
  "12-3-x": "strum", "12-3-r": "strum", "12-3-f": "notes", 
  "12-4-x": "none", "12-4-r": "choice", "12-4-f": "none", "12-4-s": "choice", "12-4-rec": "choice",
  "12-5-x": "choice", "12-5-r": "choice", "12-5-f": "none", "12-5-s": "choice", "12-5-rec": "choice",
  "13-1-x": "choice", "13-1-r": "choice", "13-1-f": "none", "13-1-s": "choice", "13-1-rec": "choice",
  "13-2-x": "choice", "13-2-r": "choice", "13-2-f": "none", "13-2-s": "choice", "13-2-rec": "choice",
  "13-3-x": "choice", "13-3-r": "choice", "13-3-f": "none", "13-3-s": "choice", "13-3-rec": "choice",
  "13-4-r": "choice", "13-4-f": "none", "13-4-s": "choice", "13-4-rec": "choice",
  "13-5-x": "choice", "13-5-r": "choice", "13-5-f": "none", "13-5-s": "choice", "13-5-rec": "choice",
  // corrections after reviewing every block
  "1-4-rec": "strum", "1-5-rec": "strum", "2-5-rec": "strum",
  "3-3-x": "alt", "3-3-r": "shuffleLicks", "3-3-s": "shuffleLicks", "3-3-rec": "shuffleLicks", "3-5-r": "shuffleLicks", "3-5-rec": "shuffleLicks",
  "5-2-s": "alt", "5-3-r": "alt", "5-4-s": "riffSong", "5-5-s": "riffSong", "5-4-rec": "bend",
  "6-2-x": "slide", "6-2-r": "slide", "6-5-r": "shuffleLicks",
  "7-4-s": "strum", "8-2-w": "strum", "8-3-w": "strum", "9-2-w": "strum", "11-3-w": "strum",
  "10-5-s": "rhythmLead", "11-1-r": "rhythmLead", "12-2-s": "riffSong", "12-3-s": "riffSong", "12-3-rec": "strum", "13-4-x": "strum",
  // corrections after the October curriculum rewrite
  "3-5-f": "notes", "4-2-x": "strum", "5-2-w": "alt", "6-3-f": "notes", "7-1-s": "strum",
  "7-4-r": "alt", "7-4-rec": "alt", "8-1-f": "notes", "9-1-f": "strum", "9-1-rec": "strum", "9-2-f": "strum",
  "9-3-r": "legato", "9-4-f": "arp", "9-5-f": "strum", "10-2-f": "alt", "10-3-f": "alt", "13-4-x": "none", "13-2-x": "none",
};

function byRule(key, text) {
  const t = text.toLowerCase();
  if (key === "free" || t.includes("your choice of warm-up")) return "choice";
  if (/hammer|pull-off|legato/.test(t)) return "legato";
  if (/arpeggi|string by string|one at a time|pick each string/.test(t)) return "arp";
  if (/bend|vibrato/.test(t)) return "bend";
  if (/palm mut|down-picked|power chord/.test(t)) return "down";
  if (/strum|scratch|chop|chord changes|progression|groove/.test(t)) return "strum";
  if (/chromatic|spider|scale|box|pentatonic|alternate|lick|riff|melody|solo|improvis|16th/.test(t)) return "alt";
  if (/\bsong\b/.test(t)) return "strum";
  if (/^(name|write|talk|listen|ear:|sing|hum|calm|count)/.test(t)) return "none";
  if (key === "f") return "notes";
  if (key === "s" || key === "r") return "strum";
  return "alt";
}

export function handFor(week, day, key, text) {
  return OVERRIDES[`${week}-${day}-${key}`] || byRule(key, text || "");
}

// Plectrum or fingers? The headline answer for each block.
const TOOL = {
  alt: "pick", down: "pick", strum: "pick", arp: "pick", legato: "pick", bend: "pick", notes: "pick",
  slide: "pick", shuffleLicks: "pick", riffSong: "pick", rhythmLead: "pick", none: "none", choice: "either",
};
export const TOOLS = {
  pick: { label: "Plectrum", icon: "pick" },
  fingers: { label: "Fingers", icon: "hand" },
  either: { label: "Plectrum or fingers", icon: "pick" },
  none: { label: "No plectrum needed", icon: "ear" },
};

export function handInfo(week, day, key, text, guitar) {
  const code = handFor(week, day, key, text);
  let tool = TOOL[code] || "pick";
  let { label, how } = HANDS[code];
  // Real arpeggio work sounds best fingerpicked on acoustic; "pick each string to check it rings" stays on the plectrum.
  if (code === "arp" && guitar === "acoustic" && /arpeggi/i.test(text || "")) {
    tool = "fingers";
    how = "Fingerpick it: thumb on the bass strings (E, A, D), index, middle and ring fingers on G, B and e. Let every note ring.";
  }
  if (code === "strum" && guitar === "acoustic") how += " A thin plectrum (around 0.6 mm) sounds best for strumming.";
  return { code, tool, toolLabel: TOOLS[tool].label, toolIcon: TOOLS[tool].icon, label, how };
}
