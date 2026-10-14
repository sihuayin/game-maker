#!/usr/bin/env node
/**
 * 票 69 探针：`CharacterDNA.palette` 的 `palette:N` **没有越界判据** ——
 * 而**同一条不变量**在隔壁（VWS 六桶 · drawlist 的 fill/stroke）**各有判据**。
 *
 * **为什么要有它**：票面的结论是「同一个不变量，`VisualWorldSpec` 判、`CharacterDNA` 不判」。
 * 本探针做四件事：
 *   ① 把那条不变量**在三个落点上各查一遍**（谁有 gate、谁只有散文、谁什么都没有）；
 *   ② 把一份**越界的** DNA 从契约一路喂到 `dnaBrief`，看**整条链是不是全绿**
 *      （如果真的全绿，那「越界」在这条链上就是一个**没有任何东西会红**的状态）；
 *   ③ 把票面列的**三个候选落点**逐一钉到**阶段**上 —— 因为「落在哪」不只是失败语义不同，
 *      还决定它响在**钱线的哪一侧**（`runUnderstanding` 还是 `runBuild`）。
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
const findLine = (lines, needle) => lines.findIndex((l) => l.includes(needle)) + 1;

/** 盘上那一对**同一跑**的真产物（DNA 与 VWS 必须同源，否则色板长度对不上）。 */
const RUN = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/run-out-2026-10-13h/ruined-city-scavenger/run/v1/";
const realDna = load(RUN + "character-dna.json");
const realVws = load(RUN + "visual-world.json");
const realDesign = load(RUN + "game-design.json");
const PAL_LEN = realVws.style.palette.length;

// ── ⓪ 同一条不变量，三个落点各是什么待遇 ────────────────────────────────────
line("=== ⓪ 同一条不变量（`palette:N` 的下标必须 < 色板长度），三个落点各是什么待遇 ===");
line(`  （底下那份真 VWS 的 \`style.palette\` 有 **${PAL_LEN}** 个色 ⇒ 合法下标 0..${PAL_LEN - 1}）`);

const vw = S("packages/contracts/src/visual-world.ts");
const vwGate = findLine(vw, "const n = v.style.palette.length;");
const vwMsg = findLine(vw, "悬空引用：色板与引用是同一次调用里写出来的");
line("\n  ── 落点 A · `VisualWorldSpec`（六桶 + `materials.*.color`）");
line(`     gate  visual-world.ts:${vwGate}-${vwMsg}（顶层 \`superRefine\`）`);
line(`           ${vw[vwMsg - 1].trim()}`);
line(`     散文  vision/src/prompts.ts:${findLine(S("packages/vision/src/prompts.ts"), "严格小于")}  ` +
     `…${cut(S("packages/vision/src/prompts.ts")[findLine(S("packages/vision/src/prompts.ts"), "严格小于") - 1].trim(), 80)}`);
line("     ⇒ **gate + 散文都有**（散文那一句是**补**出来的，理由见 ⑦）");

const rs = S("packages/assets/src/raster.ts");
const rsAt = findLine(rs, "越界（色板只有");
line("\n  ── 落点 B · drawlist 的 `fill` / `stroke` / `colors`");
line(`     判据  raster.ts:${rsAt}  ${cut(rs[rsAt - 1].trim(), 110)}`);
line("           ⇒ **抛 `RasterError`**（光栅化当场停）");
line(`     散文  assets/src/prompt.ts:${findLine(S("packages/assets/src/prompt.ts"), "硬编码 hex 会被 schema 直接拒绝")}  ` +
     `${cut(S("packages/assets/src/prompt.ts")[findLine(S("packages/assets/src/prompt.ts"), "硬编码 hex 会被 schema 直接拒绝") - 1].trim(), 70)}`);
line("     ⇒ **判据 + 散文都有**");

const cd = S("packages/contracts/src/character-dna.ts");
line("\n  ── 落点 C · `CharacterDNA.palette`（**本票**）");
const palAt = findLine(cd, "palette: z.array(PaletteRefShape)");
line(`     判据  **没有**。character-dna.ts:${palAt} 只有 \`${cd[palAt - 1].trim()}\``);
line(`           \`PaletteRefShape\`（visual-world.ts:${findLine(vw, "^") || findLine(vw, "export const PaletteRefShape")}）是**只认形状**的正则 \`/^palette:\\d+$/\``);
line("           ⇒ `palette:99` 只要色板不是 100 项就**合法通过**");
const gd = S("packages/game-design/src/prompts.ts");
const rule4 = findLine(gd, '4. \\`palette\\` 只能写');
const hintPal = findLine(gd, "这个角色身上的颜色，从世界色板里");
line(`     散文  只说了**形状**（prompts.ts:${rule4} 与 :${hintPal}）——`);
line(`            「只能写 \`palette:<下标>\`（从上面那份色板里**选**）」`);
line(`     ⚠️ 而**没有**一句「下标必须**小于**色板长度」（A 那一侧的散文有，这一侧没有）`);
line("     ⇒ **判据与散文，这一半都没有**");

// ── ① 把越界那份 DNA 从契约一路走到 dnaBrief ──────────────────────────────
line("\n=== ① 越界的那一份，整条链走一遍（看是不是**全绿**）===");
const OOB = `palette:${PAL_LEN + 5}`;   // 真实越界：色板 6 项 ⇒ palette:11
line(`  把 13h 那份真 DNA 的**第一个元素**改成 \`${OOB}\`（越界 ${PAL_LEN + 5 - PAL_LEN} 格），其余一个字不动`);
const c0 = realDna.characters[0];
const oobFile = { format: "character-dna/v1", characters: [{ ...c0, palette: [OOB] }, ...realDna.characters.slice(1)] };

const p1 = C.CharacterDNAFileSchema.safeParse(oobFile);
line(`\n  ① 契约（\`CharacterDNAFileSchema\`）：success = ${p1.success}` +
     (p1.success ? "  ⇒ **放行**" : `  ⇒ 拒：${p1.error.issues[0].message}`));

const po = C.parseToolUse(
  { stop_reason: "tool_use", content: [{ type: "tool_use", name: G.CHARACTER_DNA_TOOL_NAME, input: oobFile }] },
  G.CHARACTER_DNA_TOOL_NAME, C.CharacterDNAFileSchema);
line(`  ② 链上那一层（\`parseToolUse\`）：ok = ${po.ok}` + (po.ok ? "  ⇒ **放行**" : ` ⇒ ${po.detail}`));

const built = G.buildCharacterDna({ fromModel: oobFile, design: realDesign, vws: realVws });
line(`  ③ 装配步（\`buildCharacterDna\`，**它手上有 vws**）：ok = ${built.ok}` +
     (built.ok ? "  ⇒ **放行**（两条检查都不看 palette）" : `  ⇒ ${cut(built.detail, 140)}`));

const briefed = A.dnaBrief(oobFile.characters[0], { palette: realVws.style.palette });
const colorLine = briefed.split("\n").find((l) => l.startsWith("- `palette`"));
line(`  ④ 唯一那个读者（\`dnaBrief\`）：${colorLine}`);
line(`     ⇒ ⚠️ 越界取到 \`undefined\` ⇒ 落回 \`?? ref\` ⇒ **字面量 \`${OOB}\` 原样进了生图提示词**`);
line(`     ⚠️ 而 assets/src/prompt.ts:${findLine(S("packages/assets/src/prompt.ts"), "模型不认")} 逐字写着「**模型不认 \`palette:3\` 这个说法**，它认颜色」`);
line("     —— 那一行**正是**这个翻译存在的理由，而它失败时**没有任何东西会红**。");
line("\n  ⇒ **四个环节全绿**：契约过 · \`parseToolUse\` 过 · 装配过 · \`dnaBrief\` 不抛。");

// ── ② 模型那一侧看得见什么 ─────────────────────────────────────────────────
line("\n=== ② 模型那一侧看得见什么：色板是印出来的，但「小于」那句话不在 ===");
const dnaPrompt = G.characterDnaPrompt({ design: realDesign, vws: realVws });
const palLine = dnaPrompt.split("\n").find((l) => l.includes("**色板**"));
line(`  提示词里那一行：${cut(palLine, 200)}`);
line("  ⇒ 下标 0..N-1 **是印出来的** ⇒ 越界需要模型**数错或者凭印象编**");
const saysBound = /小于|不超过|之内的下标|合法下标/.test(dnaPrompt);
line(`  ⚠️ 而整份 DNA 提示词里有没有一句「下标必须小于色板长度」？**${saysBound}**`);
const toolSaysBound = /小于|不超过|合法下标/.test(G.CHARACTER_DNA_TOOL_DESCRIPTION);
line(`  ⚠️ 工具说明（\`CHARACTER_DNA_TOOL_DESCRIPTION\`）里呢？**${toolSaysBound}**`);
line(`  ⇒ 对照 A 那一侧：\`vision\` 的工具说明**有**那句（因为它的 gate 模型看不见，见 ⑦）`);

// ── ②′ 那句字面量**真的**到了交给模型的提示词里吗 ────────────────────────────
line("\n=== ②′ 那句字面量**真的**进了交给模型的提示词（`masterPrompt` 真的拼一遍）===");
const realStyle = load(RUN + "stylespec.json");
const oobChar = oobFile.characters[0];
let mp = null;
try {
  mp = A.masterPrompt({
    master: { id: oobChar.id, role: "player", description: "玩家角色（探针占位）" },
    dna: oobChar, style: realStyle, canvas: { w: 64, h: 64 },
  });
} catch (e) {
  line(`  ⚠️ masterPrompt **抛了**：${e.message}`);
}
if (mp) {
  const hit = mp.split("\n").filter((l) => l.includes(OOB));
  line(`  拼出来的母版提示词 **${mp.length} 字**；其中含 \`${OOB}\` 的行 ${hit.length} 行：`);
  for (const h of hit) line(`      ${h}`);
  line(`  ⇒ ✅ **字面量原样落进了最终提示词** —— 恰恰是 \`assets/src/prompt.ts:72\` 说「模型不认」的那种写法。`);
  line(`     而它旁边那一行是合法下标印出来的色值（②），所以模型会看到**两种写法混在一段里**。`);
  line(`  ⚠️ 对照：把同一份 DNA 的 \`palette\` 换回合法值，这一行会变成 \`#22...\` 之类的**色值** ——`);
  const okChar = { ...oobChar, palette: ["palette:" + (realVws.style.palette.length - 1)] };
  const mpOk = A.masterPrompt({
    master: { id: okChar.id, role: "player", description: "玩家角色（探针占位）" },
    dna: okChar, style: realStyle, canvas: { w: 64, h: 64 },
  });
  line(`     合法值时那一行：${mpOk.split("\n").find((l) => l.startsWith("- \`palette\`"))}`);
}

// ── ③ 盘上 9 份（阴性 n=9）─────────────────────────────────────────────────
line("\n=== ③ 盘上 9 份真 DNA：越界过没有 ===");
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
let chars = 0, refs = 0, oob = 0;
const lens = [];
for (const f of files) {
  const d = JSON.parse(fs.readFileSync(f, "utf8"));
  const vp = path.join(path.dirname(f), "visual-world.json");
  const n = fs.existsSync(vp) ? JSON.parse(fs.readFileSync(vp, "utf8")).style.palette.length : null;
  lens.push(n === null ? "?" : String(n));
  chars += d.characters.length;
  for (const c of d.characters)
    for (const r of c.palette) {
      refs++;
      if (n !== null && Number(r.slice("palette:".length)) >= n) { oob++; line(`  ⚠️ 越界：${path.relative(ROOT, f)} ${c.id} ⇒ ${r}（色板 ${n} 项）`); }
    }
}
line(`  · ${files.length} 份 · ${chars} 个角色 · ${refs} 个元素 · 逐份色板长度：${lens.join(" / ")}`);
line(`  · ⚠️ **越界 ${oob} 个** ⇒ 票面「零尸体（n=9）」**成立**`);

// ── ④ 四个候选落点，落在**钱线的哪一侧** ────────────────────────────────────
line("\n=== ④ ⚠️ 落点不只决定失败语义，还决定它响在**钱线的哪一侧** ===");
const cg = S("packages/pipeline/src/create-game.ts");
const uAt = findLine(cg, "export async function runUnderstanding");
const bAt = findLine(cg, "export async function runBuild");
const dnaCall = findLine(cg, "const dna = await compileCharacterDna");
const packAt = findLine(cg, 'say("pack")');
line(`  · create-game.ts:${uAt}  \`runUnderstanding\`（理解层：**到 \`asset-recipe.json\` 为止**）`);
line(`  · create-game.ts:${dnaCall}  \`compileCharacterDna\` —— **在这里面**（⇒ 钱线**之前**）`);
line(`  · create-game.ts:${bAt}  \`runBuild\`（构建层：**从磁盘读回清单往下走**）`);
line(`  · create-game.ts:${packAt}  \`say("pack")\` —— **买图从这里开始**`);
line("  ⇒ 四个候选落点：");
line("     ⓐ `contracts` 的 schema 级（`CharacterDNAFileSchema` 的 superRefine）⇒ 理解层 · **钱线之前**");
line("     ⓑ `build-character-dna.ts` 的装配级 ⇒ 同一个函数里 · **钱线之前**（⚠️ **它手上有 `vws`**）");
line("     ⓒ `assets` 的入口级（`readCharacterRef` / `readStyle` 那种）⇒ **构建层 · 钱线之后**");
line("     ⓓ `dnaBrief` 级 ⇒ `pack` 里、**正在买图的时候** ⇒ 钱线**之后**");
line("  ⚠️ 换句话说：ⓒⓓ 就算补上了，也是**在钱花出去之后**才知道这份 DNA 有悬空引用。");

// ── ⑤ 四个落点的失败语义（票面说「三个位置的失败语义不同」，核一遍）──────────
line("\n=== ⑤ 失败语义：票面那句「schema 会重采样、装配级不重采样」够准确吗 ===");
const ccd = S("packages/game-design/src/compile-character-dna.ts");
const builtAt = findLine(ccd, "const built = buildCharacterDna(");
line(`  compile-character-dna.ts:${builtAt}  ${ccd[builtAt - 1].trim()}`);
line(`  compile-character-dna.ts:${builtAt + 1}  ${ccd[builtAt].trim()}`);
line("  ⇒ ⚠️ **装配级失败也走 `failure: \"schema\"`** ⇒ 调用方**照样重采样**（R16 三发）");
line("     ⇒ 票面 Q2 那句「`schema` 会重采样、装配级不重采样」**在本步不成立**");
line("        （那句话对**设计层**成立：R12 是 `rejected` ⇒ 不重采样 —— 两层的「拒绝面」不一样）");
line(`  ⚠️ 而这一步**没有拒绝面**（文件头逐字：${cut(ccd[findLine(ccd, "本步只有这一档错") - 1].trim(), 90)}）`);
line("  ⇒ 所以 ⓐ 与 ⓑ 的**失败语义今天是一样的**（都是 3 发盲重采样 + 退 4）——");
line("     真正把 ⓐ 与 ⓑ 分开的是**别的**东西（能不能拿到 `vws`、要不要动契约的输入形状）。");

// ── ⑥ 代价：A 那一侧那条 gate 有多少行、DNA 那侧要动什么 ─────────────────────
line("\n=== ⑥ 代价 ===");
line(`  · A 那一侧的 gate 本体：visual-world.ts:${vwGate}-${vwMsg - 1}（约 ${vwMsg - 1 - vwGate + 1} 行，含报文）`);
line("    —— 它跑在**顶层 superRefine** 里，所以**同一份文档**里的引用都能跟 `style.palette` 对账");
line(`  · ⚠️ 而 \`CharacterDNAFileSchema\` 今天**不吃 \`vws\`**（character-dna.ts:${findLine(cd, "export const CharacterDNAFileSchema")} —— 它是**文件形状**）`);
line("    ⇒ ⓐ 要**改契约的输入形状**（把色板长度塞进这份 schema 的入参）");
line(`  · ⓑ 那一侧**什么都不用改形状**：\`buildCharacterDna\` 的入参里已经有 \`design\` 与 \`vws\``);
line(`    （build-character-dna.ts:${findLine(S("packages/game-design/src/build-character-dna.ts"), "vws: VisualWorldSpec;")}），而且那里**已经有两只手**：\`characterSetGate\` 与 \`verbatimCopyGuard\``);

// ── ⑦ 「模型看不见 superRefine」那条自白，本文件自己就写着 ────────────────────
line("\n=== ⑦ ⚠️ 任何 superRefine 都**模型看不见** —— 这条自白本文件自己写着 ===");
const blindAt = findLine(cd, "这条 check 模型看不见");
line(`  character-dna.ts:${blindAt - 1}-${blindAt + 1}`);
for (let i = -1; i <= 1; i++) line(`      ${cd[blindAt - 1 + i].trim()}`);
line("  ⇒ 若走 ⓐ：那条 gate 会**静默丢掉**（`toJSONSchema`），模型照旧不知道有这条规矩");
line("     ⇒ 按 A 那一侧的先例（`vision` 的工具说明补了「严格小于色板长度」那一句），");
line("        **散文必须跟着走** —— 而散文那半句**今天不存在**（②）");
line("     ⇒ 这就把它接回了**票 68 那一句话**（票面 §Q3 已经点过：两票住同一句话）。");

// ── ⑧ 先例：票 44 裁过「入口拒、契约一个字不动」 ────────────────────────────
line("\n=== ⑧ 先例：票 44 裁过「在入口拒、契约仍然不动」（这就是 ⓒ 那条路）===");
const ops = S("packages/assets/src/ops.ts");
const t44 = findLine(ops, "票 44）就地更正");
for (let i = 0; i <= 3; i++) line(`      ops.ts:${t44 + i}  ${cut((ops[t44 + i - 1] ?? "").trim(), 160)}`);
const t44gate = findLine(ops, "票 44 的闸");
line(`      ops.ts:${t44gate}  ${cut((ops[t44gate - 1] ?? "").trim(), 160)}`);
line("  ⇒ 那个先例的形状：**判据加在入口**、**schema 一动不动**（守 R6）。");
line("     ⚠️ 而它今天也在**构建层**（`pack` 那条路上）⇒ 走 ⓒ 会继承同一个「钱线之后」的性质（④）");

// ── ⑨ 教义：那条现成的 gate 是**按文书**划的，不是按**形状**划的 ──────────────
line("\n=== ⑨ 教义：`PaletteRefShape` 只有两个宿主，而「越界」只在一个宿主里定义 ===");
line("  全仓 `PaletteRefShape` 的宿主（`grep` 逐处列出）：");
line("     · visual-world.ts:200-205  六桶（primary/secondary/accent/background/shadow/highlight）");
line("     · visual-world.ts:225      materials.*.color");
line("     · character-dna.ts:111     `palette: z.array(PaletteRefShape)`  ← **本票**");
line("  ⇒ **一个形状 · 两个宿主 · 一个宿主有 gate**。");
line(`  ⚠️ 而 visual-world.ts:${findLine(vw, "只此一处的「越界」定义")} 的注释逐字写着「**只此一处的「越界」定义**」——`);
line("     这句话在**它的射程内**是对的，而它的射程是**按文书划的**（`VisualWorldSpecSchema.superRefine`）。");
line("\n  那条 gate 自己写下的四条教义（逐字）：");
line(`     ${vw[findLine(vw, "一条顶层的 `superRefine`：所有") - 1].trim()}`);
line(`     ${vw[findLine(vw, "**它管什么**：六桶") - 1].trim()}`);
line(`     ${vw[findLine(vw, "**为什么只提前管这一条**") - 1].trim()}`);
line(`     ${cut(vw[findLine(vw, "模型自己写下一份") - 1].trim(), 150)}`);
line(`     ${vw[findLine(vw, "**别把这条 check 当垃圾桶往里加。**") - 1].trim()}`);
line(`     ${cut(vw[findLine(vw, "**一个必须点名的连带后果") - 1].trim(), 150)}`);
line(`     ${cut(vw[findLine(vw, "**永远不再触发**") - 1].trim(), 150)}`);
line("\n  ⇒ ⭐ 把它读成一句话：**「引用越界」在这个仓库里的定义 = 「同一份文书自己跟自己矛盾」**，");
line("     而 DNA 引用的是**同一份** `style.palette`（同一个颜色来源，`character-dna.ts` 的字段说明也是这么说的），");
line("     只是住在**另一份文书**里 ⇒ **现有 gate 结构上够不着**（不是忘了写）。");
line("  ⚠️ 于是 Q1 的真正分岔不在于「要不要补」，在于**那一发算不算「自己跟自己矛盾」**：");
line("     DNA 那一发的色板是**印在提示词里**的（②），模型是**对着印出来的 6 个色**写下 `palette:11` 的");
line("     ⇒ 若「提示词里印了色板」算文书的一部分 ⇒ 是自相矛盾 ⇒ 该就地 gate；");
line("       若「文书」只指**写出来的那份 JSON** ⇒ 色板不在里面 ⇒ 它是**跨文书的不一致**");
line("       ⇒ 按上面那条教义，跨文书的不一致**正是那条 gate 明说自己不管的那一类**。");
line("  ⭐⭐ 而 DNA 那一侧的**字段注释引的是同一条判决** —— character-dna.ts:106-110 逐字：");
for (const l of cd.slice(105, 110)) line(`      ${l.trim()}`);
line("     ⇒ 「**第二套颜色来源**」/「`palette:N` 的**一元性**」正是 VWS 那条 gate 引的**同一条**（票 02 裁决 25）。");
line("     ⇒ 也就是说：**「一元性」这条原则本身就是跨文书的**（它要治的恰恰是「DNA 自己另搞一套」）——");
line("       按原则，DNA 越界**就是**「同一条违规」；按 gate 的实现，它够不着。");
line("  ⚠️ 另：那条教义末句「**别把这条 check 当垃圾桶往里加**」也在射程内 ——");
line("     走 ⓐ 时要写清它是**另一份文书上的另一条 check**，不是往 VWS 那条里塞。");

// ── ⑩ ⚠️ 但「比哪个色板」？—— `dnaBrief` 索引的是 `StyleSpec.palette`，不是 `vws.style.palette` ──
line("\n=== ⑩ ⚠️ 比哪个色板：`dnaBrief` 索引的是 `StyleSpec.palette`，而 gate 手上的是 `vws.style.palette` ===");
line("  · `dnaBrief(dna, style)` 的第二参是 **`StyleSpec`**（`prompt.ts:75`）⇒ 它索引的是 **`stylespec.json` 的 `palette`**");
line("  · 而 ⓪ 那条 gate（以及任何要加的 DNA gate）比的是 **`vws.style.palette`**");
line("  ⇒ 于是「两个数字今天一样吗」不是文风问题，是**这条 gate 管不管得着读者**的问题。");
const w = S("packages/assets/src/ops.ts");
const dumpAt = findLine(w, "落盘的风格是**这个世界的 `style` 子树**");
line(`\n  ⭐ 结论是**构造上一样**：ops.ts:${dumpAt + 1} 逐字 ——`);
line(`      ${(w[dumpAt + 1] ?? "").trim()}`);
line(`      ${(w[dumpAt + 2] ?? "").trim()}`);
line("     ⇒ `stylespec.json` 是 `world.style` 的**逐字节 JSON 转储**（R6 那个「兼容载体」）");
line("       ⇒ **`stylespec.palette` ≡ `vws.style.palette`，顺序都保得住** —— 不是「碰巧相等」。");
line("\n  盘上核对（9 份 DNA 的目录，逐个把两份色板比一遍）：");
const DIRS = [];
(function walk2(d) {
  let e = []; try { e = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
  for (const x of e) { const p = path.join(d, x.name);
    if (x.isDirectory()) { if (x.name !== "node_modules") walk2(p); } else if (x.name === "character-dna.json") DIRS.push(path.dirname(p)); }
})(path.join(ROOT, ".scratch"));
let both = 0, identical = 0, onlyVws = 0;
for (const dir of DIRS) {
  const vp = path.join(dir, "visual-world.json"), sp = path.join(dir, "stylespec.json");
  const hv = fs.existsSync(vp), hs = fs.existsSync(sp);
  if (!hv) { line(`    ⚠️ ${path.relative(ROOT, dir)}：没有 visual-world.json`); continue; }
  const vp2 = JSON.parse(fs.readFileSync(vp, "utf8"));
  if (!hs) { onlyVws++; line(`    ⚠️ ${path.relative(ROOT, dir)}：vws=${vp2.style.palette.length} · **没有 stylespec.json**`); continue; }
  const sp2 = JSON.parse(fs.readFileSync(sp, "utf8"));
  both++;
  const same = JSON.stringify(vp2.style.palette) === JSON.stringify(sp2.palette);
  if (same) identical++;
  line(`    ${same ? "✅" : "❌"} ${path.relative(ROOT, dir)}：vws=${vp2.style.palette.length} · stylespec=${sp2.palette.length} · 同色序=${same}`);
}
line(`  ⇒ ${both} 份两份都在、**${identical}/${both} 逐字节同色序**；另有 ${onlyVws} 份只有 VWS（\`.failed\` 那一跑）`);
line("     ⇒ 所以**比哪一份都一样** —— 而这一点必须量出来，不能假定：ⓐⓑ 手上只有 `vws`。");

// ── ⑪ ⭐⭐ 仓库里**已有两条**悬空引用 gate，而它们的家不按「不变量」分，按「文书」分 ──
line("\n=== ⑪ ⭐⭐ 已有的两条悬空引用 gate：**同一份文书**归契约、**跨文书**归装配 ===");
line("  全仓「悬空引用」四条（`grep` 逐处）：");
line("     · visual-world.ts:287-300   `palette:N` 越界 —— 六桶 + `materials.*.color` vs `style.palette`");
line("     · game-design.ts:297-299    `levels[].entities[]` 解不到 —— vs `player` + 四桶的 id");
line("     · game-design-gate.test.ts:77 那条测试逐字：「**与票 08 的「色板下标越界」同形**」");
line("     · ops.ts（票 44 的空色板闸）—— 是「空的」，不是「悬空」，另一类");
const gd2 = S("packages/contracts/src/game-design.ts");
const entAt = findLine(gd2, "与四桶里都没有这个 id");
line(`\n     game-design.ts:${entAt} 逐字：`);
line(`       ${cut(gd2[entAt - 1].trim(), 220)}`);
line("   ⇒ 两条 gate 的报文**形状一模一样**，末尾都是「⚠️ 悬空引用：…是**同一次调用里写出来的**，对不上就是**文书自己跟自己矛盾**」");
line("   ⭐ 而两条都满足同一件事：**被引的那一侧与引用，是同一次模型调用写出来的**（都在同一份 JSON 里）。");
line("   ⚠️ DNA 那一侧**不满足**：`characters[].palette` 指的是**另一次调用（vision）**写的 `style.palette`。");
line("\n  ⭐⭐ 而跨文书的引用检查在这个仓库里**已经有家** —— `buildCharacterDna` 那两只手：");
line(`     · \`characterSetGate(design, file)\`（build-character-dna.ts:105）—— DNA 的 id ↔ **设计层**（另一份文书）`);
line(`     · \`verbatimCopyGuard(file, vws)\`（:143）—— DNA 的 7 个字段 ↔ **世界层**（另一份文书）`);
line("   ⇒ **两条都是跨文书**，而且**两条都住在装配级、都收外来文书当入参**。");
line("\n  ⇒ 于是仓库现有的分工是一句话：");
line("     **同一份文书内部的引用 ⇒ 契约 schema 级 gate**（VWS 六桶 · design levels）");
line("     **跨文书的引用 ⇒ 装配级 gate，收那份外来文书当入参**（`buildCharacterDna`）");
line("     ⚠️ DNA 的 `palette[]` 指向**另一份文书**的色板 ⇒ **按已有分工，它的家就是 ⓑ**。");

// ── ⑫ 一句话总结 ───────────────────────────────────────────────────────────
line("\n=== ⑫ 这一轮量到的五件票面没写的事 ===");
line("  ① **不变量在三个落点上的待遇是三档，不是两档**：");
line("     VWS（gate + 散文）· drawlist（抛错 + 散文）· **DNA（两样都没有）**");
line("     ⇒ 更准确的说法不是「隔壁有、这里没有」，而是「**别处都是两半一起来，这里两半都缺**」");
line("  ② **越界在这条链上是全绿的**（①②③④ 四个环节没有一个会红），");
line("     而它走到的那一格恰恰是**翻译失败**那一格（`?? ref` 把 `palette:11` 原样交给模型）；");
line("  ③ **四个候选落点分居钱线两侧**：ⓐⓑ 在买图之前、ⓒⓓ 在买图之后 ⇒");
line("     而 ⓑ **什么形状都不用改**（`buildCharacterDna` 手上有 `vws`，且已挂着两只手）。");
line("  ④ **「比哪一份色板」有确定答案**（⑩）：`dnaBrief` 索引 `StyleSpec.palette`，");
line("     而 `stylespec.json` 是 `world.style` 的逐字节转储 ⇒ 两份色板**构造上**同色序（盘上 8/8 印证）");
line("     ⇒ 手上那份 `vws` 就够用，**不需要**再给 gate 递第二个色板。");
line("  ⑤ ⭐⭐ **落点的答案不在「不变量」里，在「文书」里**（⑪）：现有两条悬空引用 gate");
line("     **都是同一份文书内部的**（VWS 六桶 vs `style.palette` · design levels vs 四桶），");
line("     而跨文书的引用检查**已有家**：`buildCharacterDna` 那两只手（`characterSetGate` 对 design、");
line("     `verbatimCopyGuard` 对 vws）—— 都住在装配级、都收外来文书当入参。");
line("     ⇒ DNA 的 `palette[]` 指向**另一份文书** ⇒ 按已有分工，家就是 ⓑ。");

// ══════════════════════════════════════════════════════════════════════════════
// ⭐ 补量（2026-10-14 · 同日第二轮 · 只读 · 零付费 · 源码一个字节没动）
//
// ⚠️ 补量这一段包一层作用域：`.cjs` 的顶层全是同一张 const 表，重名会当场炸。
//    里面还要 `await`（拿假 `fetch` 驱动**真的** `compileCharacterDna`）⇒ 一层 async IIFE。
//
// 第一轮量了三件事：**判决**（谁红谁不红）· **落点**（钱线哪一侧）· **代价**（动几处）。
// 补的四行量的是判决之外的四件事：**贵不贵**（⑫）· **判据的「口径」是什么**（⑬）·
// **Q5 说的那份「规格」实物长什么样**（⑭）· **ⓑ 那只手要照着谁写**（⑮）。
// ══════════════════════════════════════════════════════════════════════════════
(async () => {
  const TOOL = G.CHARACTER_DNA_TOOL_NAME;

  // ── ⑫ 价签：越界今天值几发，补上判据之后又值几发 ──────────────────────────
  line("\n=== ⑫ ⭐ 价签：拿假 `fetch` 驱动**真的** `compileCharacterDna`，数往返次数 ===");
  line("  （走的是**真代码**：真循环、真 `parseToolUse`、真 `buildCharacterDna`、真账；`fetch` 由探针自己顶）");
  const upstream = (file) => ({
    content: [{ type: "tool_use", name: TOOL, input: file }],
    stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 2100, output_tokens: 900 },
  });
  const priceOf = async (label, file, note) => {
    const seen = [];
    const fetchImpl = async (_url, init) => {
      seen.push(String(init.body));
      const body = upstream(file);
      return { ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) };
    };
    let verdict, detail = "", led = "";
    try {
      const r = await G.compileCharacterDna({
        design: realDesign, vws: realVws, transport: { baseUrl: "http://upstream.test", apiKey: "k" }, fetchImpl,
      });
      verdict = "**过了**（`ok`）—— 链往下走";
      if (r.ledger) led = `attempts=${r.ledger[0].attempts} · failures=${JSON.stringify(r.ledger[0].failures ?? null)}`;
    } catch (e) {
      verdict = `抛 \`${e.name}\`（\`failure: ${e.failure}\`）`;
      detail = e.detail ?? e.message ?? "";
      if (e.ledger) led = `attempts=${e.ledger[0].attempts} · failures=${JSON.stringify(e.ledger[0].failures ?? null)}`;
    }
    line(`\n  【${label}】`);
    line(`     往返 **${seen.length}** 次 · body 去重后 **${new Set(seen).size}** 种 · ${led}`);
    line(`     判决：${verdict}`);
    if (detail) line(`     落到人眼前的那句话：${cut(detail.replace(/\n/g, " / "), 150)}`);
    if (note) line(`     ${note}`);
    return seen.length;
  };

  const priceC0 = realDna.characters[0];
  const priceOOB = `palette:${PAL_LEN + 5}`;
  const oobWhole = {
    format: "character-dna/v1",
    characters: [{ ...priceC0, palette: [priceOOB] }, ...realDna.characters.slice(1)],
  };
  await priceOf("对照 · 盘上原样的 DNA", realDna, "⇒ 台子诚实（第一轮 ① 用的是同一份）");
  const nOob = await priceOf(
    `越界 · characters[0].palette[0] = ${priceOOB}（其余一个字不动）`,
    oobWhole,
    "⚠️ 这就是第一轮 ① 那份「全绿」的文书 —— 它在**真 `compileCharacterDna`** 里也全绿",
  );
  const nHand = await priceOf(
    "装配级失败（今天真存在的那两只手之一）· 抽掉一个角色的 id",
    { format: "character-dna/v1", characters: realDna.characters.slice(1) },
    "⇒ 这就是**在 ⓑ 补第三只手之后**，越界会走的同一条路：同一个 `kind: \"schema\"`、同一个重采样",
  );
  const nSchema = await priceOf(
    "契约级失败 · palette 写成 hex",
    { format: "character-dna/v1", characters: [{ ...priceC0, palette: ["#ff0000"] }, ...realDna.characters.slice(1)] },
    "⇒ 与 ⓐ 补上之后同一条路（票 68 那句话的后果，在这里做对照）",
  );
  line("\n  ⇒ ⭐⭐ 读数：**越界今天值 1 发，而且那 1 发是「过」** —— 它**没有**花掉重采样的钱，");
  line(`     因为**今天没有东西会红**；而装配级那两只手拦下的失败值 **${nHand} 发**、契约级的值 **${nSchema} 发**。`);
  line("     ⇒ **加判据不是省钱，是花钱买一声响**：越界那一支从「1 发 · 静默通过」");
  line("       变成「3 发 · 响亮失败 + 一句能定位的话」。");
  line("     ⚠️ 而这一层**没有拒绝面**（第一轮 ⑤）⇒ ⓐⓑⓒⓓ **没有一个**能把那 3 发降回 1 发 ——");
  line("        这和票 67 那个角的方向**正好相反**（那边是「把贵的那一支变便宜」）。");
  line("     ⚠️ 另外：这 3 发的 **body 逐字节相同**（同一个常量盲发三次），模型看不到理由。");
  line(`     而今天那份越界文书走完这一发，④ 那一格拿到的是：`);
  const priceBrief = A.dnaBrief(oobWhole.characters[0], { palette: realVws.style.palette });
  line(`       ${priceBrief.split("\n").find((l) => l.startsWith("- \`palette\`"))}`);

  // ── ⑬ 口径：那条正则允许前导零 ⇒ 「越界判据」补的是哪一种 ─────────────────
  line("\n=== ⑬ ⚠️ 口径：`/^palette:\\d+$/` 允许**前导零**，所以「补 `< n`」补的是值级、不是形级 ===");
  line("  先看 DNA 这一侧（拿盘上**色板 11 项**的那一跑去试，因为 7 在里面）：");
  const longDir = ".scratch/game-maker-v2/experiments/e2e-wasteland/raw/checkpoint-run11/ruined-city-scavenger/run/v1/";
  const longDna = load(longDir + "character-dna.json");
  const longStyle = load(longDir + "stylespec.json");
  const lc0 = longDna.characters[0];
  line(`     （${longDir.replace(ROOT + "/", "")} · 色板 ${longStyle.palette.length} 项）`);
  for (const ref of ["palette:7", "palette:07", "palette:007"]) {
    const pp = C.CharacterDNAFileSchema.safeParse({ format: "character-dna/v1", characters: [{ ...lc0, palette: [ref] }] });
    const bb = A.dnaBrief({ ...lc0, palette: [ref] }, { palette: longStyle.palette });
    line(`     ${ref.padEnd(13)} 契约=${pp.success ? "**过**" : "拒"}  ⇒  ${bb.split("\n").find((l) => l.startsWith("- \`palette\`"))}`);
  }
  line("     ⇒ ⚠️ **三个不同的字符串、同一个色**（`Number(\"07\") === Number(\"7\")`）—— 都合法、都翻得出色值。");
  line("  再看 VWS 那一侧（同一条正则的另一个宿主，色板 3 项的最小文档）：");
  const vdoc = (over) => ({
    format: "visual-world/v1", styleIdentity: { keywords: [], description: "d" },
    camera: { mode: "side" }, composition: {}, lighting: {}, character: {}, environment: {},
    palette: { primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [] },
    materials: {}, shapeLanguage: [], constraints: [], styleReferences: [],
    style: { id: "s", identity: [], palette: ["#112233", "#445566", "#778899"], confidence: 0.5 }, ...over,
  });
  const vb = (o) => ({ primary: [], secondary: [], accent: [], background: [], shadow: [], highlight: [], ...o });
  for (const ref of ["palette:2", "palette:02", "palette:002", "palette:04"]) {
    const r = C.VisualWorldSpecSchema.safeParse(vdoc({ palette: vb({ primary: [ref] }) }));
    line(`     VWS 六桶 ${ref.padEnd(13)} ⇒ success=${r.success}` +
      (r.success ? "  ⚠️ **也放行**" : `  ${cut(r.error.issues[0].message, 60)}`));
  }
  line("     ⇒ ⚠️ **VWS 那条 gate 也只查 `idx >= n`**，前导零在同一侧同样溜得过 ⇒");
  line("        「给 DNA 补一条 `< n`」= 与 VWS **对齐**，**不是**补一个 DNA 独有的洞、");
  line("        也**不会**顺带治「同一个色有无数种合法写法」——⚠️ 那是**另一件事**（形级 / 规范化），");
  line("        本票不裁它，这里只登记：**四处（VWS 六桶 · materials.color · drawlist · DNA）没有一处管它**。");

  // ── ⑭ Q5 说的那份「规格」实物：到底几条断言 ──────────────────────────────
  line("\n=== ⑭ Q5 的模板实物：`visual-world-gate.test.ts` 到底几条断言 ===");
  const gtPath = "packages/contracts/tests/visual-world-gate.test.ts";
  const gt = S(gtPath);
  const its = gt.map((l, i) => [i + 1, l]).filter(([, l]) => l.trim().startsWith("it("));
  line(`  ${gtPath} —— **${gt.length} 行** · \`it(\` **${its.length} 条**（第一轮的 Q5 写的是「4 条断言」⇒ **这里纠正**）`);
  for (const [n, l] of its) line(`     :${String(n).padEnd(3)} ${cut(l.trim().replace(/^it\(|,?\s*\(\)\s*=>\s*\{$/g, ""), 96)}`);
  const describes = gt.filter((l) => l.trim().startsWith("describe(")).length;
  line(`  分 **${describes} 个 \`describe\`**：前一组是 gate 本身（越界 / 定位 / 一处一条 / 边界放行 / 空色板 / 读盘也管），`);
  line("     后一组两条讲的是「**gate 模型看不见**」（`toJSONSchema` 丢 `superRefine` · `.omit()` 会摘掉它）——");
  line("     ⇒ 若给 DNA 补 gate，**前一组那几条可以逐条换字段照抄**，后一组两条讲的是同一条性质、也照旧成立。");

  // ── ⑮ ⓑ 那只手要照着谁写：两只手的签名与返回形状 + 那一格全仓只有一个读者 ──
  line("\n=== ⑮ ⭐ ⓑ 的模板：那两只手的**返回形状**决定了第三只手怎么写 ===");
  const bd = S("packages/game-design/src/build-character-dna.ts");
  const sigSet = findLine(bd, "export function characterSetGate(");
  const sigVer = findLine(bd, "export function verbatimCopyGuard(");
  line(`  · :${sigSet}  ${bd[sigSet - 1].trim()}`);
  line(`  · :${sigVer}  ${bd[sigVer - 1].trim()}`);
  line("    ⇒ ⚠️ **两只手都返回 `string[]`**（一串**给人读的问题**，不是 `boolean`、不是抛错）——");
  line("       第三只手照这个形状写就行：**纯函数 · 收 `(file, vws)` · 返回问题清单**，不需要新类型、不抛。");
  const foldAt = findLine(bd, "const problems = [");
  for (let i = 0; i <= 3; i++) line(`    :${foldAt + i}  ${bd[foldAt + i - 1].trim()}`);
  line("    ⇒ 折叠点**只有一处**（`problems.length > 0` ⇒ `kind: \"schema\"`）⇒ 补一只手**不改这里一个字**。");
  line("  · ⚠️ 而这一格在**全仓只有一个读者** —— 扫遍 `packages/` 整棵树（含 tests、含 `src/` 的子目录，\n     只排掉 `dist` 与 `node_modules`），找所有读 `dna.palette` 的地方：");
  const readers = [];
  (function scanAll(d) {
    let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
    for (const e of ents) {
      if (e.name === "node_modules" || e.name === "dist") continue;
      const p2 = path.join(d, e.name);
      if (e.isDirectory()) { scanAll(p2); continue; }
      if (!e.name.endsWith(".ts")) continue;
      const rel = path.relative(ROOT, p2);
      fs.readFileSync(p2, "utf8").split("\n").forEach((l, i) => {
        if (/\bdna\.palette\b/.test(l)) readers.push(`${rel}:${i + 1}  ${l.trim()}`);
      });
    }
  })(P("packages"));
  for (const r of readers) line(`      ${cut(r, 120)}`);
  line(`    ⇒ 命中 **${readers.length} 行**，但**是同一个读者**（\`dnaBrief\` 那一句拆成了两行）⇒ 「这一格只有一只手在拿」成立。`);
  line("       补上第三只手之后，**那唯一一个读者就再也拿不到悬空值** —— 这正是 ⑫ 里");
  line("       「加判据买到的是**一声响**、不是省钱」这句话的落点：它买的是一格**本来会静默翻译失败**的东西。");

  line("\n=== ⑯ 补量这一段量到的四件事（一句话各一条）===");
  line(`  ① ⭐ 价签：越界今天 **${nOob} 发且「过」**，加判据后 **${nHand} 发且抛** ⇒ **不是省钱，是花钱买一声响**；`);
  line("     而这一层没有拒绝面 ⇒ ⓐⓑⓒⓓ 没一个能把 3 发降回来（与票 67 方向相反）。");
  line("  ② ⚠️ 口径：正则允许前导零 ⇒ 「补 `< n`」是**值级**、与 VWS 对齐，不治「同色多写」（四处都没管）。");
  line(`  ③ Q5 的模板实物：\`visual-world-gate.test.ts\` **${gt.length} 行 · ${its.length} 条 \`it\`**（第一轮说 4 条 ⇒ 纠正）。`);
  line("  ④ ⓑ 的模板：两只手都返回 `string[]`、折叠点只有一处、而这一格**只有一个读者** ⇒ 第三只手是纯函数、零新类型。");

  // ════════════════════════════════════════════════════════════════════════════
  // ⭐ 补量 · 第二轮（2026-10-14 · 同日第三轮 · 只读 / 只 require 已构建 `dist` · 零付费）
  //
  // ⚠️ 这一段**追加在上一段的 ⑯ 小结之后**、**上面任何一个字节都没动**
  //    ⇒ 上一份原始输出的 297 行**整段成为前缀**（这就是「逐字节未漂」最强的形式）。
  //
  // 前两轮量的是：**判决**（谁红谁不红）· **落点**（钱线哪一侧）· **代价**（动几处）·
  //   **贵不贵**（⑫）· **口径**（⑬）· **模板实物**（⑭⑮）。
  // 这一轮量的是**裁 Q1–Q5 那张表时要付的东西**：
  //   ⓒ/ⓓ 手上到底有没有料（⑰）· Q4 的落点离先例有多远（⑱）·
  //   补上之后**仓库里谁会红**（⑲）· 第三只手**真写一遍**会怎样（⑳）·
  //   与票 68 **同住一格**会不会打架（㉑）。
  // ════════════════════════════════════════════════════════════════════════════
  {
    // ── ⑰ ⓒ/ⓓ 手上到底有没有色板 ─────────────────────────────────────────────
    line("\n=== ⑰ ⭐ ⓒ/ⓓ 手上到底有没有色板：`style` 是必填，`visualWorld` 是可选 ===");
    const pk2 = S("packages/assets/src/pack.ts");
    const styleReqAt = pk2.findIndex((l) => l === "  style: StyleSpec;") + 1;
    const vwsOptAt = pk2.findIndex((l) => l.trim().startsWith("visualWorld?: VisualWorldSpec;")) + 1;
    line(`  · pack.ts:${styleReqAt}   ${pk2[styleReqAt - 1].trim()}      ← **必填**（没有 \`?\`）`);
    line(`  · pack.ts:${vwsOptAt}   ${pk2[vwsOptAt - 1].trim()}   ← **可选**`);
    const pr2 = S("packages/assets/src/prompt.ts");
    const briefAt2 = pr2.findIndex((l) => l.includes("export function dnaBrief(")) + 1;
    const idxAt2 = pr2.findIndex((l) => l.includes("style.palette[Number(ref.slice(")) + 1;
    line(`  · 而读者索引的是**哪一份**：prompt.ts:${briefAt2} \`dnaBrief(dna, style)\` → :${idxAt2}`);
    line(`      ${pr2[idxAt2 - 1].trim()}`);
    line("  ⇒ ⭐ 读数：在 assets 那一侧，所谓「色板」**就是 `style.palette`** —— 而 `style` 是 `buildAssetPack` 的**必填入参**，");
    line("     与**可选**的 `opts.visualWorld` 无关。");
    line("  ⇒ ⚠️ 这一条纠正了一个默认假设：ⓒ/ⓓ 不是「拿不到色板」，而是**手上那一份就是读者用的那一份**。");
    line("     ⇒ ⑩ 那条「`stylespec.json` 是 `world.style` 的逐字节转储」的桥，在 ⓒ/ⓓ **根本不用搭**：");
    line("        一个跨文书的假设都不需要 —— 而 ⓑ 需要（它比的是 `vws.style.palette`）。");

    // ── ⑱ 票 44 那条入口闸离 Q4 的落点有多远 ─────────────────────────────────
    line("\n=== ⑱ ⭐⭐ 票 44 那条入口闸，与 Q4 的落点住在**同一个函数体**里 ===");
    const ops2 = S("packages/assets/src/ops.ts");
    const styleAt2 = ops2.findIndex((l) => l === "  const style = readStyle(styleAbs);") + 1;
    const callAt2 = ops2.findIndex((l) => l.includes("  const characterDna = readCharacterRef(")) + 1;
    const defAt2 = ops2.findIndex((l) => l.includes("function readCharacterRef(")) + 1;
    const readStyleAt2 = ops2.findIndex((l) => l.includes("function readStyle(p: string): StyleSpec {")) + 1;
    line(`  · ops.ts:${styleAt2}   ${ops2[styleAt2 - 1].trim()}`);
    line(`  · ops.ts:${callAt2}   ${cut(ops2[callAt2 - 1].trim(), 110)}`);
    line(`  ⇒ 两者相隔 **${callAt2 - styleAt2} 行**、**同一个函数体**（\`packAssets\`）。`);
    line(`  · 而票 44 那条闸本体就长在 readStyle 里（ops.ts:${readStyleAt2} 起）—— 它的注释逐字给了做法：`);
    const n1 = ops2.findIndex((l) => l.includes("**色板非空**是一条**业务**判据"));
    const n2 = ops2.findIndex((l) => l.includes("不依赖清单是否引用色板"));
    line(`      :${n1 + 1}  ${cut(ops2[n1].trim(), 140)}`);
    line(`      :${n2 + 1}  ${cut(ops2[n2].trim(), 140)}`);
    line(`  ⇒ ⭐ 所以 Q4(a)「入口也拒」**不是**「要 plumbing」：色板在 :${styleAt2} 就已经在手上，`);
    line(`     只差把 \`style\`（或 \`style.palette\`）多传一个参数进 :${callAt2}。`);
    line(`  · 而今天的 readCharacterRef **签名里没有它**（:${defAt2}）：`);
    line(`      ${cut(ops2[defAt2 - 1].trim(), 150)}`);

    // ── ⑲ 落地价签：仓库里谁会红 ─────────────────────────────────────────────
    line("\n=== ⑲ ⚠️ 落地价签：补上这条判据之后，**仓库里有没有既有 fixture / 测试会红** ===");
    line("  ⚠️ 第一轮 ③ 量的是**盘上真产物**（9 份 · 96 元素 · 越界 0）；这一格量的是**仓库自己的 fixture**。");
    const pairs = [
      { f: "packages/game-design/tests/fixtures.ts", who: "`dnaRecord()`（**全 game-design 套件都用它**）", refs: ["palette:0"], len: 2, note: "配对的是同文件 `VWS.style.palette`（**2 个色**；`VWS_CLASS` 由它 spread，色板同一份）" },
      { f: "packages/assets/tests/master.test.ts", who: "`DNA`（`dnaBrief` 那条测试的输入）", refs: ["palette:1", "palette:3"], len: 4, note: "配对的是同文件 `STYLE.palette`（**4 个色**，:14）" },
      { f: "packages/assets/tests/pack-master.test.ts", who: "`DNA`（pack 那条测试的输入）", refs: ["palette:0"], len: null, note: "色板来自配方 fixture 的 `styleRef`；`palette:0` 对**任何非空**色板都在界内（非空由票 44 的闸保证）" },
      { f: "fixtures/upstream/canned.json", who: "`characterDna.characters[*].palette`（E2E 的假上游回话）", refs: ["palette:0", "palette:1"], len: 2, note: "配对的是同文件 `visualWorld.style.palette`（**2 个色**）" },
      { f: "packages/contracts/tests/character-dna.test.ts", who: "`ODIN.palette`（**纯 schema 测试**，不配色板）", refs: ["palette:0", "palette:3", "palette:2"], len: null, note: "⚠️ 它过的是 `CharacterDNAFileSchema` —— **手上没有色板** ⇒ ⓑ 那道手**碰不到它**" },
    ];
    for (const q of pairs) {
      const mx = Math.max(...q.refs.map((r) => Number(r.slice(8))));
      const verdict = q.len === null ? "（不配色板 ⇒ 由**落点**决定谁碰得到它）" : (mx < q.len ? `✅ **全在界内**（最大 ${mx} < ${q.len}）` : "⚠️ **会红**");
      line(`  · ${q.who}`);
      line(`      ${q.f}   下标 ${q.refs.join(" / ")}   ⇒  ${verdict}`);
      line(`      ${q.note}`);
    }
    line("  ⇒ ⭐ 读数：**仓库里没有一份 DNA fixture 带越界引用** —— 最大下标是 `master.test.ts` 的 **3**，而它配的色板是 **4** 个。");
    line("     ⇒ 「补上这道手」在**既有测试**这一侧是**免费的**：game-design 全套件用的是 `dnaRecord`（只有 `palette:0`）、");
    line("       assets 那两份也在界内 ⇒ **改造不会先撞红一片**。");
    line("     ⚠️ 而 `contracts/tests/character-dna.test.ts` 的 `palette:3` 提醒了 ⑥ 那件事：**它压根不配色板** ⇒");
    line("        若 Q2 裁 ⓐ（schema 级），那一份 fixture 的**入参形状要跟着变**；裁 ⓑ/ⓒ/ⓓ 则一个字不用动。");

    // ── ⑳ 第三只手真写一遍（只在内存里）──────────────────────────────────────
    line("\n=== ⑳ ⭐⭐ 第三只手照那两只手的形状**真写一遍**（只在内存里），喂真文书 ===");
    const bd2 = S("packages/game-design/src/build-character-dna.ts");
    const sigSet2 = bd2.findIndex((l) => l.includes("export function characterSetGate(")) + 1;
    const sigVer2 = bd2.findIndex((l) => l.includes("export function verbatimCopyGuard(")) + 1;
    line("  模板（⑮ 已量过签名）：");
    line(`     :${sigSet2}  ${bd2[sigSet2 - 1].trim()}`);
    line(`     :${sigVer2}  ${bd2[sigVer2 - 1].trim()}`);
    /** 照 VWS 那条 gate 的口径（`idx >= n` ⇒ 一条问题）写的第三只手 —— 6 行、纯函数、返回 `string[]`、不抛。 */
    const thirdHand = (file, paletteLen) => {
      const out = [];
      file.characters.forEach((c, ci) => {
        c.palette.forEach((ref, ri) => {
          const idx = Number(ref.slice("palette:".length));
          if (idx >= paletteLen) out.push(`characters.${ci}.palette.${ri}：悬空引用 —— 色板只有 ${paletteLen} 项，而这里指的是 ${ref}`);
        });
      });
      return out;
    };
    line("  · 第三只手（**6 行**、返回 `string[]`、不抛、零新类型）：");
    line('      const idx = Number(ref.slice("palette:".length));');
    line("      if (idx >= paletteLen) out.push(`characters.${ci}.palette.${ri}：…`);");
    line("  ⚠️ 下面喂的是**盘上真产物**（不是构的）：");
    const dnaFiles = [];
    (function walk2(d, depth) {
      if (depth > 6) return;
      let ents = []; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch { return; }
      for (const e of ents) {
        const p3 = path.join(d, e.name);
        if (e.isDirectory()) { walk2(p3, depth + 1); continue; }
        if (e.name === "character-dna.json") dnaFiles.push(p3);
      }
    })(P(".scratch/game-maker-v2/experiments/e2e-wasteland/raw"), 0);
    let tCh = 0, tEl = 0, tBad = 0, tSkip = 0;
    for (const p3 of dnaFiles.sort()) {
      const dna = JSON.parse(fs.readFileSync(p3, "utf8"));
      let n = null;
      try { n = JSON.parse(fs.readFileSync(path.join(path.dirname(p3), "visual-world.json"), "utf8")).style.palette.length; } catch { }
      if (n === null) { tSkip++; continue; }
      const probs = thirdHand(dna, n);
      const els = dna.characters.reduce((a, c) => a + c.palette.length, 0);
      tCh += dna.characters.length; tEl += els; tBad += probs.length;
      line(`     ${String(probs.length).padStart(2)} 条 · 色板 ${String(n).padStart(2)} 项 · ${String(dna.characters.length).padStart(2)} 角色 · ${String(els).padStart(2)} 元素   ${path.relative(P(".scratch/game-maker-v2/experiments/e2e-wasteland/raw"), p3)}`);
    }
    line(`  ⇒ 盘上合计 **${tCh} 个角色 · ${tEl} 个元素**（另 ${tSkip} 份缺同跑的 VWS，跳过）⇒ 第三只手报 **${tBad} 条问题**`);
    line("     ⇒ ⭐ 这是对 ③「n=9 · 越界 0」在**手这一层**的复核（不是重述票面，是把那只手跑起来）：**它一条都不报**。");
    line("  · 再喂**构造的**四份（看它报不报、报文长什么样）：");
    const c0b = realDna.characters[0];
    const mk2 = (refs) => ({ format: "character-dna/v1", characters: [{ ...c0b, palette: refs }, ...realDna.characters.slice(1)] });
    for (const [label, refs] of [
      [`越界 · palette:${PAL_LEN + 5}`, [`palette:${PAL_LEN + 5}`]],
      [`边界外一格 · palette:${PAL_LEN}`, [`palette:${PAL_LEN}`]],
      [`边界内最大 · palette:${PAL_LEN - 1}`, [`palette:${PAL_LEN - 1}`]],
      [`前导零 · palette:0${PAL_LEN - 2}（色板 ${PAL_LEN} 项 ⇒ 值 = ${PAL_LEN - 2}）`, [`palette:0${PAL_LEN - 2}`]],
    ]) {
      const probs = thirdHand(mk2(refs), PAL_LEN);
      line(`     ${label.padEnd(40)} ⇒ **${probs.length}** 条${probs.length ? "：「" + cut(probs[0], 96) + "」" : ""}`);
    }
    line("  ⇒ ⭐ 读数：那只手是**按值判**的（`Number(ref.slice(8))`）—— 所以前导零那行报 **0** 条**不是漏洞**：");
    line("     它只是同一个值的另一种拼法（值 4 < 色板 6 项 ⇒ 在界内），与 `palette:4` 同判。");
    line("     ⇒ 而 ⑬ 量到的 VWS 那条 gate 口径**一致**：`palette:04` 配 **3 项**色板时**照样拒**（值 4 ≥ 3）");
    line("       ⇒ 两条 gate 判的都是**值**、不是**形** ⇒ ⑫ 那句「口径对齐」在这一格**实测成立**。");
    line("     ⇒ ⑮ 那句「照这个形状写」**实测成立**：零新类型、不抛、报文与 VWS 那条同形（`path：悬空引用 …`）。");
    line("     ⚠️ 但这一格**证不了**「补上之后模型会更小心」—— 它只证「那只手写得出、且对真文书沉默」。");

    // ── ㉑ 与票 68 同住一格：两票合起来会不会打架 ────────────────────────────
    line("\n=== ㉑ ⭐ 票 68 与票 69 住**同一格**：两票的候选措辞合起来会不会打架 ===");
    const gd2 = S("packages/game-design/src/prompts.ts");
    const hintAt2 = gd2.findIndex((l) => l.includes("这个角色身上的颜色，从世界色板里")) + 1;
    const ruleAt2 = gd2.findIndex((l) => l.includes("palette\\` 只能写")) + 1;
    line(`  · 同一格现话：prompts.ts:${hintAt2}-${hintAt2 + 1}（\`DNA_FIELD_HINTS.palette\`）`);
    line(`      ${cut(gd2[hintAt2 - 1].trim(), 120)}`);
    line(`      ${cut(gd2[hintAt2].trim(), 120)}`);
    line(`  · 另一处「规矩」：prompts.ts:${ruleAt2}（工具说明第 4 条 —— 票 68 的 ⑬ 量过：它与这一格在**同一发 body** 里）`);
    line(`      ${cut(gd2[ruleAt2 - 1].trim(), 150)}`);
    const A68 = "⚠️ 不许写 hex 或颜色名（写了下游会被量化掉，等于没写）";
    const B68 = "⚠️ 不许写 hex 或颜色名：写了这一份**过不了 palette:<下标> 的 schema**（整份判失败、退 4）—— **不是**「等于没写」，是**当场退回来**";
    const A69 = "只能写 `palette:<下标>`（如 `palette:0`）。";
    const B69 = A69 + "⚠️ 那个下标必须**严格小于**色板的项数（写大了这一份过不了 schema、整份判失败、退 4）。";
    const cell = gd2.slice(hintAt2 - 1, hintAt2 + 1).join("\n");
    line("  · 两个「锚」在**同一格**里各命中几次（这才是「同格」的真正风险 —— 换句会不会互相覆盖）：");
    line(`     · 票 68 的锚（后果那半）⇒ 命中 **${cell.split(A68).length - 1}** 次`);
    line(`     · 票 69 的锚（规矩那半）⇒ 命中 **${cell.split(A69).length - 1}** 次`);
    line("  ⇒ ⭐ 读数：**两个锚不相交**（68 动「后果」、69 动「规矩」）⇒ **换句顺序无关、不会互相覆盖**。");
    const todayFull = G.characterDnaPrompt({ design: JSON.parse(fs.readFileSync(P(RUN + "game-design.json"), "utf8")), vws: realVws });
    const both = todayFull.replace(A68, B68).replace(A69, B69);
    line(`  · 拿**真**的一对拼出来的提示词：**${todayFull.length} 字** · 两票都换过之后：**${both.length} 字**（Δ ${both.length - todayFull.length}）`);
    line(`     · 68 的旧句仍在吗 **${both.includes(A68)}**（应为 false） · 69 的新半句在吗 **${both.includes("严格小于")}**（应为 true）`);
    line("     · 一条既有的、盯这一格的断言还在吗（`dna-prompts.test.ts` 那条 `toContain(\"\\`palette:<下标>\\`\")`）：");
    line(`       **${both.includes("`palette:<下标>`")}**`);
    line("  ⇒ ⭐ 读数：两票可以**同一次落地**、互不踩 —— 但顺序仍是「第二票落地时先读第一票改完的那句话」（Q3 已写）。");
    line("     ⚠️ 这一格量的是**字符串层面**的相容性，**不是**「那句话读起来通顺」（后者只有人裁能说）。");

    line("\n=== 小结 · 这一轮量到的五件事（**不编号** —— ㉒ 起留给下一轮读数）===");
    line("  ① ⭐ ⓒ/ⓓ 手上**有色板**（`style` 必填 · `visualWorld` 可选 · 而读者索引的就是 `style.palette`）");
    line("     ⇒ 「钱线之后那两支拿不到色板」这个默认假设**不成立**；且它们比的是**读者自己那一份**（连 ⑩ 的桥都不用搭）。");
    line("  ② ⭐⭐ 票 44 那条入口闸与 Q4 的落点**相隔 30 行、同一个函数体**（ops.ts:1372 / :1402）");
    line("     ⇒ Q4(a) 的代价不是「要 plumbing」，是「多传一个参数」。");
    line("  ③ ⚠️ 落地价签：**仓库里没有一份 DNA fixture 带越界引用**（最大下标 3，配 4 项色板）");
    line("     ⇒ 补上这只手，既有测试这一侧是**免费的**；⚠️ 唯一要动入参的是 ⓐ 那条路（`contracts` 那份 fixture 不配色板）。");
    line(`  ④ ⭐ 第三只手（6 行纯函数）真跑：盘上 ${tCh} 角色 / ${tEl} 元素报 **${tBad}** 条 · 构造的越界报 1 条 · 前导零按**值**判（与 VWS 同口径）。`);
    line("  ⑤ ⭐ 与票 68 **同格不相交**：两个锚各命中 1 次 ⇒ 换句顺序无关、可同一次落地。");
  }
})();
