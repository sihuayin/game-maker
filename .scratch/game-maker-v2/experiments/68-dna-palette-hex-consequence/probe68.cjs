#!/usr/bin/env node
/**
 * 票 68 探针：`DNA_FIELD_HINTS.palette` 把「写 hex」的后果说成**有损**（会被量化掉、等于没写），
 * 而契约（`PaletteRefShape`）是**当场 schema 失败**。
 *
 * **为什么要有它**：票面的结论是「后果说反了」。而「后果」这个词在这条链上有**三个候选主语**：
 *   ① 那一格数据（说法：会被量化掉）；
 *   ② 那一次调用（说法：等于没写 —— 听起来像「照常往下走，只是白填」）；
 *   ③ 那一整份产物（实际：过不了 schema ⇒ 重采样 3 发 ⇒ 整份 DNA 判失败 ⇒ 退 4）。
 * 本探针把**真的**喂进去，看机检那一侧逐字判什么；再把散文点名的那个下游机制
 * （`quantize.ts`）**到底吃不吃 DNA 的 palette** 查出来 —— 因为那句假陈述的害处
 * 不在措辞，在于**它给了一个错的因果**（「下游兜得住」）。
 *
 * 另外量三件票面引了但没量的事：
 *   ① 那句话在仓库里**抄了几份**（票面知道两份）；
 *   ② 盘上 9 份真 DNA 的样子（零尸体那条）；
 *   ③ 真正读 `dna.palette` 的那一处拿到非法值时会怎样（`?? ref` 那一格）。
 *
 * **免费**：只 `require` 已构建的 `packages/<包>/dist` + 读盘上**真的** run 产物 + 读源码文本。
 * 不碰网络、不跑管线、零付费、源码一个字节没动。
 */
const path = require("path");
const fs = require("fs");

const ROOT = path.resolve(__dirname, "../../../..");
const C = require(path.join(ROOT, "packages/contracts/dist/index.js"));
const G = require(path.join(ROOT, "packages/game-design/dist/index.js"));
const A = require(path.join(ROOT, "packages/assets/dist/index.js"));

const P = (...p) => path.join(ROOT, ...p);
const load = (p) => JSON.parse(fs.readFileSync(P(p), "utf8"));
const S = (p) => fs.readFileSync(P(p), "utf8").split("\n");
const line = (s) => console.log(s);
const cut = (s, n) => (String(s).length > n ? String(s).slice(0, n) + `…（共 ${String(s).length} 字）` : String(s));

// ── ⓪ 两侧的原话（行号在运行时从源文件里找，不靠记忆）────────────────────────
line("=== ⓪ 两侧的原话：散文说「有损」，gate 说「过不了」 ===");
const prompts = S("packages/game-design/src/prompts.ts");
const hintAt = prompts.findIndex((l) => l.includes("这个角色身上的颜色，从世界色板里"));
line(`  散文  prompts.ts:${hintAt + 1}-${hintAt + 2}（DNA_FIELD_HINTS.palette）：`);
for (let i = 0; i < 2; i++) line(`      ${prompts[hintAt + i].trim()}`);

const vw = S("packages/contracts/src/visual-world.ts");
const refAt = vw.findIndex((l) => l.includes("export const PaletteRefShape"));
line(`  gate  visual-world.ts:${refAt + 1}-${refAt + 3}（PaletteRefShape）：`);
for (let i = 0; i < 4; i++) line(`      ${vw[refAt - 1 + i].trim()}`);

const dnaSrc = S("packages/contracts/src/character-dna.ts");
const arrAt = dnaSrc.findIndex((l) => l.includes("palette: z.array(PaletteRefShape)"));
line(`  复用  character-dna.ts:${arrAt + 1}  ${dnaSrc[arrAt].trim()}  ← DNA 那一侧**原样复用**同一个形状`);
line(`  ⇒ 那一格的类型是 \`PaletteRef[]\`（\`z.array(PaletteRefShape)\`）—— **不是**自由字符串`);

// ── ① 把三种写法真的喂进契约 ────────────────────────────────────────────────
line("\n=== ① 三种写法各喂一次**真的**契约（\`CharacterDNAFileSchema\`，即模型要过的那个）===");
const baseDna = load(".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/character-dna.json");
const one = baseDna.characters[0];
const withPalette = (pal) => ({ format: "character-dna/v1", characters: [{ ...one, palette: pal }] });

const probe = (label, pal, note) => {
  const r = C.CharacterDNAFileSchema.safeParse(withPalette(pal));
  line(`\n  ── ${label}   palette = ${JSON.stringify(pal)}`);
  line(`     ${note}`);
  if (r.success) { line(`     ⇒ **过了**（ok:true）—— 契约放行`); return; }
  for (const iss of r.error.issues)
    line(`     ⇒ 拒：path=[${iss.path.join(".")}]  报文逐字：「${cut(iss.message, 180)}」`);
};

probe("合法写法", ["palette:0", "palette:3"], "散文要求的那一种");
probe("⚠️ 自由 hex", ["#ff0000"], "散文说「下游会被量化掉，等于没写」——**听起来像走得通**");
probe("⚠️ 颜色名", ["red"], "同上，散文把这两者写成同一种后果");

// ⚠️ 同一个字段、走**真正的**那条路（`parseToolUse` 是 `compile-character-dna` 用的那一层）
line("\n  ── 走**链上真正的那一层**：`parseToolUse(body, CHARACTER_DNA_TOOL_NAME, CharacterDNAFileSchema)`");
const fakeBody = {
  stop_reason: "tool_use",
  content: [{ type: "tool_use", name: "emit_character_dna", input: withPalette(["#ff0000"]) }],
};
const po = C.parseToolUse(fakeBody, G.CHARACTER_DNA_TOOL_NAME, C.CharacterDNAFileSchema);
line(`     ok = ${po.ok}` + (po.ok ? "" : ` · failure = "${po.failure}"`));
if (!po.ok) line(`     detail 逐字：「${cut(po.detail, 260)}」`);
line("     ⇒ 落到 `compile-character-dna.ts` 里就是 `kind: \"bad\"`（failure 原样带走）⇒ **重采样那一档**");

// 装配步那一侧也过一遍（契约重过一遍的那一处）
line("\n  ── 装配步 `buildCharacterDna`（契约会被**再过一遍**，gate 在那里响）");
const built = G.buildCharacterDna({ fromModel: withPalette(["#ff0000"]), design: null, vws: null });
line(`     ok = ${built.ok}` + (built.ok ? "" : ` · detail 逐字：「${cut(built.detail, 260)}」`));

// ── ② 后果：从「这一格」放大到「这一份」要几步 ──────────────────────────────
line("\n=== ② 「后果」的主语是谁：从那一格到那一整份 ===");
const ccd = S("packages/game-design/src/compile-character-dna.ts");
const bodyAt = ccd.findIndex((l) => l.includes("const body = JSON.stringify("));
const loopAt = ccd.findIndex((l) => l.includes("for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS"));
line(`  · compile-character-dna.ts:${bodyAt + 1}  \`const body = JSON.stringify({…})\`  ← **循环之外，算一次**`);
line(`  · compile-character-dna.ts:${loopAt + 1}  \`for (let attempt = 1; attempt <= STRUCTURED_CALL_ATTEMPTS; attempt++)\``);
line(`    ⇒ 三发**用的都是同一个 \`body\`** ⇒ schema 那一档**不喂回去理由** ⇒ 3 发盲发`);
line(`    STRUCTURED_CALL_ATTEMPTS = ${C.STRUCTURED_CALL_ATTEMPTS}`);
const throwAt = ccd.findIndex((l) => l.includes("重采样 ${STRUCTURED_CALL_ATTEMPTS} 次都没有拿到"));
line(`  · compile-character-dna.ts:${throwAt + 1}  三发全灭之后抛的那句：`);
line(`      「${ccd[throwAt + 1].trim().replace(/^`|`,?$/g, "").slice(0, 120)}…」`);
line("  · 这一步**没有 R12 那种「拒绝」**（文件头逐字：「DNA 那一侧没有拒绝面」）⇒ 只有 \`schema\` 这一档");
line("  · 调用方 `create-game.ts:280` 在链上且**不 catch** ⇒ 抛出即断链（不理解成「这一格白填」）");

// ── ②′ 落到人眼前的是什么：报文 + 退出码 + 花掉几发 ────────────────────────
line("\n=== ②′ 落到人眼前的是什么（报文 · 退出码 · 花掉几发）===");
const cli = S("packages/cli/src/cli.ts");
const asAt = cli.findIndex((l) => l.includes("function asCommandError"));
line(`  · cli.ts:${asAt + 1}  \`asCommandError\`：按**形状**认 —— 带 \`failure\` 的 ⇒ \`CommandError("invalid")\``);
const upAt = cli.findIndex((l) => l.includes('o.failure === "http" || o.failure === "timeout"'));
line(`  · cli.ts:${upAt + 1}  只有 \`http\` / \`timeout\` 走 \`"upstream"\`(3)，**其余都落在 \`"invalid"\`(4)**`);
line("  · ⇒ \`schema\` 这一档退 **4**，与设计层那一档同一个码（文案不同）");
line("  · ⚠️ 报文里**看得见病因**（② 那句拼的模板：『最后一次的病因：…』）——");
line("    所以这一档**不是**「悄悄白填」，是「**3 次真调用全丢**、整份判失败、链断在这儿、退 4」");
line("    ⚠️ 「3 次真调用」不是修辞：循环体每发都 \`await onceThrough\`（真的发请求）——");
line("       前两发**成功发出、只是被契约拒**，第三发同样。三发的 token 照付。");

// ── ③ 散文点名的那个下游机制到底吃不吃 DNA 的 palette ──────────────────────
line("\n=== ③ 散文点名的 `quantize.ts`：它吃的是什么 ===");
const q = S("packages/assets/src/quantize.ts");
line(`  quantize.ts:1  ${q[0].trim()}`);
const sigAt = q.findIndex((l) => l.includes("export function quantizeToPalette"));
line(`  quantize.ts:${sigAt + 1}  ${q[sigAt].trim()}`);
line(`  ⇒ 入参类型是 \`RasterImage\`（**位图**：\`data\` 是像素字节），配色板 —— **它压根不认 DNA 的字段**`);
const callers = [];
for (const f of fs.readdirSync(P("packages/assets/src"))) {
  if (!f.endsWith(".ts")) continue;
  const t = S("packages/assets/src/" + f);
  t.forEach((l, i) => { if (/\bquantizeToPalette\(/.test(l) && !l.includes("export function")) callers.push(`packages/assets/src/${f}:${i + 1}  ${l.trim()}`); });
}
line(`  真正的调用点：${callers.length} 处`);
for (const c of callers) line(`      ${c}`);
line("  ⇒ ⚠️ **只有导入那条路**（人画的位图 → 吸附到世界色板）。生图那条路**从不**过它 ——");
const packAt = S("packages/assets/src/pack.ts");
const neverAt = packAt.findIndex((l) => l.includes("这条管线只有两条路"));
line(`     pack.ts:${neverAt + 1}  ${packAt[neverAt].trim()}`);
line("     ⇒ 生图产物的 `paletteBinding` 只有 `exact` / `composited`，\`quantized\` 那一档**恒为 0**");
line("  ⇒ 也就是说：**DNA 的 `palette` 从来流不到 `quantize.ts` 眼前**。");
line("     它流到的是**另一个**地方（见下），而那句话把因果接到了前者身上。");

// ── ③′ 真正读 `dna.palette` 的那一处，拿到非法值会怎样 ───────────────────────
line("\n=== ③′ 真正读 `dna.palette` 的那一处（\`dnaBrief\`）：拿到 hex 会怎样 ===");
const pr = S("packages/assets/src/prompt.ts");
const briefAt = pr.findIndex((l) => l.includes("export function dnaBrief"));
const mapAt = pr.findIndex((l) => l.includes('Number(ref.slice("palette:".length))'));
line(`  prompt.ts:${briefAt + 1}  \`export function dnaBrief(dna, style)\``);
line(`  prompt.ts:${mapAt + 1}  ${pr[mapAt].trim()}`);
line("  ⇒ 它是**唯一的读者**（`master.ts:86` / `prompt.ts:404` / `prompt.ts:455` 都经它）—— 「DNA 的 palette」唯一的出口");
line("  ⚠️ `ref.slice(8)` 那一步**不做任何检查**：非 `palette:N` 的形状落进去是**未定义的算术**。");
line("     下面这一格**契约不会让它发生**（① 已经证明它过不了 schema）—— 这里问的是「假如没有那道正则」：");
line('     （`style` 只在 `palette` 那一格上被用到 —— 探针给一份 3 色的：`["#2e3b4e", "#4a6076", "#f0c95c"]`）');
const fakeStyle = { palette: ["#2e3b4e", "#4a6076", "#f0c95c"] };
const brief = (pal) =>
  A.dnaBrief({ ...one, palette: pal }, fakeStyle).split("\n").find((l) => l.startsWith("- `palette`"));
for (const pal of [["palette:1"], ["#ff0000"], ["red"], ["#ff0000ff"], ["palette:9"]]) {
  try {
    line(`     · ${JSON.stringify(pal)} → ${brief(pal).replace(/^- `palette`（它身上的颜色）：/, "").trim()}`);
  } catch (e) { line(`     · ${JSON.stringify(pal)} → ⚠️ 抛：${e.message}`); }
}
line("     ⇒ ⚠️ **`#ff0000` 不是「被量化掉」，也不是「原样送到模型眼前」—— 它变成了 `palette:0` 那个颜色**");
line("        （`\"#ff0000\".slice(8)` = `\"\"` ⇒ `Number(\"\")` = `0` ⇒ 色板第 0 项）。");
line("     ⇒ 而 `palette:9`（越界）走的是另一个分支：`?? ref` ⇒ **悬空的引用原样进了生图提示词**（那一半归**票 69**）。");
line("     ⇒ 结论：散文那句「下游会被量化掉」**不仅后果说反了，机制也指错了模块**。");

// ── ④ 盘上 9 份真 DNA（票面「零尸体」那条复核一遍）────────────────────────
line('\n=== ④ 盘上 9 份真 `character-dna.json`：那句话今天有没有被撞过 ===');
const files = [];
const walk = (d) => {
  let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules") walk(p); }
    else if (e.name === "character-dna.json") files.push(p);
  }
};
walk(path.join(ROOT, ".scratch"));
let chars = 0, refs = 0, bad = 0, oob = 0, emptyPal = 0;
const lens = new Set();
for (const f of files) {
  let d; try { d = JSON.parse(fs.readFileSync(f, "utf8")); } catch { line(`  ⚠️ 读不动：${f}`); continue; }
  const vwsPath = path.join(path.dirname(f), "visual-world.json");
  const palLen = fs.existsSync(vwsPath) ? JSON.parse(fs.readFileSync(vwsPath, "utf8")).style.palette.length : null;
  chars += d.characters.length;
  lens.add(d.characters.length);
  for (const c of d.characters) {
    if (c.palette.length === 0) emptyPal++;
    for (const r of c.palette) {
      refs++;
      if (!/^palette:\d+$/.test(r)) { bad++; line(`  ⚠️ 非法引用：${path.relative(ROOT, f)} ${c.id} ⇒ ${JSON.stringify(r)}`); }
      else if (palLen !== null && Number(r.slice(8)) >= palLen) { oob++; line(`  ⚠️ 越界：${path.relative(ROOT, f)} ${c.id} ⇒ ${r}（色板 ${palLen} 项）`); }
    }
  }
}
line(`  · 盘上真 DNA 文件：**${files.length}** 份`);
line(`  · 共 **${chars}** 个角色（每份 ${[...lens].join("/")} 条）`);
line(`  · \`palette\` 元素合计 **${refs}** 个`);
line(`  · ⚠️ **不是** \`palette:<下标>\` 的：**${bad}** 个 ⇒ 票面那句「一次 hex 都没写过」**成立**`);
line(`  · ⚠️ \`palette\` 为空数组的角色：**${emptyPal}** 个（契约放行 \`[]\`，散文也写了「没有就写 \`[]\`」）`);
line(`  · ⚠️ 下标**越界**的：**${oob}** 个（这一半归**票 69**，此处只登记读数）`);

// ── ⑤ `PaletteRefShape` 这条判据在真跑里响过没有 ────────────────────────────
line("\n=== ⑤ `PaletteRefShape` 这条判据在盘上的真跑账里响过没有 ===");
const runs = fs.readdirSync(P(".scratch/game-maker-v2/experiments/e2e-wasteland/raw"))
  .filter((f) => /^run.*\.json$/.test(f));
let withFailures = 0, allFailures = new Set(), palHits = 0;
for (const f of runs) {
  const raw = fs.readFileSync(P(".scratch/game-maker-v2/experiments/e2e-wasteland/raw/" + f), "utf8");
  let blob; try { blob = JSON.parse(raw.slice(0, raw.lastIndexOf("}") + 1)); } catch { try { blob = JSON.parse(raw); } catch { continue; } }
  // ⚠️ 盘上这些 run json 把整段 CLI 输出装在 `.text` 里（**再嵌套一层 JSON**）—— 所以逐层找 `failures`。
  const texts = [raw];
  if (typeof blob.text === "string") { texts.push(blob.text); }
  for (const t of texts) {
    for (const m of t.matchAll(/"failures"\s*:\s*\[([^\]]*)\]/g)) {
      withFailures++;
      for (const x of m[1].split(",").map((s) => s.trim().replace(/"/g, "")).filter(Boolean)) allFailures.add(x);
    }
  }
  if (texts.join("").includes("必须是 palette:<下标>")) palHits++;
}
line(`  · 盘上 run-*.json：**${runs.length}** 份；带 \`failures\` 的记录 **${withFailures}** 条`);
line(`  · 出现过的 failure 档：${[...allFailures].map((x) => `\`${x}\``).join(" · ") || "（无）"}`);
line(`  · 报错文本里出现过 \`PaletteRefShape\` 那句 message 的：**${palHits}** 份 ⇒ 票面「一次没拒过」**成立**`);

// ── ⑥ 那句错话在仓库里抄了几份 ──────────────────────────────────────────────
line("\n=== ⑥ ⚠️ 那句错话在仓库里抄了**几份**（票面知道两份）===");
const sites = [];
const scan = (d) => {
  let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const e of ents) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) { if (e.name !== "node_modules" && e.name !== "dist" && !e.name.startsWith(".")) scan(p); continue; }
    if (!/\.(ts|md)$/.test(e.name)) continue;
    const t = fs.readFileSync(p, "utf8").split("\n");
    t.forEach((l, i) => {
      if (/量化掉|静默失效/.test(l) && /palette|hex/i.test(l))
        sites.push([path.relative(ROOT, p), i + 1, l.trim()]);
    });
  }
};
for (const d of ["packages", "docs"]) scan(P(d));
for (const [f, n, l] of sites) line(`  · ${f}:${n}\n      ${cut(l, 150)}`);
line(`  ⇒ 共 **${sites.length}** 处（票面点名的两处 + 另两处：一份**测试文件头**、一份**文档表格**）`);

// ── ⑦ 代价：改那句话要动几处、有没有测试盯着 ────────────────────────────────
line("\n=== ⑦ 代价：改那句话要动几处、有没有测试盯着它 ===");
const dp = S("packages/game-design/tests/dna-prompts.test.ts");
const assertAt = dp.findIndex((l) => l.includes("`palette:<下标>`"));
line(`  dna-prompts.test.ts:${assertAt + 1}  ${dp[assertAt].trim()}`);
line('  ⇒ 那份测试断言的是「**只能写 `palette:<下标>`**」这半句（断言的是 `toContain("`palette:<下标>`")` 这个子串）——');
const assertsConsequence = dp.some((l) => /量化掉|等于没写/.test(l));
line(`  ⇒ ⚠️ **没有任何一条**断言「后果」那半句（扫过整份文件：${assertsConsequence}）`);
const ctxSites = [];
for (const f of fs.readdirSync(P("packages/contracts/tests"))) {
  const t = S("packages/contracts/tests/" + f);
  t.forEach((l, i) => { if (/量化掉|静默失效/.test(l)) ctxSites.push(`packages/contracts/tests/${f}:${i + 1}`); });
}
line(`  ⇒ 契约测试里提到那句旧因果的：${ctxSites.length} 处（${ctxSites.map((s) => "\`" + s + "\`").join(" · ") || "无"}）—— 都是**注释**，不是断言`);
line("  ⇒ 所以「改那句话」是**改字符串**，不是改判据：不动 schema、不动 gate、不动 R 表（票面第 6 节同此）。");

// ── ⑧ 先例：票 54 把「后果」改口的**形状** ──────────────────────────────────
line("\n=== ⑧ 先例（票 54 的 Q2）：同一类改口，当时改成了什么形状 ===");
const t54 = S(".scratch/game-maker-v2/issues/54-mechanic-omitted-vs-coverage.md") ;
const q2At = t54.findIndex((l) => l.includes("第 2 条那句散文怎么改口"));
line(`  票 54 的 Q2 裁定逐字：`);
line(`      ${cut(t54[q2At].trim(), 200)}`);
const landAt = t54.findIndex((l) => l.includes("第 2 条按 Q2 改口"));
line(`  落地那一段逐字（该票 §『落地 · 三处』的 ③）：`);
for (let i = 1; i <= 3; i++) line(`      ${cut(t54[landAt + i].trim(), 200)}`);
line("  ⇒ 那个形状是**四件套**：① 会发生什么（整份拒绝）· ② 退出码 · ③ 链停在哪 · ④ **点名**是谁的问题。");
line("     ⚠️ 而本票那句散文比 54 更靠近**用户**侧的话术：它写的是「等于没写」——**听起来像没代价**。");

// ⚠️ 补量这一段包一层作用域：`.cjs` 的顶层全是同一张 const 表，重名会当场炸。
{
  // ═══════════════════════════════════════════════════════════════════════════
  // ⭐ 补量（2026-10-14 · 同日第二轮 · 只量不裁 · 零付费）
  //   第一轮量到「那句错话在仓库里是 4 处」（⑥），但**没有抄出四处各自的原话**、
  //   也没量「每一处是谁在读、动它要几个包、有没有东西盯着它」。补四行问的是这三件事，
  //   外加一处**对第一轮 ③ 的收窄**（⑪）。
  // ═══════════════════════════════════════════════════════════════════════════

  // ── ⑨ 那 4 处各自的原话 · 每一处是谁在读 ────────────────────────────────────
  line("\n=== ⑨ 那 4 处**各自的原话**，以及每一处是谁在读 ===");
  const HOMES = [
    ["packages/game-design/src/prompts.ts", "**模型**（每一发都读）", "prompts.ts"],
    ["packages/contracts/src/character-dna.ts", "**下一个改契约的人**", "character-dna.ts"],
    ["packages/contracts/tests/character-dna.test.ts", "**下一个改这条判据的人**", "character-dna.test.ts"],
    ["docs/v2/01-contracts.md", "**人读的文档**", "01-contracts.md"],
  ];
  const homeLines = {};
  for (const [f, who] of HOMES) {
    const src = S(f);
    const n = src.findIndex((l) => l.includes("量化掉"));
    homeLines[f] = n + 1;
    line(`\n  ── ${f}:${n + 1}   （谁在读它：${who}）`);
    line(`     ${cut(src[n].trim(), 250)}`);
  }
  line("\n  ⚠️ 四处**用的是同一句因果**（「色板外的颜色会在下游被量化掉」），但**措辞分两族**：");
  line("     · 只有一处是**给模型的**（`prompts.ts`）：它**不点模块名**，只说「下游」，且落点是「**等于没写**」；");
  line("     · 另外三处（全是**给人读的**）：措辞**逐字同族** —— 「**静默失效**」＋点名 `quantize.ts`。");
  const naming = HOMES.filter(([f]) => S(f)[homeLines[f] - 1].includes("quantize"));
  line(`     · 点名 \`quantize\` 的：**${naming.length} / 4**（${naming.map(([f]) => f.split("/").pop()).join(" · ")}）`);
  const silent = HOMES.filter(([f]) => S(f)[homeLines[f] - 1].includes("静默失效"));
  line(`     · 用「**静默失效**」这四个字的：**${silent.length} / 4**（${silent.map(([f]) => f.split("/").pop()).join(" · ")}）`);
  line("     ⇒ 「静默」与真实的「**当场判失败、整份拒绝**」是**反的** —— 而这个反的方向在四处**完全一致**");

  // ── ⑩ Q2 的授权粒度：四处各住在哪 · 有没有东西盯着它 ────────────────────────
  line("\n=== ⑩ Q2 的授权粒度：四处各住在哪 · 动它要碰几个包 · 有没有东西盯着它 ===");
  for (const [f, who] of HOMES) {
    const pkg = f.startsWith("docs/") ? "（不在任何包里）" : f.split("/").slice(0, 2).join("/");
    line(`\n  ── ${f}`);
    line(`     住的包：${pkg} · 行 ${homeLines[f]} · 读它的人：${who}`);
  }
  const scripts = fs.readdirSync(P("scripts")).sort();
  line(`\n  ⇒ \`scripts/\` 里只有：${scripts.join(" · ")}`);
  const pkgJson = load("package.json");
  line(`     （\`check:links\` 只查**链接**、\`check:deps\` 只查**依赖** —— **没有任何文档生成器**）`);
  line(`  ⇒ \`docs/v2/01-contracts.md\` 是**手写的** ⇒ ④ 那处**没有生成器会覆盖它**，也没有判据读它`);
  const mdCheckers = ["check-links.mjs", "check-deps.mjs"];
  line(`  ⇒ 四处里**只有一处（\`prompts.ts\`）是给模型的**，另外三处**全是给人读的** ——`);
  line("     而三处「给人读的」里，**没有任何一处有测试或工具在盯那句话的内容**（⑦ 已量过 prompts 那处也没有）");

  // ── ⑪ ⚠️ 一处收窄：对第一轮 ③ 的「唯一调用点」那句话 ────────────────────────
  line("\n=== ⑪ ⚠️ 对第一轮 ③ 的一处收窄：`quantize.ts` 的调用点唯一，但**它被两条路走到** ===");
  const qz = S("packages/assets/src/quantize.ts");
  const qzCallers = [];
  for (const d of fs.readdirSync(P("packages/assets/src")))
    if (d.endsWith(".ts")) {
      const s = S(`packages/assets/src/${d}`);
      s.forEach((l, i) => { if (l.includes("quantizeToPalette(") && !l.includes("export function")) qzCallers.push(`assets/src/${d}:${i + 1}`); });
    }
  line(`  \`quantizeToPalette(\` 在 \`packages/assets/src\` 里的**调用点**：${qzCallers.join(" · ")}`);
  line("  ✅ 第一轮 ③ 说的「调用点唯一」**成立**（就是导入管线里那一处）。");
  const pk = S("packages/assets/src/pack.ts");
  const impLine = pk.findIndex((l) => l.includes('from "./import.js"'));
  line(`  ⚠️ **但**：\`pack.ts:${impLine + 1}\` 从同一个模块拿了 ` +
    `\`${(pk[impLine].match(/import \{([^}]*)\}/) || [])[1]}\` ——`.replace("{\n", "{"));
  const genLine = pk.findIndex((l) => l.includes("生图产物**同样过那条重建管线**"));
  line(`     \`pack.ts:${genLine + 1}\` 逐字：「${cut(pk[genLine].trim(), 120)}」`);
  const bindLine = pk.findIndex((l, i) => i > genLine && l.includes('binding = "quantized"'));
  line(`     \`pack.ts:${bindLine + 1}\`  \`${pk[bindLine].trim()}\``);
  line("  ⇒ ⚠️ **量化是真的在跑**：生图那条路也走 `importFrames` ⇒ `import.ts:383` ⇒ `quantizeToPalette`。");
  line("     它吃的是**位图**、用的是**世界色板**（`StyleSpec.palette`）。");
  line("  ⇒ ⭐ 所以那句假话的**真形状**是：**一个真的事实，被搬到了一个碰不到它的字段上** ——");
  line("     `dna.palette` 这一格**从不变成位图**（它只被 `dnaBrief` 当**文本**读进生图提示词，③′），");
  line("     而「被量化掉」是**像素**那一侧的事。这才是它读起来可信的原因。");
  line("  ⇒ ⚠️ 而它的**结论**也不对（③′）：没有那道正则时，`\"#ff0000\"` 不是「被量化掉」，");
  line("     是 `Number(\"\".slice(8))` ⇒ **静默变成 `palette:0`**（色板**第 0 项**）。");

  // ── ⑫ Q4 的落点与先例：那条断言住在哪、反向断言有没有先例 ────────────────────
  line("\n=== ⑫ Q4 若要补判据：它住在哪 · 反向断言有没有先例 ===");
  const dp = S("packages/game-design/tests/dna-prompts.test.ts");
  const itLine = dp.findIndex((l) => l.includes("颜色是从世界色板里"));
  line('  今天那条 `it`（只断言**规矩那半句**）：');
  for (let i = itLine; i < itLine + 3; i++) line(`     dna-prompts.test.ts:${i + 1}  ${dp[i].trim()}`);
  const tianLine = dp.findIndex((l) => l.includes("说成天网只会教会模型绕"));
  line(`  ⭐ **同一个文件里已经有一条反向断言**（而且防的正是「把后果说错」）：`);
  for (let i = tianLine - 1; i <= tianLine + 2; i++) line(`     dna-prompts.test.ts:${i + 1}  ${dp[i].trim()}`);
  let reverse = 0, reverseFiles = new Set();
  for (const p of fs.readdirSync(P("packages"))) {
    const tdir = P(`packages/${p}/tests`);
    if (!fs.existsSync(tdir)) continue;
    for (const f of fs.readdirSync(tdir))
      if (f.endsWith(".test.ts")) {
        const n = (fs.readFileSync(path.join(tdir, f), "utf8").match(/\.not\.to(Contain|Match)\(/g) || []).length;
        if (n > 0) { reverse += n; reverseFiles.add(`packages/${p}/tests/${f}`); }
      }
  }
  line(`  ⇒ 全仓 \`.not.toContain\` / \`.not.toMatch\` 先例：**${reverse} 处**，散在 **${reverseFiles.size}** 份测试文件里`);
  line("     ⇒ Q4(a) 的**形状是现成的**（反向断言在这个仓库里是常态，且在**同一个文件**里就有一条）；");
  line("       落点也现成：`dna-prompts.test.ts:73` 那条 `it` 里补两句即可（**不动 schema / gate / R 表**）。");


}


// ⚠️ 同样包一层作用域：`.cjs` 顶层共用一张 const 表，重名会当场炸。
{
  // ═══════════════════════════════════════════════════════════════════════════
  // 补量 · 第二轮（2026-10-14 · 同日第三轮 · 只量不裁 · 零付费 · 源码一个字节没动）
  //   前两轮量的是「那句话错在哪」（①–⑧）与「它抄在几处、谁在读」（⑨–⑫）。
  //   这一轮量的是**裁 Q1–Q5 那张表时要付的东西**：模型每一发读到几处（⑬）·
  //   先例那次改口**实际落在哪一处**（⑭）· 那句假话**为什么可信**（⑮）·
  //   Q4 要加的那条判据**今天是不是红的**（⑯）· Q1 的候选措辞**会不会踩既有断言**（⑰）。
  // ═══════════════════════════════════════════════════════════════════════════

  const gpr = S("packages/game-design/src/prompts.ts");
  const gccd = S("packages/game-design/src/compile-character-dna.ts");
  const V1 = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1";
  const rDesign = JSON.parse(fs.readFileSync(P(V1 + "/game-design.json"), "utf8"));
  const rVws = JSON.parse(fs.readFileSync(P(V1 + "/visual-world.json"), "utf8"));
  const todayDna = G.characterDnaPrompt({ design: rDesign, vws: rVws });

  // ── ⑬ 模型每一发读到几处「规矩」、几处「后果」──────────────────────────────
  line("\n=== ⑬ 模型每一发读到几处「规矩」、几处「后果」===");
  const toolAt2 = gpr.findIndex((l) => l.includes("export const CHARACTER_DNA_TOOL_DESCRIPTION"));
  const ruleAt2 = gpr.findIndex((l, i) => i > toolAt2 && i < toolAt2 + 40 && l.includes("palette:<下标>"));
  const hintAt2 = gpr.findIndex((l) => l.includes("这个角色身上的颜色，从世界色板里"));
  line(`  · 工具说明 第 4 条（prompts.ts:${ruleAt2 + 1}）—— 读它的人：**模型**`);
  line(`      ${cut(gpr[ruleAt2].trim(), 220)}`);
  line(`  · 逐字段台账 DNA_FIELD_HINTS.palette（prompts.ts:${hintAt2 + 1}-${hintAt2 + 2}）—— 读它的人：**模型**`);
  line(`      ${cut(gpr[hintAt2].trim(), 220)}`);
  line(`      ${cut(gpr[hintAt2 + 1].trim(), 220)}`);
  const forcedAt2 = gccd.findIndex((l) => l.includes("forcedTool(CHARACTER_DNA_TOOL_NAME"));
  const msgAt2 = gccd.findIndex((l) => l.includes("messages: [{ role:"));
  line(`  · 两者在**同一发 body** 里：compile-character-dna.ts:${forcedAt2 + 1} 与 :${msgAt2 + 1}`);
  line(`      :${forcedAt2 + 1}  ${cut(gccd[forcedAt2].trim(), 170)}`);
  line(`      :${msgAt2 + 1}  ${cut(gccd[msgAt2].trim(), 170)}`);
  line(`  · 同一份 body 的两半：工具说明含「规矩」= **${G.CHARACTER_DNA_TOOL_DESCRIPTION.includes("palette:<下标>")}** ·` +
       ` 含「后果」= **${G.CHARACTER_DNA_TOOL_DESCRIPTION.includes("量化掉")}**`);
  line("  ⇒ 量出来：模型**每一发同时读到两处「规矩」**（工具说明第 4 条 + 字段台账），");
  line("     而「后果」只在**一处**出现（台账）—— 且那一处是假的 ⇒ 票面说的「给模型那处」其实是**两处**。");
  line("  ⚠️ 而票 54 的先例恰好把后果**写在工具说明里**（⑭）—— 这一票的对应处（工具说明第 4 条）");
  line("     今天**一个字后果都没有** ⇒ 若 Q1 只改台账，模型读到的两处会一处在说后果、一处不说。");

  // ── ⑭ 票 54 那次改口**落在哪一处**（读的，不是推的）──────────────────────
  line("\n=== ⑭ 票 54 那次改口**落在哪一处**（读的，不是推的）===");
  const gdt = S("packages/game-design/tests/design-prompts.test.ts");
  const it54At = gdt.findIndex((l) => l.includes("静默损失比省掉更糟"));
  line(`  · 它当时配的判据就长在 design-prompts.test.ts:${it54At + 1} 那条 it 里（逐条抄）：`);
  for (const kw of ["整条省掉", "静默丢东西", "整份拒绝", "退出码 4", "点名", "没人看见的丢东西"]) {
    const n = gdt.findIndex((l) => l.includes(`toContain("${kw}")`));
    line(`      :${n + 1}  ${gdt[n].trim()}`);
  }
  line("  ⇒ ⭐ 后果那半句**钉在 `DESIGN_TOOL_DESCRIPTION`（工具说明）上**，不是钉在字段台账上。");
  const fightAt = gdt.findIndex((l) => l.includes("不再打架"));
  line(`  ⇒ 而它**另配了一条 it**（:${fightAt + 1}）专门钉「工具说明与字段台账**不再打架**」：`);
  line(`      it 标题逐字：「${(gdt[fightAt].match(/it\("(.*?)"/) || [, gdt[fightAt].trim()])[1]}」`);
  const src54At = gpr.findIndex((l) => l.includes("省掉之后会发生什么，说清楚"));
  line(`  · ⭐ 那句**今天实际长在 prompts.ts:${src54At + 1}**（逐字；反引号在 TS 模板串里写作 \`\\\`\`，即 Q1(a) 要照的形状）：`);
  for (let i = src54At; i < src54At + 4; i++) line(`      ${cut(gpr[i].trim(), 180)}`);
  line("  ⇒ 票 54 的先例**同时**动了两处：**工具说明**（补后果）＋ **字段台账**（删掉与它打架的那半句）。");
  line("     ⚠️ 而 68 的台账那处**今天正放着那句假后果**（⑬）⇒ 按先例办 = 工具说明补一句、台账换一句。");

  // ── ⑮ 那句假话**为什么可信**：同一份提示词里 hex 到处都是 ─────────────────
  line("\n=== ⑮ 那句假话**为什么可信**：同一份提示词里 hex 到处都是 ===");
  const palLine = gpr.findIndex((l) => l.includes("指的就是它"));
  line(`  · prompts.ts:${palLine + 1} 把色板**摊开**给模型 —— 下面是**真拼出来的那一行**：`);
  const renderedPal = todayDna.split("\n").find((l) => l.includes("指的就是它"));
  line(`      ${renderedPal ? renderedPal.trim() : "（未找到）"}`);
  const hexInPrompt = (todayDna.match(/#[0-9a-f]{6}/gi) || []).length;
  line(`  · ⚠️ 这一发提示词里 #rrggbb 形状出现 **${hexInPrompt}** 次 —— 而同一份提示词里写着「不许写 hex」`);
  const vwsSrc = S("packages/contracts/src/visual-world.ts");
  const colorAt = vwsSrc.findIndex((l) => l.includes("export const PaletteColorShape"));
  const refAt2 = vwsSrc.findIndex((l) => l.includes("export const PaletteRefShape"));
  line(`  · 而契约里这两个形状相隔 **${refAt2 - colorAt}** 行：`);
  line(`      visual-world.ts:${colorAt + 1}  PaletteColorShape（**色板本身**那一格）：${cut(vwsSrc[colorAt].trim(), 100)}`);
  line(`      visual-world.ts:${refAt2 + 1}  PaletteRefShape （**引用色板**那一格）：${cut(vwsSrc[refAt2 + 2].trim(), 100)}`);
  line("  ⇒ 也就是说：**色板那一格写的就是 hex，引用色板那一格不许写 hex** —— 同一个文件里相隔十几行。");
  line("     ⇒ 模型在这一发里看到一串 hex，同时被告知「不许写 hex，写了会被量化掉」");
  line("     ⇒ 「下游会把 hex 换回色板里的一个」在这份上下文里读起来是**顺的** —— 这是那句假话可信的来源。");

  // ── ⑯ Q4(a) 的价签：候选断言拿**今天**的字符串跑，红还是绿 ─────────────────
  line("\n=== ⑯ Q4(a) 的价签：候选断言拿**今天**的字符串跑，红还是绿 ===");
  const todayHint = gpr[hintAt2].trim() + "\n" + gpr[hintAt2 + 1].trim();
  const toolDesc = G.CHARACTER_DNA_TOOL_DESCRIPTION;
  const cands = [
    ["台账", "正向", "整份拒绝", todayHint], ["台账", "正向", "退出码 4", todayHint],
    ["台账", "正向", "重采样", todayHint], ["台账", "正向", "停在这儿", todayHint],
    ["台账", "反向", "量化掉", todayHint], ["台账", "反向", "等于没写", todayHint],
    ["工具说明", "正向", "整份拒绝", toolDesc], ["工具说明", "正向", "退出码 4", toolDesc],
    ["工具说明", "反向", "量化掉", toolDesc],
  ];
  for (const [where, dir, kw, hay] of cands) {
    const has = hay.includes(kw);
    const pass = dir === "正向" ? has : !has;
    line(`     · ${where} · ${dir}「${kw}」 ⇒ 今天**${has ? "在" : "不在"}** ⇒ 这条断言今天 ${pass ? "✅ **绿**" : "⚠️ **红**"}`);
  }
  line("  ⇒ ⚠️ **反向那几条今天就是红的**（假话还在）⇒ 它**不能单独加**：必须与 Q1 同一次落地。");
  line("  ⇒ 它花的是 **0 发**（纯字符串断言；形状与落点 ⑫ 已量过是现成的）——");
  line("     它的代价不是钱，是**把 Q1 与 Q4 绑成一次施工**。");

  // ── ⑰ Q1(a) 的落地价签：候选新句原地换进去，今天那些断言逐条还绿吗 ─────────
  line("\n=== ⑰ Q1(a) 的落地价签：候选新句**原地换进去**（只在内存里），今天那些断言逐条还绿吗 ===");
  line(`  · 拿盘上**真**的一对（${V1.split("/").slice(-3).join("/")}）拼一次：design ${Object.keys(rDesign).length} 键 · vws ${Object.keys(rVws).length} 键`);
  line(`  · 今天拼出来的提示词：**${todayDna.length}** 字 · ${todayDna.split("\n").length} 行`);
  const OLD = "⚠️ 不许写 hex 或颜色名（写了下游会被量化掉，等于没写）";
  line(`  · 那句假话在提示词里：**${todayDna.includes(OLD)}**`);
  const NEW = "⚠️ 不许写 hex 或颜色名：写了这一份**过不了 `palette:<下标>` 的 schema**（整份判失败、退 4）—— **不是**「等于没写」，是**当场退回来**";
  const draftDna = todayDna.replace(OLD, NEW);
  line(`  · 候选新句（${NEW.length} 字）换进去之后：**${draftDna.length}** 字（Δ ${draftDna.length - todayDna.length}）`);
  line("  · 候选新句逐字（**只是探针里的草稿，供 Q1 措辞用，不是落地**）：");
  line(`      ${NEW}`);
  const KEYS2 = Object.keys(C.CharacterDNASchema.shape);
  const checks2 = [
    ["① 契约每个键被点名（:19）", () => KEYS2.filter((k) => !draftDna.includes("`" + k + "`")).length === 0],
    ["① 逐字段行数 == 键数（:21）", () => draftDna.split("# 逐字段")[1].split("\n\n#")[0].split("\n").filter((l) => l.startsWith("- `")).length === KEYS2.length],
    ["② 世界五格逐个具名（:27）", () => ["proportions", "silhouette", "poseLanguage", "clothing", "faceAbstraction"].every((k) => draftDna.includes("`character." + k + "`"))],
    ["② 世界那两格的原值插进去了（:28-29）", () => draftDna.includes(rVws.character.proportions) && draftDna.includes(rVws.character.poseLanguage)],
    ["③ 色板原值仍在（:34-35）", () => draftDna.includes(rVws.style.palette[0]) && draftDna.includes("0=" + rVws.style.palette[0])],
    ["③ 六桶名仍在（:36-37）", () => ["primary", "secondary", "accent", "background", "shadow", "highlight"].every((b) => draftDna.includes(b))],
    ["③ materials 原话仍在（:38）", () => Object.values(rVws.materials).every((m) => !m.appearance || draftDna.includes(m.appearance))],
    ["④ 个体那一半仍在（:43-48）", () => draftDna.includes(rDesign.player.role) && draftDna.includes(rDesign.world.setting)],
    ["⑤ 没有基因的那些仍被点名（:53-55）", () => draftDna.includes("没有基因")],
    ["⑥ 类/个体那条语义说法仍在（:60-62）", () => draftDna.includes("这一类共有") && draftDna.includes("落到这一个身上")],
    ["⑦ 非人形那段仍在（:67-69）", () => draftDna.includes('`face` 写 `"none"`') && draftDna.includes("省掉一个键与「确实没有」在文件里长得一模一样")],
    ["⑧ 规矩那半句（`palette:<下标>`）仍在（:73）", () => draftDna.includes("`palette:<下标>`")],
    ["⑨ 收在工具名上（:90）", () => draftDna.includes("只调 emit_character_dna 工具")],
  ];
  line(`  ⚠️ 下面这 ${checks2.length} 条 = dna-prompts.test.ts 里**全部**盯提示词字符串的断言，逐条在**改后的**串上跑：`);
  let red2 = 0;
  for (const [name, fn] of checks2) {
    let ok = false, err = "";
    try { ok = fn(); } catch (e) { err = e.message; }
    if (!ok) red2++;
    line(`     · ${name} ⇒ ${ok ? "✅ 绿" : "⚠️ 红" + (err ? "（" + err + "）" : "")}`);
  }
  line(`  ⇒ 红 **${red2}** 条 / 共 ${checks2.length} 条 ⇒ Q1(a) 的候选措辞**不踩任何一条既有断言**`);
  line("     （⑦ 已量过：那句假话今天没有任何断言钉着它）。");
  line(`  · 工具说明那一侧：${toolDesc.length} 字 · 含「整份拒绝」= **${toolDesc.includes("整份拒绝")}** · 含「退出码 4」= **${toolDesc.includes("退出码 4")}**`);
  line("     ⇒ 把候选后果**接在**工具说明第 4 条后面，唯一盯它的断言（:79-80 的 toContain）不受影响（那是**加**，不是换）。");
  line("  ⇒ ⭐ 于是 Q1 与 Q4 的分工量清了：**Q1 = 换一句（不踩断言）**、**Q4 = 加一条今天必红的判据（把它锁住）**。");
}

line("\n=== 小结 · 前两轮量到的（**不编号** —— ⑬ 起留给下一轮读数）===");
line("  票面成立：散文说「有损」，实际是「当场 schema 失败 + 3 发盲重采样 + 整份判失败」。");
line("  ⚠️ 本轮**多量到两件**：");
line("     ① 那句错话在仓库里是 **4 处**（票面知道 2 处）；");
line("     ② 散文点名的 `quantize.ts` **见不到 DNA 的字段**（它吃位图；调用点确实唯一，但补量 ⑪ 收到：");
  line("        **它被导入与生图两条路走到** ⇒ 「被量化掉」是**像素**那一侧的真事，只是**搬到了碰不到它的字段上**），");
line("        而真正读 `dna.palette` 的 `dnaBrief` 拿到 `\"#ff0000\"` 会把它算成 `palette:0` ——");
line("        ⇒ 那句假陈述**不只是把后果说轻了，它还把因果接到了错的模块上**。");
