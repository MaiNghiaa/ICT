/* Bộ sinh câu hỏi ngẫu nhiên (giữ nguyên từ trang nguồn). Mỗi lần gọi tạo một câu mới. */

/* Random question generators — create brand-new questions every attempt.
   Each returns {q, a, w:[wrongs], c?:code, h?:html, e?:explanation, t?:true} */
(function () {
  const R = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const shuffle = arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  // three distinct numeric distractors near the answer
  const near = (ans, spread = 3, extra = []) => {
    const set = new Set(); extra.forEach(v => { if (v !== ans && v >= 0) set.add(v); });
    let guard = 0;
    while (set.size < 3 && guard++ < 100) { const v = ans + R(-spread, spread); if (v !== ans && v >= 0) set.add(v); }
    while (set.size < 3) set.add(ans + set.size + 7);
    return [...set].slice(0, 3).map(String);
  };
  const WORDS = ["robot", "python", "laptop", "planet", "guitar", "dragon", "pixel", "rocket", "jungle", "mango", "turtle", "cookie", "school", "galaxy", "tiger", "cloud"];
  const NAMES = ["Ana", "Ben", "Chen", "Dev", "Ella", "Femi", "Gia", "Hiro", "Isla", "Jay", "Kai", "Lina", "Minh", "Nora", "Omar", "Priya"];

  const G = [];
  const add = (objs, fn) => G.push({ objs, fn });

  /* 9P.02 data types */
  add(["9P.02"], () => {
    const opts = [
      () => ({ v: String(R(2, 999)), a: "Integer" }),
      () => ({ v: String(-R(1, 50)), a: "Integer" }),
      () => ({ v: (R(1, 99) + R(1, 99) / 100).toFixed(2), a: "Real" }),
      () => ({ v: "'" + pick("ABCDXYZ?#7".split("")) + "'", a: "Character" }),
      () => ({ v: '"' + pick(["Hello", "Year 8", "Robi", "chatbot", "12 Main St", "07700 900123"]) + '"', a: "String" }),
      () => ({ v: pick(["True", "False"]), a: "Boolean" })
    ];
    const o = pick(opts)();
    const all = ["Integer", "Real", "Character", "String", "Boolean"];
    return { q: "What is the data type of the value stored in x?", c: "x = " + o.v, a: o.a, w: shuffle(all.filter(t => t !== o.a)).slice(0, 3), t: true };
  });

  /* loop total */
  add(["9P.03", "9CT.07", "9CT.06", "9CT.02"], () => {
    const start = R(0, 3), step = pick([1, 1, 2, 3]), count = R(3, 5);
    const stop = start + step * count;
    let total = 0; for (let i = start; i < stop; i += step) total += i;
    const rng = step === 1 ? `range(${start}, ${stop})` : `range(${start}, ${stop}, ${step})`;
    return { q: "What is printed?", c: `total = 0\nfor i in ${rng}:\n    total = total + i\nprint(total)`, a: String(total), w: near(total, 4, [total + stop, total - start]), t: true, e: `i takes the values ${[...Array(count).keys()].map(k => start + k * step).join(", ")} — they add up to ${total}.` };
  });

  /* loop count (pseudocode / python) */
  add(["9CT.06", "9CT.02", "9P.03"], () => {
    if (Math.random() < 0.5) {
      const a = R(0, 5), b = a + R(3, 9);
      const n = b - a + 1;
      return { q: "How many times is \"Hello\" output?", c: `FOR i ← ${a} TO ${b}\n    OUTPUT "Hello"\nNEXT i`, a: String(n), w: near(n, 2, [n - 1, n + 1, b]), t: true, e: `Pseudocode FOR loops include both ends: ${a} to ${b} is ${n} times.` };
    }
    const a = R(0, 4), b = a + R(3, 9);
    const n = b - a;
    return { q: "How many times does this loop run?", c: `for i in range(${a}, ${b}):\n    print("Hi")`, a: String(n), w: near(n, 2, [n + 1, n - 1, b]), t: true, e: `range(${a}, ${b}) stops before ${b}, so it runs ${n} times.` };
  });

  /* array index */
  add(["9P.04", "9P.01"], () => {
    const items = shuffle(WORDS).slice(0, R(4, 6));
    const listTxt = "items = [" + items.map(s => `"${s}"`).join(", ") + "]";
    const mode = R(0, 3);
    if (mode === 0) { // len
      return { q: "What is printed?", c: listTxt + "\nprint(len(items))", a: String(items.length), w: near(items.length, 2, [items.length - 1, items.length + 1]), t: true };
    }
    if (mode === 1) { // out of range
      const k = items.length;
      return { q: "What happens when this runs?", c: listTxt + `\nprint(items[${k}])`, a: "IndexError (runtime error)", w: [`It prints "${items[k - 1]}"`, `It prints "${items[0]}"`, "Syntax error"], e: `Indexes go from 0 to ${k - 1}, so items[${k}] does not exist.` };
    }
    const k = R(0, items.length - 1);
    const wr = shuffle(items.filter((_, i) => i !== k)).slice(0, 3);
    return { q: "What is printed?", c: listTxt + `\nprint(items[${k}])`, a: items[k], w: wr, t: true, e: `Index ${k} is item number ${k + 1}, because indexes start at 0.` };
  });

  /* string manipulation */
  add(["9P.05"], () => {
    const w = pick(WORDS); const word = Math.random() < 0.5 ? w[0].toUpperCase() + w.slice(1) : w.toUpperCase();
    const mode = R(0, 3);
    if (mode === 0) return { q: "What is printed?", c: `word = "${word}"\nprint(len(word))`, a: String(word.length), w: near(word.length, 2), t: true };
    if (mode === 1) return { q: "What is printed?", c: `word = "${word}"\nprint(word.lower())`, a: word.toLowerCase(), w: [word.toUpperCase(), word, word[0].toUpperCase() + word.slice(1).toLowerCase()].filter(x => x !== word.toLowerCase()).concat([String(word.length)]).slice(0, 3), t: true };
    if (mode === 2) { const lw = word.toLowerCase(); return { q: "What is printed?", c: `word = "${lw}"\nprint(word.upper())`, a: lw.toUpperCase(), w: [lw, lw[0].toUpperCase() + lw.slice(1), String(lw.length)], t: true }; }
    const n = pick(NAMES), s = pick(["Reyes", "Tran", "Smith", "Khan", "Lopez", "Nguyen"]);
    const ans = (n[0] + s).toLowerCase();
    return { q: "What username is printed?", c: `first = "${n}"\nlast = "${s}"\nprint((first[0] + last).lower())`, a: ans, w: [n[0] + s, (n + s).toLowerCase(), (n[0] + s).toUpperCase()], t: true };
  });

  /* trace a variable */
  add(["9P.11", "9CT.07"], () => {
    const start = R(1, 5), n = R(2, 4), mode = R(0, 2);
    let x = start, code, steps = [x];
    if (mode === 0) { const m = pick([2, 3]); for (let i = 0; i < n; i++) { x *= m; steps.push(x); } code = `x = ${start}\nfor i in range(${n}):\n    x = x * ${m}\nprint(x)`; }
    else if (mode === 1) { for (let i = 1; i <= n; i++) { x += i; steps.push(x); } code = `x = ${start}\nfor i in range(1, ${n + 1}):\n    x = x + i\nprint(x)`; }
    else { const d = R(2, 4); x = start + 20; steps = [x]; for (let i = 0; i < n; i++) { x -= d; steps.push(x); } code = `x = ${start + 20}\nfor i in range(${n}):\n    x = x - ${d}\nprint(x)`; }
    return { q: "Complete a trace table in your head. What is printed?", c: code, a: String(x), w: near(x, 5, [steps[steps.length - 2]]), t: true, e: "x takes the values: " + steps.join(" → ") };
  });

  /* test data */
  add(["9P.09", "9P.08"], () => {
    const ctx = pick([["age", 11, 16], ["mark", 0, 100], ["number of tickets", 1, 6], ["shoe size", 3, 12], ["level", 1, 20], ["temperature setting", 16, 30]]);
    const [what, lo, hi] = ctx; const kind = pick(["Normal", "Extreme", "Invalid", "Invalid"]);
    let v;
    if (kind === "Normal") v = R(lo + 1, hi - 1);
    else if (kind === "Extreme") v = pick([lo, hi]);
    else v = pick([lo - R(1, 3), hi + R(1, 5), '"' + pick(["ten", "abc", "?"]) + '"']);
    return { q: `A program accepts a ${what} from ${lo} to ${hi} (inclusive). What type of test data is ${v}?`, a: kind, w: ["Normal", "Extreme", "Invalid", "Syntax"].filter(k => k !== kind).slice(0, 3), t: true,
      e: kind === "Extreme" ? "It is right on the boundary but still allowed." : kind === "Normal" ? "It is safely inside the range." : "It is outside the range or the wrong type, so it should be rejected." };
  });

  /* binary search */
  add(["9CT.05"], () => {
    const n = pick([7, 9, 11]); const set = new Set(); while (set.size < n) set.add(R(1, 99));
    const arr = [...set].sort((a, b) => a - b);
    if (Math.random() < 0.5) {
      const mid = arr[Math.floor((n - 1) / 2)];
      return { q: "Using a binary search on this list, which value is checked FIRST?", c: JSON.stringify(arr).replace(/,/g, ", "), a: String(mid), w: [String(arr[0]), String(arr[n - 1]), String(arr[Math.floor((n - 1) / 2) + 1])], t: true, e: "Binary search always starts with the middle item." };
    }
    const target = pick(arr); let lo = 0, hi = n - 1, c = 0, seq = [];
    while (lo <= hi) { const m = Math.floor((lo + hi) / 2); c++; seq.push(arr[m]); if (arr[m] === target) break; if (target < arr[m]) hi = m - 1; else lo = m + 1; }
    return { q: `How many comparisons does a binary search need to find ${target}? (middle = (low + high) ÷ 2, rounded down)`, c: JSON.stringify(arr).replace(/,/g, ", "), a: String(c), w: near(c, 2, [arr.indexOf(target) + 1]), t: true, e: "Values checked: " + seq.join(" → ") };
  });

  /* storage units */
  add(["9CS.06"], () => {
    const conv = pick([
      () => { const v = R(2, 16); return [`${v} bytes`, "bits", v * 8, "×8"]; },
      () => { const v = R(2, 12) * 8; return [`${v} bits`, "bytes", v / 8, "÷8"]; },
      () => { const v = R(2, 8); return [`${v} KB`, "bytes", v * 1024, "×1024"]; },
      () => { const v = R(2, 9); return [`${v} MB`, "KB", v * 1024, "×1024"]; },
      () => { const v = R(2, 6); return [`${v} GB`, "MB", v * 1024, "×1024"]; },
      () => { const v = R(2, 5); return [`${v} TB`, "GB", v * 1024, "×1024"]; },
      () => { const v = R(2, 8); return [`${v * 1024} MB`, "GB", v, "÷1024"]; },
      () => { const v = R(2, 8); return [`${v * 1024} KB`, "MB", v, "÷1024"]; },
      () => { const v = R(2, 6); return [`${v} nibbles`, "bits", v * 4, "×4"]; }
    ])();
    const [from, to, ans, how] = conv;
    const wr = [ans * 2, Math.round(ans / 2), String(from).includes("bit") || to === "bits" ? ans + 8 : ans * 1000 / 1024 | 0].filter(v => v !== ans && v > 0);
    return { q: `Convert ${from} into ${to}.`, a: String(ans), w: near(ans, 3, wr), t: true, e: `${from} ${how} = ${ans} ${to}` };
  });

  /* sound samples */
  add(["9CS.05"], () => {
    const rate = pick([1000, 2000, 4000, 8000, 500]), secs = R(2, 10);
    if (Math.random() < 0.5) {
      const ans = rate * secs;
      return { q: `A sound is sampled at ${rate} Hz for ${secs} seconds. How many samples are taken?`, a: String(ans), w: [String(rate + secs), String(rate * (secs + 1)), String(rate * secs * 8)], t: true, e: `samples = sample rate × seconds = ${rate} × ${secs}` };
    }
    const bits = pick([8, 16]); const ansBits = rate * secs * bits; const ans = ansBits / 8;
    return { q: `A ${secs}-second recording uses a sample rate of ${rate} Hz and a bit depth of ${bits} bits. What is the file size in BYTES?`, a: String(ans), w: [String(ansBits), String(ans * 2), String(ans + rate)].filter(x => x !== String(ans)), t: true, e: `${rate} × ${bits} × ${secs} = ${ansBits} bits ÷ 8 = ${ans} bytes` };
  });

  /* logic */
  add(["9CS.07"], () => {
    const A = R(0, 1), B = R(0, 1), C = R(0, 1);
    const exprs = [
      ["A AND B", A & B, false], ["A OR B", A | B, false], ["NOT A", 1 - A, false],
      ["(A AND B) OR C", (A & B) | C, true], ["(A OR B) AND C", (A | B) & C, true],
      ["NOT (A AND B)", 1 - (A & B), false], ["NOT (A OR B)", 1 - (A | B), false],
      ["(A AND B) OR NOT C", (A & B) | (1 - C), true], ["A AND NOT B", A & (1 - B), false]
    ];
    const [ex, out, useC] = pick(exprs);
    if (Math.random() < 0.25) {
      // which gate gives final output
      const fin = ex.startsWith("NOT (") ? "NOT" : ex.includes(") OR") ? "OR" : ex.includes(") AND") ? "AND" : ex.includes("AND NOT") ? "AND" : ex.split(" ")[1] || "NOT";
      if (["AND", "OR", "NOT"].includes(fin)) return { q: `In a logic circuit for Q = ${ex}, which gate produces the final output Q?`, a: fin, w: ["AND", "OR", "NOT", "XOR"].filter(g => g !== fin).slice(0, 3), t: true };
    }
    const ins = `A = ${A}, B = ${B}` + (useC ? `, C = ${C}` : "");
    return { q: `Q = ${ex}. What is Q when ${ins}?`, a: String(out), w: [String(1 - out), "2", "It cannot be worked out"], t: true };
  });

  /* parity 1D */
  add(["9DC.04"], () => {
    const bits = Array.from({ length: 7 }, () => R(0, 1)); const ones = bits.reduce((a, b) => a + b, 0);
    const type = pick(["even", "odd"]);
    if (Math.random() < 0.5) {
      const p = type === "even" ? ones % 2 : 1 - ones % 2;
      return { q: `Using ${type.toUpperCase()} parity, what parity bit should be added to ${bits.join("")}?`, a: String(p), w: [String(1 - p), String(ones), "8"].filter(x => x !== String(p)), t: true, e: `The data has ${ones} ones. With ${type} parity the total must be ${type}.` };
    }
    const byte = [R(0, 1)].concat(bits); const tot = byte.reduce((a, b) => a + b, 0);
    const ok = type === "even" ? tot % 2 === 0 : tot % 2 === 1;
    return { q: `${type.toUpperCase()} parity is being used. The byte ${byte.join("")} is received. What should the receiver decide?`, a: ok ? "No error detected" : "An error has occurred", w: [ok ? "An error has occurred" : "No error detected", "The parity bit is missing", "Change to the other parity"], e: `It has ${tot} ones, which is ${tot % 2 ? "odd" : "even"}.` };
  });

  /* parity 2D */
  add(["9DC.04"], () => {
    const rows = 3, cols = 4; const g = [];
    for (let r = 0; r < rows; r++) { const row = Array.from({ length: cols }, () => R(0, 1)); row.push(row.reduce((a, b) => a + b, 0) % 2); g.push(row); }
    const pr = []; for (let c = 0; c <= cols; c++) pr.push(g.reduce((a, row) => a + row[c], 0) % 2); g.push(pr);
    const er = R(0, rows - 1), ec = R(0, cols - 1); g[er][ec] ^= 1;
    let h = '<table class="tbl mono"><tr><th></th>' + [...Array(cols).keys()].map(c => `<th>C${c + 1}</th>`).join("") + "<th>Parity</th></tr>";
    g.forEach((row, r) => { h += `<tr><th>${r < rows ? "Row " + (r + 1) : "Parity"}</th>` + row.map(v => `<td>${v}</td>`).join("") + "</tr>"; });
    h += "</table>";
    const ans = `Row ${er + 1}, C${ec + 1}`; const wr = new Set();
    while (wr.size < 3) { const o = `Row ${R(1, rows)}, C${R(1, cols)}`; if (o !== ans) wr.add(o); }
    return { q: "EVEN parity was used in this 2D parity check. One bit was changed during transmission. Where is the error?", h, a: ans, w: [...wr], e: "Find the row with an odd number of 1s and the column with an odd number of 1s — the error is where they cross." };
  });

  /* spreadsheet functions */
  add(["9MD.02"], () => {
    const vals = Array.from({ length: 5 }, () => R(10, 99));
    const hasText = Math.random() < 0.4; if (hasText) vals[R(0, 4)] = "absent";
    const nums = vals.filter(v => typeof v === "number");
    let h = '<table class="tbl mono"><tr><th></th><th>A</th></tr>' + vals.map((v, i) => `<tr><th>${i + 1}</th><td>${v}</td></tr>`).join("") + "</table>";
    const f = pick(["MAX", "MIN", "COUNT", "IF"]);
    if (f === "MAX") { const a = Math.max(...nums); return { q: "What does =MAX(A1:A5) return?", h, a: String(a), w: [String(Math.min(...nums)), String(nums.length), String(nums.reduce((x, y) => x + y, 0))], t: true }; }
    if (f === "MIN") { const a = Math.min(...nums); return { q: "What does =MIN(A1:A5) return?", h, a: String(a), w: [String(Math.max(...nums)), String(nums.length), "0"], t: true }; }
    if (f === "COUNT") { const a = nums.length; return { q: "What does =COUNT(A1:A5) return?", h, a: String(a), w: near(a, 2, [5, a - 1, a + 1]), t: true, e: "COUNT only counts cells that contain numbers." }; }
    const i = vals.findIndex(v => typeof v === "number"); const lim = R(4, 8) * 10; const a = vals[i] >= lim ? "Pass" : "Fail";
    return { q: `What does =IF(A${i + 1}>=${lim},"Pass","Fail") show?`, h, a, w: [a === "Pass" ? "Fail" : "Pass", String(vals[i]), "TRUE"], t: true };
  });

  /* database query */
  add(["9MD.06", "9MD.07"], () => {
    const clubs = ["Chess", "Robotics", "Art", "Drama"];
    const recs = shuffle(NAMES).slice(0, 7).map(n => ({ n, y: pick([7, 8, 9]), s: R(40, 99), c: pick(clubs) }));
    let h = '<table class="tbl"><tr><th>Name</th><th>Year</th><th>Score</th><th>Club</th></tr>' + recs.map(r => `<tr><td>${r.n}</td><td>${r.y}</td><td>${r.s}</td><td>${r.c}</td></tr>`).join("") + "</table>";
    const yr = pick([7, 8, 9]), lim = R(5, 8) * 10, club = pick(clubs), club2 = pick(clubs.filter(c => c !== club));
    const qs = [
      [`Year = ${yr} AND Score > ${lim}`, r => r.y === yr && r.s > lim],
      [`Year = ${yr} OR Score > ${lim}`, r => r.y === yr || r.s > lim],
      [`Club = "${club}" OR Club = "${club2}"`, r => r.c === club || r.c === club2],
      [`Club = "${club}" AND Score >= ${lim}`, r => r.c === club && r.s >= lim],
      [`Year <> ${yr} AND Score < ${lim}`, r => r.y !== yr && r.s < lim]
    ];
    const [crit, test] = pick(qs); const a = recs.filter(test).length;
    return { q: `How many records match this search?  ${crit}`, h, a: String(a), w: near(a, 2, [a + 1, Math.max(0, a - 1), 7 - a]), t: true, e: "Matching: " + (recs.filter(test).map(r => r.n).join(", ") || "none") };
  });

  /* FDE ordering */
  add(["9CS.09", "9CS.08"], () => {
    const stages = ["Fetch", "Decode", "Execute"]; const i = R(0, 2);
    const nextS = stages[(i + 1) % 3];
    return { q: `In the fetch–decode–execute cycle, which stage comes straight after ${stages[i].toUpperCase()}?`, a: nextS, w: stages.filter(s => s !== nextS).concat(["Store"]).slice(0, 3), t: true };
  });

  window.GENERATORS = G;
  window.QUtil = { R, pick, shuffle };
})();

