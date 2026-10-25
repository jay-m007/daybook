import test from "node:test";
import assert from "node:assert/strict";
import { search } from "../engine/search.js";
import { rising, topWords, wordCounts } from "../engine/trends.js";
const J = (o) => Object.fromEntries(Object.entries(o).map(([d, t]) => [d, { text: t }]));
const plain = (sn) => sn.map((p) => p.text).join("");

test("search needs every word, ignores case, returns newest first", () => {
  const j = J({ "2025-01-01": "Went to the Beach with Mira", "2026-01-01": "beach day, rain", "2026-02-01": "Mira called" });
  assert.deepEqual(search(j, "beach").map((h) => h.date), ["2026-01-01", "2025-01-01"]);
  assert.deepEqual(search(j, "MIRA beach").map((h) => h.date), ["2025-01-01"]);
  assert.deepEqual(search(j, "   "), []); assert.deepEqual(search(j, "zzz"), []); assert.deepEqual(search(j, null), []);
});
test("snippets mark the matches without any HTML and keep the original capitals", () => {
  const h = search(J({ "2026-01-01": "A long day. I met <b>Mira</b> at the beach and we talked." }), "mira")[0];
  assert.ok(h.snippet.some((p) => p.match && p.text === "Mira"));
  assert.ok(plain(h.snippet).includes("<b>"), "tags are just text");
});
test("long entries get a short snippet with ellipses", () => {
  const t = "x ".repeat(300) + "needle " + "y ".repeat(300);
  const sn = search(J({ "2026-01-01": t }), "needle")[0].snippet;
  assert.ok(plain(sn).length < 250); assert.equal(sn[0].text, "…"); assert.equal(sn[sn.length - 1].text, "…");
});
test("regex characters in a query are plain text", () => { assert.equal(search(J({ "2026-01-01": "cost (approx) $5.00" }), "(approx) $5.00").length, 1); assert.doesNotThrow(() => search(J({ "2026-01-01": "x" }), "[[[")); });
test("limit applies", () => { const j = J(Object.fromEntries(Array.from({ length: 80 }, (_, i) => [`2026-01-${String((i % 28) + 1).padStart(2, "0")}`.replace(/^2026/, String(2000 + i)), "tea"]))); assert.equal(search(j, "tea", { limit: 10 }).length, 10); });

test("word counts skip common words and short ones", () => {
  const m = wordCounts(["The gym was great, the gym again", "I went to the gym"]);
  assert.equal(m.get("gym"), 3); assert.ok(!m.has("the")); assert.ok(!m.has("was"));
});
test("top words", () => { assert.deepEqual(topWords(J({ "2026-01-01": "gym gym tea", "2026-01-02": "gym tea walk" }), 2), [{ word: "gym", count: 3 }, { word: "tea", count: 2 }]); });
test("trends say 'not enough yet' for a young journal", () => {
  assert.equal(rising(J({ "2026-10-24": "a", "2026-10-25": "b" }), "2026-10-25").enough, false);
});
test("trends find words that rose lately and words that faded", () => {
  const j = {};
  for (let i = 0; i < 20; i++) j[`2026-08-${String(i + 1).padStart(2, "0")}`] = { text: "worried about exams, worried and tired, exams again" };
  for (let i = 0; i < 12; i++) j[`2026-10-${String(i + 10).padStart(2, "0")}`] = { text: "cycling with friends, cycling every evening, friends laughing" };
  const r = rising(j, "2026-10-25", { days: 20 });
  assert.ok(r.enough);
  assert.ok(r.rising.map((x) => x.word).includes("cycling")); assert.ok(r.faded.map((x) => x.word).includes("exams"));
  assert.ok(!r.rising.map((x) => x.word).includes("exams"));
});
