/* =====================================================================
   ICT 8 · Quiz mỗi ngày — Lớp Thầy Nghĩa
   - Tạo đề tự động mỗi ngày, bám theo tiến độ học (lịch tuần hoặc tự chọn)
   - 5 dạng câu: 1 đáp án, nhiều đáp án, Đúng/Sai, điền đáp án, nối cặp
   - Lặp lại ngắt quãng (spaced repetition) cho câu sai + ưu tiên chủ điểm yếu
   - Thống kê sai theo mạch kiến thức, unit, bài, chủ điểm, dạng câu
   Dữ liệu lưu trong trình duyệt (localStorage); có xuất/nhập JSON.
   ===================================================================== */
(function () {
  "use strict";
  const QB = window.QB, GENS = window.GENERATORS || [];
  const KEY = "ict8_thaynghia_v1";
  const VERSION = 1;

  /* ---------------- tiện ích ---------------- */
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pad = n => String(n).padStart(2, "0");
  const ymd = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const parseD = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const today = () => ymd(new Date());
  const shiftDay = (s, n) => ymd(addDays(parseD(s), n));
  const fmtD = (s, o = { weekday: "short", day: "numeric", month: "numeric" }) => parseD(s).toLocaleDateString("vi-VN", o);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  const uniq = a => [...new Set(a)];
  const inline = s => esc(s).replace(/`([^`]+)`/g, "<code>$1</code>");

  /* RNG có seed: đề hôm nay luôn giống nhau dù mở lại nhiều lần */
  function hashStr(s) { let h = 1779033703 ^ s.length; for (let i = 0; i < s.length; i++) { h = Math.imul(h ^ s.charCodeAt(i), 3432918353); h = (h << 13) | (h >>> 19); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  const nativeRandom = Math.random.bind(Math);
  let rnd = nativeRandom;
  function seeded(seed, fn) {
    const r = mulberry32(hashStr(String(seed))); const pr = rnd, pm = Math.random;
    rnd = r; Math.random = r; // bộ sinh câu hỏi dùng Math.random
    try { return fn(); } finally { rnd = pr; Math.random = pm; }
  }
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = a => a[Math.floor(rnd() * a.length)];
  function wpick(entries) { const tot = entries.reduce((s, e) => s + e.w, 0); if (!tot) return entries.length ? entries[0].v : null; let r = rnd() * tot; for (const e of entries) { r -= e.w; if (r <= 0) return e.v; } return entries[entries.length - 1].v; }

  /* ---------------- chỉ mục dữ liệu ---------------- */
  const STRANDS = {
    "9P": { vi: "Lập trình", en: "Programming" },
    "9CT": { vi: "Tư duy máy tính", en: "Computational thinking" },
    "9CS": { vi: "Hệ thống máy tính", en: "Computer systems" },
    "9MD": { vi: "Mô hình & dữ liệu", en: "Managing data" },
    "9DC": { vi: "Truyền thông số & mạng", en: "Digital communication" }
  };
  const strandOf = o => String(o).split(".")[0];
  const TYPES = { single: "Một đáp án", multi: "Nhiều đáp án", tf: "Đúng / Sai", typed: "Điền đáp án", match: "Nối cặp" };
  const SRC = { new: ["Bài đang học", "acc"], wrong: ["Ôn câu từng sai", "bad"], weak: ["Chủ điểm yếu", "warn"], review: ["Ôn tập", ""], practice: ["Luyện tập", ""] };

  const TOPICS = {}, UNIT_OF = {}, ORDER = [];
  QB.units.forEach(u => u.topics.forEach(t => { TOPICS[t.id] = t; UNIT_OF[t.id] = u; ORDER.push(t.id); }));
  const ITEMS = {}, BY_OBJ = {};
  for (const o in QB.bank) BY_OBJ[o] = QB.bank[o].map(it => (ITEMS[it.id] = Object.assign({ obj: o }, it)));
  const GEN_BY_OBJ = {};
  GENS.forEach((g, i) => g.objs.forEach(o => (GEN_BY_OBJ[o] = GEN_BY_OBJ[o] || []).push(i)));
  const OBJ_TOPICS = {};
  ORDER.forEach(id => TOPICS[id].objectives.forEach(o => (OBJ_TOPICS[o] = OBJ_TOPICS[o] || []).push(id)));
  const shortItem = it => !it.c && String(it.a).length <= 70 && it.q.length <= 130 && it.w.length;
  const topicLink = id => QB.source + "#topic/" + encodeURIComponent(id);
  const objName = o => QB.objectives[o] || o;

  /* ---------------- môn học (js/config.js) ---------------- */
  const SITE = Object.assign({ teacher: "Thầy Nghĩa", url: "" }, window.SITE || {});
  const COURSES = (window.COURSES && window.COURSES.length ? window.COURSES : [{ code: 1, key: "ict8", name: "Tin học (ICT)", short: "ICT", mark: "ICT", bank: "ict8", grades: [8] }])
    .map(c => Object.assign({ short: c.name, mark: "QUIZ", grades: [], note: "" }, c));
  const courseBy = k => COURSES.find(c => c.key === k) || COURSES[0];
  const courseByCode = n => COURSES.find(c => c.code === n) || null;
  const hasBank = p => courseBy(p.course).bank === "ict8";
  const nameKey = s => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/đ/gi, "d").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  /* ---------------- mã vào lớp ----------------
     10 ký tự Crockford base32: [môn][khối][lớp ×3][học sinh ×4][kiểm tra]
     Mã tự chứa thông tin nên không cần máy chủ: máy học sinh đọc mã là biết môn, khối, lớp.
     Link gửi học sinh: <web>#join-<MÃ>-<tên mã hoá>-<tên lớp mã hoá> → bấm là vào thẳng. */
  const B32 = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";
  const rid = n => Array.from({ length: n }, () => B32[Math.floor(nativeRandom() * 32)]).join("");
  function makeCode(courseCode, grade, cls, sid) {
    const body = B32[courseCode] + B32[grade || 0] + cls + sid; let s = 0;
    for (let i = 0; i < body.length; i++) s += B32.indexOf(body[i]) * (i + 3);
    return body + B32[s % 32];
  }
  const fmtCode = c => c.slice(0, 5) + "-" + c.slice(5);
  function parseCode(raw) {
    const c = String(raw || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/[IL]/g, "1").replace(/O/g, "0").replace(/U/g, "V");
    if (c.length !== 10) return null;
    const cc = B32.indexOf(c[0]), g = B32.indexOf(c[1]);
    if (makeCode(cc, g, c.slice(2, 5), c.slice(5, 9)) !== c) return null;
    const course = courseByCode(cc); if (!course) return null;
    return { code: c, course, grade: g || null, cls: c.slice(2, 5), sid: c.slice(5, 9), pid: "s" + c.slice(2, 9) };
  }
  function encTxt(s) { const by = new TextEncoder().encode(s); let bits = 0, val = 0, out = ""; for (const b of by) { val = (val << 8) | b; bits += 8; while (bits >= 5) { out += B32[(val >>> (bits - 5)) & 31]; bits -= 5; } } if (bits) out += B32[(val << (5 - bits)) & 31]; return out; }
  function decTxt(s) { try { let bits = 0, val = 0; const out = []; for (const ch of String(s).toUpperCase()) { const v = B32.indexOf(ch); if (v < 0) return ""; val = (val << 5) | v; bits += 5; if (bits >= 8) { out.push((val >>> (bits - 8)) & 255); bits -= 8; } } return new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(out)); } catch (e) { return ""; } }

  /* ---------------- lưu trữ ---------------- */
  // profiles: hồ sơ học sinh trên máy này · tclasses: lớp thầy tạo · results: kết quả học sinh gửi thầy
  let DB = { profiles: {}, current: null, theme: null, tclasses: {}, results: {}, tpin: null };
  try { DB = Object.assign(DB, JSON.parse(localStorage.getItem(KEY)) || {}); } catch (e) { /* chế độ riêng tư */ }
  DB.tclasses = DB.tclasses || {}; DB.results = DB.results || {};
  let P = DB.current ? DB.profiles[DB.current] : null;
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) { toast("Không lưu được dữ liệu (bộ nhớ trình duyệt đầy hoặc bị chặn)."); } };
  const defaultSettings = () => ({ perDay: 15, mode: "schedule", sem1: QB.plan.semesters[0].start, sem2: QB.plan.semesters[1].start, learned: {}, current: [] });
  function newProfile({ id, name, course = COURSES[0].key, grade = null, className = "" }) {
    const c = courseBy(course); grade = grade || c.grades[0] || null;
    const p = { id: id || "p" + Date.now().toString(36) + nativeRandom().toString(36).slice(2, 6), name, course: c.key, grade, cls: grade ? "Lớp " + grade : "", className, created: today(), settings: defaultSettings(), log: [], srs: {}, wrongs: [], daily: {}, history: [], practice: null };
    // học sinh nhỏ hơn lớp 8 học ICT: đi chậm, bắt đầu từ bài đầu tiên
    if (c.bank === "ict8" && grade && grade < 8) { p.settings.mode = "manual"; p.settings.learned = { [ORDER[0]]: true }; p.settings.current = [ORDER[0]]; p.settings.perDay = 10; }
    return p;
  }
  function fixProfile(p) {
    p.settings = Object.assign(defaultSettings(), p.settings || {}); ["log", "wrongs", "history"].forEach(k => (p[k] = p[k] || [])); p.srs = p.srs || {}; p.daily = p.daily || {};
    if (!p.course || !COURSES.some(c => c.key === p.course)) p.course = p.classId === "toan5" ? "toan5" : COURSES[0].key;
    if (!p.grade) { const g = parseInt(String(p.cls || "").replace(/\D+/g, " ").trim(), 10); p.grade = g >= 1 && g <= 12 ? g : courseBy(p.course).grades[0] || null; }
    if (!p.cls && p.grade) p.cls = "Lớp " + p.grade;
    return p;
  }

  /* ---------------- tiến độ học ---------------- */
  function schedule(p) {
    const out = [];
    QB.plan.semesters.forEach(s => {
      let prev = null; const st = p.settings["sem" + s.id] || s.start;
      (QB.plan.weeklyPlan[s.id] || []).forEach(w => {
        const start = prev ? addDays(prev, 7) : parseD(st); prev = start;
        out.push({ sem: s.id, week: w.week, topics: w.topics, unitTest: w.unitTest, start: ymd(start), end: ymd(addDays(start, 6)) });
      });
    });
    return out;
  }
  function progress(p, date = today()) {
    const S = p.settings;
    if (S.mode === "manual") {
      const learned = new Set(Object.keys(S.learned).filter(k => S.learned[k] && TOPICS[k]));
      let current = (S.current || []).filter(k => TOPICS[k]);
      if (!current.length) current = ORDER.filter(id => learned.has(id)).slice(-1);
      if (!current.length) current = [ORDER[0]];
      current.forEach(c => learned.add(c));
      return { mode: "manual", learned, current, label: "Tiến độ tự chọn" };
    }
    const ws = schedule(p);
    let cur = ws.find(w => date >= w.start && date <= w.end), state = "now";
    if (!cur) { const past = ws.filter(w => w.start <= date); if (past.length) { cur = past[past.length - 1]; state = "after"; } else { cur = ws[0]; state = "before"; } }
    const learned = new Set();
    ws.forEach(w => { if (w.start <= cur.start) w.topics.forEach(id => learned.add(id)); });
    return { mode: "schedule", learned, current: cur.topics.slice(), week: cur, state, label: `Học kỳ ${cur.sem} · Tuần ${cur.week}` };
  }
  function topicFor(obj, pg, prefer) {
    if (prefer && TOPICS[prefer] && TOPICS[prefer].objectives.includes(obj)) return prefer;
    const ts = OBJ_TOPICS[obj] || [];
    const l = pg ? ts.filter(id => pg.learned.has(id)) : [];
    const c = l.length ? l : ts;
    return c.find(id => !TOPICS[id].project && !/^R/.test(id)) || c.find(id => !TOPICS[id].project) || c[0];
  }

  /* ---------------- thống kê ---------------- */
  function aggregate(log) {
    const mk = () => ({ n: 0, ok: 0, m: 0.5, last: null });
    const A = { obj: {}, topic: {}, unit: {}, strand: {}, type: {}, day: {}, all: mk() };
    for (const e of log) {
      const u = UNIT_OF[e.tp] ? UNIT_OF[e.tp].id : "?";
      [[A.obj, e.o], [A.topic, e.tp], [A.unit, u], [A.strand, strandOf(e.o)], [A.type, e.ty], [A.day, e.d], [{ x: A.all }, "x"]].forEach(([m, k]) => {
        const x = m[k] || (m[k] = mk()); x.n++; x.ok += e.ok; x.m += 0.35 * (e.ok - x.m); x.last = e.d;
      });
    }
    return A;
  }
  function streak(p) {
    const days = new Set(p.log.map(e => e.d)); let s = 0, d = today();
    if (!days.has(d)) d = shiftDay(d, -1);
    while (days.has(d)) { s++; d = shiftDay(d, -1); }
    return s;
  }

  /* ---------------- lặp lại ngắt quãng ---------------- */
  const INTERVALS = [1, 2, 4, 7, 15, 30];
  function srsUpdate(p, key, obj, ok, d) {
    if (!key) return;
    const s = p.srs[key] || (p.srs[key] = { b: 0, r: 0, w: 0, o: obj });
    if (ok) { s.r++; s.b = Math.min(s.b + 1, INTERVALS.length - 1); } else { s.w++; s.b = 0; }
    s.lastOk = ok ? 1 : 0; s.last = d; s.due = shiftDay(d, ok ? INTERVALS[s.b] : 1);
  }
  const dueWrong = (p, date) => Object.entries(p.srs).filter(([, s]) => s.w > 0 && (!s.lastOk || s.b <= 1) && s.due <= date).sort((a, b) => (a[1].due < b[1].due ? -1 : 1));

  /* ---------------- tạo câu hỏi ---------------- */
  function genItem(gi, obj) {
    const g = GENS[gi]; if (!g) return null;
    let it; try { it = g.fn(); } catch (e) { return null; }
    return { id: "gen:" + gi, gen: true, obj: obj || g.objs[0], q: it.q, a: String(it.a), w: (it.w || []).map(String), c: it.c, h: it.h, e: it.e, t: it.t };
  }
  function itemByKey(key, obj) { if (key.startsWith("gen:")) return genItem(+key.slice(4), obj); return ITEMS[key] || null; }
  function pickItem(p, obj, used, date, genRate = 0.3) {
    const gens = GEN_BY_OBJ[obj] || [];
    if (gens.length && rnd() < genRate) {
      const gi = pick(gens), k = "gen:" + gi;
      if ((used.get(k) || 0) < 2) { const it = genItem(gi, obj); if (it) return it; }
    }
    const pool = (BY_OBJ[obj] || []).filter(it => !used.has(it.id));
    if (!pool.length) { if (gens.length) { const gi = pick(gens); if ((used.get("gen:" + gi) || 0) < 3) return genItem(gi, obj); } return null; }
    return wpick(pool.map(it => { const s = p.srs[it.id]; return { v: it, w: !s ? 3 : s.due <= date ? (s.lastOk ? 2 : 4) : 0.35 }; }));
  }
  const norm = s => String(s).toLowerCase().trim().replace(/^["'“”‘’]+|["'“”‘’.]+$/g, "").replace(/[\s,]+/g, " ").trim();
  const normNum = s => norm(s).replace(/ /g, "");

  function toQuestion(it, meta, forceKind) {
    const wrong = uniq(it.w.map(String)).filter(x => x !== it.a);
    const typable = !!it.t && it.a.length <= 30;
    let kind = forceKind;
    if (!kind) {
      const r = rnd();
      kind = typable ? (r < 0.5 ? "single" : r < 0.72 ? "tf" : "typed") : (r < 0.78 ? "single" : "tf");
    }
    if (!wrong.length) kind = typable ? "typed" : "single";
    if (kind === "typed" && !typable) kind = "single";
    const base = { kind, key: it.id, obj: it.obj, tp: meta.tp, src: meta.src, prompt: it.q, code: it.c, html: it.h, answer: it.a, expl: it.e };
    if (kind === "single") return Object.assign(base, { options: shuffle([it.a].concat(shuffle(wrong).slice(0, 3))) });
    if (kind === "tf") { const right = rnd() < 0.5; return Object.assign(base, { shown: right ? it.a : pick(wrong), truth: right }); }
    return Object.assign(base, { accept: uniq([it.a].concat(Array.isArray(it.t) ? it.t : [])) });
  }
  function multiFor(obj, used, meta) {
    const pool = shuffle((BY_OBJ[obj] || []).filter(it => shortItem(it) && !used.has(it.id)));
    if (pool.length < 4) return null;
    const four = pool.slice(0, 4);
    let truths = four.map(() => rnd() < 0.5);
    if (truths.every(Boolean)) truths[Math.floor(rnd() * 4)] = false;
    if (!truths.some(Boolean)) truths[Math.floor(rnd() * 4)] = true;
    four.forEach(it => used.set(it.id, 1));
    return { kind: "multi", key: null, obj, tp: meta.tp, src: meta.src, prompt: "Chọn TẤT CẢ các cặp hỏi – đáp ĐÚNG.", hint: "Có thể có 1, 2 hoặc 3 cặp đúng.",
      statements: four.map((it, j) => ({ q: it.q, shown: truths[j] ? it.a : pick(it.w.filter(w => w !== it.a)), truth: truths[j], key: it.id, answer: it.a })) };
  }
  function matchFor(obj, used, meta) {
    const pool = shuffle((BY_OBJ[obj] || []).filter(it => shortItem(it) && it.a.length <= 48 && !used.has(it.id)));
    const trio = [], seen = new Set();
    for (const it of pool) { if (!seen.has(it.a)) { seen.add(it.a); trio.push(it); } if (trio.length === 3) break; }
    if (trio.length < 3) return null;
    trio.forEach(it => used.set(it.id, 1));
    return { kind: "match", key: null, obj, tp: meta.tp, src: meta.src, prompt: "Nối mỗi câu hỏi với đáp án đúng.", pairs: trio.map(it => ({ q: it.q, a: it.a, key: it.id })), options: shuffle(trio.map(it => it.a)) };
  }

  /* Tạo đề hằng ngày: bài đang học + câu sai đến hạn ôn + chủ điểm yếu */
  function buildAdaptive(p, date, n, seedTag) {
    return seeded(p.id + "|" + date + "|" + seedTag, () => {
      const pg = progress(p, date), A = aggregate(p.log);
      const curObjs = uniq(pg.current.flatMap(id => TOPICS[id].objectives));
      let learnedObjs = uniq([...pg.learned].flatMap(id => TOPICS[id].objectives));
      if (!learnedObjs.length) learnedObjs = curObjs;
      const used = new Map(), slots = [];
      const add = (it, src, tp) => { if (!it) return false; const k = it.id; if (!it.gen && used.has(k)) return false; used.set(k, (used.get(k) || 0) + 1); slots.push({ it, src, tp: tp || topicFor(it.obj, pg) }); return true; };

      // 1) Bài đang học (~40%)
      const nNew = Math.max(1, Math.round(n * 0.4));
      const curTopics = shuffle(pg.current);
      for (let i = 0, g = 0; slots.length < nNew && g < 80; g++, i++) {
        const tp = curTopics[i % curTopics.length];
        const objs = TOPICS[tp].objectives;
        const obj = wpick(objs.map(o => ({ v: o, w: 1 / (1 + ((A.obj[o] && A.obj[o].n) || 0) / 6) })));
        add(pickItem(p, obj, used, date), "new", tp);
      }
      // 2) Câu từng sai đến hạn ôn (tối đa ~25%)
      const nWrong = Math.round(n * 0.25);
      for (const [key, s] of dueWrong(p, date)) {
        if (slots.filter(x => x.src === "wrong").length >= nWrong) break;
        if (!learnedObjs.includes(s.o) && !curObjs.includes(s.o)) continue;
        add(itemByKey(key, s.o), "wrong");
      }
      // 3) Chủ điểm yếu / ôn tập ngắt quãng (phần còn lại)
      const weight = o => { const x = A.obj[o]; const base = !x ? 0.45 : Math.pow(1 - x.m, 2) * 1.6 + 0.08; return curObjs.includes(o) ? base * 0.5 : base; };
      for (let g = 0; slots.length < n && g < 200; g++) {
        const obj = wpick(learnedObjs.map(o => ({ v: o, w: weight(o) })));
        const x = A.obj[obj];
        add(pickItem(p, obj, used, date), x && x.n >= 2 && x.m < 0.6 ? "weak" : "review");
      }
      return finalize(slots, used, pg, n);
    });
  }
  /* Luyện tập theo bài / unit / chủ điểm */
  function buildPractice(p, objs, n, tpPrefer, seedTag) {
    return seeded(p.id + "|practice|" + seedTag, () => {
      const pg = progress(p), used = new Map(), slots = [], A = aggregate(p.log);
      for (let g = 0; slots.length < n && g < 300; g++) {
        const obj = wpick(objs.map(o => ({ v: o, w: A.obj[o] ? Math.pow(1 - A.obj[o].m, 2) + 0.2 : 0.6 })));
        const it = pickItem(p, obj, used, today(), 0.35);
        if (!it || (!it.gen && used.has(it.id))) continue;
        used.set(it.id, (used.get(it.id) || 0) + 1);
        slots.push({ it, src: "practice", tp: topicFor(obj, pg, tpPrefer) });
      }
      return finalize(slots, used, pg, n);
    });
  }
  /* Ôn lại toàn bộ câu từng sai */
  function buildReview(p, n) {
    return seeded(p.id + "|review|" + Date.now(), () => {
      const pg = progress(p), used = new Map(), slots = [];
      const keys = Object.entries(p.srs).filter(([, s]) => s.w > 0 && (!s.lastOk || s.b <= 1)).sort((a, b) => (a[1].due < b[1].due ? -1 : 1));
      for (const [key, s] of keys) { if (slots.length >= n) break; const it = itemByKey(key, s.o); if (it && !used.has(it.id)) { used.set(it.id, 1); slots.push({ it, src: "wrong", tp: topicFor(s.o, pg) }); } }
      return slots.map(s => toQuestion(s.it, s));
    });
  }
  function finalize(slots, used, pg, n) {
    let qs = slots.map(s => toQuestion(s.it, s));
    // thay vài câu bằng dạng "nhiều đáp án" và "nối cặp" để đề đa dạng
    const nMulti = n >= 12 ? 2 : n >= 6 ? 1 : 0, nMatch = n >= 8 ? 1 : 0;
    const cand = shuffle(qs.map((q, i) => i).filter(i => !slots[i].it.gen && slots[i].src !== "wrong"));
    let m = 0, k = 0;
    for (const i of cand) {
      if (m < nMulti) { const q = multiFor(qs[i].obj, used, slots[i]); if (q) { qs[i] = q; m++; continue; } }
      else if (k < nMatch) { const q = matchFor(qs[i].obj, used, slots[i]); if (q) { qs[i] = q; k++; continue; } }
      if (m >= nMulti && k >= nMatch) break;
    }
    if (!qs.some(q => q.kind === "typed")) { const i = qs.findIndex((q, j) => slots[j] && slots[j].it.t && slots[j].it.a.length <= 30 && (q.kind === "single" || q.kind === "tf")); if (i >= 0) qs[i] = toQuestion(slots[i].it, slots[i], "typed"); }
    qs.forEach((q, i) => (q.n = i));
    return shuffle(qs);
  }

  /* ---------------- chấm điểm ---------------- */
  function grade(q, g) {
    if (q.kind === "single") return { ok: g === q.answer };
    if (q.kind === "tf") return { ok: g === q.truth };
    if (q.kind === "typed") { const v = norm(g || ""); const ok = q.accept.some(a => norm(a) === v || (normNum(a) === normNum(g || "") && normNum(a) !== "")); return { ok }; }
    if (q.kind === "multi") { const sub = q.statements.map((s, j) => !!(g || []).includes(j) === s.truth); return { ok: sub.every(Boolean), sub }; }
    if (q.kind === "match") { const sub = q.pairs.map((pr, j) => (g || [])[j] === pr.a); return { ok: sub.every(Boolean), sub }; }
    return { ok: false };
  }
  const correctText = q => q.kind === "tf" ? (q.truth ? "Đúng" : "Sai") + ` (đáp án đúng: ${q.answer})` : q.kind === "multi" ? q.statements.filter(s => s.truth).map(s => s.q + " → " + s.shown).join(" | ") : q.kind === "match" ? q.pairs.map(pr => pr.q + " → " + pr.a).join(" | ") : q.answer;
  const givenText = (q, g) => q.kind === "tf" ? (g ? "Đúng" : "Sai") : q.kind === "multi" ? ((g || []).length ? g.map(j => String.fromCharCode(65 + j)).join(", ") : "(không chọn)") : q.kind === "match" ? q.pairs.map((pr, j) => (g || [])[j] || "—").join(" | ") : String(g == null ? "" : g) || "(bỏ trống)";

  function record(quiz, q, g, res) {
    const d = today();
    P.log.push({ d, ts: Date.now(), qz: quiz.id, k: q.key || q.kind + ":" + q.obj, o: q.obj, tp: q.tp, ty: q.kind, ok: res.ok ? 1 : 0, s: q.src });
    if (q.kind === "multi") q.statements.forEach((s, j) => srsUpdate(P, s.key, q.obj, res.sub[j], d));
    else if (q.kind === "match") q.pairs.forEach((pr, j) => srsUpdate(P, pr.key, q.obj, res.sub[j], d));
    else srsUpdate(P, q.key, q.obj, res.ok, d);
    if (!res.ok) {
      P.wrongs.unshift({ ts: Date.now(), d, o: q.obj, tp: q.tp, ty: q.kind, prompt: q.kind === "tf" ? q.prompt + "  [Đáp án đưa ra: " + q.shown + "]" : q.prompt, code: q.code, html: q.html, correct: correctText(q), given: givenText(q, g), key: q.key });
      P.wrongs = P.wrongs.slice(0, 400);
    }
  }

  /* ---------------- quiz: tạo/lấy ---------------- */
  function dailyQuiz(date = today()) {
    if (!P.daily[date]) {
      const n = P.settings.perDay;
      P.daily[date] = { id: "daily:" + date, kind: "daily", title: "Quiz ngày " + fmtD(date, { day: "numeric", month: "numeric", year: "numeric" }), date, qs: buildAdaptive(P, date, n, "daily"), i: 0, answers: [], done: false };
      // giữ chi tiết 45 ngày gần nhất
      Object.keys(P.daily).sort().slice(0, -45).forEach(k => delete P.daily[k]);
      save();
    }
    return P.daily[date];
  }
  function startPractice(title, qs, kind = "practice") {
    if (!qs.length) return toast("Chưa có câu hỏi phù hợp.");
    P.practice = { id: kind + ":" + Date.now(), kind, title, date: today(), qs, i: 0, answers: [], done: false };
    save(); location.hash = "#quiz-practice";
  }
  function finishQuiz(qz) {
    qz.done = true; qz.finished = Date.now();
    const ok = qz.answers.filter(a => a.ok).length;
    qz.score = pct(ok, qz.qs.length);
    P.history.unshift({ id: qz.id, kind: qz.kind, title: qz.title, date: today(), n: qz.qs.length, ok, score: qz.score });
    P.history = P.history.slice(0, 300);
    save();
    autoSend();
  }

  /* ---------------- khung giao diện ---------------- */
  const view = $("#view");
  let toastT;
  function toast(msg) { let t = $(".toast"); if (!t) { t = document.createElement("div"); t.className = "toast"; document.body.appendChild(t); } t.textContent = msg; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600); }
  function applyTheme() { if (DB.theme) document.documentElement.setAttribute("data-theme", DB.theme); else document.documentElement.removeAttribute("data-theme"); }
  applyTheme();
  $("#themeBtn").onclick = () => {
    const dark = DB.theme ? DB.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
    DB.theme = dark ? "light" : "dark"; applyTheme(); save();
  };
  $("#whoBtn").onclick = () => welcomeModal();
  $("#foot").innerHTML = `Ngân hàng ${Object.values(QB.bank).reduce((s, a) => s + a.length, 0)} câu hỏi + ${GENS.length} bộ sinh câu ngẫu nhiên, tổng hợp từ <a href="${esc(QB.source)}" target="_blank" rel="noopener">Computing topics for Grade 8</a> (trích xuất ${esc(QB.extractedAt)}). Dữ liệu làm bài lưu trên trình duyệt này.`;

  /* Đường dẫn dạng #ten hoặc #ten-phu (trang Artifact chỉ giữ #ten đơn giản) */
  function parseHash() { const h = location.hash.slice(1), i = h.indexOf("-"); return i < 0 ? { r: h, a: "" } : { r: h.slice(0, i), a: h.slice(i + 1) }; }
  function header() {
    const r = parseHash().r || "home", teacher = r === "class";
    $("#whoBtn").textContent = P ? `👤 ${P.name}${P.cls ? " · " + P.cls : ""}` : "Nhập mã vào lớp";
    const c = P && !teacher ? courseBy(P.course) : null;
    $(".brand-mark").textContent = teacher ? "GV" : c ? c.mark : "QUIZ";
    $(".brand small").textContent = teacher ? `Khu giáo viên · ${SITE.teacher}` : `Lớp ${SITE.teacher}` + (P ? " · " + (P.className || c.short) : "");
    $$("#nav a").forEach(a => a.classList.toggle("on", a.dataset.r === r));
    const student = P && hasBank(P);
    $$("#nav a").forEach(a => (a.hidden = a.dataset.r !== "class" && a.dataset.r !== "home" && !student));
    $("#foot").hidden = !!(P && !hasBank(P));
  }
  function useProfile(p) {
    DB.current = p.id; P = fixProfile(p); save();
    $$(".modal-bg").forEach(m => m.remove());
    if (location.hash === "#home" || !location.hash) route(); else location.hash = "#home";
  }

  /* Màn hình vào lớp: nhập mã → (hỏi tên nếu cần) → vào lớp */
  function welcomeModal(opts = {}) {
    $$(".modal-bg").forEach(m => m.remove());
    const local = Object.values(DB.profiles);
    const bg = modal(`
      <div class="eyebrow">Lớp ${esc(SITE.teacher)}</div>
      <h2 class="mt-s">${P ? "Đổi học sinh" : "Chào em! 👋"}</h2>
      <div id="stepCode">
        <p class="sub small">Nhập <b>mã vào lớp</b> mà thầy gửi cho em.</p>
        <div class="typed" style="margin-top:10px"><input id="jCode" class="code-in" placeholder="VD: 1A3K7-X9Q2M" maxlength="13" autocomplete="off" autocapitalize="characters" spellcheck="false" value="${esc(opts.code ? fmtCode(opts.code) : "")}"><button class="btn primary" id="jGo">Vào lớp →</button></div>
        <div id="jMsg" class="small mt-s"></div>
      </div>
      <div id="stepName" hidden>
        <div class="fb good"><div class="t">✓ Mã hợp lệ</div><div id="jInfo" class="small mt-s"></div></div>
        <div class="field mt"><label for="jName">Em tên là gì?</label><input id="jName" placeholder="Họ và tên của em" autocomplete="off"></div>
        <div class="row between mt"><button class="btn ghost" id="jBack">← Nhập mã khác</button><button class="btn primary" id="jStart">Bắt đầu học →</button></div>
      </div>
      ${local.length ? `<div class="eyebrow mt-l">Hoặc chọn tên đã dùng trên máy này</div><div class="list mt-s">${local.map(p => `<button class="opt" data-id="${esc(p.id)}"><span class="k">${esc((p.name[0] || "?").toUpperCase())}</span><span><b>${esc(p.name)}</b> <span class="muted small">${esc([p.className || courseBy(p.course).short, p.cls].filter(Boolean).join(" · "))}</span></span></button>`).join("")}</div>` : ""}
      <div class="row between mt-l small">${P ? `<button class="btn ghost sm" data-x>Đóng</button>` : "<span></span>"}<a href="#class" id="toTeacher">Thầy/cô giáo? Vào khu giáo viên →</a></div>`);
    let found = null;
    const inp = $("#jCode", bg), msg = $("#jMsg", bg);
    inp.oninput = () => { const raw = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, ""); inp.value = raw.length > 5 ? raw.slice(0, 5) + "-" + raw.slice(5, 10) : raw; msg.textContent = ""; };
    const go = () => {
      const c = parseCode(inp.value);
      if (!c) { msg.innerHTML = `<span style="color:var(--bad)">Mã chưa đúng. Mã gồm 10 ký tự, VD <b>1A3K7-X9Q2M</b> — em kiểm tra lại nhé.</span>`; inp.focus(); return; }
      if (DB.profiles[c.pid]) return useProfile(DB.profiles[c.pid]);
      found = c;
      $("#jInfo", bg).innerHTML = `Môn: <b>${esc(c.course.name)}</b>${c.grade ? ` · Khối <b>${c.grade}</b>` : ""}${opts.className ? ` · Lớp <b>${esc(opts.className)}</b>` : ""}`;
      $("#stepCode", bg).hidden = true; $("#stepName", bg).hidden = false; setTimeout(() => $("#jName", bg).focus(), 30);
    };
    const start = () => { const n = $("#jName", bg).value.trim(); if (!n) return $("#jName", bg).focus(); const p = newProfile({ id: found.pid, name: n, course: found.course.key, grade: found.grade, className: opts.className || "" }); p.code = found.code; DB.profiles[p.id] = p; useProfile(p); };
    $("#jGo", bg).onclick = go; inp.onkeydown = e => { if (e.key === "Enter") go(); };
    $("#jStart", bg).onclick = start; $("#jName", bg).onkeydown = e => { if (e.key === "Enter") start(); };
    $("#jBack", bg).onclick = () => { $("#stepCode", bg).hidden = false; $("#stepName", bg).hidden = true; inp.focus(); };
    $$("[data-id]", bg).forEach(b => (b.onclick = () => useProfile(DB.profiles[b.dataset.id])));
    const x = $("[data-x]", bg); if (x) x.onclick = () => bg.remove();
    $("#toTeacher", bg).onclick = () => bg.remove();
    if (opts.code && parseCode(opts.code)) go(); else setTimeout(() => inp.focus(), 30);
  }
  /* Bấm link thầy gửi: #join-<MÃ>[-<tên>[-<lớp>]] */
  function joinFromLink(a) {
    const [code, nm, cn] = a.split("-"), c = parseCode(code);
    if (!c) { toast("Link vào lớp không đúng — em nhập mã thầy gửi nhé."); safeReplace("#home"); return welcomeModal(); }
    if (DB.profiles[c.pid]) { const p = DB.profiles[c.pid]; if (cn && !p.className) p.className = decTxt(cn); return useProfile(p); }
    const name = nm ? decTxt(nm) : "", className = cn ? decTxt(cn) : "";
    if (!name) return welcomeModal({ code: c.code, className });
    $$(".modal-bg").forEach(m => m.remove());
    const bg = modal(`<div class="eyebrow">Lớp ${esc(SITE.teacher)}</div><h2 class="mt-s">Chào ${esc(name)}! 👋</h2>
      <p class="sub">${esc(SITE.teacher)} đã thêm em vào lớp${className ? ` <b>${esc(className)}</b>` : ""}.</p>
      <div class="tf-shown small">Môn: <b style="display:inline">${esc(c.course.name)}</b>${c.grade ? ` · Khối ${c.grade}` : ""}<br>Mã của em: <b style="display:inline;font-family:var(--mono)">${fmtCode(c.code)}</b> <span class="muted">(dùng để vào lại trên máy khác)</span></div>
      <div class="row between mt"><button class="btn ghost" id="notMe">Không phải em?</button><button class="btn primary" id="inGo">Vào lớp →</button></div>`);
    $("#inGo", bg).onclick = () => { const p = newProfile({ id: c.pid, name, course: c.course.key, grade: c.grade, className }); p.code = c.code; DB.profiles[p.id] = p; useProfile(p); };
    $("#notMe", bg).onclick = () => welcomeModal();
  }
  function safeReplace(h) { try { history.replaceState(null, "", h); } catch (e) { /* khung sandbox */ } }

  /* Lớp chưa có ngân hàng câu hỏi */
  function vNoBank() {
    const c = courseBy(P.course);
    view.innerHTML = `<div class="card" style="max-width:640px;margin:0 auto;text-align:center;padding:36px 22px">
      <div class="eyebrow">${esc(P.className || c.name)}</div><h1 class="mt-s">Chào ${esc(P.name)}! 👋</h1>
      <p class="sub">${esc(SITE.teacher)} đang soạn câu hỏi cho môn ${esc(c.short)}.<br>Khi có câu hỏi, quiz mỗi ngày sẽ tự xuất hiện ở đây.</p>
      ${c.note ? `<p class="small muted">${esc(c.note)}</p>` : ""}
      <button class="btn mt" id="sw">Đổi học sinh</button></div>`;
    $("#sw").onclick = () => welcomeModal();
  }

  /* ---------------- vẽ biểu đồ ---------------- */
  function barRows(rows) {
    // rows: [{name, sub, n, ok}] — thanh = % đúng, nhãn = % + số câu sai
    if (!rows.length) return `<div class="empty small">Chưa có dữ liệu.</div>`;
    return `<div class="bars">${rows.map(r => { const p = pct(r.ok, r.n); return `<div class="bar-row" title="${esc(r.name)}: đúng ${r.ok}/${r.n} câu (${p}%)">
      <div class="nm">${r.href ? `<a href="${r.href}">${esc(r.name)}</a>` : esc(r.name)}${r.sub ? ` <small>${esc(r.sub)}</small>` : ""}</div>
      <div class="track"><div class="fill ${r.n ? "" : "none"}" style="width:${r.n ? Math.max(p, 1) : 0}%"></div></div>
      <div class="val">${r.n ? `<b>${p}%</b> · ${r.n - r.ok} sai` : "—"}</div></div>`; }).join("")}</div>`;
  }
  function trendChart(A, days = 14) {
    const ds = []; for (let i = days - 1; i >= 0; i--) ds.push(shiftDay(today(), -i));
    const W = 640, H = 170, L = 30, B = 22, T = 8, cw = (W - L) / days;
    let s = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Tỉ lệ đúng theo ngày, ${days} ngày gần nhất">`;
    [0, 50, 100].forEach(v => { const y = T + (H - T - B) * (1 - v / 100); s += `<line class="gridl" x1="${L}" x2="${W}" y1="${y}" y2="${y}"/><text class="axis" x="${L - 6}" y="${y + 3}" text-anchor="end">${v}%</text>`; });
    ds.forEach((d, i) => {
      const x = A.day[d], p = x ? pct(x.ok, x.n) : 0, h = (H - T - B) * p / 100, bx = L + i * cw + cw * 0.18, bw = cw * 0.64, y = H - B - h;
      const tip = x ? `${fmtD(d)}: ${p}% đúng (${x.ok}/${x.n} câu)` : `${fmtD(d)}: không làm bài`;
      s += `<g data-tip="${esc(tip)}"><rect class="col-hit" x="${L + i * cw}" y="${T}" width="${cw}" height="${H - T - B}"/>${x ? `<path class="col" d="M${bx},${H - B} V${y + Math.min(4, h)} q0,-4 4,-4 h${bw - 8} q4,0 4,4 V${H - B} Z"/>` : ""}</g>`;
      if (i % 2 === (days - 1) % 2) s += `<text class="axis" x="${L + i * cw + cw / 2}" y="${H - 6}" text-anchor="middle">${parseD(d).getDate()}/${parseD(d).getMonth() + 1}</text>`;
    });
    return `<div class="trend">${s}</svg></div>`;
  }
  function wireTips(root) {
    $$(".trend", root).forEach(box => {
      let tip;
      box.addEventListener("mousemove", e => { const g = e.target.closest("g[data-tip]"); if (!g) { if (tip) tip.hidden = true; return; } if (!tip) { tip = document.createElement("div"); tip.className = "tip"; box.appendChild(tip); } tip.hidden = false; tip.textContent = g.dataset.tip; const r = box.getBoundingClientRect(); tip.style.left = (e.clientX - r.left) + "px"; tip.style.top = (e.clientY - r.top) + "px"; });
      box.addEventListener("mouseleave", () => { if (tip) tip.hidden = true; });
    });
  }
  function heat(p, weeks = 5) {
    const counts = {}; p.log.forEach(e => (counts[e.d] = (counts[e.d] || 0) + 1));
    const t = parseD(today()), dow = (t.getDay() + 6) % 7; // Thứ 2 = 0
    const start = addDays(t, -dow - (weeks - 1) * 7); let h = "";
    for (let i = 0; i < weeks * 7; i++) {
      const d = ymd(addDays(start, i)), c = counts[d] || 0, lv = c === 0 ? "" : c < 8 ? "l1" : c < 15 ? "l2" : "l3";
      h += `<div class="${lv} ${d === today() ? "today" : ""}" title="${fmtD(d)}: ${c} câu"></div>`;
    }
    return `<div class="heat" aria-label="Lịch làm bài ${weeks} tuần">${h}</div><div class="heat-legend">Ít <i></i><i class="l1"></i><i class="l2"></i><i class="l3"></i> Nhiều · ô viền = hôm nay</div>`;
  }

  /* ---------------- trang: Hôm nay ---------------- */
  function vHome() {
    const pg = progress(P), qz = dailyQuiz(), A = aggregate(P.log);
    const mix = {}; qz.qs.forEach(q => (mix[q.src] = (mix[q.src] || 0) + 1));
    const kinds = {}; qz.qs.forEach(q => (kinds[q.kind] = (kinds[q.kind] || 0) + 1));
    const answered = qz.answers.length, okN = qz.answers.filter(a => a.ok).length;
    const weak = Object.entries(A.obj).filter(([, x]) => x.n >= 3).sort((a, b) => a[1].m - b[1].m).slice(0, 4);
    const dw = dueWrong(P, today()).length;
    const st = streak(P);
    view.innerHTML = `
      <div class="hero">
        <div class="card hero-main">
          <div class="eyebrow">${esc(fmtD(today(), { weekday: "long", day: "numeric", month: "long", year: "numeric" }))}</div>
          <h1 class="mt-s">${qz.done ? `Đã xong quiz hôm nay: ${qz.score}% 🎉` : answered ? `Đang làm: câu ${answered + 1}/${qz.qs.length}` : `Quiz hôm nay đã sẵn sàng`}</h1>
          <div class="sub">${qz.qs.length} câu được tạo riêng cho <b>${esc(P.name)}</b> dựa trên tiến độ <b>${esc(pg.label)}</b>${pg.state === "after" ? " (đang nghỉ / ôn tập)" : pg.state === "before" ? " (chưa vào học kỳ)" : ""}.</div>
          <div class="mix">${Object.entries(mix).map(([k, v]) => `<span>${v} · ${SRC[k][0]}</span>`).join("")}</div>
          <div class="mix" style="margin-top:8px">${Object.entries(kinds).map(([k, v]) => `<span>${v} ${TYPES[k]}</span>`).join("")}</div>
          <div class="row mt-l">
            ${qz.done ? `<button class="btn primary" id="sendRes" data-manual-send>📤 Gửi kết quả cho thầy</button><a class="btn" href="#quiz-daily">Xem lại kết quả</a><button class="btn" id="bonus">Làm thêm 10 câu</button>` : `<a class="btn primary" href="#quiz-daily">${answered ? "Làm tiếp" : "Bắt đầu"} →</a>`}
          </div>
          <div class="small mt" id="sendState" style="opacity:.92"></div>
        </div>
        <div class="card">
          <div class="eyebrow">Đang học</div>
          <div class="list mt-s">${pg.current.map(id => `<div><span class="tag acc">${esc(id)}</span> <b>${esc(TOPICS[id].title)}</b><div class="small muted">${esc(UNIT_OF[id].title)}</div></div>`).join("")}</div>
          <div class="row mt between small"><span class="muted">${pg.learned.size} bài đã học</span><a href="#progress">Chỉnh tiến độ →</a></div>
          <div class="eyebrow mt-l">Chuỗi ngày: ${st} 🔥</div>
          <div class="mt-s">${heat(P)}</div>
        </div>
      </div>
      <div class="grid g4 mt">
        <div class="card stat"><div class="lbl">Câu đã làm</div><div class="num">${A.all.n}</div></div>
        <div class="card stat"><div class="lbl">Tỉ lệ đúng</div><div class="num">${A.all.n ? pct(A.all.ok, A.all.n) + "%" : "—"}</div></div>
        <div class="card stat"><div class="lbl">Câu sai cần ôn hôm nay</div><div class="num">${dw}</div></div>
        <div class="card stat"><div class="lbl">Quiz đã hoàn thành</div><div class="num">${P.history.length}</div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><div class="row between"><h2>Chủ điểm cần cố gắng</h2><a class="small" href="#stats">Thống kê đầy đủ →</a></div>
          ${weak.length ? `<div class="list mt">${weak.map(([o, x]) => `<div class="item"><div class="grow"><div class="ttl"><span class="tag warn">${esc(o)}</span> ${esc(STRANDS[strandOf(o)].vi)}</div><div class="small ink2">${esc(objName(o))}</div><div class="small muted">Đúng ${x.ok}/${x.n} · độ thành thạo ${Math.round(x.m * 100)}%</div></div><button class="btn sm" data-po="${esc(o)}">Luyện</button></div>`).join("")}</div>` : `<div class="empty small">Làm vài quiz để hệ thống tìm ra chủ điểm yếu của bạn.</div>`}
        </div>
        <div class="card"><h2>Lần làm gần đây</h2>
          ${P.history.length ? `<div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Ngày</th><th>Bài</th><th class="num">Điểm</th></tr>${P.history.slice(0, 6).map(h => `<tr><td class="small">${fmtD(h.date)}</td><td>${esc(h.title)}</td><td class="num"><span class="tag ${h.score >= 70 ? "good" : h.score >= 50 ? "warn" : "bad"}">${h.score}% · ${h.ok}/${h.n}</span></td></tr>`).join("")}</table></div>` : `<div class="empty small">Chưa có lần làm nào.</div>`}
        </div>
      </div>`;
    const sr = $("#sendRes"); if (sr) sr.onclick = sendResults;
    sendBadge();
    const b = $("#bonus"); if (b) b.onclick = () => startPractice("Làm thêm hôm nay", buildAdaptive(P, today(), 10, "bonus" + Date.now()), "bonus");
    $$("[data-po]").forEach(x => (x.onclick = () => practiceObj(x.dataset.po)));
  }
  function practiceObj(o) { startPractice(`Luyện chủ điểm ${o}`, buildPractice(P, [o], 8, null, o + Date.now())); }

  /* ---------------- trang: Làm quiz ---------------- */
  let QS = null; // trạng thái câu đang làm (lựa chọn tạm)
  function vQuiz(which) {
    const qz = which === "daily" ? dailyQuiz() : P.practice;
    if (!qz) { view.innerHTML = `<div class="card empty">Không có bài luyện tập nào đang mở. <a href="#practice">Chọn bài luyện →</a></div>`; return; }
    if (qz.done) return vResult(qz, which);
    const i = qz.answers.length, q = qz.qs[i], N = qz.qs.length;
    QS = { qz, q, which, sel: q.kind === "multi" ? [] : q.kind === "match" ? [] : null, checked: false };
    const meta = `<div class="qmeta"><span class="tag ${SRC[q.src][1]}">${SRC[q.src][0]}</span><span class="tag">${TYPES[q.kind]}</span><span class="tag" title="${esc(objName(q.obj))}">${esc(q.obj)} · ${esc(STRANDS[strandOf(q.obj)].vi)}</span>${q.tp ? `<span class="tag" title="${esc(UNIT_OF[q.tp].title)}">Bài ${esc(q.tp)}</span>` : ""}</div>`;
    let body = `<div class="qtext">${inline(q.prompt)}</div>${q.hint ? `<div class="qhint">${esc(q.hint)}</div>` : ""}`;
    if (q.code) body += `<pre class="code">${esc(q.code)}</pre>`;
    if (q.html) body += `<div class="qhtml">${q.html}</div>`;
    if (q.kind === "single") body += `<div class="opts">${q.options.map((o, j) => `<button class="opt" data-v="${j}"><span class="k">${String.fromCharCode(65 + j)}</span><span>${inline(o)}</span></button>`).join("")}</div>`;
    if (q.kind === "multi") body += `<div class="opts">${q.statements.map((s, j) => `<button class="opt multi" data-v="${j}"><span class="k">${String.fromCharCode(65 + j)}</span><span><span class="stm-q">${inline(s.q)}</span><span class="stm-a">→ ${inline(s.shown)}</span></span></button>`).join("")}</div>`;
    if (q.kind === "tf") body += `<div class="tf-shown"><span class="small muted">Đáp án được đưa ra:</span><b>${inline(q.shown)}</b></div><div class="qhint">Đáp án này Đúng hay Sai?</div><div class="opts" style="grid-template-columns:1fr 1fr"><button class="opt" data-v="t"><span class="k">Đ</span><span>Đúng</span></button><button class="opt" data-v="f"><span class="k">S</span><span>Sai</span></button></div>`;
    if (q.kind === "typed") body += `<div class="typed"><input id="typed" placeholder="Gõ đáp án của bạn…" autocomplete="off" autocapitalize="off" spellcheck="false"></div><div class="qhint">Không phân biệt chữ hoa/thường.</div>`;
    if (q.kind === "match") body += `<div class="match">${q.pairs.map((pr, j) => `<div class="mrow" data-row="${j}"><div>${inline(pr.q)}</div><select data-m="${j}" aria-label="Đáp án cho câu ${j + 1}"><option value="">— chọn đáp án —</option>${q.options.map(o => `<option>${esc(o)}</option>`).join("")}</select></div>`).join("")}</div>`;
    view.innerHTML = `<div class="quiz">
      <div class="row between"><a class="small" href="#home">← Thoát (đã lưu)</a><span class="small muted">${esc(qz.title)}</span></div>
      <div class="qbar mt-s"><div class="qprog"><i style="width:${pct(i, N)}%"></i></div><b class="small">${i + 1}/${N}</b></div>
      <div class="card qcard">${meta}${body}<div id="fb"></div>
        <div class="qactions"><span class="small muted">${q.kind === "single" || q.kind === "multi" ? `Phím tắt: <span class="kbd">A</span>–<span class="kbd">D</span>, ` : ""}<span class="kbd">Enter</span> để kiểm tra / sang câu</span>
        <button class="btn primary" id="check" disabled>Kiểm tra</button></div></div></div>`;
    const btn = $("#check");
    const ready = () => { const s = QS.sel; btn.disabled = q.kind === "multi" ? !s.length : q.kind === "match" ? q.pairs.some((_, j) => !s[j]) : q.kind === "typed" ? !String(s || "").trim() : s == null; };
    $$(".opt[data-v]").forEach(o => (o.onclick = () => {
      if (QS.checked) return;
      if (q.kind === "multi") { const j = +o.dataset.v; QS.sel = QS.sel.includes(j) ? QS.sel.filter(x => x !== j) : QS.sel.concat(j); o.classList.toggle("sel"); }
      else { $$(".opt").forEach(x => x.classList.remove("sel")); o.classList.add("sel"); QS.sel = q.kind === "tf" ? o.dataset.v === "t" : q.options[+o.dataset.v]; }
      ready();
    }));
    const inp = $("#typed"); if (inp) { inp.oninput = () => { QS.sel = inp.value; ready(); }; setTimeout(() => inp.focus(), 20); }
    $$("select[data-m]").forEach(s => (s.onchange = () => { QS.sel[+s.dataset.m] = s.value; ready(); }));
    btn.onclick = () => (QS.checked ? next() : check());
  }
  function check() {
    const { qz, q } = QS; const g = QS.sel; const res = grade(q, g);
    QS.checked = true;
    qz.answers.push({ g, ok: res.ok, sub: res.sub });
    record(qz, q, g, res);
    // tô màu
    if (q.kind === "single") $$(".opt").forEach((o, j) => { o.disabled = true; if (q.options[j] === q.answer) o.classList.add("right"); else if (q.options[j] === g) o.classList.add("wrong"); });
    if (q.kind === "tf") $$(".opt").forEach(o => { o.disabled = true; const v = o.dataset.v === "t"; if (v === q.truth) o.classList.add("right"); else if (v === g) o.classList.add("wrong"); });
    if (q.kind === "multi") $$(".opt").forEach((o, j) => { o.disabled = true; o.classList.remove("sel"); const s = q.statements[j]; if (s.truth) o.classList.add("right"); else if (g.includes(j)) o.classList.add("wrong"); });
    if (q.kind === "typed") { const i = $("#typed"); i.disabled = true; i.classList.add(res.ok ? "right" : "wrong"); }
    if (q.kind === "match") $$(".mrow").forEach((r, j) => { r.classList.add(res.sub[j] ? "right" : "wrong"); $("select", r).disabled = true; });
    let detail = "";
    if (q.kind === "multi") detail = `<div class="small mt-s">${q.statements.map((s, j) => `<div>${String.fromCharCode(65 + j)}. ${s.truth ? "✔ Đúng" : `✘ Sai — đáp án đúng là <b>${inline(s.answer)}</b>`}</div>`).join("")}</div>`;
    else if (q.kind === "match") detail = `<div class="small mt-s">${q.pairs.map(pr => `<div>• ${inline(pr.q)} → <b>${inline(pr.a)}</b></div>`).join("")}</div>`;
    else if (!res.ok || q.kind === "tf") detail = `<div class="mt-s">Đáp án đúng: <b>${inline(q.answer)}</b>${q.kind === "tf" ? ` — nên câu này là <b>${q.truth ? "Đúng" : "Sai"}</b>` : ""}</div>`;
    $("#fb").innerHTML = `<div class="fb ${res.ok ? "good" : "bad"}"><div class="t">${res.ok ? "Chính xác! ✓" : "Chưa đúng ✗"}</div>${detail}${q.expl ? `<div class="small mt-s">💡 ${inline(q.expl)}</div>` : ""}
      ${!res.ok && q.tp ? `<div class="small mt-s">Ôn lại: <a href="${esc(topicLink(TOPICS[q.tp].refId || q.tp))}" target="_blank" rel="noopener">Bài ${esc(q.tp)} – ${esc(TOPICS[q.tp].title)} ↗</a></div>` : ""}</div>`;
    const b = $("#check"); b.disabled = false; b.textContent = qz.answers.length >= qz.qs.length ? "Xem kết quả →" : "Câu tiếp →"; b.focus();
    if (qz.answers.length >= qz.qs.length) finishQuiz(qz); else save();
  }
  function next() { vQuiz(QS.which); window.scrollTo({ top: 0, behavior: "smooth" }); }
  document.addEventListener("keydown", e => {
    if (!QS || !location.hash.startsWith("#quiz-") || $(".modal-bg")) return;
    const tag = (e.target.tagName || "").toLowerCase();
    if (e.key === "Enter") { const b = $("#check"); if (b && !b.disabled) { e.preventDefault(); b.click(); } return; }
    if (tag === "input" || tag === "select" || QS.checked) return;
    const k = e.key.toUpperCase();
    if (QS.q.kind === "tf" && (k === "D" || k === "S")) { const o = $(`.opt[data-v="${k === "D" ? "t" : "f"}"]`); if (o) o.click(); return; }
    if (/^[A-D]$/.test(k)) { const o = $$(".opt[data-v]")[k.charCodeAt(0) - 65]; if (o) o.click(); }
  });

  function ring(p) {
    const r = 52, c = 2 * Math.PI * r;
    return `<svg class="score-ring" viewBox="0 0 120 120" role="img" aria-label="Điểm ${p}%"><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--bar-track)" stroke-width="10"/><circle cx="60" cy="60" r="${r}" fill="none" stroke="var(--bar)" stroke-width="10" stroke-linecap="round" stroke-dasharray="${c * p / 100} ${c}" transform="rotate(-90 60 60)"/><text x="60" y="67" text-anchor="middle" font-size="24" font-weight="700" fill="var(--ink)" font-family="var(--sans)">${p}%</text></svg>`;
  }
  function vResult(qz, which) {
    QS = null;
    const ok = qz.answers.filter(a => a.ok).length, N = qz.qs.length, p = pct(ok, N);
    const byObj = {}; qz.qs.forEach((q, i) => { const x = byObj[q.obj] || (byObj[q.obj] = { n: 0, ok: 0 }); x.n++; x.ok += qz.answers[i] && qz.answers[i].ok ? 1 : 0; });
    const wrongIdx = qz.qs.map((q, i) => i).filter(i => !(qz.answers[i] && qz.answers[i].ok));
    view.innerHTML = `<div class="quiz">
      <a class="small" href="#home">← Về trang Hôm nay</a>
      <div class="card mt"><div class="result-top">${ring(p)}<div><div class="eyebrow">${esc(qz.title)}</div><h1 class="mt-s">${p >= 85 ? "Xuất sắc! 🌟" : p >= 70 ? "Làm tốt lắm! 👍" : p >= 50 ? "Khá rồi, cố thêm chút nữa 💪" : "Cần ôn lại — đừng nản nhé 📚"}</h1>
        <div class="sub">Đúng <b>${ok}/${N}</b> câu. ${wrongIdx.length ? `${wrongIdx.length} câu sai đã được đưa vào lịch ôn — sẽ xuất hiện lại trong các quiz sau.` : ""}</div>
        <div class="row mt"><button class="btn primary" id="sendRes2" data-manual-send>📤 Gửi kết quả cho thầy</button><a class="btn" href="#stats">Xem thống kê</a>${wrongIdx.length ? `<button class="btn" id="redo">Làm lại câu sai ngay</button>` : ""}</div><div class="small muted mt-s" id="sendState"></div></div></div></div>
      <div class="card mt"><h2>Theo chủ điểm trong bài này</h2><div class="mt">${barRows(Object.entries(byObj).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n).map(([o, x]) => ({ name: o + " · " + STRANDS[strandOf(o)].vi, sub: "", n: x.n, ok: x.ok })))}</div></div>
      ${wrongIdx.length ? `<div class="card mt"><h2>Các câu sai</h2><div class="list mt">${wrongIdx.map(i => { const q = qz.qs[i], a = qz.answers[i]; return `<div class="item wrong-item"><div class="grow"><div class="ttl">${inline(q.prompt)}</div>${q.code ? `<pre class="code">${esc(q.code)}</pre>` : ""}<div class="ans-line">Bạn trả lời: <span class="x">${inline(a ? givenText(q, a.g) : "—")}</span></div><div class="ans-line">Đúng: <span class="v">${inline(correctText(q))}</span></div></div><span class="tag">${esc(q.obj)}</span></div>`; }).join("")}</div></div>` : ""}
    </div>`;
    $("#sendRes2").onclick = sendResults;
    sendBadge();
    const r = $("#redo"); if (r) r.onclick = () => startPractice("Làm lại câu sai", seeded("redo" + Date.now(), () => wrongIdx.map(i => { const q = qz.qs[i]; if (q.key) { const it = itemByKey(q.key, q.obj); if (it) return toQuestion(it, { tp: q.tp, src: "wrong" }); } return Object.assign({}, q, { src: "wrong", options: q.options ? shuffle(q.options) : q.options }); })), "redo");
  }

  /* ---------------- trang: Luyện tập ---------------- */
  function vPractice() {
    const pg = progress(P), A = aggregate(P.log);
    const dueN = Object.values(P.srs).filter(s => s.w > 0 && (!s.lastOk || s.b <= 1)).length;
    view.innerHTML = `<div class="page-head"><div class="eyebrow">Luyện tập tự chọn</div><h1>Luyện tập 🎯</h1><div class="sub">Chọn một bài, một unit hoặc một chủ điểm để luyện thêm. Câu hỏi ưu tiên chỗ bạn còn yếu.</div></div>
      <div class="grid g3">
        <div class="card"><h3>Ôn tất cả câu từng sai</h3><p class="small ink2">${dueN} câu đang trong danh sách cần ôn.</p><button class="btn primary" id="rv" ${dueN ? "" : "disabled"}>Ôn ${Math.min(dueN, 15)} câu</button></div>
        <div class="card"><h3>Tổng ôn các bài đã học</h3><p class="small ink2">${pg.learned.size} bài · trộn đều, ưu tiên chủ điểm yếu.</p><button class="btn" id="mixAll">Làm 20 câu</button></div>
        <div class="card"><h3>Số câu mỗi lần luyện</h3><div class="seg mt-s" id="pn">${[5, 10, 15, 20].map(v => `<button data-n="${v}" class="${v === 10 ? "on" : ""}">${v}</button>`).join("")}</div></div>
      </div>
      ${QB.units.map(u => `<div class="card mt"><div class="row between"><div><div class="eyebrow">Học kỳ ${u.semester} · Unit ${u.num}</div><h2>${esc(u.title)}</h2></div><button class="btn sm" data-unit="${u.id}">Luyện cả unit</button></div>
        <div class="mt-s">${u.topics.map(t => { const x = A.topic[t.id]; return `<div class="topic-row"><span class="code">${esc(t.id)}</span><div><b>${esc(t.title)}</b> ${pg.learned.has(t.id) ? (pg.current.includes(t.id) ? `<span class="tag acc">Đang học</span>` : `<span class="tag good">Đã học</span>`) : ""}<div class="small muted">${t.objectives.map(esc).join(" · ")}${x ? ` — đúng ${pct(x.ok, x.n)}% (${x.n} câu)` : ""}</div></div><button class="btn sm" data-topic="${esc(t.id)}">Luyện</button></div>`; }).join("")}</div></div>`).join("")}
      <div class="card mt"><h2>Theo chủ điểm (learning objective)</h2><div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Mã</th><th>Nội dung</th><th class="num">Số câu</th><th></th></tr>${Object.keys(QB.objectives).map(o => `<tr><td><b>${esc(o)}</b></td><td class="small">${esc(objName(o))}</td><td class="num">${(BY_OBJ[o] || []).length}${GEN_BY_OBJ[o] ? " + ∞" : ""}</td><td><button class="btn sm" data-obj="${esc(o)}">Luyện</button></td></tr>`).join("")}</table></div><div class="small muted mt-s">“+ ∞” = có bộ sinh câu hỏi ngẫu nhiên (số, code, bảng…), mỗi lần làm là câu mới.</div></div>`;
    let n = 10;
    $$("#pn button").forEach(b => (b.onclick = () => { n = +b.dataset.n; $$("#pn button").forEach(x => x.classList.toggle("on", x === b)); }));
    $("#rv").onclick = () => startPractice("Ôn câu từng sai", buildReview(P, 15), "review");
    $("#mixAll").onclick = () => { const objs = uniq([...pg.learned].flatMap(id => TOPICS[id].objectives)); startPractice("Tổng ôn các bài đã học", buildPractice(P, objs, 20, null, "mix" + Date.now())); };
    $$("[data-unit]").forEach(b => (b.onclick = () => { const u = QB.units.find(x => x.id === b.dataset.unit); startPractice(`Luyện Unit ${u.num}: ${u.title}`, buildPractice(P, uniq(u.topics.flatMap(t => t.objectives)), n, null, u.id + Date.now())); }));
    $$("[data-topic]").forEach(b => (b.onclick = () => { const t = TOPICS[b.dataset.topic]; startPractice(`Luyện bài ${t.id}: ${t.title}`, buildPractice(P, t.objectives, n, t.id, t.id + Date.now())); }));
    $$("[data-obj]").forEach(b => (b.onclick = () => startPractice(`Luyện chủ điểm ${b.dataset.obj}`, buildPractice(P, [b.dataset.obj], n, null, b.dataset.obj + Date.now()))));
  }

  /* ---------------- trang: Thống kê ---------------- */
  function vStats() {
    const A = aggregate(P.log), pg = progress(P);
    if (!A.all.n) { view.innerHTML = `<div class="page-head"><h1>Thống kê 📊</h1></div><div class="card empty">Chưa có dữ liệu. <a href="#quiz-daily">Làm quiz hôm nay</a> để bắt đầu thống kê.</div>`; return; }
    const strandRows = Object.keys(STRANDS).map(s => ({ name: STRANDS[s].vi, sub: s, n: (A.strand[s] || {}).n || 0, ok: (A.strand[s] || {}).ok || 0 }));
    const typeRows = Object.keys(TYPES).map(t => ({ name: TYPES[t], n: (A.type[t] || {}).n || 0, ok: (A.type[t] || {}).ok || 0 }));
    const objRows = Object.entries(A.obj).sort((a, b) => a[1].m - b[1].m);
    const last7 = P.log.filter(e => e.d > shiftDay(today(), -7)), l7 = last7.reduce((s, e) => s + e.ok, 0);
    const worstTopic = Object.entries(A.topic).filter(([, x]) => x.n >= 3).sort((a, b) => a[1].ok / a[1].n - b[1].ok / b[1].n)[0];
    const worstObj = objRows.find(([, x]) => x.n >= 3);
    view.innerHTML = `<div class="page-head row between"><div><div class="eyebrow">${esc(P.name)}${P.cls ? " · " + esc(P.cls) : ""}</div><h1>Thống kê 📊</h1><div class="sub">Sai ở đâu, chủ điểm nào, phần nào — cập nhật sau mỗi câu trả lời.</div></div>
        <div class="row"><button class="btn sm" id="csv">Xuất CSV</button><button class="btn sm primary" id="json">📤 Gửi kết quả cho thầy</button></div></div>
      <div class="grid g4">
        <div class="card stat"><div class="lbl">Tổng số câu</div><div class="num">${A.all.n}</div><div class="small muted">${A.all.n - A.all.ok} câu sai</div></div>
        <div class="card stat"><div class="lbl">Tỉ lệ đúng chung</div><div class="num">${pct(A.all.ok, A.all.n)}%</div><div class="small muted">7 ngày qua: ${last7.length ? pct(l7, last7.length) + "%" : "—"}</div></div>
        <div class="card stat"><div class="lbl">Bài yếu nhất</div><div class="num" style="font-size:1.25rem">${worstTopic ? esc(worstTopic[0]) : "—"}</div><div class="small muted">${worstTopic ? esc(TOPICS[worstTopic[0]].title) + " · " + pct(worstTopic[1].ok, worstTopic[1].n) + "%" : "Cần ≥ 3 câu/bài"}</div></div>
        <div class="card stat"><div class="lbl">Chủ điểm yếu nhất</div><div class="num" style="font-size:1.25rem">${worstObj ? esc(worstObj[0]) : "—"}</div><div class="small muted">${worstObj ? esc(STRANDS[strandOf(worstObj[0])].vi) + " · " + pct(worstObj[1].ok, worstObj[1].n) + "%" : "Cần ≥ 3 câu/chủ điểm"}</div></div>
      </div>
      <div class="grid g2 mt">
        <div class="card"><h2>Theo mạch kiến thức</h2><div class="small muted">Thanh = % trả lời đúng</div><div class="mt">${barRows(strandRows)}</div></div>
        <div class="card"><h2>Theo dạng câu hỏi</h2><div class="small muted">Thanh = % trả lời đúng</div><div class="mt">${barRows(typeRows)}</div></div>
      </div>
      <div class="card mt"><h2>Tỉ lệ đúng 14 ngày gần nhất</h2><div class="small muted">Rê chuột lên cột để xem chi tiết</div><div class="mt">${trendChart(A)}</div></div>
      <div class="card mt"><div class="row between"><h2>Bảng tổng hợp theo Unit → Bài</h2><span class="small muted">Sắp theo chương trình</span></div>
        <div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Phần</th><th class="num">Số câu</th><th class="num">Sai</th><th class="num">% đúng</th><th></th></tr>
        ${QB.units.map(u => { const ux = A.unit[u.id]; const ts = u.topics.filter(t => A.topic[t.id]); if (!ux && !u.topics.some(t => pg.learned.has(t.id))) return ""; return `<tr class="unit-row"><td>Unit ${u.num} · ${esc(u.title)}</td><td class="num">${ux ? ux.n : 0}</td><td class="num">${ux ? ux.n - ux.ok : 0}</td><td class="num">${ux ? pct(ux.ok, ux.n) + "%" : "—"}${ux ? `<span class="mini-bar"><i style="width:${pct(ux.ok, ux.n)}%"></i></span>` : ""}</td><td></td></tr>` +
          u.topics.filter(t => A.topic[t.id] || pg.learned.has(t.id)).map(t => { const x = A.topic[t.id]; return `<tr><td><span class="muted small">${esc(t.id)}</span> ${esc(t.title)}</td><td class="num">${x ? x.n : 0}</td><td class="num">${x ? `<b style="color:var(--bad)">${x.n - x.ok}</b>` : 0}</td><td class="num">${x ? pct(x.ok, x.n) + "%" : "—"}${x ? `<span class="mini-bar"><i style="width:${pct(x.ok, x.n)}%"></i></span>` : ""}</td><td><button class="btn sm" data-topic="${esc(t.id)}">Luyện</button></td></tr>`; }).join(""); }).join("")}
        </table></div>${ORDER.length ? `<div class="small muted mt-s">Chỉ hiện các bài đã học hoặc đã làm. Bài chưa có câu nào hiển thị “—”.</div>` : ""}</div>
      <div class="card mt"><h2>Bảng tổng hợp theo chủ điểm</h2><div class="small muted">Sắp từ yếu nhất. “Thành thạo” tính theo các lần làm gần đây (câu mới có trọng số cao hơn).</div>
        <div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Chủ điểm</th><th>Mạch</th><th class="num">Câu</th><th class="num">Sai</th><th class="num">% đúng</th><th class="num">Thành thạo</th><th></th></tr>
        ${objRows.map(([o, x]) => { const m = Math.round(x.m * 100); return `<tr><td><b>${esc(o)}</b><div class="small ink2">${esc(objName(o))}</div></td><td class="small">${esc(STRANDS[strandOf(o)].vi)}</td><td class="num">${x.n}</td><td class="num">${x.n - x.ok}</td><td class="num">${pct(x.ok, x.n)}%</td><td class="num"><span class="tag ${m >= 75 ? "good" : m >= 50 ? "warn" : "bad"}">${m >= 75 ? "✓ " : m >= 50 ? "~ " : "! "}${m}%</span></td><td><button class="btn sm" data-obj="${esc(o)}">Luyện</button></td></tr>`; }).join("")}
        </table></div></div>
      <div class="card mt"><h2>Lịch sử các lần làm</h2><div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Ngày</th><th>Bài</th><th class="num">Đúng</th><th class="num">Điểm</th></tr>${P.history.slice(0, 30).map(h => `<tr><td class="small">${fmtD(h.date)}</td><td>${esc(h.title)}</td><td class="num">${h.ok}/${h.n}</td><td class="num"><span class="tag ${h.score >= 70 ? "good" : h.score >= 50 ? "warn" : "bad"}">${h.score}%</span></td></tr>`).join("") || `<tr><td colspan="4" class="muted">Chưa hoàn thành bài nào.</td></tr>`}</table></div></div>`;
    wireTips(view);
    $$("[data-topic]").forEach(b => (b.onclick = () => { const t = TOPICS[b.dataset.topic]; startPractice(`Luyện bài ${t.id}: ${t.title}`, buildPractice(P, t.objectives, 10, t.id, t.id + Date.now())); }));
    $$("[data-obj]").forEach(b => (b.onclick = () => practiceObj(b.dataset.obj)));
    $("#csv").onclick = exportCSV; $("#json").onclick = sendResults;
  }

  /* ---------------- trang: Câu sai ---------------- */
  function vWrongs() {
    const f = parseHash().a || "all";
    const list = P.wrongs.filter(w => f === "all" || strandOf(w.o) === f);
    view.innerHTML = `<div class="page-head row between"><div><div class="eyebrow">Sổ tay lỗi sai</div><h1>Câu đã làm sai 📒</h1><div class="sub">${P.wrongs.length} lần sai được lưu. Câu sai tự quay lại trong quiz hằng ngày cho tới khi bạn làm đúng nhiều lần.</div></div>
      <button class="btn primary" id="rv">Ôn lại các câu sai</button></div>
      <div class="row"><div class="seg" id="flt"><button data-f="all" class="${f === "all" ? "on" : ""}">Tất cả</button>${Object.keys(STRANDS).map(s => `<button data-f="${s}" class="${f === s ? "on" : ""}">${esc(STRANDS[s].vi)}</button>`).join("")}</div></div>
      <div class="list mt">${list.slice(0, 120).map(w => `<div class="item wrong-item"><div class="grow"><div class="row small muted"><span>${fmtD(w.d)}</span><span class="tag">${esc(w.o)}</span>${w.tp && TOPICS[w.tp] ? `<span class="tag">Bài ${esc(w.tp)}</span>` : ""}<span class="tag">${TYPES[w.ty] || ""}</span></div>
        <div class="ttl mt-s">${inline(w.prompt)}</div>${w.code ? `<pre class="code">${esc(w.code)}</pre>` : ""}${w.html ? `<div class="qhtml">${w.html}</div>` : ""}
        <div class="ans-line">Bạn trả lời: <span class="x">${inline(w.given)}</span></div><div class="ans-line">Đáp án đúng: <span class="v">${inline(w.correct)}</span></div></div></div>`).join("") || `<div class="card empty">Không có câu sai nào ở mục này. Tuyệt vời! 🎉</div>`}</div>`;
    $$("#flt button").forEach(b => (b.onclick = () => (location.hash = "#wrongs-" + b.dataset.f)));
    $("#rv").onclick = () => startPractice("Ôn câu từng sai", buildReview(P, 15), "review");
  }

  /* ---------------- trang: Tiến độ & cài đặt ---------------- */
  function vProgress() {
    const S = P.settings, pg = progress(P), ws = schedule(P), A = aggregate(P.log);
    view.innerHTML = `<div class="page-head"><div class="eyebrow">Tiến độ học</div><h1>Tiến độ & cài đặt ⚙️</h1><div class="sub">Quiz hằng ngày chỉ hỏi những bài đã học, tập trung vào bài đang học. Chọn cách xác định tiến độ:</div></div>
      <div class="card"><div class="row between"><div class="seg" id="mode"><button data-m="schedule" class="${S.mode === "schedule" ? "on" : ""}">Theo lịch tuần</button><button data-m="manual" class="${S.mode === "manual" ? "on" : ""}">Tự chọn bài</button></div>
        <div class="row"><div class="field"><label for="perDay">Số câu quiz mỗi ngày</label><select id="perDay">${[10, 15, 20, 25, 30].map(v => `<option ${v === S.perDay ? "selected" : ""}>${v}</option>`).join("")}</select></div></div></div>
        <p class="small ink2 mt">${S.mode === "schedule" ? `Tự động theo lịch: hôm nay là <b>${esc(pg.label)}</b>. Mỗi tuần học sinh “mở khóa” bài mới; quiz trộn bài tuần này với các bài trước.` : `Tick các bài lớp đã học, và đánh dấu ⭐ bài đang học tuần này.`}</p>
        ${S.mode === "schedule" ? `<div class="grid g2 mt-s"><div class="field"><label for="s1">Ngày bắt đầu Học kỳ 1 (thứ Hai tuần 1)</label><input type="date" id="s1" value="${esc(S.sem1)}"></div><div class="field"><label for="s2">Ngày bắt đầu Học kỳ 2</label><input type="date" id="s2" value="${esc(S.sem2)}"></div></div>` : ""}
        <div class="note mt">Thay đổi tiến độ sẽ áp dụng từ quiz của <b>ngày mai</b> (quiz hôm nay đã tạo giữ nguyên). <button class="btn sm" id="regen">Tạo lại quiz hôm nay</button></div>
      </div>
      ${S.mode === "schedule" ? `<div class="card mt"><h2>Lịch học theo tuần</h2><div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Tuần</th><th>Thời gian</th><th>Bài</th><th>Trạng thái</th></tr>${ws.map(w => { const now = pg.week && w.sem === pg.week.sem && w.week === pg.week.week; const past = w.start < (pg.week ? pg.week.start : ""); return `<tr ${now ? 'style="background:var(--accent-soft)"' : ""}><td>HK${w.sem} · T${w.week}</td><td class="small">${fmtD(w.start, { day: "numeric", month: "numeric" })} – ${fmtD(w.end, { day: "numeric", month: "numeric" })}</td><td class="small">${w.topics.map(id => `<b>${esc(id)}</b> ${esc(TOPICS[id].title)}`).join("<br>")}${w.unitTest ? `<br><span class="tag warn">Kiểm tra Unit</span>` : ""}</td><td>${now ? `<span class="tag acc">Đang học</span>` : past ? `<span class="tag good">Đã học</span>` : `<span class="tag">Sắp tới</span>`}</td></tr>`; }).join("")}</table></div></div>` :
      QB.units.map(u => `<div class="card mt"><div class="row between"><h2>Unit ${u.num} · ${esc(u.title)}</h2><button class="btn sm" data-all="${u.id}">Chọn cả unit</button></div>${u.topics.map(t => `<div class="topic-row"><span class="code">${esc(t.id)}</span><label><input type="checkbox" data-l="${esc(t.id)}" ${S.learned[t.id] ? "checked" : ""}> ${esc(t.title)}</label><button class="btn sm ${S.current.includes(t.id) ? "primary" : ""}" data-c="${esc(t.id)}" title="Đánh dấu bài đang học">⭐ Đang học</button></div>`).join("")}</div>`).join("")}
      <div class="card mt"><h2>Thuật toán tạo đề hằng ngày</h2><ul class="small ink2">
        <li><b>~40% bài đang học</b> — các bài của tuần hiện tại (hoặc bài ⭐).</li>
        <li><b>~25% câu từng sai đến hạn ôn</b> — sai hôm nay sẽ hỏi lại ngày mai; đúng thì giãn dần 2 → 4 → 7 → 15 → 30 ngày.</li>
        <li><b>Phần còn lại: chủ điểm yếu & ôn tập</b> — chọn ngẫu nhiên có trọng số theo độ thành thạo (càng yếu càng hay được hỏi), chỉ trong các bài đã học.</li>
        <li>Mỗi đề trộn 5 dạng: một đáp án, nhiều đáp án, Đúng/Sai, điền đáp án, nối cặp; khoảng 30% câu có thể là câu sinh ngẫu nhiên (số liệu, code mới mỗi lần).</li>
        <li>Đề cố định trong ngày (mở lại vẫn là đề đó), sang ngày mới tự tạo đề mới.</li></ul></div>
      <div class="card mt"><h2>Dữ liệu</h2><p class="small ink2">Kết quả lưu trên trình duyệt này. Muốn chuyển sang máy khác: xuất dữ liệu ở máy cũ rồi nhập ở máy mới.</p><div class="row mt-s"><button class="btn sm" id="json">Sao lưu (chuyển máy)</button><label class="btn sm">Nhập từ file<input type="file" id="imp" accept=".json,.txt,application/json,text/plain" hidden></label><button class="btn sm" id="pasteSelf">Dán dữ liệu</button><button class="btn sm danger" id="del">Xóa hồ sơ ${esc(P.name)}</button></div></div>`;
    $$("#mode button").forEach(b => (b.onclick = () => { S.mode = b.dataset.m; if (S.mode === "manual" && !Object.keys(S.learned).length) { pg.learned.forEach(id => (S.learned[id] = true)); S.current = pg.current.slice(); } save(); vProgress(); }));
    $("#perDay").onchange = e => { S.perDay = +e.target.value; save(); toast("Đã lưu. Áp dụng từ quiz tiếp theo."); };
    const s1 = $("#s1"), s2 = $("#s2");
    if (s1) s1.onchange = () => { if (s1.value) { S.sem1 = s1.value; save(); vProgress(); } };
    if (s2) s2.onchange = () => { if (s2.value) { S.sem2 = s2.value; save(); vProgress(); } };
    $$("[data-l]").forEach(c => (c.onchange = () => { S.learned[c.dataset.l] = c.checked; if (!c.checked) S.current = S.current.filter(x => x !== c.dataset.l); save(); }));
    $$("[data-c]").forEach(b => (b.onclick = () => { const id = b.dataset.c; S.current = S.current.includes(id) ? S.current.filter(x => x !== id) : S.current.concat(id); if (S.current.includes(id)) S.learned[id] = true; save(); vProgress(); }));
    $$("[data-all]").forEach(b => (b.onclick = () => { QB.units.find(u => u.id === b.dataset.all).topics.forEach(t => (S.learned[t.id] = true)); save(); vProgress(); }));
    $("#regen").onclick = async () => { const d = P.daily[today()]; if (d && d.answers.length && !(await ask("Quiz hôm nay đã làm " + d.answers.length + " câu. Tạo lại đề mới? (Kết quả các câu đã làm vẫn được giữ trong thống kê)", "Tạo lại"))) return; delete P.daily[today()]; save(); toast("Đã tạo lại quiz hôm nay theo tiến độ mới."); location.hash = "#home"; };
    $("#json").onclick = exportJSON;
    $("#imp").onchange = e => importFile(e.target.files, "self");
    $("#pasteSelf").onclick = () => pasteModal("self");
    $("#del").onclick = async () => { if (!(await ask(`Xóa vĩnh viễn hồ sơ và toàn bộ kết quả của ${P.name}? Không thể hoàn tác.`, "Xóa hồ sơ", true))) return; delete DB.profiles[P.id]; DB.current = null; P = null; save(); route(); };
  }

  /* ---------------- kết quả gửi thầy (gọn, dán được vào Zalo) ---------------- */
  function summaryOf(p) {
    const A = aggregate(p.log), obj = {}, days = {};
    Object.entries(A.obj).forEach(([o, x]) => (obj[o] = [x.n, x.ok, Math.round(x.m * 100)]));
    Object.keys(A.day).sort().slice(-60).forEach(d => (days[d] = [A.day[d].n, A.day[d].ok]));
    return { app: "ict8-kq", v: 1, ts: Date.now(), id: p.id, name: p.name, grade: p.grade, course: p.course, cls: p.className || "", code: p.code || "", at: today(), streak: streak(p), quizzes: p.history.length, obj, days, hist: p.history.slice(0, 15).map(h => [h.date, h.ok, h.n]) };
  }
  function sumStats(s) {
    let n = 0, ok = 0; const st = {};
    for (const [o, v] of Object.entries(s.obj || {})) { n += v[0]; ok += v[1]; const k = strandOf(o); st[k] = st[k] || [0, 0]; st[k][0] += v[0]; st[k][1] += v[1]; }
    const weak = Object.entries(s.obj || {}).filter(([, v]) => v[0] >= 3).sort((x, y) => x[1][2] - y[1][2]).slice(0, 2).map(([o]) => o);
    const ds = Object.keys(s.days || {}).sort();
    return { n, ok, st, weak, last: ds[ds.length - 1] || null, days: ds.length, d7: ds.filter(d => d > shiftDay(today(), -7)).length, streak: s.streak || 0, at: s.at, quizzes: s.quizzes || 0 };
  }
  function sendResults() {
    exportModal("Gửi kết quả cho thầy", `ket-qua-${slug(P.name)}-${today()}.json`, JSON.stringify(summaryOf(P)), "application/json",
      `Bấm <b>Sao chép</b> rồi dán vào tin nhắn Zalo / Messenger gửi ${esc(SITE.teacher)}. Thầy dán vào khu giáo viên là thấy kết quả của em.`);
  }

  /* ---------------- tự gửi / tự nhận kết quả qua Google Sheets ----------------
     Học sinh: sau mỗi quiz (và mỗi lần mở web) tự POST bản tóm tắt tới Apps Script của thầy.
     Thầy: GET bằng "mã đọc" (chỉ lưu trên máy thầy) để kéo kết quả cả lớp về.
     Trang chạy trong khung claude.ai bị chặn gửi ra ngoài → tắt, dùng cách gửi Zalo. */
  const canAutoSend = () => !!SITE.sheetUrl && !embedded;
  const sheetReadUrl = () => (DB.sheetUrl || SITE.sheetUrl || "").trim();
  let sending = false;
  async function autoSend(force) {
    const p = P;
    if (!p || !canAutoSend() || sending || !p.log.length) return;
    if (!force && p.sentLen === p.log.length) return;
    sending = true; const len = p.log.length;
    try {
      const r = await fetch(SITE.sheetUrl, { method: "POST", body: JSON.stringify({ key: SITE.sheetKey, data: summaryOf(p) }) });
      const j = await r.json(); if (!j || !j.ok) throw new Error((j && j.error) || "fail");
      p.sentLen = len; p.sentAt = Date.now(); p.sendErr = null;
    } catch (e) { p.sendErr = Date.now(); }
    finally { sending = false; save(); sendBadge(); }
  }
  function sendBadge() {
    const el = $("#sendState"); if (!el || !P) return;
    if (!canAutoSend()) { el.innerHTML = ""; return; }
    const t = P.sentAt ? new Date(P.sentAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" }) + " " + fmtD(ymd(new Date(P.sentAt)), { day: "numeric", month: "numeric" }) : "";
    el.innerHTML = P.sentLen === P.log.length && P.sentAt ? `✓ Kết quả đã tự gửi cho thầy lúc ${t}` : P.sendErr ? `⏳ Chưa gửi được kết quả (mất mạng?) — web sẽ tự thử lại.` : P.log.length ? `↻ Đang gửi kết quả cho thầy…` : "";
    $$("[data-manual-send]").forEach(b => (b.hidden = !P.sendErr && P.sentLen === P.log.length));
  }
  window.addEventListener("online", () => autoSend());

  async function pullResults(quiet) {
    const url = sheetReadUrl();
    if (!url || !DB.sheetReadKey) { if (!quiet) toast("Chưa kết nối Google Sheets."); return false; }
    try {
      const r = await fetch(url + (url.includes("?") ? "&" : "?") + "key=" + encodeURIComponent(DB.sheetReadKey));
      const j = await r.json(); if (!j || !j.ok) throw new Error((j && j.error) || "fail");
      let k = 0;
      for (const d of j.results || []) if (d && d.app === "ict8-kq" && d.id && newer(d, DB.results[d.id])) { DB.results[d.id] = d; k++; }
      DB.sheetSync = Date.now(); save();
      if (!quiet) toast(k ? `Đã cập nhật ${k} kết quả mới từ Google Sheets.` : "Không có kết quả mới.");
      return true;
    } catch (e) { if (!quiet) toast(embedded ? "Trang trong khung claude.ai không kết nối được Google Sheets — mở bản localhost/GitHub Pages." : "Không kết nối được Google Sheets — kiểm tra lại link / mã đọc."); return false; }
  }
  const newer = (a, b) => !b || (a.ts || 0) > (b.ts || 0) || (!(a.ts || b.ts) && (a.at || "") >= (b.at || ""));
  function autoPull(rerender) {
    if (!sheetReadUrl() || !DB.sheetReadKey || embedded || Date.now() - (DB.sheetSync || 0) < 60000) return;
    DB.sheetSync = Date.now();
    pullResults(true).then(ok => { if (ok && rerender && parseHash().r === "class") route(); });
  }

  function appsScriptCode(readKey) {
    return `/* Hộp thư nhận kết quả quiz ICT — Lớp ${SITE.teacher}
   Dán toàn bộ đoạn này vào Apps Script của Google Sheet, rồi Triển khai → Ứng dụng web. */
const WRITE_KEY = "${SITE.sheetKey}";   // trùng sheetKey trong js/config.js
const READ_KEY = "${readKey}";          // mã đọc — chỉ thầy biết, KHÔNG gửi cho học sinh
const SHEET_NAME = "KetQua";
const HEAD = ["Mã HS", "Học sinh", "Lớp", "Khối", "Mã vào lớp", "Ngày cập nhật", "Số câu", "% đúng", "Chủ điểm yếu", "Chuỗi ngày", "Số quiz", "Nhận lúc", "Dữ liệu"];

function sheet_() {
  const ss = SpreadsheetApp.getActive();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) { sh = ss.insertSheet(SHEET_NAME); sh.appendRow(HEAD); sh.setFrozenRows(1); }
  return sh;
}
function out_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function txt_(v) { v = String(v == null ? "" : v).slice(0, 200); return /^[=+\\-@]/.test(v) ? "'" + v : v; }

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return out_({ ok: false, error: "json" }); }
  if (!body || body.key !== WRITE_KEY) return out_({ ok: false, error: "key" });
  const d = body.data || {};
  const raw = JSON.stringify(d);
  if (d.app !== "ict8-kq" || !/^[A-Za-z0-9]{1,24}$/.test(String(d.id || "")) || raw.length > 30000) return out_({ ok: false, error: "data" });
  const objs = d.obj || {}; let n = 0, ok = 0;
  Object.keys(objs).forEach(k => { n += Number(objs[k][0]) || 0; ok += Number(objs[k][1]) || 0; });
  const weak = Object.keys(objs).filter(k => objs[k][0] >= 3).sort((a, b) => objs[a][2] - objs[b][2]).slice(0, 2).join(", ");
  const row = [d.id, txt_(d.name), txt_(d.cls), Number(d.grade) || "", txt_(d.code), txt_(d.at), n, n ? Math.round(ok * 100 / n) : "", weak, Number(d.streak) || 0, Number(d.quizzes) || 0, new Date(), raw];
  const lock = LockService.getScriptLock(); lock.waitLock(10000);
  try {
    const sh = sheet_(), last = sh.getLastRow();
    const ids = last > 1 ? sh.getRange(2, 1, last - 1, 1).getValues().map(r => String(r[0])) : [];
    const i = ids.indexOf(String(d.id));
    if (i >= 0) sh.getRange(i + 2, 1, 1, row.length).setValues([row]); else sh.appendRow(row);
  } finally { lock.releaseLock(); }
  return out_({ ok: true });
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.key !== READ_KEY) return out_({ ok: false, error: "key" });
  const sh = sheet_(), last = sh.getLastRow();
  const rows = last > 1 ? sh.getRange(2, 1, last - 1, HEAD.length).getValues() : [];
  return out_({ ok: true, results: rows.map(r => { try { return JSON.parse(r[12]); } catch (err) { return null; } }).filter(Boolean) });
}
`;
  }
  function sheetWizard() {
    DB.sheetReadKey = DB.sheetReadKey || "r-" + rid(16).toLowerCase(); save();
    const code = appsScriptCode(DB.sheetReadKey);
    const bg = modal(`<h2>Tự nhận kết quả qua Google Sheets</h2>
      <p class="small ink2">Làm 1 lần, khoảng 5 phút. Sau đó học sinh làm xong quiz là kết quả tự về Google Sheet của thầy.</p>
      <ol class="setup">
        <li>Mở <a href="https://sheets.new" target="_blank" rel="noopener">sheets.new</a> để tạo một Google Sheet trống (đặt tên VD “Kết quả quiz ICT”).</li>
        <li>Trong Sheet: <b>Tiện ích mở rộng → Apps Script</b>. Xóa hết mã có sẵn, dán đoạn dưới vào, bấm 💾 Lưu.
          <textarea id="gsCode" readonly class="code-box"></textarea><button class="btn sm" id="gsCopy">Copy mã</button></li>
        <li>Bấm <b>Triển khai → Tùy chọn triển khai mới</b> → bánh răng chọn <b>Ứng dụng web</b>.<br>“Thực thi với tư cách”: <b>Tôi</b> · “Ai có quyền truy cập”: <b>Bất kỳ ai</b> → <b>Triển khai</b> → cấp quyền cho tài khoản Google của thầy.</li>
        <li>Copy <b>URL ứng dụng web</b> (dạng <code>https://script.google.com/macros/s/…/exec</code>) và dán vào đây:
          <div class="typed" style="margin-top:8px"><input id="gsUrl" placeholder="https://script.google.com/macros/s/…/exec" value="${esc(sheetReadUrl())}" autocomplete="off" spellcheck="false"><button class="btn primary" id="gsTest">Kiểm tra</button></div><div id="gsMsg" class="small mt-s"></div></li>
        <li>Để <b>máy học sinh</b> tự gửi: link này phải nằm trong web học sinh dùng — dán vào <code>js/config.js</code> ở dòng <code>sheetUrl</code> (hoặc gửi link cho Claude để cập nhật giúp).</li>
      </ol>
      <p class="small muted">Mã đọc kết quả chỉ lưu trên máy này và trong Apps Script của thầy — học sinh không đọc được kết quả của nhau.</p>
      <div class="row between mt"><span></span><button class="btn" data-x>Đóng</button></div>`);
    $("#gsCode", bg).value = code;
    $("#gsCopy", bg).onclick = () => copyText(code, "Đã copy mã Apps Script.");
    $("[data-x]", bg).onclick = () => { bg.remove(); route(); };
    $("#gsTest", bg).onclick = async () => {
      const u = $("#gsUrl", bg).value.trim(), msg = $("#gsMsg", bg);
      if (!/^https:\/\/script\.google(usercontent)?\.com\/.+/.test(u) && !/^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?\//.test(u)) { msg.innerHTML = `<span style="color:var(--bad)">Link chưa đúng — phải là URL ứng dụng web của Apps Script.</span>`; return; }
      DB.sheetUrl = u; save(); msg.textContent = "Đang kiểm tra…";
      const ok = await pullResults(true);
      msg.innerHTML = ok ? `<span style="color:var(--good)"><b>✓ Kết nối thành công!</b></span> ${SITE.sheetUrl === u ? "Máy học sinh đã có link này." : `Bước cuối: đưa link vào <code>js/config.js</code> → <code>sheetUrl: "${esc(u)}"</code>`}`
        : `<span style="color:var(--bad)">Chưa kết nối được. Kiểm tra: đã triển khai “Ứng dụng web”, quyền “Bất kỳ ai”, và dán đúng mã ở bước 2 (mã đọc phải khớp).</span>`;
    };
  }

  /* ---------------- khu giáo viên ---------------- */
  let tUnlocked = false;
  const studentPid = (cl, st) => "s" + cl.id + st.sid;
  const studentData = (cl, st) => { const pid = studentPid(cl, st); return DB.profiles[pid] ? summaryOf(DB.profiles[pid]) : DB.results[pid] || null; };
  const isLocal = u => /\/\/(localhost|127\.0\.0\.1|\[::1\])/.test(u) || u.startsWith("file:");
  function siteBase() { if (!embedded && /^https?:$/.test(location.protocol)) return location.origin + location.pathname; return SITE.url || location.href.split("#")[0]; }
  const studentLink = (cl, st) => siteBase() + "#join-" + st.code + "-" + encTxt(st.name) + "-" + encTxt(cl.name);
  const studentMsg = (cl, st) => `Chào ${st.name}! ${SITE.teacher} gửi em link vào lớp ${cl.name}:\n${studentLink(cl, st)}\n\nHoặc mở ${siteBase()} rồi nhập mã: ${fmtCode(st.code)}\nMỗi ngày em làm 1 quiz nhé. Làm xong bấm "Gửi kết quả cho thầy" và dán vào đây.`;
  async function copyText(text, okMsg) {
    try { await navigator.clipboard.writeText(text); toast(okMsg || "Đã sao chép."); return true; }
    catch (e) { exportModal("Sao chép nội dung", "noi-dung.txt", text, "text/plain", "Trình duyệt chặn sao chép tự động — bấm “Sao chép” hoặc chọn toàn bộ ô dưới rồi Ctrl/⌘ + C."); return true; }
  }
  function classModal(cl) {
    const bg = modal(`<h2>${cl ? "Đổi thông tin lớp" : "Tạo lớp mới"}</h2>
      <div class="field mt"><label for="cName">Tên lớp</label><input id="cName" placeholder="VD: ICT 8 – Thứ 7" value="${esc(cl ? cl.name : "")}" autocomplete="off"></div>
      <div class="grid g2 mt-s"><div class="field" ${COURSES.length < 2 ? "hidden" : ""}><label for="cCourse">Môn / ngân hàng câu hỏi</label><select id="cCourse" ${cl ? "disabled" : ""}>${COURSES.map(c => `<option value="${esc(c.key)}" ${cl && cl.course === c.key ? "selected" : ""}>${esc(c.name)}${c.bank ? "" : " (đang soạn)"}</option>`).join("")}</select></div>
      <div class="field"><label for="cGrade">Khối chính</label><select id="cGrade"></select></div></div>
      ${cl ? `<p class="small muted">Không đổi được môn của lớp đã tạo (mã học sinh đã gắn với môn).</p>` : ""}
      <div class="row between mt"><button class="btn ghost" data-x>Hủy</button><button class="btn primary" id="cSave">${cl ? "Lưu" : "Tạo lớp →"}</button></div>`);
    const cs = $("#cCourse", bg), gs = $("#cGrade", bg);
    const fill = () => { const c = courseBy(cs.value); gs.innerHTML = c.grades.map(g => `<option value="${g}" ${cl && cl.grade === g ? "selected" : ""}>Lớp ${g}</option>`).join(""); };
    cs.onchange = fill; fill();
    $("[data-x]", bg).onclick = () => bg.remove();
    $("#cSave", bg).onclick = () => {
      const name = $("#cName", bg).value.trim(); if (!name) return $("#cName", bg).focus();
      if (cl) { cl.name = name; cl.grade = +gs.value; save(); bg.remove(); return route(); }
      let id; do { id = rid(3); } while (DB.tclasses[id]);
      DB.tclasses[id] = { id, name, course: cs.value, grade: +gs.value, created: today(), students: [] };
      save(); bg.remove(); location.hash = "#class-" + id;
    };
    setTimeout(() => $("#cName", bg).focus(), 30);
  }
  function addStudent(cl, name, grade) {
    name = String(name).trim(); if (!name) return null;
    const c = courseBy(cl.course); grade = c.grades.includes(+grade) ? +grade : cl.grade;
    let sid; do { sid = rid(4); } while (cl.students.some(s => s.sid === sid));
    const st = { sid, name, grade, code: makeCode(c.code, grade, cl.id, sid), added: today() };
    cl.students.push(st); return st;
  }
  function pinModal() {
    const bg = modal(`<h2>Mã PIN giáo viên</h2><p class="small ink2">Khóa khu giáo viên trên máy này để học sinh dùng chung máy không vào được. (Chỉ là khóa đơn giản trên trình duyệt.)</p>
      <div class="field mt"><label for="pin1">PIN mới (4–6 số) — để trống để bỏ khóa</label><input id="pin1" inputmode="numeric" maxlength="6" autocomplete="off"></div>
      <div class="row between mt"><button class="btn ghost" data-x>Hủy</button><button class="btn primary" id="pinSave">Lưu</button></div>`);
    $("[data-x]", bg).onclick = () => bg.remove();
    $("#pinSave", bg).onclick = () => { const v = $("#pin1", bg).value.trim(); if (v && !/^\d{4,6}$/.test(v)) return toast("PIN gồm 4–6 chữ số."); DB.tpin = v || null; tUnlocked = true; save(); bg.remove(); toast(v ? "Đã đặt PIN giáo viên." : "Đã bỏ khóa PIN."); route(); };
  }

  function vTeacher(cid) {
    if (DB.tpin && !tUnlocked) {
      view.innerHTML = `<div class="card" style="max-width:420px;margin:30px auto;text-align:center"><div class="eyebrow">Khu giáo viên</div><h2 class="mt-s">Nhập mã PIN 🔒</h2>
        <div class="typed" style="justify-content:center"><input id="pinIn" inputmode="numeric" maxlength="6" style="max-width:160px;text-align:center;letter-spacing:.3em" autocomplete="off"><button class="btn primary" id="pinGo">Mở</button></div>
        <p class="small muted mt">Học sinh: <a href="#home">quay lại trang học →</a></p></div>`;
      const go = () => { if ($("#pinIn").value === DB.tpin) { tUnlocked = true; route(); } else { toast("PIN chưa đúng."); $("#pinIn").select(); } };
      $("#pinGo").onclick = go; $("#pinIn").onkeydown = e => { if (e.key === "Enter") go(); }; setTimeout(() => $("#pinIn").focus(), 30);
      return;
    }
    autoPull(true);
    if (cid && DB.tclasses[cid]) return vTClass(DB.tclasses[cid]);
    vTList();
  }
  function journey() {
    const cls = Object.values(DB.tclasses), studs = cls.flatMap(c => c.students);
    const steps = [
      ["Tạo lớp", "Đặt tên lớp, chọn môn và khối.", cls.length > 0],
      ["Thêm học sinh", "Mỗi em tự có một mã vào lớp riêng.", studs.length > 0],
      ["Gửi link / mã", "Copy tin nhắn có sẵn, gửi qua Zalo.", studs.some(s => s.sent)],
      ["Học sinh làm quiz", "Mỗi ngày 1 đề tự tạo theo tiến độ.", Object.keys(DB.results).length > 0],
      ["Nhận kết quả", SITE.sheetUrl ? "Tự về Google Sheets — bấm “Cập nhật kết quả”." : "Kết nối Google Sheets để tự nhận, hoặc dán tin nhắn Zalo.", Object.keys(DB.results).length > 0]
    ];
    const next = steps.findIndex(s => !s[2]);
    return `<div class="card"><div class="row between"><h2>Hành trình lớp học</h2><span class="small muted">${next < 0 ? "Đã xong cả 5 bước 🎉" : `Bước tiếp theo: ${next + 1}. ${steps[next][0]}`}</span></div>
      <ol class="journey mt">${steps.map((s, i) => `<li class="${s[2] ? "done" : i === next ? "now" : ""}"><span class="dot">${s[2] ? "✓" : i + 1}</span><div><b>${s[0]}</b><div class="small muted">${s[1]}</div></div></li>`).join("")}</ol></div>`;
  }
  function vTList() {
    const cls = Object.values(DB.tclasses).sort((a, b) => a.name.localeCompare(b.name));
    const known = new Set(cls.flatMap(c => c.students.map(s => studentPid(c, s))));
    const orphan = Object.values(DB.results).filter(r => !known.has(r.id));
    view.innerHTML = `<div class="page-head row between"><div><div class="eyebrow">Khu giáo viên · ${esc(SITE.teacher)}</div><h1>Lớp của tôi 👨‍🏫</h1><div class="sub">Tạo lớp → thêm học sinh → gửi mã → nhận kết quả.</div></div>
        <div class="row"><button class="btn" id="pasteAll">Dán kết quả học sinh</button><button class="btn primary" id="newCls">+ Tạo lớp mới</button></div></div>
      ${journey()}
      ${cls.length ? `<div class="grid g3 mt">${cls.map(c => { const co = courseBy(c.course); const got = c.students.filter(s => studentData(c, s)).length; return `<a class="card cls-card" href="#class-${esc(c.id)}"><div class="row between"><span class="tag ${co.bank ? "acc" : "warn"}">${esc(co.short)}${co.bank ? "" : " · đang soạn"}</span><span class="small muted">Khối ${c.grade}</span></div><h2 class="mt-s">${esc(c.name)}</h2><div class="small ink2 mt-s">${c.students.length} học sinh · ${got} đã gửi kết quả</div><div class="small mt">Mở lớp →</div></a>`; }).join("")}</div>`
        : `<div class="card empty mt"><p>Chưa có lớp nào.</p><button class="btn primary" id="newCls2">Tạo lớp đầu tiên →</button></div>`}
      ${orphan.length ? `<div class="card mt"><h2>Kết quả chưa thuộc lớp nào</h2><p class="small muted">Học sinh dùng mã không có trong các lớp trên máy này (VD lớp tạo ở máy khác — hãy khôi phục bản sao lưu lớp).</p><div class="list mt-s">${orphan.map(r => { const s = sumStats(r); return `<div class="item"><div class="grow"><b>${esc(r.name)}</b> <span class="small muted">${esc(r.cls || "")} · ${esc(courseBy(r.course).short)} · ${r.grade ? "Lớp " + r.grade : ""}</span><div class="small">${s.n} câu · ${pct(s.ok, s.n)}% đúng · cập nhật ${r.at ? fmtD(r.at) : "—"}</div></div><button class="btn sm danger" data-rmres="${esc(r.id)}">Xóa</button></div>`; }).join("")}</div></div>` : ""}
      <div class="card mt"><div class="row between"><h2>Tự nhận kết quả (Google Sheets)</h2>${sheetReadUrl() && DB.sheetReadKey ? `<span class="tag good">Đã kết nối</span>` : `<span class="tag">Chưa kết nối</span>`}</div>
        ${sheetReadUrl() && DB.sheetReadKey ? `<p class="small ink2">Kết quả học sinh tự về Google Sheet của thầy. Lần cập nhật cuối: <b>${DB.sheetSync ? new Date(DB.sheetSync).toLocaleString("vi-VN") : "—"}</b>.${SITE.sheetUrl ? "" : ` <span style="color:var(--warn)">Máy học sinh chưa có link — cần đưa link vào <code>js/config.js</code>.</span>`}${embedded ? ` <span style="color:var(--warn)">Bản trong khung claude.ai không kết nối được — dùng bản localhost/GitHub Pages.</span>` : ""}</p>
          <div class="row mt-s"><button class="btn sm primary" id="gsPull">Cập nhật kết quả</button><button class="btn sm" id="gsSetup">Xem lại cách thiết lập</button></div>`
        : `<p class="small ink2">Học sinh làm xong quiz là kết quả <b>tự gửi</b> về Google Sheet của thầy — không cần copy qua Zalo. Thiết lập 1 lần khoảng 5 phút.</p><button class="btn sm primary mt-s" id="gsSetup">Thiết lập ngay</button>`}</div>
      <div class="card mt"><h2>Công cụ</h2><div class="row mt-s"><button class="btn sm" id="bk">Sao lưu lớp & kết quả</button><button class="btn sm" id="rs">Khôi phục từ bản sao lưu</button><button class="btn sm" id="pin">${DB.tpin ? "Đổi / bỏ PIN" : "Đặt PIN giáo viên"}</button></div>
        <p class="small muted mt-s">Lớp và kết quả lưu trên trình duyệt này. Dùng “Sao lưu” để chuyển sang máy khác hoặc phòng khi xóa dữ liệu trình duyệt.</p></div>`;
    [$("#newCls"), $("#newCls2")].forEach(b => b && (b.onclick = () => classModal()));
    $("#pasteAll").onclick = () => pasteModal("class");
    $("#bk").onclick = () => exportModal("Sao lưu lớp & kết quả", `lop-thay-nghia-${today()}.json`, JSON.stringify({ app: "ict8-teacher", v: 1, at: today(), tclasses: DB.tclasses, results: DB.results }), "application/json", "Giữ đoạn này (hoặc file) cẩn thận — dán vào “Khôi phục” trên máy khác để có lại toàn bộ lớp.");
    $("#rs").onclick = () => pasteModal("class");
    $("#pin").onclick = pinModal;
    $("#gsSetup").onclick = sheetWizard;
    const gp = $("#gsPull"); if (gp) gp.onclick = async () => { gp.disabled = true; if (await pullResults()) route(); else gp.disabled = false; };
    $$("[data-rmres]").forEach(b => (b.onclick = async () => { if (await ask("Xóa kết quả này khỏi máy?", "Xóa", true)) { delete DB.results[b.dataset.rmres]; save(); route(); } }));
  }
  function vTClass(cl) {
    const co = courseBy(cl.course), bank = co.bank === "ict8";
    const rows = cl.students.map(st => ({ st, d: studentData(cl, st) })).map(x => Object.assign(x, { s: x.d ? sumStats(x.d) : null }));
    const tot = {}; rows.forEach(x => x.d && Object.entries(x.d.obj || {}).forEach(([o, v]) => { tot[o] = tot[o] || [0, 0]; tot[o][0] += v[0]; tot[o][1] += v[1]; }));
    const objRows = Object.entries(tot).filter(([, v]) => v[0] >= 5).sort((a, b) => a[1][1] / a[1][0] - b[1][1] / b[1][0]).slice(0, 8);
    const cell = v => v == null ? `<td class="num muted">—</td>` : `<td class="num"><span class="tag ${v >= 75 ? "good" : v >= 50 ? "warn" : "bad"}">${v}%</span></td>`;
    const base = siteBase();
    view.innerHTML = `<a class="small" href="#class">← Lớp của tôi</a>
      <div class="page-head row between mt-s"><div><div class="eyebrow">${esc(co.name)} · Khối ${cl.grade}</div><h1>${esc(cl.name)}</h1><div class="sub">${cl.students.length} học sinh${co.bank ? "" : " · môn này đang soạn câu hỏi (học sinh vẫn vào lớp được)"}</div></div>
        <div class="row"><button class="btn sm" id="ren">Đổi tên</button><button class="btn sm danger" id="delC">Xóa lớp</button></div></div>
      <div class="card"><h2><span class="step-n">1</span> Thêm học sinh</h2>
        <div class="row mt-s" style="align-items:flex-end"><div class="field" style="flex:1;min-width:180px"><label for="sName">Họ tên</label><input id="sName" placeholder="VD: Nguyễn Văn Lâm" autocomplete="off"></div>
        <div class="field"><label for="sGrade">Khối</label><select id="sGrade">${co.grades.map(g => `<option value="${g}" ${g === cl.grade ? "selected" : ""}>Lớp ${g}</option>`).join("")}</select></div>
        <button class="btn primary" id="sAdd">+ Thêm</button><button class="btn" id="sMany">Thêm nhiều tên</button></div>
        ${bank && co.grades.length > 1 ? `<p class="small muted mt-s">Học sinh khối nhỏ hơn ${co.grades[0]} tự đi chậm: bắt đầu từ bài đầu, 10 câu/ngày.</p>` : ""}</div>
      <div class="card mt"><div class="row between"><h2><span class="step-n">2</span> Gửi mã cho học sinh</h2>${cl.students.length ? `<button class="btn sm" id="cpAll">Copy tin nhắn cả lớp</button>` : ""}</div>
        ${isLocal(base) ? `<div class="note mt-s">Web đang chạy trên máy này (<code>${esc(base)}</code>) nên <b>link</b> chỉ mở được trên chính máy này. Học sinh dùng máy khác: gửi <b>mã</b>, hoặc đưa web lên mạng rồi gửi link.</div>` : ""}
        ${cl.students.length ? `<div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Học sinh</th><th>Khối</th><th>Mã vào lớp</th><th>Gửi cho em</th><th>Trạng thái</th><th></th></tr>
          ${rows.map(({ st, s }) => `<tr><td><b>${esc(st.name)}</b></td><td>${st.grade}</td><td><span class="code-chip">${fmtCode(st.code)}</span></td>
            <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm" data-msg="${esc(st.sid)}">Copy tin nhắn</button><button class="btn sm ghost" data-link="${esc(st.sid)}">Copy link</button></div></td>
            <td class="small">${s ? `<span class="tag good">Đã gửi kết quả</span><div class="muted">${s.at ? fmtD(s.at) : ""}</div>` : st.sent ? `<span class="tag acc">Đã gửi mã</span><div class="muted">${fmtD(st.sent)}</div>` : `<span class="tag">Chưa gửi mã</span>`}</td>
            <td><div class="row" style="gap:6px;flex-wrap:nowrap"><button class="btn sm ghost" data-try="${esc(st.sid)}" title="Mở web như học sinh này trên máy thầy">Làm thử</button><button class="btn sm ghost danger" data-del="${esc(st.sid)}" title="Xóa học sinh">✕</button></div></td></tr>`).join("")}</table></div>` : `<div class="empty small">Thêm học sinh ở bước 1 — mỗi em sẽ có mã riêng ở đây.</div>`}</div>
      <div class="card mt"><div class="row between"><h2><span class="step-n">3</span> Kết quả lớp</h2><div class="row">${sheetReadUrl() && DB.sheetReadKey ? `<button class="btn sm primary" id="gsPull2">Cập nhật từ Google Sheets</button>` : ""}<button class="btn sm ${sheetReadUrl() && DB.sheetReadKey ? "" : "primary"}" id="paste">Dán kết quả học sinh</button></div></div>
        <p class="small muted">${sheetReadUrl() && DB.sheetReadKey ? "Kết quả tự về qua Google Sheets (tự cập nhật khi mở trang). Em nào gửi qua Zalo thì dùng “Dán kết quả học sinh”." : "Học sinh bấm “Gửi kết quả cho thầy” → sao chép → gửi Zalo. Thầy copy tin nhắn đó, bấm “Dán kết quả học sinh”. Hoặc thiết lập Google Sheets ở trang “Lớp của tôi” để tự nhận."}</p>
        ${rows.some(x => x.s) ? `<div class="tbl-wrap mt-s"><table class="tbl"><tr><th>Học sinh</th><th class="num">Câu</th><th class="num">% đúng</th>${bank ? Object.keys(STRANDS).map(k => `<th class="num" title="${esc(STRANDS[k].vi)}">${esc(k)}</th>`).join("") + "<th>Yếu nhất</th>" : ""}<th class="num">Ngày học (7 ngày)</th><th class="num">Chuỗi</th><th>Cập nhật</th></tr>
          ${rows.map(({ st, s }) => s ? `<tr><td><b>${esc(st.name)}</b><div class="small muted">Lớp ${st.grade}</div></td><td class="num">${s.n}</td>${cell(s.n ? pct(s.ok, s.n) : null)}${bank ? Object.keys(STRANDS).map(k => cell(s.st[k] ? pct(s.st[k][1], s.st[k][0]) : null)).join("") + `<td class="small">${s.weak.map(esc).join(", ") || "—"}</td>` : ""}<td class="num">${s.d7}/7</td><td class="num">${s.streak} 🔥</td><td class="small">${s.at ? fmtD(s.at) : "—"}</td></tr>`
            : `<tr><td><b>${esc(st.name)}</b><div class="small muted">Lớp ${st.grade}</div></td><td class="muted small" colspan="${bank ? 11 : 5}">Chưa nhận kết quả</td></tr>`).join("")}</table></div>
          ${bank ? `<div class="small muted mt-s">9P/9CT/9CS/9MD/9DC = % đúng theo mạch: ${Object.entries(STRANDS).map(([k, v]) => `${k} ${v.vi}`).join(" · ")}.</div>` : ""}` : `<div class="empty small">Chưa nhận kết quả nào của lớp này.</div>`}
      </div>
      ${bank && objRows.length ? `<div class="card mt"><h2>Chủ điểm cả lớp sai nhiều nhất</h2><div class="small muted">Chủ điểm có ≥ 5 lượt trả lời · thanh = % đúng</div><div class="mt">${barRows(objRows.map(([o, v]) => ({ name: o, sub: STRANDS[strandOf(o)].vi, n: v[0], ok: v[1] })))}</div></div>` : ""}`;
    const byId = sid => cl.students.find(s => s.sid === sid);
    const add = () => { const st = addStudent(cl, $("#sName").value, $("#sGrade").value); if (!st) return $("#sName").focus(); save(); toast(`Đã thêm ${st.name} · mã ${fmtCode(st.code)}`); vTClass(cl); setTimeout(() => $("#sName") && $("#sName").focus(), 30); };
    $("#sAdd").onclick = add; $("#sName").onkeydown = e => { if (e.key === "Enter") add(); };
    $("#sMany").onclick = () => {
      const bg = modal(`<h2>Thêm nhiều học sinh</h2><p class="small ink2">Mỗi dòng một tên. Muốn khác khối thì thêm dấu phẩy và số khối, VD: <code>Trần An, 7</code></p><textarea id="many" style="width:100%;height:160px;border:1.5px solid var(--line);border-radius:10px;padding:8px;background:var(--surface);color:var(--ink)"></textarea><div class="row between mt"><button class="btn ghost" data-x>Hủy</button><button class="btn primary" id="mGo">Thêm</button></div>`);
      $("[data-x]", bg).onclick = () => bg.remove();
      $("#mGo", bg).onclick = () => { let k = 0; $("#many", bg).value.split("\n").forEach(line => { const m = line.match(/^(.*?)(?:[,;]\s*(\d{1,2}))?\s*$/); if (m && addStudent(cl, m[1], m[2] || cl.grade)) k++; }); save(); bg.remove(); toast(`Đã thêm ${k} học sinh.`); vTClass(cl); };
      setTimeout(() => $("#many", bg).focus(), 30);
    };
    const markSent = st => { st.sent = today(); save(); };
    $$("[data-msg]").forEach(b => (b.onclick = async () => { const st = byId(b.dataset.msg); if (await copyText(studentMsg(cl, st), `Đã copy tin nhắn cho ${st.name} — dán vào Zalo nhé.`)) { markSent(st); vTClass(cl); } }));
    $$("[data-link]").forEach(b => (b.onclick = async () => { const st = byId(b.dataset.link); if (await copyText(studentLink(cl, st), `Đã copy link của ${st.name}.`)) { markSent(st); vTClass(cl); } }));
    const all = $("#cpAll"); if (all) all.onclick = async () => { if (await copyText(cl.students.map(st => studentMsg(cl, st)).join("\n\n— — —\n\n"), "Đã copy tin nhắn của cả lớp.")) { cl.students.forEach(markSent); vTClass(cl); } };
    $$("[data-try]").forEach(b => (b.onclick = () => { const st = byId(b.dataset.try), pid = studentPid(cl, st); if (!DB.profiles[pid]) { const p = newProfile({ id: pid, name: st.name, course: cl.course, grade: st.grade, className: cl.name }); p.code = st.code; DB.profiles[pid] = p; } toast(`Đang mở web như ${st.name} (trên máy này).`); useProfile(DB.profiles[pid]); }));
    $$("[data-del]").forEach(b => (b.onclick = async () => { const st = byId(b.dataset.del); if (!(await ask(`Xóa ${st.name} khỏi lớp? Mã của em sẽ không còn trong danh sách (kết quả đã nhận vẫn giữ).`, "Xóa", true))) return; cl.students = cl.students.filter(s => s !== st); save(); vTClass(cl); }));
    $("#paste").onclick = () => pasteModal("class");
    const gp2 = $("#gsPull2"); if (gp2) gp2.onclick = async () => { gp2.disabled = true; if (await pullResults()) route(); else gp2.disabled = false; };
    $("#ren").onclick = () => classModal(cl);
    $("#delC").onclick = async () => { if (!(await ask(`Xóa lớp "${cl.name}" và danh sách ${cl.students.length} học sinh? Không thể hoàn tác.`, "Xóa lớp", true))) return; delete DB.tclasses[cl.id]; save(); location.hash = "#class"; };
  }

  /* ---------------- xuất / nhập ---------------- */
  /* Hộp thoại trong trang (trang Artifact không cho dùng confirm/alert) */
  function modal(html) { const bg = document.createElement("div"); bg.className = "modal-bg"; bg.innerHTML = `<div class="card modal">${html}</div>`; document.body.appendChild(bg); return bg; }
  function ask(msg, okLabel = "Đồng ý", danger) {
    return new Promise(res => {
      const bg = modal(`<p style="margin-top:0">${esc(msg)}</p><div class="row between mt"><button class="btn ghost" data-a="0">Hủy</button><button class="btn primary ${danger ? "danger" : ""}" data-a="1">${esc(okLabel)}</button></div>`);
      $$("[data-a]", bg).forEach(b => (b.onclick = () => { bg.remove(); res(b.dataset.a === "1"); }));
    });
  }
  /* Tải file: trong trang Artifact dùng quyền "downloads"; mở file cục bộ thì tải trực tiếp */
  let dlCap;
  const downloadsCap = () => (dlCap !== undefined ? Promise.resolve(dlCap) : window.claude && window.claude.use ? Promise.race([window.claude.use("downloads").catch(() => null), new Promise(r => setTimeout(() => r(null), 4000))]).then(c => (dlCap = c)) : Promise.resolve((dlCap = null)));
  const embedded = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  async function download(name, text, type) {
    const cap = await downloadsCap();
    if (cap) { try { await cap.save({ filename: name, data: text }); return true; } catch (e) { if (e && e.code === "declined") return false; } }
    if (embedded && !cap) return false;
    try { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([text], { type })); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500); return true; } catch (e) { return false; }
  }
  /* Xuất: luôn có ô chữ + nút Sao chép (gửi qua Zalo/Messenger/email), kèm nút Tải file nếu được */
  function exportModal(title, name, text, type, note = "Mở bằng Excel / Google Sheets.") {
    const bg = modal(`<h2>${esc(title)}</h2><p class="small ink2">${note}</p><textarea id="exTxt" readonly style="width:100%;height:140px;font:12px var(--mono);border:1.5px solid var(--line);border-radius:10px;padding:8px;background:var(--surface-2);color:var(--ink)"></textarea>
      <div class="row between mt"><button class="btn ghost" data-x>Đóng</button><div class="row"><button class="btn" id="exDl">Tải file</button><button class="btn primary" id="exCp">Sao chép</button></div></div>`);
    const ta = $("#exTxt", bg); ta.value = text;
    $("[data-x]", bg).onclick = () => bg.remove();
    $("#exCp", bg).onclick = async () => { try { await navigator.clipboard.writeText(text); toast("Đã sao chép. Dán vào tin nhắn gửi thầy nhé!"); } catch (e) { ta.focus(); ta.select(); toast("Đã chọn sẵn — bấm Ctrl/⌘ + C để sao chép."); } };
    $("#exDl", bg).onclick = async () => { const ok = await download(name, text, type); if (!ok) toast("Không tải được file ở đây — hãy dùng nút Sao chép."); };
    downloadsCap().then(c => { if (!c && embedded) $("#exDl", bg).hidden = true; });
  }
  function pasteModal(mode) {
    const bg = modal(`<h2>${mode === "class" ? "Dán kết quả / bản sao lưu" : "Dán dữ liệu của em"}</h2><p class="small ink2">${mode === "class" ? "Dán tin nhắn kết quả học sinh gửi (dán nhiều em cùng lúc được, kể cả còn lẫn chữ khác của Zalo), hoặc bản sao lưu lớp." : "Dán đoạn dữ liệu đã sao lưu từ máy cũ."}</p>
      <textarea id="pTxt" style="width:100%;height:150px;font:12px var(--mono);border:1.5px solid var(--line);border-radius:10px;padding:8px;background:var(--surface);color:var(--ink)"></textarea>
      <div class="row between mt"><button class="btn ghost" data-x>Hủy</button><button class="btn primary" id="pGo">Nhập</button></div>`);
    $("[data-x]", bg).onclick = () => bg.remove();
    $("#pGo", bg).onclick = async () => { const txt = $("#pTxt", bg).value; bg.remove(); await importText(txt, mode, "nội dung đã dán"); };
    setTimeout(() => $("#pTxt", bg).focus(), 30);
  }
  const slug = s => nameKey(s) || "hoc-sinh";
  function exportJSON() { exportModal("Sao lưu toàn bộ dữ liệu của " + P.name, `sao-luu-${slug(P.name)}-${today()}.json`, JSON.stringify({ app: "ict8-thaynghia", version: VERSION, exported: new Date().toISOString(), profile: { id: P.id, name: P.name, cls: P.cls, course: P.course, grade: P.grade, className: P.className, code: P.code, log: P.log, history: P.history, srs: P.srs, wrongs: P.wrongs, settings: P.settings } }), "application/json", "Dùng để chuyển sang máy khác: mở web ở máy mới → Tiến độ → <b>Dán dữ liệu</b>. (Gửi thầy thì dùng nút “Gửi kết quả cho thầy” — gọn hơn.)"); }
  function exportCSV() {
    const head = ["ngay", "quiz", "chu_diem", "mach", "bai", "unit", "dang_cau", "nguon", "dung"];
    const rows = P.log.map(e => [e.d, e.qz, e.o, STRANDS[strandOf(e.o)] ? STRANDS[strandOf(e.o)].vi : "", e.tp, UNIT_OF[e.tp] ? "Unit " + UNIT_OF[e.tp].num : "", TYPES[e.ty] || e.ty, SRC[e.s] ? SRC[e.s][0] : e.s, e.ok]);
    exportModal("Xuất bảng CSV", `ict8-${slug(P.name)}-${today()}.csv`, "﻿" + [head].concat(rows).map(r => r.map(v => `"${String(v == null ? "" : v).replace(/"/g, '""')}"`).join(",")).join("\n"), "text/csv");
  }
  /* Tách các khối {...} JSON trong một đoạn văn bản (tin nhắn Zalo có thể lẫn chữ khác) */
  function jsonBlocks(text) {
    const out = []; let depth = 0, start = -1, inStr = false, escp = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inStr) { if (escp) escp = false; else if (ch === "\\") escp = true; else if (ch === '"') inStr = false; continue; }
      if (ch === '"' && depth > 0) inStr = true;
      else if (ch === "{") { if (depth === 0) start = i; depth++; }
      else if (ch === "}" && depth > 0) { depth--; if (depth === 0) { try { out.push(JSON.parse(text.slice(start, i + 1))); } catch (e) { /* bỏ qua */ } } }
    }
    return out;
  }
  async function importText(text, mode, label) {
    const blocks = jsonBlocks(String(text || "")).filter(d => d && ["ict8-kq", "ict8-thaynghia", "ict8-teacher"].includes(d.app));
    if (!blocks.length) { toast(`Không tìm thấy dữ liệu hợp lệ trong ${label}.`); return; }
    const names = [];
    for (const d of blocks) {
      if (d.app === "ict8-teacher") {
        if (!(await ask(`Khôi phục ${Object.keys(d.tclasses || {}).length} lớp và ${Object.keys(d.results || {}).length} kết quả từ bản sao lưu ngày ${d.at || "?"}? (Lớp trùng mã sẽ được thay bằng bản sao lưu)`, "Khôi phục"))) continue;
        Object.assign(DB.tclasses, d.tclasses || {});
        for (const [k, r] of Object.entries(d.results || {})) if (newer(r, DB.results[k])) DB.results[k] = r;
        names.push("bản sao lưu lớp");
      } else if (d.app === "ict8-kq") {
        if (!d.id) continue;
        if (newer(d, DB.results[d.id])) DB.results[d.id] = d;
        names.push(d.name);
      } else if (d.app === "ict8-thaynghia" && d.profile && Array.isArray(d.profile.log)) {
        const p = d.profile;
        if (mode === "self") {
          if (!(await ask(`Nhập dữ liệu của "${p.name}" vào trình duyệt này? (Nếu đã có hồ sơ cùng mã, dữ liệu sẽ được thay thế)`, "Nhập"))) continue;
          DB.profiles[p.id] = fixProfile(Object.assign(DB.profiles[p.id] || newProfile({ id: p.id, name: p.name, course: p.course, grade: p.grade, className: p.className }), p)); DB.current = p.id; P = DB.profiles[p.id];
        } else DB.results[p.id] = summaryOf(fixProfile(Object.assign(newProfile({ id: p.id, name: p.name, course: p.course, grade: p.grade, className: p.className }), p)));
        names.push(p.name);
      }
    }
    if (!names.length) return;
    save(); toast(`Đã nhập: ${uniq(names).join(", ")}.`); route();
  }
  async function importFile(files, mode) {
    for (const f of [...files]) { try { await importText(await f.text(), mode, `file “${f.name}”`); } catch (e) { toast(`Không đọc được file “${f.name}”.`); } }
  }

  /* ---------------- điều hướng ---------------- */
  function route() {
    const { r, a } = parseHash();
    header();
    if (r === "join" && a) { joinFromLink(a); return; }
    if (r !== "quiz") QS = null;
    if (r === "class") return vTeacher(a);
    if (!P) { view.innerHTML = `<div class="card empty">Nhập mã vào lớp thầy gửi để bắt đầu.</div>`; if (!$(".modal-bg")) welcomeModal(); return; }
    if (!hasBank(P)) return vNoBank();
    switch (r) {
      case "quiz": return vQuiz(a === "practice" ? "practice" : "daily");
      case "practice": return vPractice();
      case "stats": return vStats();
      case "wrongs": return vWrongs();
      case "progress": return vProgress();
      default: return vHome();
    }
  }
  window.addEventListener("hashchange", () => { route(); window.scrollTo(0, 0); });
  route();
  setTimeout(() => autoSend(), 1500);
  // sang ngày mới khi để tab mở qua đêm
  let day = today();
  setInterval(() => { if (today() !== day) { day = today(); if (!location.hash.startsWith("#quiz")) route(); } }, 60000);

  // cho kiểm thử
  window.ICT8 = { buildAdaptive: (n = 15, date = today()) => buildAdaptive(P, date, n, "test"), progress: () => progress(P), aggregate: () => aggregate(P.log) };
})();
