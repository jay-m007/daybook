// Which words show up more lately than before? Plain counting: no sentiment guessing, because that is unreliable for a diary.
import { addDays, daysBetween } from "./dates.js";

const STOP = new Set(`a about after again all also am an and any are as at be because been before being but by can could did do does doing done for from get got had has have he her here him his how i i'm i've if in into is it it's its just me more most my no not now of off on one only or other our out over really she so some than that the their them then there these they this to too up us very was we were what when which who will with would you your day today went`.split(/\s+/));

export function wordCounts(entries) {
  const m = new Map();
  for (const text of entries) for (const w of text.toLowerCase().match(/[\p{L}][\p{L}\p{M}'’-]{2,}/gu) || []) { const k = w.replace(/’/g, "'"); if (!STOP.has(k)) m.set(k, (m.get(k) || 0) + 1); }
  return m;
}

/** Compare the last `days` days with everything earlier. Needs enough writing to mean anything. */
export function rising(journal, today, { days = 30, minNow = 3, limit = 8 } = {}) {
  const now = [], before = [];
  for (const [d, e] of Object.entries(journal)) { const age = daysBetween(d, today); if (age < 0) continue; (age < days ? now : before).push(e.text); }
  if (now.length < 5 || before.length < 5) return { enough: false, rising: [], faded: [], recentEntries: now.length, olderEntries: before.length };
  const a = wordCounts(now), b = wordCounts(before);
  const na = now.length, nb = before.length;
  const rate = (c, n) => c / n;
  const up = [...a].filter(([, c]) => c >= minNow).map(([w, c]) => ({ word: w, now: c, before: b.get(w) || 0, lift: (rate(c, na) + 0.05) / (rate(b.get(w) || 0, nb) + 0.05) }))
    .filter((x) => x.lift > 1.8).sort((x, y) => y.lift - x.lift || y.now - x.now).slice(0, limit);
  const down = [...b].filter(([, c]) => c >= minNow + 2).map(([w, c]) => ({ word: w, now: a.get(w) || 0, before: c, lift: (rate(a.get(w) || 0, na) + 0.05) / (rate(c, nb) + 0.05) }))
    .filter((x) => x.lift < 0.5).sort((x, y) => x.lift - y.lift || y.before - x.before).slice(0, limit);
  return { enough: true, rising: up, faded: down, recentEntries: na, olderEntries: nb };
}

export function topWords(journal, limit = 12) {
  return [...wordCounts(Object.values(journal).map((e) => e.text))].sort((x, y) => y[1] - x[1] || x[0].localeCompare(y[0])).slice(0, limit).map(([word, count]) => ({ word, count }));
}
