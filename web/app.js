import {
  today as todayStr, addDays, daysBetween, pretty, prettyShort, monthName,
  setEntry, wordCount, clean, MAX_ENTRY, onThisDay, recentLookbacks, span,
  streaks, totals, monthGrid, search, rising, topWords,
  toJSON, fromJSON, toText, fromText, merge, createVault, openVault, seal, buildReminderICS,
} from "./engine/index.js";

const $ = (id) => document.getElementById(id);
const PLAIN = "daybook.journal.v1", VAULT = "daybook.vault.v1";
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

let journal = {};
let lockInfo = null;            // {key, salt, iterations} while a passphrase lock is on
let viewDate = todayStr();
let openedOn = viewDate;
let cal = { y: +viewDate.slice(0, 4), m: +viewDate.slice(5, 7) };
let dirty = false, saveTimer = null, saveChain = Promise.resolve();

/* ---------- small DOM helpers (text only; nothing from an entry is ever parsed as HTML) ---------- */
function el(tag, props = {}, ...kids) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) { if (k === "class") n.className = v; else if (k === "text") n.textContent = v; else if (k.startsWith("on")) n.addEventListener(k.slice(2), v); else n.setAttribute(k, v); }
  for (const c of kids) n.append(c);
  return n;
}
const clear = (n) => { while (n.firstChild) n.removeChild(n.firstChild); };
const plural = (n, w) => `${n} ${w}${n === 1 ? "" : "s"}`;
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = el("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------- saving ---------- */
function setSaved(msg) { $("saved").textContent = msg; }
function persist() {
  saveChain = saveChain.then(async () => {
    let ok;
    if (lockInfo) {
      const v = await seal(lockInfo.key, lockInfo.salt, lockInfo.iterations, journal);
      ok = store.set(VAULT, JSON.stringify(v));
    } else ok = store.set(PLAIN, JSON.stringify(journal));
    return ok;
  }).catch(() => false);
  return saveChain;
}
function scheduleSave() {
  dirty = true; setSaved("Saving…");
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 500);
}
async function flush() {
  clearTimeout(saveTimer);
  if (!dirty) return;
  dirty = false;
  const ok = await persist();
  setSaved(ok ? "Saved" : "Could not save here. Download a backup from Settings.");
}

/* ---------- Write tab ---------- */
function renderWrite() {
  const t = todayStr();
  $("date-title").textContent = viewDate === t ? "Today" : pretty(viewDate);
  const ago = daysBetween(viewDate, t);
  $("date-sub").textContent = viewDate === t ? pretty(viewDate) : ago === 1 ? "Yesterday" : plural(ago, "day") + " ago";
  $("next-day").disabled = viewDate >= t;
  $("today-btn").hidden = viewDate === t;
  const box = $("entry");
  box.value = journal[viewDate] ? journal[viewDate].text : "";
  box.maxLength = MAX_ENTRY;
  updateCount();
  setSaved("");
  renderStreak();
  renderMemories();
}
function updateCount() { const n = wordCount($("entry").value); $("count").textContent = n ? plural(n, "word") : ""; }
function renderStreak() {
  const s = streaks(journal, todayStr()), p = $("streak");
  if (!Object.keys(journal).length) { p.textContent = "Two lines is enough. Come back tomorrow."; return; }
  p.textContent = s.current ? `${plural(s.current, "day")} in a row${s.wroteToday ? "" : ". Write today to keep it going"}.` : "No streak right now. Today is a good day to start one.";
}
function memoryCard(title, date, text) {
  return el("article", { class: "mem" },
    el("h3", { text: title }),
    el("p", { text }),
    el("button", { class: "ghost", type: "button", text: "Open that day", onclick: () => goTo(date) }));
}
function renderMemories() {
  const box = $("memories"); clear(box);
  const years = onThisDay(journal, viewDate), recent = recentLookbacks(journal, viewDate);
  for (const m of years) box.append(memoryCard(`${m.yearsAgo === 1 ? "A year ago" : m.yearsAgo + " years ago"} · ${prettyShort(m.date)}`, m.date, m.text));
  for (const m of recent) box.append(memoryCard(`${m.label} · ${prettyShort(m.date)}`, m.date, m.text));
  if (!box.firstChild) box.append(el("p", { class: "empty", text: "Entries from earlier years on this date, and from a week, 30 and 90 days ago, appear here once you have written them." }));
}
async function goTo(date, tab = "write") {
  await flush();
  viewDate = date; showTab(tab); renderWrite();
  window.scrollTo(0, 0);
}
$("entry").addEventListener("input", () => { journal = setEntry(journal, viewDate, $("entry").value); updateCount(); scheduleSave(); });
$("entry").addEventListener("blur", flush);
$("prev-day").addEventListener("click", () => goTo(addDays(viewDate, -1)));
$("next-day").addEventListener("click", () => { if (viewDate < todayStr()) goTo(addDays(viewDate, 1)); });
$("today-btn").addEventListener("click", () => goTo(todayStr()));
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") flush();
  else if (todayStr() !== openedOn) { const was = viewDate === openedOn; openedOn = todayStr(); if (was && !$("app").hidden) { viewDate = openedOn; renderWrite(); } }
});
addEventListener("pagehide", flush);

/* ---------- Look back ---------- */
function renderCal() {
  $("cal-title").textContent = `${monthName(cal.m)} ${cal.y}`;
  const t = $("cal"); clear(t);
  const head = el("tr"); for (const d of ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]) head.append(el("th", { scope: "col", text: d }));
  t.append(el("thead", {}, head));
  const body = el("tbody"), now = todayStr();
  for (const week of monthGrid(journal, cal.y, cal.m)) {
    const tr = el("tr");
    for (const c of week) {
      const td = el("td");
      if (c) {
        const b = el("button", { type: "button", class: `day s${c.size}${c.date === now ? " today" : ""}`, text: String(c.day), "aria-label": `${pretty(c.date)}${c.has ? ", has an entry" : ""}`, onclick: () => goTo(c.date) });
        if (c.date > now) b.disabled = true;
        td.append(b);
      }
      tr.append(td);
    }
    body.append(tr);
  }
  t.append(body);
  $("cal-next").disabled = cal.y > +openedOn.slice(0, 4) || (cal.y === +openedOn.slice(0, 4) && cal.m >= +openedOn.slice(5, 7));
}
function shiftMonth(n) { let m = cal.m + n, y = cal.y; if (m < 1) { m = 12; y--; } if (m > 12) { m = 1; y++; } cal = { y, m }; renderCal(); }
$("cal-prev").addEventListener("click", () => shiftMonth(-1));
$("cal-next").addEventListener("click", () => shiftMonth(1));
function renderResults() {
  const box = $("results"); clear(box);
  const q = $("q").value.trim(); if (!q) return;
  const hits = search(journal, q);
  if (!hits.length) { box.append(el("p", { class: "empty", text: "No entry has all of those words." })); return; }
  for (const h of hits) {
    const s = el("span");
    for (const p of h.snippet) s.append(p.match ? el("mark", { text: p.text }) : document.createTextNode(p.text));
    box.append(el("button", { type: "button", class: "hit", onclick: () => goTo(h.date) }, el("b", { text: pretty(h.date) }), s));
  }
}
$("q").addEventListener("input", renderResults);

/* ---------- Trends ---------- */
function renderTrends() {
  const box = $("trends"); clear(box);
  if (!Object.keys(journal).length) { box.append(el("p", { class: "empty", text: "Write a few entries and this page will show your streaks and the words you use most." })); return; }
  const t = totals(journal), s = streaks(journal, todayStr()), sp = span(journal, todayStr());
  const stats = el("div", { class: "stats" });
  for (const [n, l] of [[t.entries, "entries"], [t.words.toLocaleString(), "words"], [s.current, "day streak"], [s.longest, "longest streak"], [sp.days, "days since your first"]]) stats.append(el("div", { class: "stat" }, el("b", { text: String(n) }), el("span", { text: l })));
  box.append(stats);
  const list = (title, items, note) => {
    box.append(el("h2", { class: "sec", text: title }));
    if (note) box.append(el("p", { class: "muted small", text: note }));
    const ul = el("ul", { class: "wordlist" });
    for (const w of items) ul.append(el("li", {}, w.word, el("small", { text: String(w.count ?? w.now) })));
    box.append(items.length ? ul : el("p", { class: "muted", text: "Nothing stands out yet." }));
  };
  list("Words you use most", topWords(journal, 14), "Common words like “the” and “was” are left out.");
  const r = rising(journal, todayStr());
  if (!r.enough) box.append(el("h2", { class: "sec", text: "What changed lately" }), el("p", { class: "muted", text: "This needs at least 5 entries in the last 30 days and 5 older ones. It only counts words; it does not guess your mood." }));
  else {
    list("Showing up more in the last 30 days", r.rising, "Number is how many times in the last 30 days.");
    list("Faded from your writing", r.faded.map((w) => ({ word: w.word, count: w.before })), "Number is how many times in older entries.");
  }
}

/* ---------- Settings ---------- */
$("exp-json").addEventListener("click", () => download(`daybook-${todayStr()}.json`, toJSON(journal), "application/json"));
$("exp-text").addEventListener("click", () => download(`daybook-${todayStr()}.txt`, toText(journal), "text/plain"));
$("rem-btn").addEventListener("click", () => {
  const [h, m] = ($("rem-time").value || "21:00").split(":").map(Number);
  download("daybook-reminder.ics", buildReminderICS({ hour: h, minute: m }), "text/calendar");
});
$("imp-file").addEventListener("change", async (e) => {
  const f = e.target.files[0], msg = $("imp-msg"); if (!f) return;
  try {
    if (f.size > 8e6) throw new Error("That file is over 8 MB, which is far more than a journal.");
    const raw = await f.text();
    const incoming = raw.trimStart().startsWith("{") ? fromJSON(raw) : fromText(raw);
    if (!Object.keys(incoming).length) throw new Error("No dated entries found. Each entry should start with a line that is just a date.");
    const r = merge(journal, incoming, $("imp-mode").value);
    journal = r.journal; await persist(); renderAll();
    msg.textContent = `Added ${plural(r.added, "day")}${r.joined ? `, joined text into ${plural(r.joined, "day")}` : ""}${r.skipped ? `, left ${plural(r.skipped, "day")} as they were` : ""}.`;
  } catch (err) { msg.textContent = err.message; }
  e.target.value = "";
});
function renderLockUI() {
  const box = $("lock-ui"); clear(box);
  if (!lockInfo) {
    const p1 = el("input", { type: "password", id: "new-pass", autocomplete: "new-password", "aria-label": "New passphrase, at least 8 characters", placeholder: "New passphrase (8+ characters)" });
    const p2 = el("input", { type: "password", id: "new-pass2", autocomplete: "new-password", "aria-label": "Repeat the passphrase", placeholder: "Repeat it" });
    const msg = el("p", { class: "msg", role: "status" });
    const btn = el("button", { type: "button", text: "Turn on lock", onclick: async () => {
      if (p1.value !== p2.value) { msg.textContent = "The two passphrases do not match."; return; }
      try {
        btn.disabled = true; msg.textContent = "Locking…";
        const c = await createVault(p1.value, journal);
        if (!store.set(VAULT, JSON.stringify(c.vault))) throw new Error("Could not save the locked journal in this browser.");
        store.del(PLAIN); lockInfo = { key: c.key, salt: c.salt, iterations: c.iterations };
        renderLockUI();
      } catch (err) { msg.textContent = err.message; btn.disabled = false; }
    } });
    box.append(el("div", { class: "row" }, p1), el("div", { class: "row" }, p2), el("div", { class: "row" }, btn), msg);
  } else {
    box.append(el("p", { text: "The lock is on. Entries are stored scrambled in this browser." }),
      el("div", { class: "row" },
        el("button", { type: "button", text: "Lock now", onclick: async () => { await flush(); lockInfo = null; journal = {}; showLock(); } }),
        el("button", { type: "button", class: "ghost", text: "Turn off lock", onclick: async () => { await flush(); if (!store.set(PLAIN, JSON.stringify(journal))) return; store.del(VAULT); lockInfo = null; renderLockUI(); } })));
  }
}
let wipeArm = 0;
$("wipe").addEventListener("click", async () => {
  const b = $("wipe");
  if (Date.now() > wipeArm) { wipeArm = Date.now() + 6000; b.textContent = "Press again to delete everything"; setTimeout(() => { if (Date.now() >= wipeArm) b.textContent = "Delete all entries"; }, 6100); return; }
  wipeArm = 0; b.textContent = "Delete all entries"; journal = {}; await persist(); renderAll(); $("wipe-msg").textContent = "All entries deleted from this browser.";
});

/* ---------- tabs ---------- */
const TABS = ["write", "look", "trends", "settings"];
function showTab(name) {
  for (const t of TABS) { const on = t === name; $("tab-" + t).setAttribute("aria-selected", on); $("tab-" + t).tabIndex = on ? 0 : -1; $("panel-" + t).hidden = !on; }
  if (name === "look") { cal = { y: +viewDate.slice(0, 4), m: +viewDate.slice(5, 7) }; renderCal(); renderResults(); }
  if (name === "trends") renderTrends();
  if (name === "settings") renderLockUI();
}
for (const t of TABS) {
  $("tab-" + t).addEventListener("click", async () => { await flush(); showTab(t); });
  $("tab-" + t).addEventListener("keydown", (e) => {
    const i = TABS.indexOf(t); let j = null;
    if (e.key === "ArrowRight") j = (i + 1) % 4; else if (e.key === "ArrowLeft") j = (i + 3) % 4; else if (e.key === "Home") j = 0; else if (e.key === "End") j = 3;
    if (j !== null) { e.preventDefault(); showTab(TABS[j]); $("tab-" + TABS[j]).focus(); }
  });
}
function renderAll() { renderWrite(); renderCal(); renderResults(); if (!$("panel-trends").hidden) renderTrends(); }

/* ---------- start ---------- */
function showLock() {
  $("app").hidden = true; $("lock").hidden = false; $("lock-pass").value = ""; $("lock-err").textContent = ""; $("lock-pass").focus();
}
$("lock-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = e.submitter; if (btn) btn.disabled = true; $("lock-err").textContent = "";
  try {
    const r = await openVault($("lock-pass").value, JSON.parse(store.get(VAULT)));
    journal = clean(r.object); lockInfo = { key: r.key, salt: r.salt, iterations: r.iterations };
    $("lock").hidden = true; start();
  } catch (err) { $("lock-err").textContent = err.message; }
  if (btn) btn.disabled = false;
});
function start() {
  $("app").hidden = false; viewDate = todayStr(); openedOn = viewDate; showTab("write"); renderWrite(); $("entry").focus();
}
(function init() {
  if (store.get(VAULT)) { showLock(); return; }
  const raw = store.get(PLAIN);
  if (raw) { try { journal = clean(JSON.parse(raw)); } catch { store.set(PLAIN + ".damaged", raw); journal = {}; } }
  start();
})();
