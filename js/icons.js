// One consistent line-icon set: 24px grid, 1.75 stroke, round caps.
const P = {
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft: '<path d="M19 12H5M11 6l-6 6 6 6"/>',
  chevronLeft: '<path d="M15 5l-7 7 7 7"/>',
  chevronRight: '<path d="M9 5l7 7-7 7"/>',
  play: '<path d="M7.5 5.2v13.6a.6.6 0 0 0 .9.5l11-6.8a.6.6 0 0 0 0-1L8.4 4.7a.6.6 0 0 0-.9.5z" fill="currentColor" stroke="none"/>',
  pause: '<rect x="6.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/><rect x="13.5" y="5" width="4" height="14" rx="1.2" fill="currentColor" stroke="none"/>',
  stop: '<rect x="6" y="6" width="12" height="12" rx="2.5" fill="currentColor" stroke="none"/>',
  reset: '<path d="M4 12a8 8 0 1 0 2.6-5.9"/><path d="M4 4.5V9h4.5"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  x: '<path d="M6.5 6.5l11 11M17.5 6.5l-11 11"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  flame: '<path d="M12 3c.9 3.3 4.8 5.4 4.8 9.8a4.8 4.8 0 0 1-9.6 0c0-2.4 1.3-3.9 2.3-4.9.3 1.7 1.2 2.6 2.4 3-.1-2.9-.9-5.4.1-7.9z"/>',
  today: '<circle cx="12" cy="12" r="3.6"/><path d="M12 3v1.8M12 19.2V21M3 12h1.8M19.2 12H21M5.6 5.6l1.3 1.3M17.1 17.1l1.3 1.3M5.6 18.4l1.3-1.3M17.1 6.9l1.3-1.3"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8.5 3v4M15.5 3v4"/>',
  target: '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.8"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/>',
  tape: '<rect x="2.5" y="5.5" width="19" height="13" rx="2.5"/><circle cx="8.2" cy="11.5" r="2"/><circle cx="15.8" cy="11.5" r="2"/><path d="M10.2 11.5h3.6M6.5 18.5l1.6-2.6h7.8l1.6 2.6"/>',
  sliders: '<path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="17" cy="17" r="2"/>',
  cloud: '<path d="M7 18.5a4.2 4.2 0 0 1-.4-8.4 5.6 5.6 0 0 1 10.8-1.3 3.9 3.9 0 0 1 .1 9.7z"/>',
  mic: '<rect x="9" y="3" width="6" height="11.5" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"/>',
  volume: '<path d="M4 9.5v5h3.8l4.7 4V5.5l-4.7 4z"/><path d="M16 9a4.2 4.2 0 0 1 0 6M18.6 6.4a8 8 0 0 1 0 11.2"/>',
  volumeOff: '<path d="M4 9.5v5h3.8l4.7 4V5.5l-4.7 4z"/><path d="M16.5 9.5l5 5M21.5 9.5l-5 5"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4"/>',
  moon: '<path d="M19.5 14.6A8 8 0 1 1 9.4 4.5a6.4 6.4 0 0 0 10.1 10.1z"/>',
  metronome: '<path d="M7.2 20.5L10 3.5h4l2.8 17z"/><path d="M12 15.5l5.2-7.5M6.5 20.5h11"/>',
  sparkle: '<path d="M12 3.5l1.7 5 5 1.7-5 1.7-1.7 5-1.7-5-5-1.7 5-1.7z"/><path d="M18.5 15.5l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z"/>',
  note: '<path d="M9 18V6.5l10-2V16"/><circle cx="6.8" cy="18" r="2.3"/><circle cx="16.8" cy="16" r="2.3"/>',
  guitar: '<path d="M14.5 9.5l5-5M18 3l3 3"/><path d="M11.8 8.6a3 3 0 0 0-4.6 1.1c-.4.8-1.3 1.1-2.2 1.2a3.3 3.3 0 0 0-2.1 5.7l4.5 4.5a3.3 3.3 0 0 0 5.7-2.1c.1-.9.4-1.8 1.2-2.2a3 3 0 0 0 1.1-4.6z"/><circle cx="10" cy="14" r="1.6"/>',
  pen: '<path d="M4 20l4.2-1 10.4-10.4a2 2 0 0 0-3.2-3.2L5 15.8z"/><path d="M13.8 7l3.2 3.2"/>',
  download: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  upload: '<path d="M12 15.5V4M7 9l5-5 5 5M5 20h14"/>',
  link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
  move: '<path d="M4 12h16M15 7l5 5-5 5"/><path d="M4 7v10"/>',
  heart: '<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.3a4.3 4.3 0 0 1 7.5 2.5C19.5 15.4 12 20 12 20z"/>',
};

export const icon = (name, cls = "") =>
  `<svg class="i ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;

// Mood faces in the same line style. 0 rough … 4 buzzing.
const MOUTHS = ["M8.2 16.4q3.8-3.4 7.6 0", "M8.5 15.2h7", "M8.4 14.6q3.6 2.2 7.2 0", "M8 13.8q4 4.4 8 0", "M7.6 13.2q4.4 6 8.8 0z"];
export function moodFace(n, size = 40) {
  const eyes = n === 4
    ? '<path d="M8 10.2l1.2-1.6 1.2 1.6M13.6 10.2l1.2-1.6 1.2 1.6"/>'
    : n === 0
      ? '<path d="M8 9.6l2.2.8M16 9.6l-2.2.8"/><circle cx="9.2" cy="11" r=".9" fill="currentColor" stroke="none"/><circle cx="14.8" cy="11" r=".9" fill="currentColor" stroke="none"/>'
      : '<circle cx="9.2" cy="10" r="1" fill="currentColor" stroke="none"/><circle cx="14.8" cy="10" r="1" fill="currentColor" stroke="none"/>';
  return `<svg class="face" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="9.5"/>${eyes}<path d="${MOUTHS[n]}" ${n === 4 ? 'fill="currentColor"' : ""}/></svg>`;
}

export const PICK_PATH = "M12 1.5C18.6 1.5 22.5 5 22.5 9.6C22.5 15.8 15.6 22.5 12 22.5C8.4 22.5 1.5 15.8 1.5 9.6C1.5 5 5.4 1.5 12 1.5Z";
export const pick = (cls = "") => `<svg class="pick ${cls}" viewBox="0 0 24 24" aria-hidden="true"><path d="${PICK_PATH}"/></svg>`;
