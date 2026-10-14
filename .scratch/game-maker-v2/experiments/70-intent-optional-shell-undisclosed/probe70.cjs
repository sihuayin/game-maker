#!/usr/bin/env node
/**
 * 票 70 探针：意图层 gate ④（`progression` / `challenge` **出现了但两端都空**）
 * 散文**一个字没说** —— 而契约文件头正声称「这条规矩由 `prompts.ts` 补」。
 *
 * **为什么要有它**：票面说「那句自白对 ① ② ③ ⑤ ⑤b ⑤c 成立、对 ④ 不成立」。
 * 本探针做四件事：
 *   ① 把 superRefine 的**七组逐组列出来**，一组一组去两份散文里找对家
 *      —— 因为「散文漏了一句」与「七组里漏了一组」是两种不同的事；
 *   ② 把 gate ④ 的射程**喂真契约**量一遍（缺席 / 半个 / 空壳 / 空串 / 空白串）；
 *   ③ 量**模型那一侧到底看得见什么**：`toolInputSchema` 吐出来的那份 schema 里有没有这条规矩，
 *      以及七组里**哪几组本来就能用 JSON Schema 表达**（表达得出来的不需要散文补）；
 *   ④ 量链上的后果（`analyze-intent.ts` 的三发盲重采样 + 退 4）。
 *
 * **免费**：只 `require` 已构建的 `packages/<包>/dist` + 读盘上**真的** run 产物 + 读源码文本。
 * 不碰网络、不跑管线、零付费、源码一个字节没动。
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../../../..");
const C = require(path.join(ROOT, "packages/contracts/dist/index.js"));
const G = require(path.join(ROOT, "packages/game-design/dist/index.js"));

const P = (...p) => path.join(ROOT, ...p);
const load = (p) => JSON.parse(fs.readFileSync(P(p), "utf8"));
const S = (p) => fs.readFileSync(P(p), "utf8").split("\n");
const line = (s) => console.log(s);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n) + `…（共 ${String(s).length} 字）` : String(s));
const findLine = (lines, needle) => lines.findIndex((l) => l.includes(needle)) + 1;
const has = (hay, needle) => String(hay).includes(needle);

const gi = S("packages/contracts/src/game-intent.ts");
const pr = S("packages/game-design/src/prompts.ts");
const TOOL = G.TOOL_DESCRIPTION;
const PROMPT = G.intentPrompt({ requirementText: "（探针占位）做一个废土横版寻宝游戏" });

// ── ⓪ 两处原话 ─────────────────────────────────────────────────────────────
line("=== ⓪ 两处原话：gate ④ 与契约那句自白 ===");
const g4 = findLine(gi, "// ④ 可选对象**若出现**");
line(`  gate  packages/contracts/src/game-intent.ts:${g4}-${g4 + 5}`);
for (let i = g4 - 1; i <= g4 + 5; i++) line(`      ${gi[i].trim()}`);
line(`  字段  game-intent.ts:${findLine(gi, "progression: z")}-${findLine(gi, "progression: z") + 2}`);
for (let i = findLine(gi, "progression: z") - 1; i <= findLine(gi, "progression: z") + 2; i++) line(`      ${gi[i].trim()}`);
line("  ⇒ ⚠️ `type` 与 `description` **都是 `optional`**，而那个对象**自己也是 `optional`** ⇒ `{}` 过 Zod、被 gate 拒。");

const cl = findLine(gi, "而「让模型知道有这条规矩」那件事，");
line(`\n  自白  game-intent.ts:${cl - 2}-${cl}`);
for (let i = cl - 2; i <= cl; i++) line(`      ${gi[i].trim()}`);

// ── ① ⭐ 七组逐组对账 ──────────────────────────────────────────────────────
line("\n=== ① ⭐ 七组 gate 逐组去散文里找对家 ===");
const GROUPS = [
  ["①", "必填**字符串**非空", ["必填的字符串字段都得有内容"]],
  ["②", "数组元素 / `entities[].role` 非空串", ["数组里也不许留空串占位"]],
  ["③", "`coreLoopSteps`/`player.goals`/`mechanics` **至少一条**", ["至少一条"]],
  ["④", "**`progression`/`challenge` 出现即不得两端皆空**", ["空壳", "两个都空", "两端都空", "都空", "出现了就", "要么整个省掉、要么给一句"]],
  ["⑤", "各数组**内部** id 不重复", ["不许重复"]],
  ["⑤b", "**跨数组** id 不重复", ["两张表之间"]],
  ["⑤c", "`entities[].id` 不得写成「这一类」", ["不是「这一类」"]],
];
line("  组 | 规矩 | 工具说明里 | 骨架台账里 | 命中的那几句");
for (const [id, what, needles] of GROUPS) {
  const inTool = needles.filter((n) => has(TOOL, n));
  const inPrompt = needles.filter((n) => has(PROMPT, n));
  const hits = [...new Set([...inTool, ...inPrompt])];
  line(`  ${id.padEnd(3)}| ${what} | ${inTool.length > 0 ? "✅" : "❌ 没有"} | ${inPrompt.length > 0 ? "✅" : "❌ 没有"} | ${hits.length ? hits.map((h) => `"${h}"`).join(" · ") : "——"}`);
}
line("  ⇒ ⚠️ **七组里只有 ④ 是两栏全 ❌** —— 票面「那句自白对 ① ② ③ ⑤ ⑤b ⑤c 成立、对 ④ 不成立」**成立**。");
line(`  ⇒ 而且 \`progression\` / \`challenge\` **这两个词在工具说明里一次都不出现**：${!has(TOOL, "progression") && !has(TOOL, "challenge") ? "确认 ✅" : "⚠️ 出现了"}`);

line("\n  ── 这两格在**台账**（骨架）里长什么样 —— 票 54 的教训是「台账才把模型推上错路」");
for (const k of ["progression", "challenge"]) {
  const l = findLine(pr, `  ${k}: "`);
  line(`      prompts.ts:${l}  ${pr[l - 1].trim()}`);
}
line("  ⇒ 「需求提了才填，给一句就够；**推不出就整个省掉**」—— 它说的是**什么时候填**、**填多少**，");
line("     而 gate ④ 判的是**填了就必须有内容**（`{type:\"\",description:\"\"}` 与 `{}` 同罪）⇒ 两件事不是一句。");

// ── ② gate ④ 的射程：喂真契约 ─────────────────────────────────────────────
line("\n=== ② gate ④ 的射程：各种写法各喂一次真契约 ===");
const intentFiles = [];
(function walk(d) {
  let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = path.join(d, x.name);
    if (x.isDirectory()) { if (x.name !== "node_modules") walk(p); }
    else if (x.name === "game-intent.json") intentFiles.push(p); }
})(path.join(ROOT, ".scratch"));
const parsed = intentFiles.map((f) => ({ f, doc: JSON.parse(fs.readFileSync(f, "utf8")) }));
const ok = parsed.filter((x) => C.GameIntentSpecSchema.safeParse(x.doc).success);
line(`  ⚠️ 底稿必须是一份**今天过得了 gate 的**真意图 —— 盘上 ${parsed.length} 份里只有 **${ok.length}** 份过得了`);
line(`     （其余 ${parsed.length - ok.length} 份撞的是**别的**组：票 52 / 54 那两条 gate 是后加的，旧产物没跟着变）`);
const stillFail = parsed.filter((x) => !ok.includes(x));
for (const x of stillFail.slice(0, 4)) {
  const r = C.GameIntentSpecSchema.safeParse(x.doc);
  line(`       · ${path.relative(ROOT, x.f).replace(".scratch/game-maker-v2/", "")} ⇒ ${r.error.issues[0].path.join(".")}`);
}
const BASE = (ok[0] ?? { f: "（兜底）", doc: {
  format: C.GAME_INTENT_FORMAT, genre: "platformer", targetExperience: "孤独但一直向上",
  coreLoopSteps: ["探索废墟"], player: { role: "拾荒者", goals: ["在天黑前抵达"] },
  world: { theme: "废土", setting: "铁轨旁的废墟", atmosphere: "黄昏，尘土悬浮" },
  mechanics: [{ id: "m-jump", name: "跳跃" }],
  entities: [{ id: "e-drone", type: "enemy", role: "沿固定路线巡逻的无人机" }],
  winConditions: ["抵达终点"], loseConditions: [], ambiguity: []
} }).doc;
const baseRel = path.relative(ROOT, ok[0] ? ok[0].f : "（兜底 fixture）").replace(".scratch/game-maker-v2/", "");
line(`  底稿 = ${baseRel}`);
line(`     ⚠️ 它住在一个 \`.failed-…\` 目录里 —— 那是**整跑**都被挪进去的目录（里面 game-design / vws / dna 全在，`);
line("        只少了样式那一格之外的后续），⇒ 它过得了今天的 gate，只是因为**它那一跑的理解层写得干净**，");
line("        与「这一跑后来失败了」无关。");
line(`     它的 \`progression\` / \`challenge\` = ${JSON.stringify(BASE.progression)} / ${JSON.stringify(BASE.challenge)}`);
const CASES = [
  ["整个省掉", undefined],
  ["填满", { type: "未知", description: "需求只提到有最终目标" }],
  ["只给 type", { type: "线性" }],
  ["只给 description", { description: "跳跃时机" }],
  ["空对象 `{}`", {}],
  ["`type: \"\"`", { type: "" }],
  ["`description: \"\"`", { description: "" }],
  ["`description: \"  \"`（全空白）", { description: "  " }],
  ["两头都是空串", { type: "", description: "" }],
];
for (const [label, v] of CASES) {
  const doc = { ...BASE };
  if (v === undefined) { delete doc.progression; } else { doc.progression = v; }
  const r = C.GameIntentSpecSchema.safeParse(doc);
  const first = r.success ? undefined : r.error.issues.find((i) => i.path[0] === "progression");
  line(`  ${r.success ? "✅ 放行" : "❌ 拒  "} ${label.padEnd(26)}` +
    (r.success ? "" : `  path=${JSON.stringify(first ? first.path : r.error.issues[0].path)}  ${first ? cut(first.message, 90) : cut(r.error.issues[0].message, 90)}`));
}
line("  ⇒ ⚠️ 边界很清楚：**整个省掉合法**、**只给一半合法**、**两端皆空（含全空白）不合法**。");
line("     而这三种里，散文今天只说清了**前两种**（「推不出就整个省掉」/「给一句就够」）。");

// ── ③ ⭐ 模型那一侧看得见什么 ──────────────────────────────────────────────
line("\n=== ③ ⭐ 模型那一侧到底看得见什么 ===");
const js = C.toolInputSchema(C.GameIntentSpecSchema);
const props = js.properties ?? js;
const prog = props.progression;
line("  ── (a) 工具 schema（`toolInputSchema` 吐出来的那份）里 `progression` 那一段：");
line(`      ${JSON.stringify(prog)}`);
line(`  ⇒ 有没有「两端皆空不许」的任何痕迹？`);
for (const k of ["minProperties", "required", "anyOf", "allOf", "最小"]) {
  line(`       · 含 \`${k}\`：${has(JSON.stringify(prog), k)}`);
}
const whole = JSON.stringify(js);
line(`  ⇒ 整份模型面向的 schema 里出现「空壳 / 两个都空 / 省掉」的字样：` +
  `${["空壳", "都空", "省掉", "出现了就"].filter((w) => has(whole, w)).length === 0 ? "**一次都没有** ⚠️" : "有（见上）"}`);
line("  ⇒ 这正是文件头那句「`toJSONSchema` 会**静默丢掉** `superRefine`」的**当场复现**：");
line("     一条真的判据（② 里 ❌ 拒过）在模型面向的那份 schema 里**一个字都没留下**。");

line("\n  ── (b) 七组里，**哪几组本来能用 JSON Schema 表达**（表达得出来的不必靠散文）：");
line(`       · \`coreLoopSteps\` 的字段定义：\`${gi[findLine(gi, "  coreLoopSteps: z.array(z.string()),") - 1].trim()}\``);
line("         ⇒ **没有 `.min(1)`** ⇒ ③ 也表达不出来（它同样只住在 `superRefine` 里）");
line(`       · \`progression\` / \`challenge\` 的 schema：\`${jsonish(gi, "progression")}\``);
line("         ⇒ 没有任何一个字段是 `required` ⇒ ④ 也表达不出来");
line("  ⇒ ⭐ **七组全都表达不出来** ⇒ 它们**全都**只能靠 `TOOL_DESCRIPTION` 那一句 ——");
line("     除了 ④ **一个字都没有**。");

// ── ④ 链上的后果 ──────────────────────────────────────────────────────────
line("\n=== ④ 链上的后果：撞上 ④ 会怎样 ===");
const ai = S("packages/game-design/src/analyze-intent.ts");
const loopAt = findLine(ai, "for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS");
line(`  analyze-intent.ts:${loopAt}  ${ai[loopAt - 1].trim()}`);
for (let i = loopAt; i <= loopAt + 4; i++) line(`      ${ai[i].trim()}`);
const sameDist = findLine(ai, "重采样是重抽同一个分布");
line(`\n  ⚠️ 而文件自己写着（:${sameDist}）：`);
for (let i = sameDist - 1; i <= sameDist; i++) line(`      ${ai[i].trim()}`);
line("  ⇒ 撞上 ④ 的后果与别组一样：**3 发盲重采样**（同一个 body、不喂回理由）⇒ 全败 ⇒");
line("     抛 `failure: \"schema\"` ⇒ **退 4**；而这一步**没有拒绝面**（不存在「R12 那种拒绝」）。");
line("  ⚠️ 于是 ④ 与别组唯一的区别是：**别组至少有一句话告诉模型有这条规矩**（① 那一列 ✅），④ **没有**。");

// ── ⑤ 盘上真意图普查 ──────────────────────────────────────────────────────
line("\n=== ⑤ 盘上真意图的普查：④ 撞过没有 ===");
const files = intentFiles;
let absent = 0, filled = 0, half = 0, shell = 0;
const rows = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  const cls = ["progression", "challenge"].map((k) => {
    const o = d[k];
    if (o === undefined) { absent++; return `${k}=缺席`; }
    const t = (o.type ?? "").trim(), s = (o.description ?? "").trim();
    if (t === "" && s === "") { shell++; return `${k}=**空壳**`; }
    if (t === "" || s === "") { half++; return `${k}=半个`; }
    filled++; return `${k}=填满`;
  });
  rows.push(`    · ${path.relative(ROOT, f).replace(".scratch/game-maker-v2/", "")}  ${cls.join(" · ")}`);
  if (f.includes("wasteland-scavenger-run")) rows[rows.length - 1] += `   ⚠️ 唯一那份两份都填满的：${JSON.stringify(d.progression)} / ${JSON.stringify(d.challenge)}`;
}
for (const r of rows) line(r);
line(`  ⇒ ${files.length} 份意图 · ${absent} 处缺席 · ${filled} 处填满 · ${half} 处半个 · **${shell} 处空壳**`);
line("  ⇒ ⭐ 模型实测的行为是「**要么全给、要么全省**」—— 正是 gate ④ 要的那个二选一；");
line("     ⚠️ 而「半个」（只给 `type` 或只给 `description`）也是**合法**的（② 里 ✅ 放行），盘上 0 处 —— 没人走过那条路。");
line("  ⇒ ⚠️ 这份普查**可比**：这两格的台账文字自**票 08**（`efc9511`）写下之后**一个字没改过**");
line("     （`git log -L 147,148:packages/game-design/src/prompts.ts` 只有那一个提交）");
line("     ⇒ 13 份产物是**在同一句提示词下**写出来的 ⇒ 0 处空壳这个读数没有版本错位。");
line("  ⇒ ⚠️ 但 13 份里只有 1 份过得了**今天**的 schema（②）—— 那 12 份撞的是**后加**的 ⑤b/⑤c");
line("     ⇒ 「0 处空壳」这句成立，而「13 份都还是今天的合法产物」**不成立**（别拿它当反例库）。");

// ── ⑥ 代价：改那句话要动什么 + 先例落在哪个面 ──────────────────────────────
line("\n=== ⑥ 代价：那句话住哪、改了要动什么 ===");
const pt = S("packages/game-design/tests/prompts.test.ts");
const itemTests = pt.filter((l) => l.trim().startsWith('it("')).length;
line(`  · 工具说明有**一条一测**（\`prompts.test.ts\` 里 ${itemTests} 条 \`it\`，每条钉一句原话）⇒ 加一句 = 加一条测（且**旧测一条都不用改**）`);
line(`  · 骨架（台账）那边有一条**结构判据**（\`prompts.test.ts:24\` 起：契约每个键都要点名、且不许多个名字）⇒ 改台账文字**不影响**它`);
line("  · ⚠️ 先例：⑤b（票 54）落成**两个面都写**（工具说明第 6 条 + 台账 `entities` 那句「这里的 `id` 与 `mechanics[].id` 不许撞」）；");
line(`     而 ⑤c（票 52）只落在**工具说明第 7 条**（台账 \`entities\` 那句里没有它）。`);
line(`     ⇒ 两个先例**不统一** ⇒ 「④ 该写哪」是一个**真问题**，不是照抄惯例就够了。`);

// ── ⑦ Q3 的不对称：全空白串 ───────────────────────────────────────────────
line("\n=== ⑦ Q3：`\"  \"`（全空白）那一档，三层判据 / 三层散文各写了没有 ===");
line(`  · 三层的 \`blank()\` **都是同一个写法**（` + "`(s ?? \"\").trim() === \"\"`" + `）：`);
for (const [pkg, f] of [["意图层", "game-intent.ts"], ["设计层", "game-design.ts"], ["DNA 层", "character-dna.ts"]]) {
  const l = findLine(S(`packages/contracts/src/${f}`), "const blank = ");
  line(`     · ${pkg}  contracts/src/${f}:${l}  ⇒ **trim ⇒ 全空白串 = 空串**`);
}
line("  ⇒ ⚠️ 三层的**判据**都拦 `\"  \"`；那么三层的**散文**说了没有？");
const whitespaceSites = [];
pr.forEach((l, i) => { if (l.includes('"  "')) whitespaceSites.push(i + 1); });
line(`  · 全 \`prompts.ts\` 里出现 \`"  "\`（全空白串）的**行号**：${JSON.stringify(whitespaceSites)}`);
for (const n of whitespaceSites) line(`     · :${n}  ${cut(pr[n - 1].trim(), 110)}`);
line(`  ⇒ ⭐ 三层的**判据都拦**，而三层的**散文里只有 DNA 层**把这档写出来了（那两行都在 DNA 层的工具说明 / 台账里）；`);
line("     **意图层与设计层一个字都没提** —— 而它们的 `blank()` 一样是 trim 的。");
line(`  · 意图层那一条（:${findLine(pr, "不许有空串")}）：${cut(pr[findLine(pr, "不许有空串") - 1].trim(), 110)}`);
line("     ⇒ 它说的是「不许有**空串**」—— 读者推不出「全空白也算空」这一层。");

// ── ⑦′ ⭐ 同名不同命的镜像：设计层的 `progression` ─────────────────────────
line("\n  ── ⑦′ ⭐ 同一个词 `progression`，**隔壁设计层**是另一个人设：");
const dg = S("packages/contracts/src/game-design.ts");
const dgProg = findLine(dg, "  progression: z.strictObject");
line(`     · 字段  game-design.ts:${dgProg}  \`${dg[dgProg - 1].trim()}\``);
line(`       ⇒ **两个键都必填**（没有 \`.optional()\`）—— 而意图层那两个键**都是 \`optional\`**（⓪）`);
const dgGate = findLine(dg, '["progression.model", v.progression.model]');
line(`     · 判据  game-design.ts:${dgGate}  \`${dg[dgGate - 1].trim()}\` / \`${dg[dgGate].trim()}\`  ⇒ 走的是 ①（**必填字符串非空**）`);
const dgProse = findLine(pr, "必填字符串（");
line("     · 散文  设计层工具说明第 1 条**点名了 `progression.*`**：");
line(`         :${dgProse}  ${cut(pr[dgProse - 1].trim(), 110)}`);
line(`         :${dgProse + 1}  ${cut(pr[dgProse].trim(), 110)}`);
line("     ⇒ ⭐⭐ 一句话：**设计层的 `progression` 是必填、必非空、判据 + 散文两半都在；");
line("        意图层的 `progression` 是可选、只禁「两头皆空」、散文说零句。**");
line("        ⚠️ 而模型在**同一条链上前后两次调用**里都会看到这个名字 —— 两个规矩，只有一边写了出来。");

// ── ⑧ 先例：票 54 的四件套 ────────────────────────────────────────────────
line("\n=== ⑧ 先例（票 54 的 Q2）：同一类「把后果说清」当时落成的形状 ===");
line("  ① 会发生什么（**整份判失败**）· ② 退出码（**4**）· ③ 链停在哪（**断在理解层、买图之前**）· ④ **点名**是谁的问题");
line("  ⇒ 本票若照它写，那句话的形状是现成的；⚠️ 而 ④ 的主语与别组不同：");
line("     别组的主语是「你写了一个空值」，④ 的主语是「**你决定了这个系统存在，却没说它是什么**」。");

// ── ⑨ 总结 ────────────────────────────────────────────────────────────────
line("\n=== ⑨ 这一轮量到的六件票面没写的事 ===");
line("  ① **七组逐组对完账**（①）：只有 ④ 两栏全 ❌ —— 票面那句判断**成立**，");
line("     而且 `progression` / `challenge` **这两个词在工具说明里一次都不出现**；");
line("  ② **七组**本来就都表达不出来（③b）⇒ 散文不是「补充」，是**它们唯一的家** ⇒ ④ 等于**没有家**；");
line("  ③ gate ④ 的射程比散文宽一格（②）：**`{type:\"\"}` / `{description:\"  \"}` 也拒**，");
line("     而散文只说了「省掉合法 / 给一句就够」——**唯独没说「给了就不能空」**；");
line("  ④ **两个先例不统一**（⑥）：⑤b 落在两个面、⑤c 只落工具说明 ⇒ 「写哪」是真问题；");
line("  ⑤ **那份 13 份的普查，底料是旧的**（②⑤）：只有 **1/13** 过得了**今天**的 schema（其余撞的是后加的 ⑤b/⑤c）");
line("     —— ⭐ 但「0 处空壳」这句**仍然可比**：这两格的台账文字自票 08 起一个字没改过；");
line("  ⑥ ⭐⭐ **同名不同命**（⑦′）：设计层也有一个 `progression`，那边是**必填 + 判据 + 散文点名**；");
line("     意图层的 `progression` 是**可选 + 只禁两头皆空 + 散文零句** —— 而模型前后两次调用都会看到这个词。");

function jsonish(lines, key) {
  const i = findLine(lines, `  ${key}: z`);
  return lines.slice(i - 1, i + 4).map((l) => l.trim()).join(" ").replace(/\s+/g, " ").slice(0, 200);
}

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 补量（2026-10-14 · 同日第二轮 · 只读 / 假 fetch / 零付费 · 源码一个字节没动）
//
//   第一轮量的是**缺口**：七组逐组对账（①）· gate ④ 的射程（②）· 模型看得见什么（③）·
//   链上的后果（④）· 盘上普查（⑤）· 代价与先例（⑥）。
//   补的四行量的是缺口**之外**的事 —— **贵不贵**（⑨ · ⭐ 拿假 `fetch` 驱动**真的** `analyzeIntent`）·
//   **看不见的是哪一半**（⑩）· **那句话的规格实物长什么样、谁看着它**（⑪）·
//   **那句自白在仓库里有几份副本**（⑫）。
//
//   ⚠️ 本节的行号 **⑨–⑫ 是补量的四行读数**；上面那个「=== ⑨ 这一轮量到的… ===" 是第一轮的
//      **收尾标题**、不是读数编号（两处数字撞了，读的时候按「总结」两个字认）。
// ⚠️ 这一段包一层作用域：`.cjs` 的顶层全是同一张 const 表，重名会当场炸。
(async () => {
  const P70 = (input) => ({
    stop_reason: "tool_use", model: "deepseek-flash",
    content: [{ type: "tool_use", name: G.TOOL_NAME, input }],
    usage: { input_tokens: 2100, output_tokens: 900 },
  });
  const clone = (o) => JSON.parse(JSON.stringify(o));

  // ── ⑨ ⭐ 价签：这道 gate 今天值几发 ────────────────────────────────────────
  line("\n=== ⑨ ⭐ 价签：撞上 gate ④ 今天值几发（假 fetch 驱动**真的** analyzeIntent）===");
  const priceOf = async (label, mutate) => {
    const input = clone(BASE); mutate(input);
    const bodies = [];
    const fetchImpl = async (_url, init) => {
      bodies.push(String(init.body));
      const b = P70(input);
      return { ok: true, status: 200, json: async () => b, text: async () => JSON.stringify(b) };
    };
    let verdict, led = "";
    try {
      const r = await G.analyzeIntent({
        requirementText: "（探针占位）做一个废土横版寻宝游戏",
        transport: { baseUrl: "http://upstream.test", apiKey: "k" }, fetchImpl,
      });
      verdict = "**过了**（`ok`）—— 链往下走";
      if (r.ledger) led = "`attempts=" + r.ledger[0].attempts + "`";
    } catch (e) {
      verdict = "抛 `AnalyzeIntentError` · `failure=\"" + e.failure + "\"`";
      if (e.ledger) led = "`attempts=" + e.ledger[0].attempts + "` · `failures=" + JSON.stringify(e.ledger[0].failures) + "`";
    }
    line("  " + label.padEnd(30) + " ⇒ **" + bodies.length + " 发** · " + verdict + "  " + led);
    return bodies;
  };
  await priceOf("对照（原样）", () => {});
  await priceOf("「半个」（只给 `type`）", (d) => { d.progression = { type: "线性" }; });
  const shellBodies = await priceOf("**空壳 `{}`**（gate ④）", (d) => { d.progression = {}; });
  const otherBodies = await priceOf("别组失败（必填串写成空）", (d) => { d.world.theme = ""; });
  line("  ⚠️ 三发 body **逐字节相同**？" + (otherBodies.length === 3 && otherBodies[0] === otherBodies[1] && otherBodies[1] === otherBodies[2] ? "**是**（盲重采样，不喂回理由）" : "否"));
  line("  ⇒ ⭐⭐ **价签**：撞上 gate ④ **今天就是 3 发**（它是一条**已经在收费**的判据）——");
  line("     而「半个」那样**合法**的写法是 **1 发**。⇒ 补那句散文 = 把 3 发那一支**降回 1 发**的**唯一**手段");
  line("     （这一层**没有拒绝面**（④ 的读数）：三发全败 ⇒ `failure: \"schema\"` ⇒ 退 " + C.EXIT.invalid + "）——");
  line("     ⭐ **方向与票 67 那个角相同**（把贵的那一支变便宜），**与票 69 正好相反**（那边是「花钱买一声响」）。");
  line("     ⚠️ 而「补上之后模型会不会就不写空壳了」这一问**免费证不了**（见 README「证明不了什么」）。");
  const wire = JSON.parse(shellBodies[0]);
  const wireDesc = (wire.tools && wire.tools[0] && wire.tools[0].description) || "";
  line("  ⚠️ 而**真发出去的那份 body** 里：「工具说明」区（" + wireDesc.length + " 字）含 `progression`：" +
    (has(wireDesc, "progression") ? "有" : "**没有**") + " · 含 `challenge`：" + (has(wireDesc, "challenge") ? "有" : "**没有**"));
  line("     而 `messages` 区（提示词骨架 / 台账）含 `progression`：" + (has(JSON.stringify(wire.messages), "progression") ? "**有**" : "没有"));
  line("     ⇒ ⭐ 模型**只在那本台账里见过这个词**（台账正是把它推去写这两个字段的那一份，①′）——");
  line("        而**规矩那一区（工具说明）里，这两个词一次都没出现过**。");

  // ── ⑩ 口径：看不见的是哪一半 ──────────────────────────────────────────────
  line("\n=== ⑩ 口径：gate ④ 的射程里，哪一半是**模型看不见**的 ===");
  const js70 = C.toolInputSchema(C.GameIntentSpecSchema);
  line("  模型面向的那份 schema：顶层 `required` = " + JSON.stringify(js70.required));
  line("     ⚠️ `progression` / `challenge` **都不在里面**（它们是可选的，与 ⓪ 一致）");
  line("     而 `progression` 那一段逐字：`" + JSON.stringify(js70.properties.progression) + "`");
  line("     ⇒ 它**只说得出**「是个对象、两个键都是字符串、不许多键」——**说不出**「两端皆空不许」");
  const SHELL = [
    ["整个省掉", undefined], ["填满", { type: "未知", description: "x" }],
    ["只给 `type`", { type: "线性" }], ["只给 `description`", { description: "x" }],
    ["空对象 `{}`", {}], ["`type: \"\"`", { type: "" }], ["`description: \"\"`", { description: "" }],
    ["`description: \"  \"`", { description: "  " }], ["两端都是 `\"  \"`", { type: "  ", description: "  " }],
    ["⚠️ `type: 123`（类型错）", { type: 123 }], ["⚠️ 多一个键 `{type,description,extra}`", { type: "x", description: "y", extra: 1 }],
  ];
  for (const [label, v] of SHELL) {
    const d = clone(BASE);
    if (v === undefined) delete d.progression; else d.progression = v;
    const r = C.GameIntentSpecSchema.safeParse(d);
    if (r.success) { line("  ✅ **放行**            " + label); continue; }
    const iss = r.error.issues.find((i) => i.path[0] === "progression") || r.error.issues[0];
    const gateOrigin = has(iss.message, "空壳");
    line("  ❌ " + (gateOrigin ? "**gate 拒**（⚠️ 不可见）" : "Zod 拒（可见）  ") + "  " + label.padEnd(34) +
      " `code=" + iss.code + "` `path=" + JSON.stringify(iss.path) + "`");
  }
  const both70 = clone(BASE); both70.progression = {}; both70.challenge = {};
  const rBoth = C.GameIntentSpecSchema.safeParse(both70);
  line("  · 两格**同时**空壳 ⇒ 报 **" + rBoth.error.issues.length + " 条**（各带自己的 `path`）：" +
    rBoth.error.issues.map((i) => JSON.stringify(i.path)).join(" · "));
  const ch70 = clone(BASE); ch70.challenge = { type: "" };
  const rCh = C.GameIntentSpecSchema.safeParse(ch70);
  line("  · `challenge` 单侧空壳 ⇒ " + (rCh.success ? "⚠️ **放行**（不对称！）"
    : "❌ 拒 · `path=" + JSON.stringify(rCh.error.issues[0].path) + "` ⇒ **与 `progression` 完全对称**（换的只是主语）"));
  line("  ⇒ ⭐ **口径是「可见 / 不可见」两级，不是「松 / 紧」两级**：");
  line("     射程里凡是**能用 JSON Schema 表达**的（类型错、多键）都由 **Zod** 拒，而那份 schema");
  line("     **就在模型眼前**（`\"type\":\"string\"` / `\"additionalProperties\":false`）⇒ 模型**读得到**；");
  line("     而**空壳那一整族**（五种写法）**全都**落在 `superRefine` 里 ⇒ 模型面向的 schema 里**一个字都没有**。");
  line("     ⚠️ 所以 ④ 的射程**整段**都在看不见的那一半 —— 这一格没有一个「Zod 自己会说」的替身。");

  // ── ⑪ 规格实物：那句话的落点，与谁看着它 ──────────────────────────────────
  line("\n=== ⑪ 规格实物：`prompts.test.ts` 长什么样、谁看着那句话 ===");
  const pt70 = S("packages/game-design/tests/prompts.test.ts");
  const its70 = [];
  pt70.forEach((l, i) => { if (l.trim().startsWith('it("')) its70.push([i + 1, l.trim()]); });
  line("  `packages/game-design/tests/prompts.test.ts` 共 **" + its70.length + " 条 `it`**（= ⑥ 说的「一条一测」的那个规格）：");
  for (const [n, t] of its70) line("     :" + n + "  " + cut(t, 88));
  line("  ⚠️ 读的时候注意：测试标题里的 `①②③④⑤⑥` 是**工具说明第几条**（票 03/09 的编号），");
  line("     **不是**本票说的「gate 第几组」—— 例如 `it(\"④ `ambiguity` …\")` 讲的是 `ambiguity`，与 gate ④ 无关。");
  const ptText = pt70.join("\n");
  const COVER = [["①", "不许有空串"], ["②", "数组里也不许留空串占位"], ["③", "至少一条"],
    ["④", "空壳"], ["⑤", "不许重复"], ["⑤b", "两张表之间"], ["⑤c", "不是「这一类」"]];
  line("  ── 逐组：那句话在不在工具说明里 × 有没有 `it` 钉着它：");
  for (const [id, needle] of COVER)
    line("     " + id.padEnd(3) + " | 工具说明 " + (has(TOOL, needle) ? "✅" : "❌") +
      " | 测试 " + (has(ptText, needle) ? "✅" : "❌（没有一条 `it` 钉着这句）"));
  line("  ⇒ ⭐ 唯一一条管着「gate 的规矩写在这里」的 `it` 是 **:" + findLine(pt70, "那条 gate 的规矩写在这里") + "** ——");
  line("     它里面钉着四句（「不许有空串」/「至少一条」/「可以是空数组」/「不许重复」），**没有一句是 ④ 的**。");
  line("     ⇒ 若 Q1 裁 (a)：那句话的落点/回归防线**就长这样** —— 在它里面加一行 `expect(TOOL_DESCRIPTION).toContain(…)`，");
  line("        ⚠️ 而**今天没有任何判据会因为那句话被删掉而变红**（⑤ 那一列：④ 是唯一「工具说明 ❌」的组）。");
  const KEYS70 = Object.keys(C.GameIntentSpecSchema.shape);
  const p70 = G.intentPrompt({ requirementText: "x" });
  const missing70 = KEYS70.filter((k) => !p70.includes("`" + k + "`"));
  const bullets70 = p70.split("\n").filter((l) => l.startsWith("- `"));
  const structAt = findLine(pt70, "契约的每一个键都在骨架里被点名");
  line("  ── ⚠️ 那条**结构性判据**（`:" + structAt + "-" + (structAt + 7) + "`）今天在管什么：");
  line("     `KEYS = Object.keys(GameIntentSpecSchema.shape)` ⇒ **" + KEYS70.length + " 个键**；" +
    "`missing = " + JSON.stringify(missing70) + "`；骨架里以 `- ` 开头的条目 **" + bullets70.length + " 条**");
  line("     ⇒ ⭐ 它**今天过得了** —— 因为 `progression` / `challenge` 这两个**名字**确实出现在台账里。");
  line("     ⇒ 它看的是**名字在不在**，**不是规矩在不在** ⇒ ④ 的规矩**一个字没写**，这条判据**照样绿**。");

  // ── ⑫ 那句自白的副本面 ────────────────────────────────────────────────────
  line("\n=== ⑫ 那句自白在仓库里有几份（Q1 的 (b) 要改的是一处还是一族）===");
  const CONTRACTS70 = ["game-intent.ts", "game-design.ts", "character-dna.ts", "visual-world.ts"];
  let copies = 0;
  for (const f of CONTRACTS70) {
    S("packages/contracts/src/" + f).forEach((l, i) => {
      if (has(l, "模型看不见")) { copies += 1; line("  packages/contracts/src/" + f + ":" + (i + 1) + "  " + cut(l.trim(), 84)); }
    });
  }
  line("  ── 而每一份各自点名**由谁来补**：");
  for (const f of CONTRACTS70)
    S("packages/contracts/src/" + f).forEach((l, i) => {
      if (has(l, "工具 `description` 里补")) line("     " + f.padEnd(18) + ":" + (i + 1) + "  " + cut(l.trim(), 84));
    });
  const S70 = S("packages/game-design/src/prompts.ts");
  const echo = findLine(S70, "toJSONSchema");
  line("  ⚠️ 另有一处**回声**（不是契约、是散文自己）：`packages/game-design/src/prompts.ts:" + echo + "`  " + cut(S70[echo - 1].trim(), 84));
  line("  ⇒ 这句自白是 **" + copies + " 份**（四份契约各一份 + 一处散文回声），措辞同族、都点名「由谁在工具 `description` 里补」。");
  line("     本票要动的是其中**一份**（`game-intent.ts`）—— ⚠️ 另三份**各自是否成立不在本票射程**（那是票 56 那类系统性审计）；");
  line("     这里只登记一条对 Q1(b) 有用的读数：**「改注释」改的是四份里的一份，不是全仓唯一一处**。");

  // ══════════════════════════════════════════════════════════════════════════
  // ⭐ 补量 · 第二轮（2026-10-14 · 同日第三轮探针 · 只读 / 只 require 已构建 dist
  //    · 零付费 · 源码一个字节没动）—— 量 ⑬–⑰
  //    前两轮量的是**缺口**（④ 的散文零覆盖）与**价签**（3 发盲重采样 + 退 4）；
  //    这一轮量的是**裁 Q1–Q4 那张表时要付的东西**：
  //    那句话真写进去**会不会撞红**（⑬）· 宿主对不对（⑭）· 先例的实物长几个面几条断言（⑮）·
  //    台账那一面今天写着什么（⑯）· 与 68/69 同住一份文件会不会打架（⑰）。
  // ══════════════════════════════════════════════════════════════════════════
  {
    const TL = TOOL.split("\n");
    const PT70 = S("packages/game-design/tests/prompts.test.ts");
    const yn = (b) => (b ? "是" : "否");

    // ── ⑬ ⭐⭐ 候选那句话真换进去（只在内存里）：既有断言会红几条 ─────────────
    line("\n=== ⑬ ⭐⭐ 候选那句话真换进去（只在内存里）—— 仓库里既有断言会红几条 ===");
    const AS = [];
    PT70.forEach((l, i) => {
      const m = l.match(/expect\((\w+)\)\.(not\.)?toContain\("((?:[^"\\]|\\.)*)"\)/);
      if (m) { AS.push({ n: i + 1, subj: m[1], neg: !!m[2], lit: JSON.parse('"' + m[3] + '"'), how: "直写" }); return; }
      if (/toContain\(v\)/.test(l)) {
        const mm = (PT70[i - 1] || "").match(/for \(const \w+ of \[(.*)\]\)/);
        if (mm) for (const s of mm[1].matchAll(/"((?:[^"\\]|\\.)*)"/g))
          AS.push({ n: i + 1, subj: "TOOL_DESCRIPTION", neg: false, lit: JSON.parse('"' + s[1] + '"'), how: "循环" });
      }
    });
    const bySubj = {};
    for (const a of AS) bySubj[a.subj] = (bySubj[a.subj] || 0) + 1;
    line(`  · 全 \`prompts.test.ts\` 里的 \`toContain\` / \`not.toContain\` **字面量**断言 **${AS.length}** 条`);
    line(`     按主语：${Object.entries(bySubj).map(([k, v]) => `\`${k}\` ${v} 条`).join(" · ")}`);
    const NEG = AS.filter((a) => a.neg);
    line(`     其中**反向**断言 **${NEG.length}** 条：`);
    for (const a of NEG) line(`       :${a.n}  \`${a.subj}\` **not**.toContain(${JSON.stringify(a.lit)})`);

    const reds = (subj, text) => AS.filter((a) => a.subj === subj && (a.neg ? has(text, a.lit) : !has(text, a.lit)));
    line(`  · ⚠️ 台子诚实吗（拿**今天**的两个面各跑一遍，应为 0 / 0）：`);
    line(`     工具说明面红 **${reds("TOOL_DESCRIPTION", TOOL).length}** 条 · 台账面（\`p\`）红 **${reds("p", PROMPT).length}** 条`);

    const ANCHOR70 = "**可以是空数组**（空就说「没有」）。";
    const CAND70 = "\n   ⚠️ `progression` / `challenge` **出现了就得给一句** —— 两个键都空不是「没有」、是空壳：要么整个省掉、要么填一句，没有第三条路。";
    line(`  · 宿主锚（工具说明第 5 条最后一行）在说明里命中 **${TOOL.split(ANCHOR70).length - 1}** 次 ⇒ 落点唯一`);
    const TOOL2 = TOOL.replace(ANCHOR70, ANCHOR70 + CAND70);
    line(`  · ⭐ 真换进去（工具说明 **${TOOL.length} 字 → ${TOOL2.length} 字** · Δ **+${TOOL2.length - TOOL.length}**）：`);
    line(`     工具说明面红 **${reds("TOOL_DESCRIPTION", TOOL2).length}** 条 · 台账面红 **${reds("p", PROMPT).length}** 条（台账没动，照旧）`);
    const TOOLBAD = TOOL.replace(ANCHOR70, ANCHOR70 + CAND70 + " resources");
    const PBAD = PROMPT + "`resources`";
    line(`  · ⚠️ **对照跑**（把两个面各自的禁词塞进新句，验台子不是空转）：`);
    line(`     工具说明面塞 \`resources\` ⇒ 红 **${reds("TOOL_DESCRIPTION", TOOLBAD).length}** 条 · 台账面塞 \`\`resources\`\` ⇒ 红 **${reds("p", PBAD).length}** 条`);
    line(`  ⇒ ⭐ 一条**结构性**读数：这 ${AS.length} 条断言里**只有 ${NEG.length} 条是反向的**，其余全是正向 \`toContain\` ⇒`);
    line("     **往散文里加字不可能弄红任何一条正向断言**（文字只增不减、正向只会更容易满足）；");
    line("     唯一能弄红的动作是「**新句里带上了既有的禁词**」—— 而两个面各有一个（上面两条）。");
    line("     ⇒ ⭐ 所以 Q1/Q2 的「落地会不会撞红一片」答案是：**不会** —— 加一句话在**断言这一侧是免费的**。");

    // ── ⑭ ⭐ 宿主对不对：第 5 条的实物与它的限定词 ──────────────────────────
    line("\n=== ⑭ ⭐ 候选那句话的宿主：第 5 条的实物与它的限定词 ===");
    const itemRange = (n) => {
      const s = TL.findIndex((l) => l.startsWith(n + ". ")) + 1;
      let e = TL.length;
      for (let i = s; i < TL.length; i++) if (/^\d+\. /.test(TL[i])) { e = i; break; }
      while (e > s && TL[e - 1].trim() === "") e -= 1;
      return [s, e];
    };
    const items = [];
    TL.forEach((l, i) => { if (/^\d+\. /.test(l)) items.push(i + 1); });
    const hdr = findLine(TL, "另外三条硬规矩");
    line(`  · 组头 :${hdr}  ${TL[hdr - 1].trim()}`);
    line(`  · 这一份工具说明：**${TL.length} 行 · ${TOOL.length} 字** · 编号条目 **${items.length}** 条（:${items.join(" · :")}）`);
    const [a5, b5] = itemRange(5);
    line(`  · 第 5 条 = 工具说明 :${a5}-${b5} —— **逐字**：`);
    for (let i = a5 - 1; i < b5; i++) line(`      :${i + 1}  ${TL[i].trim()}`);
    const t5 = TL.slice(a5 - 1, b5).join("\n");
    line(`  · ⭐ 它的**限定词**：「必填的字符串字段」在不在 —— **${yn(has(t5, "必填的"))}**`);
    line(`     ⚠️ 而 \`progression\` / \`challenge\` 在契约里**都是 \`optional\`**（⓪ 已量）⇒ **按字面读，第 5 条够不着它俩**。`);
    line(`  · 第 5 条里出现 \`progression\` 吗：**${yn(has(t5, "progression"))}** · 出现「可选」吗：**${yn(has(t5, "可选"))}** · 出现「空壳」吗：**${yn(has(t5, "空壳"))}**`);
    const kongAt = [];
    TL.forEach((l, i) => { if (l.includes("空")) kongAt.push(i + 1); });
    const kongIn5 = kongAt.filter((n) => n >= a5 && n <= b5);
    line(`  · 全份工具说明里带「空」字的行 **${kongAt.length}** 行（:${kongAt.join(" · :")}）—— 其中 **${kongIn5.length}** 行在第 5 条里`);
    const kongOut = kongAt.filter((n) => !(n >= a5 && n <= b5));
    for (const n of kongOut) line(`     ⚠️ 落在第 5 条**之外**的那 ${kongOut.length} 行 :${n}  ${TL[n - 1].trim()}`);
    line("     ⇒ ⭐ 那条题外的（第 3 条 `title` **可空**）讲的是「**整个省掉**」，**不是**「空壳」；");
    line("        而整份工具说明里**没有任何一条**把「可选字段的『空』」单列成规矩 ⇒ ④ 今天**零承载**。");

    // ── ⑮ ⭐⭐ 先例的实物：⑤b（票 54）与 ⑤c（票 52）各几个面、几条断言 ─────
    line("\n=== ⑮ ⭐⭐ 「照先例办」的实物：⑤b / ⑤c 各落在几个面、几条断言 ===");
    // ⚠️ 意图那一份工具说明的**边界**：模板字面量在 :104 收（`:48` 起）——
    //    不封边就会顺着往下扫进**设计层**那段（它的第 1 条也是一个 `1. `），把「第 7 条」拉成 90 行。
    let toolEnd = pr.length;
    for (let i = findLine(pr, "export const TOOL_DESCRIPTION"); i < pr.length; i++) {
      if (pr[i].endsWith("`;")) { toolEnd = i + 1; break; }
    }
    const itemRangeIn = (src, n, cap) => {
      const s = src.findIndex((l) => l.startsWith(n + ". ")) + 1;
      let e = cap;
      for (let i = s; i < cap; i++) if (/^\d+\. /.test(src[i])) { e = i; break; }
      while (e > s && src[e - 1].trim() === "") e -= 1;
      return [s, e];
    };
    line(`     （封边：意图那一份工具说明 = prompts.ts:48-${toolEnd}，下面两条的范围不越此界）`);
    const [g6a, g6b] = itemRangeIn(pr, 6, toolEnd);
    const [g7a, g7b] = itemRangeIn(pr, 7, toolEnd);
    line("  · ⑤b（跨数组 id 不许撞 · 票 54）——");
    line(`     面 1 · 工具说明  prompts.ts:${g6a}-${g6b}（第 6 条）`);
    line(`     面 2 · 台账      prompts.ts:${findLine(pr, "**不许撞**：一句话同时说了")}  ${cut(pr[findLine(pr, "**不许撞**：一句话同时说了") - 1].trim(), 100)}`);
    line(`     断言 · 工具说明面  :${findLine(PT70, 'toContain("不许重复")')}  \`toContain("不许重复")\``);
    line(`     断言 · 台账面      :${findLine(PT70, "与 `mechanics[].id` **不许撞**")}  \`p\` \`toContain("与 \\\`mechanics[].id\\\` **不许撞**")\``);
    line("     ⇒ **两个面各写一句（措辞不同）+ 两个面各一条断言** —— 这就是「照 ⑤b 办」的实物");
    line("  · ⑤c（id 不得写成「这一类」· 票 52）——");
    line(`     面 1 · 工具说明  prompts.ts:${g7a}-${g7b}（第 7 条）`);
    const hintRange = (needle) => {
      const s = findLine(pr, needle);
      let e = s;
      for (let i = s; i < pr.length; i++) if (pr[i].startsWith("};")) { e = i + 1; break; }
      return [s, e];
    };
    const [fh1, fh2] = hintRange("const FIELD_HINTS");
    const yileiInLedger = [];
    for (let i = fh1 - 1; i < fh2; i++) if (has(pr[i], "这一类")) yileiInLedger.push(i + 1);
    line(`     面 2 · 台账      \`FIELD_HINTS\`（prompts.ts:${fh1}-${fh2}）里「这一类」命中 **${yileiInLedger.length}** 处 ⇒ ⚠️ **这一面没有它**`);
    const yileiInTest = PT70.map((l, i) => [i + 1, l]).filter(([, l]) => has(l, "这一类"));
    line(`     断言 · 全 \`prompts.test.ts\` 里「这一类」命中 **${yileiInTest.length}** 处 ⇒ ⚠️ **⑤c 今天一条断言都没有**`);
    line(`     （对照：⑤b 在测试里有 **${PT70.filter((l) => has(l, "不许重复") || has(l, "不许撞")).length}** 行命中：「不许重复」在 :${findLine(PT70, 'toContain("不许重复")')}、「不许撞」在 :${findLine(PT70, "**不许撞**")}）`);
    line("  ⇒ ⭐⭐ 一句话：**两个先例不统一** —— ⑤b 是「两面 + 两断言」，⑤c 是「一面 + 零断言」；");
    line("     而 ⑥ 早就量过这一条（那是**票 54 特意升格**的结果，票 52 没有）。⇒ Q2 不是照抄惯例，是**选一档**。");

    // ── ⑯ ⭐ 台账那一面今天写着什么：④ 的「另一半」已经在了 ────────────────
    line("\n=== ⑯ ⭐ 若 Q2 裁「写进台账」：那一面今天写着什么 ===");
    const pProg = findLine(pr, "progression: \"`{ type, description }`：进阶");
    const pChal = findLine(pr, "challenge: \"`{ type, description }`：难度来源");
    line(`  · \`FIELD_HINTS.progression\`  prompts.ts:${pProg}  —— **逐字**：`);
    line(`      ${pr[pProg - 1].trim()}`);
    line(`  · \`FIELD_HINTS.challenge\`   prompts.ts:${pChal}  —— **逐字**：`);
    line(`      ${pr[pChal - 1].trim()}`);
    line(`  · ⭐ 两行相隔 **${pChal - pProg}** 行、同一个字面量对象（\`FIELD_HINTS\` :${fh1}-${fh2}）`);
    const hProg = pr[pProg - 1], hChal = pr[pChal - 1];
    line(`  · ⭐⭐ 台账里**已经有「省掉」那半**：「整个省掉」命中 progression 行 = **${yn(has(hProg, "整个省掉"))}**`);
    line(`     而「出现了就不能空」那半（「空壳」/「两端都空」）：progression 行 **${yn(has(hProg, "空壳") || has(hProg, "都空"))}** · challenge 行 **${yn(has(hChal, "空壳") || has(hChal, "都空"))}**`);
    line(`  · ⚠️ 而 \`challenge\` 那一行的正文是一个**指针**：「同上」命中 = **${yn(has(hChal, "同上"))}**`);
    line(`     ⇒ ⭐ 只补 \`progression\` 那行 ⇒ \`challenge\` **因「同上」自动继承**（这正是它想要的）；`);
    line("        而**只补 challenge 那行是补不进去的**（它的正文不是一个独立句子）。");
    line(`  · 真台账里那两行长什么样（\`intentPrompt\` 实拼）：`);
    PROMPT.split("\n").forEach((l) => { if (has(l, "进阶") || has(l, "难度来源")) line(`      ${l.trim()}`); });
    line("  · ⚠️ 另一条对 Q2 有用的：⑤b 的**两个面措辞不同** ——");
    line(`     工具说明 :${g6a} 写的是「**不许重复**」· 台账 :${findLine(pr, "**不许撞**：一句话同时说了")} 写的是「**不许撞**」`);
    line(`     交叉命中：工具说明第 6 条里有「不许撞」吗 **${yn(has(pr.slice(g6a - 1, g6b).join("\n"), "不许撞"))}** · 台账那行里有「不许重复」吗 **${yn(has(pr[findLine(pr, "**不许撞**：一句话同时说了") - 1], "不许重复"))}**`);
    line("     ⇒ ⭐ 「两个面都写」**不是复制粘贴**，是**两个面各自措辞**（这也正是两条断言用两个不同字面量的原因）。");

    // ── ⑰ ⭐ 三票同住一份文件：不同请求 · 锚不相交 ──────────────────────────
    line("\n=== ⑰ ⭐ 本票与 68/69 住同一份 \`prompts.ts\`：会不会打架 ===");
    const run70 = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/";
    const design70 = load(run70 + "game-design.json");
    const vws70 = load(run70 + "visual-world.json");
    const DNA70 = G.characterDnaPrompt({ design: design70, vws: vws70 });
    const PAL_ANCHOR = "`palette:<下标>`";
    const MY_ANCHOR = "不许有空串";
    line(`  · 70 的格子  prompts.ts:${findLine(pr, "**不许有空串**")}（工具说明第 5 条 · 宿主 \`TOOL_DESCRIPTION\` :48）`);
    line(`     68/69 的格子  prompts.ts:${findLine(pr, "只能写 `palette:<下标>`")}（\`DNA_FIELD_HINTS.palette\` · 宿主 \`DNA_FIELD_HINTS\` :367）`);
    line(`     ⇒ 相隔 **${findLine(pr, "只能写 `palette:<下标>`") - findLine(pr, "**不许有空串**")}** 行 · **两个字面量对象**`);
    line("  · ⭐ 它们是**两次不同的请求**（这一点比「同一个文件」要紧）：");
    line(`     \`TOOL_DESCRIPTION\` 进的是**意图那一发**的 \`tools[0].description\` ⇒ 命中于 \`intentPrompt\` 那一份 body = **${yn(has(PROMPT, MY_ANCHOR))}**`);
    line(`     \`DNA_FIELD_HINTS\` 进的是**基因那一发**的 messages ⇒ 命中于 \`characterDnaPrompt\` 那一份 body = **${yn(has(DNA70, PAL_ANCHOR))}**`);
    line(`     交叉：DNA 提示词里有「不许有空串」吗 **${yn(has(DNA70, MY_ANCHOR))}** · 意图提示词/工具说明里有「\`palette:<下标>\`」吗 **${yn(has(TOOL, PAL_ANCHOR) || has(PROMPT, PAL_ANCHOR))}**`);
    line(`  · 真产物拼一遍：DNA 提示词 **${DNA70.length} 字** · 意图提示词 **${PROMPT.length} 字** · 工具说明 **${TOOL.length} 字**`);
    line("  ⇒ ⭐⭐ 三个锚**两两不相交、而且分居两次请求** ⇒ 三票**可以同批落地、顺序无关**；");
    line("     ⚠️ 但「验」是**两次不同的真跑**（意图一发 / 基因一发）—— 两边都进**票 23**，各自出报告 + **逐次明确同意**。");

    // ── 小结（**不编号** —— ⑱ 起留给下一轮读数）────────────────────────────
    line("\n=== 小结 · 这一轮量到的五件事（**不编号** —— ⑱ 起留给下一轮读数）===");
    line("  ① ⭐⭐ **加一句话在「断言」这一侧是免费的**（⑬）：全 `prompts.test.ts` 的 28 条字面量断言里");
    line("     **27 条是正向 `toContain`** ⇒ 往散文里加字**不可能**弄红它们（正向只会更容易满足）；");
    line("     唯一的红线是「**新句里带上了既有的禁词**」—— 而两个面各有一个（:109 `resources` · :29 `` `resources` ``）。");
    line("  ② ⭐ **候选那句话的宿主，自己把射程写窄了**（⑭）：第 5 条逐字写着「**必填的**字符串字段」，");
    line("     而 `progression` / `challenge` **都是 `optional`** ⇒ 按字面读，这一条**够不着它俩**；");
    line("     整份工具说明里带「空」的 4 行有 3 行在第 5 条里，第 4 行（第 3 条 `title` **可空**）讲的是");
    line("     「**整个省掉**」、不是「空壳」⇒ ⭐ **④ 今天零承载**这件事，是**逐行数出来的**，不是推断。");
    line("  ③ ⭐⭐ **「照先例办」有两个先例、两个形状**（⑮）：⑤b（票 54）是「**两面 + 两断言**」、");
    line("     ⑤c（票 52）是「**一面 + 零断言**」（台账零命中 · 测试零命中）⇒ Q2 不是照抄惯例，是**选一档**。");
    line("  ④ ⭐ **台账那一面今天已经有一半了**（⑯）：`FIELD_HINTS.progression` 行末那句「**推不出就整个省掉**」");
    line("     正是 ④ 要的「要么省掉」那半，缺的只是「出现了就不能两端都空」；而 `challenge` 那行正文是「**同上**」");
    line("     ⇒ 只补 `progression` 那行就**自动带上** `challenge`（而**只补 challenge 那行补不进去**）。");
    line("  ⑤ ⭐⭐ **三票同住一份文件，但分居两次请求**（⑰）：70 的格子 `prompts.ts:88` / 68·69 的 `:378`");
    line("     （相隔 290 行 · 两个字面量对象），宿主一个是 `TOOL_DESCRIPTION`（意图那一发的 `tools[0].description`）、");
    line("     一个是 `DNA_FIELD_HINTS`（基因那一发的 messages）⇒ 三个锚两两不相交 ⇒ **可以同批落地、顺序无关**；");
    line("     ⚠️ 而「验」是**两次不同的真跑**，两边都进**票 23**。");
  }
})();
