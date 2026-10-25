// Streaks, counts and the month calendar.
import { addDays, daysInMonth, toDate } from "./dates.js";
import { wordCount } from "./journal.js";

/** current: consecutive days with an entry, counting back from today (or from yesterday if today is still blank, so the streak is not "lost" before bedtime). */
export function streaks(journal, today) {
  const has = (d) => !!journal[d];
  let current = 0;
  let d = has(today) ? today : addDays(today, -1);
  while (has(d)) { current++; d = addDays(d, -1); }
  let longest = 0, run = 0, prev = null;
  for (const date of Object.keys(journal).sort()) {
    run = prev && addDays(prev, 1) === date ? run + 1 : 1;
    if (run > longest) longest = run;
    prev = date;
  }
  return { current, longest, wroteToday: has(today) };
}

export function totals(journal) {
  const ds = Object.keys(journal);
  let words = 0;
  for (const d of ds) words += wordCount(journal[d].text);
  return { entries: ds.length, words };
}

/** Month grid for the calendar: weeks start on Monday. Each cell is null (padding) or {date, day, has, size 0-3}. */
export function monthGrid(journal, year, month) {
  const n = daysInMonth(year, month);
  const first = (toDate(`${year}-${String(month).padStart(2, "0")}-01`).getUTCDay() + 6) % 7; // Monday = 0
  const cells = Array(first).fill(null);
  for (let day = 1; day <= n; day++) {
    const date = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const e = journal[date];
    const w = e ? wordCount(e.text) : 0;
    cells.push({ date, day, has: !!e, size: !e ? 0 : w < 30 ? 1 : w < 120 ? 2 : 3 });
  }
  while (cells.length % 7) cells.push(null);
  const weeks = [];
  for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
  return weeks;
}
