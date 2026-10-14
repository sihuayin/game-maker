#!/usr/bin/env node
/**
 * 票 67 探针：「意图里的机制**全都**挑不出对家」这个角，**到底有没有合法输出**
 *
 * **为什么要有它**：票面的结论是一句很强的话 ——
 *   「**这个角上没有合法输出**：唯一能过 gate 的路，正是散文禁止的那条。」
 * 那句话由**两条散文规矩**（`prompts.ts:191` 的「至少一条」＋ `:194-196`「挑不出对家就整条省掉」）
 * 与**一条 gate**（`contracts/game-design.ts:255-259`）推出来。
 * 本探针把那四条路（照散文 / 顶替 / 新加 / 顶替+省掉）**真的喂进 `buildDesign`**，
 * 看机检那一侧到底判什么 —— 因为**「合法」这个词横跨散文与机检两侧**，而票面的结论
 * 说的是哪一侧，得量出来。
 *
 * 另外量三件票面引了但没量的事：
 *   ① 盘上 12 对真（意图，设计）里，这个角与被顶替的样子长什么样；
 *   ② 重采样到底是不是**盲的**（同一个 body × N 发）；
 *   ③ 仓库**自己的**测试 fixture 把哪条路当成正例。
 *
 * **免费**：只 `require` 已构建的 `packages/contracts/dist` 与 `packages/game-design/dist`，
 * 加盘上**真的** run 产物。不碰网络、不跑管线、零付费、源码一个字节没动。
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../../../..");
const C = require(path.join(ROOT, "packages/contracts/dist/index.js"));
const G = require(path.join(ROOT, "packages/game-design/dist/index.js"));

const P = (...p) => path.join(ROOT, ...p);
const load = (p) => JSON.parse(fs.readFileSync(P(p), "utf8"));
const line = (s) => console.log(s);
const cut = (s, n) => (s.length > n ? s.slice(0, n) + `…（共 ${s.length} 字）` : s);

// ── ⓪ 两张封闭表 ────────────────────────────────────────────────────────────
line("=== ⓪ 这张封闭枚举只有 8 个值，而它正是「挑不出对家」那把尺子 ===");
line("  MECHANICS（8）：" + C.MECHANICS.join(" · "));
line("  CAPABILITIES（8）：" + C.CAPABILITIES.join(" · "));
line(`  PLATFORMER_V1.mechanics ⟺ MECHANICS：${C.PLATFORMER_V1.mechanics.length} 条`);
line(`  STRUCTURED_CALL_ATTEMPTS = ${C.STRUCTURED_CALL_ATTEMPTS}（R16：schema 失败 ⇒ 重采样几发）`);
line(`  壳把两类失败翻成的退出码：两档都进 EXIT.invalid(4)（packages/cli/src/cli.ts:201-207 按**形状**认）`);

// ── ① 盘上 12 对真（意图，设计）────────────────────────────────────────────
line("\n=== ① 盘上 12 对真产物：这个角与被顶替的样子 ===");
const pairs = [];
const walk = (d) => {
  let ents = [];
  try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
    else if (e.name === "game-intent.json") {
      const dp = path.join(d, "game-design.json");
      if (fs.existsSync(dp)) pairs.push([p, dp]);
    }
  }
};
walk(path.join(ROOT, ".scratch"));

const NAMES = new Map();   // 每个枚举值被设计层用了多少次
let okBothToday = 0;
for (const [ip, dp] of pairs) {
  const intent = JSON.parse(fs.readFileSync(ip, "utf8"));
  const design = JSON.parse(fs.readFileSync(dp, "utf8"));
  const rel = path.relative(ROOT, ip).replace(".scratch/game-maker-v2/experiments/e2e-wasteland/raw/", "");
  // ⚠️ 今天的契约（票 52 那条 `id = 类名` 是**后**加的）—— 历史产物里多数今天已经过不了。
  const qi = C.GameIntentSpecSchema.safeParse(intent);
  const qd = C.GameDesignSpecSchema.safeParse(design);
  if (qi.success && qd.success) okBothToday++;
  const missing = C.auditIntentCoverage(intent, design);
  const saidIds = new Set(intent.mechanics.map((m) => m.id));
  const newOnes = design.mechanics.filter((m) => !saidIds.has(m.id));
  line(`\n  · ${rel}`);
  line(`      今天过契约：意图 ${qi.success ? "✓" : "✗"} · 设计 ${qd.success ? "✓" : "✗"}（票 52 那条判据是后加的）`);
  line(`      意图 mechanics（${intent.mechanics.length}）：` + intent.mechanics.map((m) => `${m.id}=「${m.name}」`).join(" · "));
  line(`      设计 mechanics（${design.mechanics.length}）：` + design.mechanics.map((m) => `${m.id}→${m.mechanic}`).join(" · "));
  line(`      R12 的点名（缺哪几条）：${missing.length === 0 ? "**零条**" : missing.map((m) => m.id).join(", ")}`);
  if (newOnes.length) line(`      ⚠️ 设计里**不在意图**里的：` + newOnes.map((m) => `${m.id}→${m.mechanic}`).join(" · "));
  for (const m of design.mechanics) NAMES.set(m.mechanic, (NAMES.get(m.mechanic) || 0) + 1);
}
line(`\n  ⇒ 12 对里，今天**两边都过契约**的：${okBothToday} 对（其余是历史产物，判据在那之后加过）`);
const allMissing = pairs.filter(([ip, dp]) =>
  C.auditIntentCoverage(JSON.parse(fs.readFileSync(ip, "utf8")), JSON.parse(fs.readFileSync(dp, "utf8"))).length > 0);
line(`  ⇒ 12 对里 R12 **点过名**的：**${allMissing.length}** 对（这个角与「部分缺」一样，盘上 n=0）`);
line(`  ⇒ 设计层用过的枚举值分布：` + [...NAMES.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(" · "));

// ── ①b 那个角**离得多近**：`mechanics[]` 是个杂物抽屉吗 ──────────────────────
line("\n=== ①b 那个角离得多近：意图层的 `mechanics[]` 里有没有**不是机制**的东西 ===");
line("  散文（`prompts.ts` 的「**先分家**」）逐字要求分四格，其中：");
line("    · 「**玩家怎么玩**（怎么移动、怎么跳、怎么收集、怎么打）」⇒ `mechanics[]`");
line("    · 「**那个地方是什么样**（题材、场景、氛围）」⇒ `world` 那三格");
line("    · 「**最终目标是什么**」⇒ `winConditions[]`");
line("    · 「**有一个东西在那儿**」⇒ `entities[]`");
const cols = [];
for (const [ip] of pairs) {
  const intent = JSON.parse(fs.readFileSync(ip, "utf8"));
  const eids = new Set(intent.entities.map((e) => e.id));
  const clash = intent.mechanics.filter((m) => eids.has(m.id)).map((m) => m.id);
  if (clash.length) cols.push([path.relative(ROOT, ip), clash.join(" · ")]);
}
line(`  ⚠️ **机检得出来的那一半**：同一份意图里 \`mechanics[].id\` 与 \`entities[].id\` **撞名的** —— ` +
     `${cols.length} / ${pairs.length} 份：`);
for (const [f, c] of cols) line(`      · ${f.replace(".scratch/game-maker-v2/experiments/e2e-wasteland/raw/", "")} ⇒ ${c}`);
line("      ⇒ 撞名 = 同一个 id 既登记成实体、又登记成机制 ⇒ ⑤b 那条 gate **今天拦得住**（票 03 之后加的）");
line("  ⚠️ **机检拦不住的那一半**：像 `wasteland-bg`「废土背景」这种**一句话布景** —— 名字不撞任何 id、");
line("     形状上也像一条机制 ⇒ 意图层契约**放行**（`mechanics[].name` 是 `z.string()`，而「是不是机制」没有定义）");
line("     ⇒ 它**必然**挑不出对家，于是**必然**走到设计层那一格去撞 R12");

// ── ② 那个角：四条路各喂一次真 buildDesign ──────────────────────────────────
line("\n=== ② 那个角：把四条路真的喂进 `buildDesign` ===");
// 底子取盘上**今天两边都过契约**的那一对（13b 的失败现场里那份），只换 `mechanics` 那一格 ——
//   这样其余字段的判决全是「既有判据对这份输入的意见」，换掉的机制是唯一的变量。
const BASE = "run-out-2026-10-13b/.failed-2026-10-13T09-22-52-685Z/";
const RAW = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/";
const baseIntent = load(RAW + BASE + "game-intent.json");
const baseDesign = load(RAW + BASE + "game-design.json");
// ⚠️ 那份失败现场里**没有** `visual-world.json`（它落在 `run/v<N>/`，失败现场只搬了理解层那几份）
//   ⇒ 世界取 13h 那一份（`camera.mode = "side"`，与 13b 同代同模式）。
const realVws = load(".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/visual-world.json");

// 角上的那份意图：**三条机制，一条都挑不出对家**（票面举的例子逐字借用）
const CORNER = [
  { id: "turn-based-combat", name: "回合制战斗" },
  { id: "skill-tree", name: "技能树" },
  { id: "dialogue-choice", name: "对话选择" }
];
const cornerIntent = { ...baseIntent, mechanics: CORNER };

line(`  底子：盘上 ${BASE.replace(/\/$/, "")} 那一对（今天两边都过契约）`);
line(`  角上的意图：把 mechanics 换成 ${CORNER.map((m) => m.id).join(" · ")} —— **一条都挑不出对家**`);
line(`  （8 个枚举值里没有「回合制」「技能树」「对话」；` +
     `C.MECHANICS.includes("dialogue") = ${C.MECHANICS.includes("dialogue")}）`);

/** 把一份设计喂进去，打印**机检那一侧的判决原话**。 */
const feed = (label, mechanics, note) => {
  const design = { ...baseDesign, mechanics };
  const qi = C.GameIntentSpecSchema.safeParse(cornerIntent);
  const r = G.buildDesign({ fromModel: design, intent: cornerIntent, vws: realVws, profile: C.PLATFORMER_V1 });
  line(`\n  ── ${label}`);
  line(`     ${note}`);
  if (!qi.success) line(`     ⚠️ 这份意图本身过不了今天的意图层 gate：${qi.error.issues[0].message.slice(0, 60)}…`);
  if (r.ok) { line(`     ⇒ **过了**：ok:true（没有任何一处报它）`); return; }
  if (r.kind === "schema") {
    line(`     ⇒ kind: "schema" ⇒ 调用方**重采样**（R16 ×${C.STRUCTURED_CALL_ATTEMPTS}），报文逐字：`);
    line(`       「${cut(r.detail, 220)}」`);
    return;
  }
  line(`     ⇒ kind: "rejected" ⇒ **不重采样**（R12 是结论，不是抽签）。${r.rejections.length} 条理由：`);
  for (const rj of r.rejections)
    line(`       · [${rj.reason}] ${cut(rj.detail, 150)}`);
};

feed("A · 照散文做（规则 2：整条省掉）", [],
  "`mechanics: []` —— 散文第 2 条要求的那一条路");

feed("B · 拿近似的值顶上去（散文明令禁止）",
  CORNER.map((m, i) => ({ id: m.id, mechanic: ["hazard-contact", "collect-pickup", "reach-goal"][i] })),
  "`id` 照抄、`mechanic` 顶替 —— 规则 2 逐字禁止的那条路");

feed("C · 新加一条**合法**机制、意图那三条整条省掉",
  [{ id: "turn-order", mechanic: "run" }],
  "规则 3 允许「这一层新加」；而 R12 是**单向的**（只查「少」不查「多」）");

feed("D · 顶替一条、其余两条省掉",
  [{ id: "turn-based-combat", mechanic: "hazard-contact" }],
  "非空 ⇒ 过 gate ④；而 R12 照样点名没对家的那两条");

feed("E · 只留一条**忠实**的（角上不存在）",
  CORNER.slice(0, 1).map((m) => ({ id: m.id, mechanic: "run" })),
  "⚠️ 对照：角上「忠实」的定义就是「挑得出对家」—— 挑不出时这一格填不出真值，只能顶替");

// ── ③ 顺序：schema 先响，R12 那条诚实报文到不了 ─────────────────────────────
line("\n=== ③ 顺序：那个角**到不了** R12 那句诚实的报文 ===");
line("  `build-design.ts:150` 的注释 + `:160-173` 的次序：**契约先过、R12 在后**");
line("  ⇒ A 那一格的 detail 里**有没有** `intent-mechanic-missing` 那半句？");
const a = G.buildDesign({ fromModel: { ...baseDesign, mechanics: [] }, intent: cornerIntent, vws: realVws, profile: C.PLATFORMER_V1 });
line(`     kind = ${a.kind} · detail 含「外壳做不了它」= ${String(a.detail).includes("外壳做不了它")} · ` +
     `含「没干活」= ${String(a.detail).includes("没干活")}`);
line("  ⚠️ 而 R12 那个函数**只吃已经过 gate 的 `GameDesignSpec`**（`auditIntentCoverage(intent, design)`）——");
const ungated = C.GameDesignSpecSchema.safeParse({ ...baseDesign, mechanics: [] });
line(`     拿同一份 `+"`mechanics: []`"+` 去 parse：success = ${ungated.success} ⇒ **压根构造不出那个入参**`);
line("     ⇒ Q2「把 R12 挪到 gate 之前」在今天**不是调换两个调用**，而是**拆 gate**（把第 ④ 组从 schema 里拿出来）");

// ── ④ 重采样是不是盲的 ─────────────────────────────────────────────────────
line("\n=== ④ 重采样：三发发的是**同一个 body**吗 ===");
const src = fs.readFileSync(P("packages/game-design/src/compile-design.ts"), "utf8").split("\n");
const bodyLine = src.findIndex((l) => l.includes("const body = JSON.stringify("));
const loopLine = src.findIndex((l) => l.includes("for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS"));
line(`  compile-design.ts:${bodyLine + 1}  \`const body = JSON.stringify({…})\`  ← **循环之外，算一次**`);
line(`  compile-design.ts:${loopLine + 1}  \`for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++)\``);
line(`  循环体里发给上游的是：\`body\`（**没有**带上一次的下场/理由 —— 整个循环体里只有一处 \`body\``);
const bodyUses = src.map((l, i) => [i + 1, l]).filter(([, l]) => /\bbody\b/.test(l) && l.includes("body,"));
line(`  ⇒ \`body\` 在循环体内出现的次数：${bodyUses.length}（${bodyUses.map(([n]) => ":" + n).join(" ")}）—— 全都是同一个常量`);
line(`  ⇒ schema 失败那一档**不喂回去理由**：模型看到的三发**逐字节相同**`);

// ── ⑤ 仓库自己的 fixture 把哪条路当正例 ─────────────────────────────────────
line("\n=== ⑤ ⚠️ 仓库自己的测试 fixture 里，**顶替**被当成「做出来了」 ===");
const t = fs.readFileSync(P("packages/game-design/tests/build-design.test.ts"), "utf8").split("\n");
const pick = (n) => `build-design.test.ts:${n}  ${t[n - 1].trim()}`;
line("  意图那份 fixture（:24）：" + t[23].trim());
line("  设计那份 fixture（:46 的注释 + :58）：");
line("    build-design.test.ts:46  " + t[45].trim());
line("    build-design.test.ts:58  " + t[57].trim());
line("  ⇒ `m-double-jump`（意图层写的是**二段跳**）在设计层落在 `jump` 上 —— **这就是顶替**；");
line("    :121 那条测试的名字把它当**正例**：「全都有对家 ⇒ 放行（**负判据不许误伤正例**）」；");
line("    而 :175 的注释**明说了**它就是顶替：「fixture 里**两条机制都落在 `jump` 上**」");
line("      「（`m-double-jump` 是**模型拿近似值顶的**那种情形）」");
line("  ⚠️ R12 抓不住顶替这件事，`intent-coverage.ts:33-35` 自己写着：");
const ic = fs.readFileSync(P("packages/contracts/src/intent-coverage.ts"), "utf8").split("\n");
for (const n of [33, 34, 35]) line("    intent-coverage.ts:" + n + "  " + ic[n - 1].trim());

// ── ⑥ 盘上的痕迹 ───────────────────────────────────────────────────────────
line("\n=== ⑥ ⚠️ 这个角在盘上没留过痕迹 —— 但**它的家族响过一次**，而且归因读得出来 ===");
const att = [];
const walkAtt = (d) => {
  let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walkAtt(p); }
    else if (e.name === "design-attempts.json") att.push(p);
  }
};
walkAtt(ROOT);
line(`  (1) 盘上的 \`design-attempts.json\`：**${att.length}** 份 —— 票 55 那只容器**在这些跑之后**才落地`);
line("      ⇒ 被拒的那份设计**一个字都没落盘**（13a 的失败现场里只有 intent.md / game-intent.json / visual-world.json / style.png）");

line("\n  (2) ⚠️ 但 13a 的**报错文本本身**就是证据 —— 逐字：");
const runA = load(RAW + "run-2026-10-13a.json");
const blob = JSON.parse(runA.text.slice(0, runA.text.lastIndexOf("}") + 1));
for (const l of blob.error.split("\n")) line("      " + l);
line(`      退出码 ${blob.exitCode}（`+"`invalid`"+`）· 账：attempts=${blob.ledger[0].attempts} failures=${JSON.stringify(blob.ledger[0].failures)}`);

line("\n  (3) 归因**读得出来**（不再是「疑似」）—— 三联推：");
line("      · `spentCall.trip()`（compile-design.ts:81-95）：`attempts = trips`，而 `failures[]` **只在带了** failure 的那几发里加");
line(`      · ⇒ ${blob.ledger[0].attempts} 发里只有 ${blob.ledger[0].failures.length} 条 CallFailure ⇒ **第 ${blob.ledger[0].attempts} 发不是 CallFailure**`);
line("      · 而那一发的落点只有两种：`ok`（会往下走）或 `rejected`（当场抛）—— 这一跑停在 `design`、报的是 `DesignRejectedError` 那句话");
line("      ⇒ **第三发是 R12 的拒绝**：模型前两发没吐出一份过契约的（盲发），第三发吐出了一份**过了 gate ④** 的，");
line("        而 R12 在那份上点了名 ⇒ **诚实报文真的到达了人眼前，盘上至少一次**");

line("\n  (4) 而它点的那条机制，是**一句话布景**：");
const ia = load(RAW + "run-out-2026-10-13a/.failed-2026-10-13T02-21-58-177Z/game-intent.json");
line("      13a 的意图 mechanics（7）：" + ia.mechanics.map((m) => `${m.id}=「${m.name}」`).join(" · "));
line("      ⚠️ `wasteland-bg`「**废土背景**」不是一条机制，是一句布景 —— 而意图层契约的 `mechanics[].name` 是 `z.string()`");
line("         （`vocabulary.ts:30-31` 逐字：「意图侧**故意不吃**这张表」）⇒ 它**必然**挑不出对家。");
line("      ⇒ 报错里缺的**只有它** ⇒ 设计层那 6 条机制**都写上了**（R12 没点名）");
line("         ⚠️ **但读不出**它们各自的 `mechanic` 值是不是顶替 —— 那份设计**从没落盘**（票 55 的容器在它之后才落地）");
line("      ⇒ 形状上就是探针里的 **D** 那一支（**部分覆盖 + 部分省掉**）：R12 照样点名、照样停");
line(`      ⚠️ 也就是说：这个角的**入口**不是「回合制战斗」那么远的需求 —— **一句布景被记成机制**就到门口了`);

// ── ⑦ 代价：Q1(b)「只把报错文案改对」要动几处 ────────────────────────────────
line("\n=== ⑦ 代价：改那句 gate 文案 / 加一条散文出路，各要动几处 ===");
const gateMsg = fs.readFileSync(P("packages/contracts/src/game-design.ts"), "utf8").split("\n");
line(`  gate ④ 的 message 只有一处：game-design.ts:259`);
line(`      ${gateMsg[258].trim().slice(0, 110)}…`);
const mentioning = [];
const walkTests = (d) => {
  let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walkTests(p); }
    else if (/\.test\.ts$/.test(e.name) && fs.readFileSync(p, "utf8").includes("没干活"))
      mentioning.push(path.relative(ROOT, p));
  }
};
walkTests(P("packages"));
line(`  提到「没干活」的测试文件 ${mentioning.length} 份：`);
for (const m of mentioning) line(`      ${m}`);
line("      ⇒ 设计层那份（`game-design-gate.test.ts:57`）断言的是 **`path`**（`[mechanics]`），**不是那句 message**");
line("  ⚠️ 而 Q1(a)（散文加一条出路）**不是改文案**：它要 gate ④ 给 `mechanics` 开一个口子 ——");
line("     那是**动契约语义 / 动 R12**，按 **R17 另开票**（票面第 5 节已经写了这一条）");

line("\n=== ⑧ 两条路的**依赖关系**（②③ 的读数直接推出来的）===");
line("  (a) 只在散文中加一句「一条都对不上就把 mechanics 留空」：");
line("      ⇒ 模型照着写 ⇒ **还是** `mechanics: []` ⇒ gate ④ 照旧判 `schema` ⇒ 3 发盲重采样 ⇒ 人看到的还是「没干活」");
line("      ⇒ **散文与机检仍然打架**，只是散文自洽了 ⇒ 单独做 (a) **一分钱也治不好**，它必须等 gate ④ 被开口（R17 另开票）");
line("  (b) 只把 gate ④ 那句 message 改对（`mechanics` 空时说「可能是外壳做不了」而不是「没干活」）：");
line("      ⇒ 链**还是停在同一格**（`schema`、还是 3 发盲重采样、还是退 4），但**落到人眼前的那句话对了一方**");
line("      ⇒ 它**不动 gate 的形状**、不动 R12、不违反 R17（改的是 message，不是判据）");
line("  (c) 两者都做 = (b) 立刻成立，(a) 挂在一个 R17 票后面");
line("  (d) 都不动：这个角保持今天的形状 —— 而 13a 量到模型在这个角上**最省事的行为是顶替**（那 6 条），");
line("      顶替恰好是**唯一能被沉默接受**的路（②B 逐字：ok:true，没有任何一处报它）");

// ═══════════════════════════════════════════════════════════════════════════
// ⭐ 补量（2026-10-14 · 同日第二轮 · 只量不裁 · 零付费）
//   第一轮把 A/B/C/D 四条路的**判决**量出来了（②），也量到重采样是盲的（④）。
//   补的这四行问的是**判决之外**的三件事：
//   ⑨ 那四条路各要**几发付费往返**（判决一样贵吗）；⑩ 两条路在**人眼前**长得一样吗（退码 / 账）；
//   ⑪ 那两句相反的话**住在哪**（是不是同一个模型读得到的面上）；⑫ 散文第 1 条与 gate ④ 对得齐吗。
// ═══════════════════════════════════════════════════════════════════════════

// ── ⑨ 这个角值几发：四条路各要几次付费往返（假 fetch · 实测）────────────────
line("\n=== ⑨ 这个角值几发：四条路各要几次付费往返（假 `fetch` · 实测 · 零付费）===");
line("  做法：把盘上那一对真产物喂进**真的 `compileDesign`** —— 只换模型每一发回的那份设计，");
line("        数 `fetch` 被调了几次（每一发 = 一次付费往返）。");

const replyBody = (design) => ({
  content: [{ type: "tool_use", name: G.DESIGN_TOOL_NAME, input: design }],
  stop_reason: "tool_use", model: "deepseek-flash",
  usage: { input_tokens: 2400, output_tokens: 2600 },
});

const costOf = async (label, mechanics, note, useIntent) => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(String(init.body));
    const body = replyBody({ ...baseDesign, mechanics });
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
  let verdict, led = "";
  try {
    const r = await G.compileDesign({
      intent: useIntent ?? cornerIntent, vws: realVws,
      transport: { baseUrl: "http://upstream.test", apiKey: "k" }, fetchImpl,
    });
    verdict = "**过了**（`ok`）—— 链往下走";
    if (r.ledger) led = `attempts=${r.ledger[0].attempts} · failures=${JSON.stringify(r.ledger[0].failures ?? null)}`;
  } catch (e) {
    if (Array.isArray(e.rejections)) verdict = `抛 \`${e.name}\`（R12 的拒绝）—— **当场停**`;
    else verdict = `抛 \`${e.name}\`（\`failure: ${e.failure}\`）—— **三发打完**才停`;
    if (e.ledger) led = `attempts=${e.ledger[0].attempts} · failures=${JSON.stringify(e.ledger[0].failures ?? null)}`;
  }
  const uniq = new Set(seen).size;
  line(`\n  ── ${label}`);
  line(`     ${note}`);
  line(`     ⇒ 付费往返 **${seen.length}** 次 · 发出去的 body **${uniq}** 种` +
    (seen.length > 1 && uniq === 1 ? "（**逐字节相同**：三发是同一份请求）" : ""));
  line(`     ⇒ 结局：${verdict}`);
  line(`     ⇒ 账：${led}`);
  return seen.length;
};

// ⚠️ 这一节要 await（真跑一遍 `compileDesign` 的**假 fetch** 版）—— `.cjs` 没有顶层 await，包一层。
(async () => {

const baseMechanics = baseDesign.mechanics;
await costOf("对照 · 盘上那一份原样的（意图，设计）", baseMechanics,
  `⚠️ 这一格用**原来的那份意图**（${baseIntent.mechanics.length} 条机制，${
    baseIntent.mechanics.filter((m) => C.MECHANICS.includes(m.id)).length} 条挑得出对家）—— ` +
  "证明这个台子本身是诚实的", baseIntent);
await costOf("A · 照散文做（规则 2：整条省掉）", [],
  "`mechanics: []` —— 散文第 2 条要求的那一条路");
await costOf("B · 拿近似的值顶上去（散文明令禁止）",
  CORNER.map((m, i) => ({ id: m.id, mechanic: ["hazard-contact", "collect-pickup", "reach-goal"][i] })),
  "`id` 照抄、`mechanic` 顶替 —— 规则 2 逐字禁止的那条路");
await costOf("C · 新加一条**合法**机制、意图那三条整条省掉",
  [{ id: "turn-order", mechanic: "run" }],
  "规则 3 允许「这一层新加」");
await costOf("D · 顶替一条、其余两条省掉",
  [{ id: "turn-based-combat", mechanic: "hazard-contact" }],
  "非空 ⇒ 过 gate ④；R12 照样点名没对家的那两条");

line("\n  ⚠️ 而这一件事仓库**自己的测试**已经断言过（`compile-design.test.ts`）：");
const ct = fs.readFileSync(P("packages/game-design/tests/compile-design.test.ts"), "utf8").split("\n");
for (const n of [99, 102, 105, 136, 137, 138])
  line(`    compile-design.test.ts:${n}  ${ct[n - 1].trim()}`);
line("     ⇒ R12 那一档（:99 那条测试）：`expect(s.calls()).toBe(1)`  ← 注释逐字「重抽同一份意图抽一百次也还是做不出来」");
line("       schema 那一档：`expect(s.calls()).toBe(STRUCTURED_CALL_ATTEMPTS)`");
line("     ⇒ 循环里**只有三种结局会跳出**（`upstream` :281 · `rejected` :288 · `ok` :300），");
line("       而 `bad`（schema）**掉到循环底、接着下一发**（:305-311）—— 这是 3 发的来源。");

// ── ⑩ 两条路在人眼前长得一样吗：退码 / 账 ───────────────────────────────────
line("\n=== ⑩ 两条路在**人眼前**长得一样吗（退码相同 · 账不同）===");
const cli = fs.readFileSync(P("packages/cli/src/cli.ts"), "utf8").split("\n");
for (const n of [198, 199, 200, 201, 202, 203, 210])
  line(`  cli.ts:${n}  ${cli[n - 1].trim()}`);
line("  ⇒ 壳**按形状认**：有 `rejections` 的、和有 `failure` 的，**都进 `CommandError(\"invalid\")`** = **退出码 4**");
const cd = fs.readFileSync(P("packages/game-design/src/compile-design.ts"), "utf8").split("\n");
line(`  compile-design.ts:57  ${cd[56].trim()}`);
line(`  compile-design.ts:69  ${cd[68].trim()}`);
line("  ⇒ **A（3 发 schema）与 C/D（1 发 rejected）退的是同一个码** ——");
line("     从外面看，区别**只有那句话**（＋账里 `failures` 与 `attempts`）");

// ── ⑪ 那两句相反的话**住在同一个面**上 ──────────────────────────────────────
line("\n=== ⑪ 那两句相反的话住在哪：**同一个模型读得到的面上** ===");
line("  （模型每一发读到的文本有两份：工具说明 = `DESIGN_TOOL_DESCRIPTION`；用户消息里那段台账 = `designPrompt`）");
const td = G.DESIGN_TOOL_DESCRIPTION.split("\n");
const tdLines = td.map((l, i) => [i + 1, l]).filter(([, l]) => l.includes("至少一条") || l.includes("整条省掉"));
line(`  ── 工具说明（\`DESIGN_TOOL_DESCRIPTION\`，${td.length} 行）里：`);
for (const [n, l] of tdLines) line(`     :${n}  ${cut(l.trim(), 120)}`);
line("     ⇒ 它们在**同一条串**里，相隔 " +
  (tdLines.length > 1 ? tdLines[tdLines.length - 1][0] - tdLines[0][0] : "?") + " 行 —— 第 1 条说「至少一条」、第 2 条说「整条省掉」");
const dpText = G.designPrompt({
  intent: cornerIntent, vws: realVws,
  echo: { runtimeProfile: "platformer/v1", genre: "platformer", camera: realVws.camera.mode },
});
const dp = dpText.split("\n");
const dpIdx = dp.findIndex((l) => l.startsWith("- `mechanics` ——"));
line(`  ── 用户消息里那段台账（\`designPrompt\`，mechanics 那一格在 :${dpIdx + 1}）：`);
for (let i = dpIdx; i < dpIdx + 2; i++) line(`     :${i + 1}  ${cut(dp[i], 200)}`);
line("     ⚠️ **同一格里两句都有**：「只在你能给它挑出一个对家时**才写这一条**；挑不出对家就**整条省掉**」");
line("        和句尾那句「**至少一条**」—— **一行之内自相矛盾**。");
line("  ⇒ 所以这**不是**票 54 那个形状（台账 vs 规矩清单，两份面各说各话）——");
line("     是**同一句话自己跟自己打架**：工具说明里隔 4 行，台账里**同一行**。");

// ── ⑫ 散文第 1 条与 gate ④ 对得齐吗 ─────────────────────────────────────────
line("\n=== ⑫ 散文第 1 条那句「至少一条」与 gate ④ 对得齐吗 ===");
const gd = fs.readFileSync(P("packages/contracts/src/game-design.ts"), "utf8").split("\n");
const g4 = gd.findIndex((l) => l.includes('// ④ 「一条都说不出」的数组'));
line(`  game-design.ts:${g4 + 1}  ${gd[g4].trim()}`);
for (const n of [g4 + 3, g4 + 4, g4 + 5, g4 + 6, g4 + 7, g4 + 8]) line(`  game-design.ts:${n}  ${gd[n - 1].trim()}`);
line("  ⇒ gate ④ 管 **5 个**字段：`coreLoopSteps` · `player.abilities` · `player.goals` · `mechanics` · `levels`");
line("  ⇒ 散文第 1 条点名的也是**同样这 5 个**（工具说明 :191）—— **一个不多、一个不少**");
line("  ⇒ ⚠️ 所以散文第 1 条是 gate ④ 的**忠实镜像**，打架的是**第 2 条**（那个角）——");
line("     而第 2 条只对 `mechanics` 一个字段说话（8 值枚举只有机制那张）");
})();
