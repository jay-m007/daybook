// Search your own entries. Returns pieces of text marked as match / not match so the page can show them without parsing HTML.
const norm = (s) => s.toLowerCase();

export function search(journal, query, { limit = 50, context = 60 } = {}) {
  const words = norm(String(query || "")).split(/\s+/).filter(Boolean).slice(0, 8);
  if (!words.length) return [];
  const hits = [];
  for (const [date, e] of Object.entries(journal)) {
    const low = norm(e.text);
    if (!words.every((w) => low.includes(w))) continue; // every word must appear (any order)
    let count = 0;
    for (const w of words) { let i = -1; while ((i = low.indexOf(w, i + 1)) !== -1) count++; }
    hits.push({ date, score: count, snippet: snippet(e.text, low, words, context) });
  }
  hits.sort((a, b) => b.date.localeCompare(a.date)); // newest first is what people want from a diary
  return hits.slice(0, limit);
}

function snippet(text, low, words, context) {
  let at = Infinity;
  for (const w of words) { const i = low.indexOf(w); if (i !== -1 && i < at) at = i; }
  const start = Math.max(0, at - context), end = Math.min(text.length, at + context * 2);
  const part = text.slice(start, end);
  const plow = low.slice(start, end);
  const marks = [];
  for (const w of words) { let i = -1; while ((i = plow.indexOf(w, i + 1)) !== -1) marks.push([i, i + w.length]); }
  marks.sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const m of marks) { const last = merged[merged.length - 1]; if (last && m[0] <= last[1]) last[1] = Math.max(last[1], m[1]); else merged.push([...m]); }
  const out = []; let pos = 0;
  if (start > 0) out.push({ text: "…", match: false });
  for (const [a, b] of merged) { if (a > pos) out.push({ text: part.slice(pos, a), match: false }); out.push({ text: part.slice(a, b), match: true }); pos = b; }
  if (pos < part.length) out.push({ text: part.slice(pos), match: false });
  if (end < text.length) out.push({ text: "…", match: false });
  return out;
}
