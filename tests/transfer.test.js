import test from "node:test";
import assert from "node:assert/strict";
import { toJSON, fromJSON, toText, fromText, parseDateLine, merge } from "../engine/transfer.js";
import { createVault, openVault } from "../engine/vault.js";
import { buildReminderICS } from "../engine/reminder.js";

const J = { "2026-03-05": { text: "Rain.\nStayed in.", updated: "u1" }, "2025-03-05": { text: "Sun, long walk.", updated: "u2" } };

test("JSON export and import round trip", () => {
  const back = fromJSON(toJSON(J));
  assert.equal(back["2026-03-05"].text, "Rain.\nStayed in."); assert.equal(Object.keys(back).length, 2);
});
test("JSON import refuses other files with a plain message", () => {
  assert.throws(() => fromJSON("not json"), /not valid JSON/);
  assert.throws(() => fromJSON('{"entries":{}}'), /Daybook export/);
  assert.throws(() => fromJSON("null"), /Daybook export/);
});
test("JSON import drops bad entries instead of trusting them", () => {
  const t = JSON.stringify({ app: "daybook", entries: { "2026-01-01": { text: "ok" }, "nope": { text: "x" }, "2026-01-02": { text: 3 } } });
  assert.deepEqual(Object.keys(fromJSON(t)), ["2026-01-01"]);
});
test("text export reads back to the same entries", () => {
  const back = fromText(toText(J));
  assert.deepEqual(Object.fromEntries(Object.entries(back).map(([d, e]) => [d, e.text])), { "2026-03-05": "Rain.\nStayed in.", "2025-03-05": "Sun, long walk." });
});
test("date lines in other common layouts", () => {
  assert.equal(parseDateLine("2024-03-05"), "2024-03-05");
  assert.equal(parseDateLine("5 March 2024"), "2024-03-05");
  assert.equal(parseDateLine("Tuesday, 5th March, 2024"), "2024-03-05");
  assert.equal(parseDateLine("## 05/03/2024"), "2024-03-05");
  assert.equal(parseDateLine("31/02/2024"), null);
  assert.equal(parseDateLine("I went on 2024-03-05 to the shop"), null, "only a line that is just a date counts");
  assert.equal(parseDateLine("5 Smarch 2024"), null);
});
test("text with text before the first date and a repeated date", () => {
  const r = fromText("my old journal\n\n2024-01-01\nFirst.\n\n5 January 2024\nSecond.\n\n2024-01-01\nAgain.\n");
  assert.equal(r["2024-01-01"].text, "First.\n\nAgain."); assert.equal(r["2024-01-05"].text, "Second."); assert.equal(Object.keys(r).length, 2);
});
test("a date line with no writing under it makes no entry", () => { assert.deepEqual(fromText("2024-01-01\n\n2024-01-02\nhi"), { "2024-01-02": { text: "hi", updated: "" } }); });
test("windows line endings", () => { assert.equal(fromText("2024-01-01\r\nhello\r\nthere\r\n")["2024-01-01"].text, "hello\nthere"); });

test("merge keep: existing entries win", () => {
  const r = merge({ "2026-01-01": { text: "mine" } }, { "2026-01-01": { text: "theirs" }, "2026-01-02": { text: "new" } });
  assert.equal(r.journal["2026-01-01"].text, "mine"); assert.deepEqual([r.added, r.joined, r.skipped], [1, 0, 1]);
});
test("merge append: both kept, identical text not doubled, input untouched", () => {
  const cur = { "2026-01-01": { text: "mine", updated: "u" }, "2026-01-03": { text: "same" } };
  const r = merge(cur, { "2026-01-01": { text: "theirs" }, "2026-01-03": { text: "same" } }, "append");
  assert.equal(r.journal["2026-01-01"].text, "mine\n\ntheirs"); assert.equal(r.journal["2026-01-03"].text, "same"); assert.deepEqual([r.joined, r.skipped], [1, 1]);
  assert.equal(cur["2026-01-01"].text, "mine");
});

test("vault round trip and a wrong passphrase", async () => {
  const data = { "2026-01-01": { text: "secret café ✓" } };
  const { vault } = await createVault("correct horse", data, 1000);
  assert.ok(!JSON.stringify(vault).includes("secret"));
  assert.deepEqual((await openVault("correct horse", vault)).object, data);
  await assert.rejects(openVault("wrong horse!!", vault), /did not open/);
});
test("vault: tampering, bad shape and silly iteration counts all give the same plain error", async () => {
  const { vault } = await createVault("correct horse", { a: 1 }, 1000);
  const t = { ...vault, ct: vault.ct.slice(0, -4) + (vault.ct.endsWith("AAAA") ? "BBBB" : "AAAA") };
  await assert.rejects(openVault("correct horse", t), /did not open/);
  await assert.rejects(openVault("correct horse", null), /did not open/);
  await assert.rejects(openVault("correct horse", { ...vault, iter: 1e12 }), /did not open/);
  await assert.rejects(openVault("correct horse", { ...vault, iter: 1 }), /did not open/);
});
test("vault: short passphrase refused; two saves use different nonces", async () => {
  await assert.rejects(createVault("short", {}, 1000), /8 characters/);
  const a = await createVault("correct horse", { a: 1 }, 1000);
  const { seal } = await import("../engine/vault.js");
  const s1 = await seal(a.key, a.salt, 1000, { a: 1 }), s2 = await seal(a.key, a.salt, 1000, { a: 1 });
  assert.notEqual(s1.iv, s2.iv); assert.notEqual(s1.ct, s2.ct);
});

test("reminder file: daily, with an alarm at the chosen time, CRLF lines", () => {
  const ics = buildReminderICS({ hour: 21, minute: 30, now: new Date(2026, 9, 25, 8, 0) });
  assert.ok(ics.includes("RRULE:FREQ=DAILY")); assert.ok(ics.includes("DTSTART:20261025T213000")); assert.ok(ics.includes("TRIGGER:PT0S"));
  assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n")); assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});
test("reminder file: out-of-range times are clamped", () => {
  const ics = buildReminderICS({ hour: 99, minute: -4, now: new Date(2026, 0, 1) });
  assert.ok(ics.includes("DTSTART:20260101T230000"));
});
