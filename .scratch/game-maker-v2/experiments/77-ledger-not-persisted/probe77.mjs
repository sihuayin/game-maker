// 票 77 探针 —— **只读 · 零付费 · 零网络**。本脚本**一个字节都不写盘**（输出只到 stdout）。
//
// 量的是：每一次真跑的**失败现场**上，「人眼前那份账」（壳印出来的）与「盘上真花的那份账」差多少。
//
// 三个读数来源（全部是盘上现成的字节）：
//   ③ 壳实际印出来的 —— <raw>/run-<suffix>.json 的 `.text` **开头那个 JSON 对象**里的 `ledger`
//                      ⚠️ `.text` **不是纯 JSON**：JSON 之后还跟着驱动记的进度行 ⇒ 要从 0 起扫出第一个配平的 `{…}`
//   ① run 级账        —— <run-out>/<gameId>/run/v<N>/ledger.json    （`writeRunLedger` 的产物）
//   ② 包的收据        —— <run-out>/<gameId>/pack/v<N>/ledger.json   （跟包走、被 verify 校验）
//   ④ 失败现场        —— <run-out>/.failed-*（`abandonRun` 改的名）里有哪些文件
import fs from "node:fs";
import path from "node:path";

const HERE = path.dirname(new URL(import.meta.url).pathname);
const RAW = path.resolve(HERE, "../e2e-wasteland/raw");
const exists = (p) => fs.existsSync(p);
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

/** `.text` 是「一个 JSON 对象 + 后面一截进度行」⇒ 从 0 起扫出第一个配平的 `{…}`。 */
function leadingJson(text) {
  if (typeof text !== "string" || text[0] !== "{") return null;
  let depth = 0, inStr = false, esc = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === "\\") esc = true;
      else if (c === '"') inStr = false;
      continue;
    }
    if (c === '"') inStr = true;
    else if (c === "{") depth++;
    else if (c === "}") { depth--; if (depth === 0) { try { return JSON.parse(text.slice(0, i + 1)); } catch { return null; } } }
  }
  return null;
}

const tally = (calls) => { const by = {}; for (const c of calls) by[c.step] = (by[c.step] ?? 0) + 1; return by; };
const render = (by) => (by ? (Object.entries(by).map(([k, v]) => `${k} ${v}`).join(" · ") || "（空）") : "—");

const U_STEPS = ["visual-world", "intent", "design", "character-dna", "recipe"];
const runs = fs.readdirSync(RAW).filter((n) => /^run-out-/.test(n)).sort();

const rows = [];
for (const runOut of runs) {
  const suffix = runOut.replace(/^run-out-/, "");
  const base = path.join(RAW, runOut);
  const repPath = path.join(RAW, `run-${suffix}.json`);
  const rep = exists(repPath) ? readJson(repPath) : null;
  const inner = rep ? leadingJson(rep.text) : null;

  const shown = inner && Array.isArray(inner.ledger) ? inner.ledger : (inner ? [] : null);
  const steps = rep && Array.isArray(rep.steps) ? rep.steps.map((s) => s.trim().replace(/^·\s*/, "")) : [];
  const lastStep = steps.length ? steps[steps.length - 1] : "—";

  const dirsIn = (d) => (exists(d) ? fs.readdirSync(d, { withFileTypes: true }).filter((x) => x.isDirectory()).map((x) => x.name) : []);
  const failedHere = dirsIn(base).filter((n) => n.startsWith(".failed-"));
  const gameIds = dirsIn(base).filter((n) => !n.startsWith("."));

  const row = {
    runOut, suffix, code: rep?.code ?? null, ms: rep?.ms ?? null, lastStep, steps,
    shownN: shown === null ? null : shown.length,
    shownBy: shown === null ? null : tally(shown),
    hasLedgerKey: inner ? "ledger" in inner : null,
    failedHere, scenes: [], gameIds: [],
  };
  for (const f of failedHere) row.scenes.push({ name: f, files: fs.readdirSync(path.join(base, f)).sort() });

  const findLedger = (root, kind) => {
    const kd = path.join(root, kind);
    if (!exists(kd)) return null;
    for (const v of fs.readdirSync(kd).sort()) { const p = path.join(kd, v, "ledger.json"); if (exists(p)) return p; }
    return null;
  };
  for (const gameId of gameIds) {
    const rd = path.join(base, gameId);
    const runL = findLedger(rd, "run"), packL = findLedger(rd, "pack");
    const runCalls = runL ? readJson(runL).calls ?? [] : null;
    const packCalls = packL ? readJson(packL).calls ?? [] : null;
    row.gameIds.push({
      gameId,
      runN: runCalls ? runCalls.length : null, runBy: runCalls ? tally(runCalls) : null,
      packN: packCalls ? packCalls.length : null, packBy: packCalls ? tally(packCalls) : null,
      packImgs: packCalls ? packCalls.filter((c) => c.step === "image" || c.step === "master").length : null,
      _runCalls: runCalls ?? [], _packCalls: packCalls ?? [],
    });
  }
  rows.push(row);
}

console.log("票 77 探针 · 失败现场上的账 —— 壳印出来的 vs 盘上真花的");
console.log(`读点：${RAW}`);
console.log(`跑数：${rows.length}\n`);

console.log("════════ 逐跑 ════════\n");
for (const r of rows) {
  console.log(`── ${r.runOut}   exit ${r.code ?? "?"} · ${r.ms ?? "?"}ms · 进度停在「${r.lastStep}」`);
  console.log(`   ③ 壳印的账        : ${r.shownN === null ? "（没有 --json 输出）" : r.hasLedgerKey ? `${r.shownN} 行  ${render(r.shownBy)}` : "**连 `ledger` 这个键都没有**"}`);
  for (const g of r.gameIds) {
    console.log(`   ① run 级账 [${g.gameId}] : ${g.runN === null ? "（没有这份文件）" : `${g.runN} 行  ${render(g.runBy)}`}`);
    console.log(`   ② 包的账   [${g.gameId}] : ${g.packN === null ? "（没有这份文件）" : `${g.packN} 行  ${render(g.packBy)}`}`);
    if (g.packN !== null) console.log(`   ⭐ 这一跑真买的图       : ${g.packImgs} 张（master + image）`);
  }
  for (const s of r.scenes) console.log(`   🗂 失败现场 ${s.name}/ : ${s.files.join(" · ") || "（空）"}`);
  console.log("");
}

console.log("════════ A · 真值**在盘上**的失败（段 B / 站点段）════════\n");
console.log("⚠️ **「盘上」= run 级账 ∪ 包的账（按行**去重**）** —— 两份账**口径不同、且会重叠**：");
console.log("   run 级那份是「链级并集」（段 A ∪ 段 B），包那份是段 B 的一部分 ⇒ **相加就是重复计数**。");
console.log("   而去重之后还差的那一行，是**只挂在异常上、两份账里都没有**的那一发（见下）。\n");
for (const r of rows.filter((x) => x.code !== 0 && x.gameIds.length)) {
  const uniq = new Set();
  for (const g of r.gameIds) for (const c of g._runCalls) uniq.add(JSON.stringify(c));
  for (const g of r.gameIds) for (const c of g._packCalls) uniq.add(JSON.stringify(c));
  const override = r.gameIds.some((g) => g.packImgs !== null);
  if (!override) continue;
  const imgs = r.gameIds.reduce((a, g) => a + (g.packImgs ?? 0), 0);
  // 只挂在异常上、而两份账里都没有的那一发
  const onlyOnError = (r.shownBy ? Object.keys(r.shownBy) : []).filter(
    (s) => ![...uniq].some((j) => JSON.parse(j).step === s));
  const truth = uniq.size + onlyOnError.length;
  const shownN = r.shownN ?? 0;
  console.log(`${shownN < truth ? "⚠️ 少报" : "✅ 齐"}  ${r.runOut.padEnd(22)} 壳印 ${String(shownN).padStart(2)} 行  vs  这一跑真花 ${String(truth).padStart(2)} 行  ⇒ 差 ${String(truth - shownN).padStart(2)}   （真买的图 ${imgs} 张）`);
  console.log(`        盘上两份账去重后 ${uniq.size} 行${onlyOnError.length ? ` · 外加**只挂在异常上、两边都没写**的 ${onlyOnError.join(" · ")} ${onlyOnError.length} 行` : ""}`);
  if (r.gameIds.some((g) => g.runN !== null) && r.gameIds.some((g) => g.packN !== null))
    console.log(`        ⚠️ 而 run 级那份账自己也**不全**：段 B 自己那一段只在**成功**时才写进去（13e 那份只有段 A 的 5 行）`);
}
console.log("");

console.log("════════ B · 真值**不在盘上**的失败（段 A · 理解层）════════\n");
console.log("（段 A 的 run 级账只在**成功**时写（create-game.ts:314）⇒ 它一失败，连那份文件都没有；");
console.log("  失败现场里也没有账。⇒ 「前面那几步跑过没有」只剩**进度行**这一个记录 —— 而进度行**不是账**。）\n");
for (const r of rows.filter((x) => x.code !== 0 && !x.gameIds.length)) {
  const announced = U_STEPS.filter((s) => r.steps.includes(s));
  const printed = r.shownN;
  console.log(`${r.runOut.padEnd(22)} 死在「${r.lastStep}」`);
  console.log(`     进度行宣告跑过 : ${announced.length}/5  → ${announced.join(" · ")}`);
  console.log(`     壳印出来的账   : ${printed === null ? "（没有 --json 输出）" : `${printed} 行`}${printed === null ? "" : `   ⇒ 与进度行差 ${announced.length - printed} 行（每行 = 一个**付过钱**的步骤）`}`);
  console.log("");
}

console.log("════════ C · 不是失败的那种（exit 0 · 检查点停）════════\n");
for (const r of rows.filter((x) => x.code === 0)) {
  console.log(`${r.runOut.padEnd(22)} exit 0（\`create\` 在清单检查点停）· 壳印 ${r.shownN === null ? "—" : r.shownN + " 行"}${r.hasLedgerKey === false ? "（没有 ledger 键 —— 成功路径本来就没有）" : ""}  · run 级账 ${r.gameIds.map((g) => g.runN ?? "—").join("/")} 行`);
}
