#!/usr/bin/env node
/**
 * 票 74 探针：**把「`mechanics` 非空」从 gate ④ 拆出去之后，会发生什么**
 *
 * **为什么要有它**：票 74 的 Q1 是「归 schema（现状）还是归 R12（拆）」。
 * 票 67 的第一轮量的是**今天**的四条路（② / ⑨：判决与价签）；
 * 本探针量的是**拆之后那一支** —— 而它**不必真的改契约就能量出来**，理由是：
 *
 *   `buildDesign` 的三族拒绝里，会因 `mechanics` 变空而变的**只有** `intentCoverage` 一族，
 *   而它**只按 `id` 比**（`intent-coverage.ts`：`hasId(design.mechanics, m.id)`）。
 *   ⇒ 拿一个**保证不与任何意图机制 id 相同**的哨兵 id 填进 `mechanics`，
 *     「非空且对不上」与「空」在 `intentCoverage` 眼里是**同一个集合差**。
 *   ⇒ 于是「拆 gate 之后 `mechanics: []` 会拿到什么」可以在**今天的真代码**上跑出来，
 *     不是推的、不是抄的。§2 有恒等校验自证这一点。
 *
 * 另外量三件票面没有的事：
 *   §3 拆 gate 会不会**开一个洞**（空 mechanics 流到下游）
 *   §4 拆 gate 之后那一档的**账单**（几发 · 账上留什么）
 *   §5 拆 gate 改不改**模型读到的字**（提示词与 gate 是不是两份面）
 *   §6 剩下那 4 格有没有同款「合法为空」的读法
 *
 * **免费**：只 `require` 已构建的 `dist` + 盘上真的 run 产物 + 读源码文本。
 * 不碰网络（`fetch` 由探针自己顶）、不跑管线、零付费、源码一个字节没动。
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../../../..");
const C = require(path.join(ROOT, "packages/contracts/dist/index.js"));
const G = require(path.join(ROOT, "packages/game-design/dist/index.js"));

const P = (...p) => path.join(ROOT, ...p);
const load = (p) => JSON.parse(fs.readFileSync(P(p), "utf8"));
const line = (s) => console.log(s);

const RAW = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/";
const BASE = "run-out-2026-10-13b/.failed-2026-10-13T09-22-52-685Z/";
const baseIntent = load(RAW + BASE + "game-intent.json");
const baseDesign = load(RAW + BASE + "game-design.json");
const realVws = load(RAW + "run-out-2026-10-13h/ruined-city-scavenger/run/v1/visual-world.json");

const CORNER = [
  { id: "turn-based-combat", name: "回合制战斗" },
  { id: "skill-tree", name: "技能树" },
  { id: "dialogue-choice", name: "对话选择" }
];
const cornerIntent = { ...baseIntent, mechanics: CORNER };

/** 哨兵 id：保证不与任何意图机制撞名 ⇒ 「非空且全对不上」与「空」在覆盖判据眼里等价。 */
const SENTINEL = "__split_probe_absent__";
const sentinelDesign = (d) => ({ ...d, mechanics: [{ id: SENTINEL, mechanic: "run" }] });
const emptyDesign = (d) => ({ ...d, mechanics: [] });

for (const [nm, it] of [["corner", cornerIntent], ["base", baseIntent]])
  if (it.mechanics.some((m) => m.id === SENTINEL)) throw new Error(`哨兵 id 撞上了 ${nm} 的机制`);

line("=== ⓪ 台子 ===");
line(`  底子：盘上 ${BASE.replace(/\/$/, "")} 那一对（票 67 ② 量过：今天两边都过契约）`);
line(`  意图机制：base ${baseIntent.mechanics.length} 条（${baseIntent.mechanics.map((m) => m.id).join(" · ")}）`);
line(`            corner ${CORNER.length} 条（一条都挑不出对家）`);
line(`  哨兵 id = \`${SENTINEL}\`（与两份意图的机制 id 都不撞）`);
line(`  MECHANICS（8）：${C.MECHANICS.join(" · ")}`);

// ── §1 拆 gate 的**唯一**障碍 ────────────────────────────────────────────────
line("\n=== §1 拆 gate 的唯一障碍：那一份空 mechanics 的设计，还有没有别的判据在拒它 ===");
{
  const q = C.GameDesignSpecSchema.safeParse(emptyDesign(baseDesign));
  line(`  \`GameDesignSpecSchema.safeParse({...baseDesign, mechanics: []})\` ⇒ success = ${q.success}`);
  if (!q.success) {
    const issues = q.error.issues;
    line(`  它一共报了 **${issues.length}** 条 issue：`);
    for (const i of issues) line(`      · path=${JSON.stringify(i.path)} ⇒ ${i.message.slice(0, 70)}…`);
    const onMechanics = issues.filter((i) => i.path[0] === "mechanics").length;
    line(`  其中落在 \`mechanics\` 那一格上的：**${onMechanics} / ${issues.length}**`);
    line(onMechanics === issues.length
      ? "  ⇒ ⭐ **唯一的障碍就是那一格**（superRefine 是一组并列的 issue）⟹ 把它去掉，这份设计**当场 parse 得过**"
      : "  ⚠️ 除了那一格**还有别的** ⇒ 拆 gate 不构成「parse 就过」，票面这句要改");
  }
}

// ── §2 拆 gate 之后会拿到什么（等价测量）────────────────────────────────────
line("\n=== §2 拆 gate 之后 `mechanics: []` 拿到的那份 rejections —— 用真 `buildDesign` 跑出来 ===");
line("  （等价性：`intentCoverage` 只按 id 比；哨兵 id 不与任何意图机制撞名");
line("    ⇒ 「空」与「一条对不上的非空」在它眼里是同一个集合差）");
const runSplit = (label, intent, design) => {
  // ⚠️ 正向：真的是空
  const missingEmpty = C.auditIntentCoverage(intent, emptyDesign(design));
  // ⚠️ 等价形状：非空 + 哨兵（parse 得过 ⇒ 能喂进真 buildDesign）
  const missingSentinel = C.auditIntentCoverage(intent, sentinelDesign(design));
  const r = G.buildDesign({ fromModel: sentinelDesign(design), intent, vws: realVws, profile: C.PLATFORMER_V1 });
  line(`\n  ── ${label}`);
  line(`     恒等校验：空 ⇒ ${missingEmpty.length} 条缺 · 哨兵 ⇒ ${missingSentinel.length} 条缺 · ` +
       `**${JSON.stringify(missingEmpty) === JSON.stringify(missingSentinel) ? "相同 ✔" : "不同 ✘（等价性不成立，下面的读数作废）"}**`);
  if (r.ok) { line("     ⇒ `ok: true`（拆之后这一档会放行）—— ⚠️ 那与 §3 冲突，要查"); return; }
  if (r.kind === "schema") { line(`     ⇒ 还是 schema：${r.detail.slice(0, 80)}…`); return; }
  line(`     ⇒ kind = \`rejected\` · **${r.rejections.length} 条**拒绝`);
  for (const rej of r.rejections) line(`        · [${rej.reason}] ${rej.detail}`);
  line("     ⇒ 退到人眼前的 detail（`build-design.ts` 用「；」拼）长度 = " + r.detail.length + " 字");
};
runSplit("corner 意图（3 条机制一条都对不上）", cornerIntent, baseDesign);
runSplit("base 意图（真实那一份）", baseIntent, baseDesign);

// ── §3 拆 gate 会不会**开一个洞** ────────────────────────────────────────────
line("\n=== §3 拆 gate 会不会开洞：空 mechanics 的设计流得到下游吗 ===");
{
  const qi = C.GameIntentSpecSchema.safeParse({ ...baseIntent, mechanics: [] });
  line(`  ① 意图层自己那条「\`mechanics\` 至少一条」（\`game-intent.ts:214-219\`）——`);
  line(`     \`GameIntentSpecSchema.safeParse({...baseIntent, mechanics: []})\` ⇒ success = **${qi.success}**（应为 false）`);
  // 盘上 12 对真意图各跑一遍
  const pairs = [];
  const walk = (d) => {
    let ents = [];
    try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
      else if (e.name === "game-intent.json" && fs.existsSync(path.join(d, "game-design.json")))
        pairs.push([p, path.join(d, "game-design.json")]);
    }
  };
  walk(path.join(ROOT, ".scratch"));
  let n = 0, min = Infinity, okIntent = 0;
  for (const [ip, dp] of pairs) {
    const it = JSON.parse(fs.readFileSync(ip, "utf8"));
    if (!C.GameIntentSpecSchema.safeParse(it).success) continue;
    okIntent++;
    const miss = C.auditIntentCoverage(it, emptyDesign(JSON.parse(fs.readFileSync(dp, "utf8"))));
    if (miss.length > 0) n++;
    min = Math.min(min, miss.length);
  }
  line(`  ② 盘上**过今天意图契约**的那 ${okIntent} 份意图，拿一份 \`mechanics: []\` 的设计去撞 R12：`);
  line(`     被点名的有 **${n} / ${okIntent}** 份 · 最少的也有 **${min}** 条 ⇒ ` +
       (n === okIntent ? "**每一份都有话可说**" : "⚠️ 有的一份都不点名 —— 那会开洞"));
  // ⚠️ 上面那一格只有 1 份样本（今天的意图契约很严，历史产物多数过不了）。
  //   把**全部** 12 份意图的 mechanics 长度也列出来 —— 那才是这条论证的真正宽度：
  //   论点不是「盘上那份碰巧有几条」，而是「**过契约 ⟹ ≥1 条**」（gate ③ 本身保证）。
  const lens = [];
  for (const [ip] of pairs) {
    const it = JSON.parse(fs.readFileSync(ip, "utf8"));
    lens.push(Array.isArray(it.mechanics) ? it.mechanics.length : -1);
  }
  lens.sort((a, b) => a - b);
  line(`     旁证：盘上**全部** ${pairs.length} 份意图的 \`mechanics\` 长度（升序）= [${lens.join(", ")}]`);
  line("     ⚠️ 而这条论证**不靠样本**：\`game-intent.ts\` 自己那条 gate 就写着「至少一条」");
  line("        ⇒ **任何**过契约的意图都有 ≥1 条机制 ⇒ 空 mechanics 的设计**必然**对上它");
  line("  ⇒ ⭐ **只要意图过契约（≥1 条机制），空 mechanics 的设计就必然被 R12 拒**");
  line("     ⟹ 拆 gate **不会**让「零机制的设计」流到下游——它换了一条路被挡住，而那条路会说话");
}

// ── §4 账单：拆前 / 拆后 ────────────────────────────────────────────────────
line("\n=== §4 那一档的账单（真 `compileDesign` + 探针顶的假 `fetch`）===");
const replyBody = (design) => ({
  content: [{ type: "tool_use", name: G.DESIGN_TOOL_NAME, input: design }],
  stop_reason: "tool_use", model: "deepseek-flash",
  usage: { input_tokens: 2400, output_tokens: 2600 },
});
const costOf = async (label, design, note) => {
  const seen = [];
  const fetchImpl = async (_url, init) => {
    seen.push(String(init.body));
    const body = replyBody(design);
    return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
  };
  let verdict, led = "", rej = "";
  try {
    const r = await G.compileDesign({
      intent: baseIntent, vws: realVws,
      transport: { baseUrl: "http://upstream.test", apiKey: "k" }, fetchImpl,
    });
    verdict = "**过了**（`ok`）—— 链往下走";
    if (r.ledger) led = `attempts=${r.ledger[0].attempts} · failures=${JSON.stringify(r.ledger[0].failures ?? null)}`;
  } catch (e) {
    if (Array.isArray(e.rejections)) {
      verdict = `抛 \`${e.name}\`（R12 的拒绝）—— **当场停**`;
      rej = ` · rejections=${e.rejections.length} 条`;
    } else verdict = `抛 \`${e.name}\`（\`failure: ${e.failure}\`）—— **三发打完**才停`;
    if (e.ledger) led = `attempts=${e.ledger[0].attempts} · failures=${JSON.stringify(e.ledger[0].failures ?? null)}`;
  }
  const uniq = new Set(seen).size;
  line(`\n  ── ${label}`);
  line(`     ${note}`);
  line(`     ⇒ 付费往返 **${seen.length}** 次 · 发出去的 body **${uniq}** 种` +
    (seen.length > 1 && uniq === 1 ? "（**逐字节相同**）" : ""));
  line(`     ⇒ 结局：${verdict}${rej}`);
  line(`     ⇒ 账：${led}`);
  return seen.length;
};

// ── §5 拆 gate 改不改**模型读到的字** ───────────────────────────────────────
line("\n=== §5 拆 gate 改不改模型读到的字（提示词与 gate 是不是两份面）===");
{
  const dump = (title, text, pats) => {
    const ls = text.split("\n");
    line(`  ── ${title}（共 ${ls.length} 行）`);
    ls.forEach((s, i) => { if (pats.some((p) => s.includes(p))) line(`     :${i + 1}  ${s.trim().slice(0, 190)}`); });
  };
  dump("工具说明 `DESIGN_TOOL_DESCRIPTION`", G.DESIGN_TOOL_DESCRIPTION, ["至少一条", "整条省掉"]);
  const dp = G.designPrompt({ intent: cornerIntent, vws: realVws, echo: { runtimeProfile: "platformer/v1", genre: "platformer", camera: "side" } });
  dump("用户消息 `designPrompt`（corner 意图）", dp, ["至少一条", "整条省掉"]);
  const src = fs.readFileSync(P("packages/game-design/src/prompts.ts"), "utf8").split("\n");
  const hits = [];
  src.forEach((s, i) => { if (s.includes("GameDesignSpecSchema")) hits.push(`:${i + 1}  ${s.trim()}`); });
  line(`  证据：\`prompts.ts\` 里提到 \`GameDesignSpecSchema\` 的**只有 ${hits.length} 处**，而它是：`);
  for (const h of hits) line(`     ${h}`);
  line("     ⇒ 那是一句**注释**（「键集必须与 `GameDesignSpecSchema` 逐字对齐」）—— 提示词**不读 gate**");
  line("     ⚠️ 而那一处说的是**键集**：拆的是 \`superRefine\`（键集不动）⇒ 那条对齐测试也不受影响");
  line("  ⇒ ⭐ 拆 gate **不改模型读到的任何一份字节**：两处「至少一条」都还在原处");
  // ⚠️ 而散文那一半**有一张测试盯着**：票 54 亲手把「整条省掉」写进去、并 pin 住它。
  const t = fs.readFileSync(P("packages/game-design/tests/design-prompts.test.ts"), "utf8").split("\n");
  line("  ⚠️ 散文里的「整条省掉」是**票 54 刻意加的、还有测试 pin 着**：");
  t.forEach((s, i) => { if (s.includes("不再打架")) line(`     design-prompts.test.ts:${i + 1}  ${s.trim()}`); });
  t.forEach((s, i) => { if (s.includes("只在你能给它挑出一个对家时")) line(`     design-prompts.test.ts:${i + 1}  ${s.trim()}`); });
  line("     ⇒ 票 54 修的是**散文内部**那处打架（台账「id 照抄」vs 第 2 条「整条省掉」）；");
  line("       它**没修、也修不了「散文 vs 机器」**那处 —— 因为机器那一半只认长度");
  line("     ⇒ ⭐ 于是今天这份提示词**主动教模型做一件机器会拒的事**（`mechanics` 台账那一行末尾还留着「至少一条」）");
}

// ── §6 剩下那 4 格有没有同款读法 ────────────────────────────────────────────
line("\n=== §6 gate ④ 管 5 格，其余 4 格有没有同款「合法为空」的读法 ===");
{
  const src = fs.readFileSync(P("packages/game-design/src/prompts.ts"), "utf8").split("\n");
  for (const f of ["coreLoopSteps", "player.abilities", "player.goals", "levels"]) {
    const hits = [];
    src.forEach((s, i) => { if (s.includes(f) && /省掉|留空|空数组|为空/.test(s)) hits.push(`:${i + 1} ${s.trim().slice(0, 150)}`); });
    line(`  · \`${f}\` —— 散文里「可以省掉 / 留空」的出现次数 = **${hits.length}**`);
    for (const h of hits) line(`      ${h}`);
  }
  line("  ⇒ ⚠️ 「挑不出对家就整条省掉」这句**只对 `mechanics` 一个字段说话**（8 值封闭枚举只有机制那一张）");
}

(async () => {
  line("\n=== §4（续）账单：拆前 / 拆后 ===");
  const a = await costOf("对照 · 盘上原样的那一份", baseDesign, "台子诚实的证明");
  const b = await costOf("今天 · 照散文做（`mechanics: []`）", emptyDesign(baseDesign),
    "⚠️ 这一份**连 parse 都过不了** ⇒ 每一发都要走完 `schema` 那一档");
  const c = await costOf("拆之后 · 同一条输入（哨兵等价形状）", sentinelDesign(baseDesign),
    "⭐ 这一格跑的是**今天的真代码**，但它的结局就是拆 gate 之后 `mechanics: []` 的结局（§2 的等价性）");
  line(`\n  ⇒ 同一件事的价签：今天 **${b}** 发 · 拆之后 **${c}** 发（对照 ${a} 发）`);
  console.log(`\n（原始输出由每次重跑覆盖；本文件只用 \`node probe74.cjs > raw-output.txt\` 生成。）`);
})();
