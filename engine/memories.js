// "Look back": what you wrote on this day in earlier years, and a few days ago.
import { addDays, daysBetween, isLeap, toDate } from "./dates.js";

/** Entries from the same month and day in earlier years, newest first. A 29 February entry shows on 28 February in years without one. */
export function onThisDay(journal, today) {
  const t = toDate(today), y = t.getUTCFullYear(), mo = t.getUTCMonth() + 1, d = t.getUTCDate();
  const out = [];
  for (const [date, e] of Object.entries(journal)) {
    const [ey, em, ed] = date.split("-").map(Number);
    if (ey >= y) continue;
    const same = em === mo && ed === d;
    const leapDay = em === 2 && ed === 29 && mo === 2 && d === 28 && !isLeap(y);
    if (same || leapDay) out.push({ date, yearsAgo: y - ey, text: e.text });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date));
}

const STEPS = [[7, "A week ago"], [30, "30 days ago"], [90, "90 days ago"]];
/** Entries from a fixed number of days back (only the ones that exist). */
export function recentLookbacks(journal, today) {
  const out = [];
  for (const [n, label] of STEPS) { const date = addDays(today, -n); if (journal[date]) out.push({ label, date, daysAgo: n, text: journal[date].text }); }
  return out;
}

/** The earliest entry, for a line like "You have written for 214 days". */
export function span(journal, today) {
  const ds = Object.keys(journal).sort();
  return ds.length ? { first: ds[0], days: daysBetween(ds[0], today) + 1 } : null;
}
