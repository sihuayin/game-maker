// 票 13 的探针：**真·生图**（5 次真调用 / 4 个臂）+ 一次**注入的失败**。
//
// ⚠️ 与文本探针（08/09/10/31）的差别：这一票量的是**图**，所以「对不对」有一半**人眼说了算**
//   —— 脚本只负责把事实摆出来（回图尺寸 · 两次请求的提示词 · 产物 PNG 落盘 · 帧是否逐字节相同），
//   **不打分、不判定像不像**（R3 把「不评分」钉在判定层上）。
//
// 四个臂：
//   A normal    —— `image` 的母版（DNA → 一张位图）+ 动画**引用它**（Q1/Q2/Q3：2 次真调用）
//   B control   —— **同一份动画、同一个提示词**，只是**没有**母版引用（1 次真调用）
//                  ⇒ 与 A 比：参考图**到底有没有起作用**（逐字节比 + 人眼看）
//   C conflict  —— DNA 描述的是「拾荒者」，而参考图是**手作的另一张母版**（Odin）（1 次真调用）
//                  ⇒ 打架时谁赢
//   D failure   —— 母版那一发**注入失败**：引用它的资产不许上路、不引用的资产照造（1 次真调用 + 1 次注入）
//
// 跑法：node .scratch/game-maker-v2/experiments/master-first-shot/run.mjs
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const url = (p) => pathToFileURL(p).href;
const read = (rel) => JSON.parse(fs.readFileSync(path.join(ROOT, rel), "utf8"));

const CONTRACTS = path.join(ROOT, "packages/contracts/dist/index.js");
const ASSETS = path.join(ROOT, "packages/assets/dist/index.js");
const { GameDesignSpecSchema, VisualWorldSpecSchema, CharacterDNAFileSchema } = await import(url(CONTRACTS));
const { buildAssetPack, createGeminiGenerator, createProxyFetch, resolveImageTransport, encodePNG, decodePNG } = await import(url(ASSETS));

// ── 输入：三份**真跑出来过**的东西 ───────────────────────────────────────────
// 世界 + 它的 StyleSpec：票 08 探针第 1 发的入参（`style` 就是票 12 抽出来的那份 StyleSpec）
const rawVws = read(".scratch/game-maker-v2/experiments/vws-first-shot/raw/01-first-shot.json").input;
const VWS = VisualWorldSpecSchema.parse({ ...rawVws, styleReferences: (rawVws.styleReferences ?? []).length ? rawVws.styleReferences : [{ path: "fixtures/reference/halt-dusk.png", role: "global" }] });
const STYLE = VWS.style;
// 设计：票 10 探针第 1 发的入参
const DESIGN = GameDesignSpecSchema.parse(read(".scratch/game-maker-v2/experiments/design-first-shot/raw/01-normal.json").input);
// 角色基因：票 31 探针第 1 发**真吐出来**的那一条（`p-scavenger`）
const rawDna = read(".scratch/game-maker-v2/experiments/dna-first-shot/raw/01-normal.json").input;
const DNA = CharacterDNAFileSchema.parse({ format: "character-dna/v1", characters: [rawDna.characters.find((c) => c.id === "p-scavenger")] });

// ── 生图端口：**出货的那一套**（本地配置读出来的 gemini + 代理）────────────────
const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (cfg.transport === undefined) throw new Error("没配生图上游（game-maker.local.json / GAME_MAKER_IMAGE_*）");
if (cfg.transport.protocol !== "gemini")
  throw new Error(`本探针要求 gemini 协议（参考图只有它内联支持）—— 现在配的是 ${cfg.transport.protocol}`);
// ⚠️ **代理可以单独覆盖**（`MASTER_PROBE_PROXY`）：跑这一次时配置里那个 9098 **没开**
//   （`ECONNREFUSED`），而本机另有一条能通 Google 的。⇒ 借用它，并在报告里写明借的是哪一条
//   —— 「探针跑的其实是哪条路」是读数的一部分，不许含糊。
const PROXY = process.env.MASTER_PROBE_PROXY ?? cfg.transport.proxy;
const doFetch = PROXY ? createProxyFetch({ proxy: PROXY }) : undefined;
const realGen = createGeminiGenerator({ ...cfg.transport, ...(doFetch ? { fetchImpl: doFetch } : {}) });

const OUT = path.join(HERE, "raw", "out");
// ⚠️ **重放（`--from-raw`）一个字节都不许动** —— 第一轮跑完我用重放补了一次汇总，
//   而当时这一行把**产物 PNG 全删了**（重放本来只该读 raw/*.json）。花了一次真钱才知道。
if (!process.argv.includes("--from-raw")) {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });
}

// ── 一份最小清单：一个**引用母版**的动画 + 一个**与母版无关**的箱子 ─────────────
const spec = (over) => ({
  kind: "animation", id: "p-scavenger-idle", role: "玩家：待机", description: "拾荒者的待机一帧",
  styleId: STYLE.id, anchor: { x: 0.5, y: 1 }, size: { w: 32, h: 48 }, required: true,
  characterId: "p-scavenger", animations: [{ name: "idle", frames: 1, fps: 1, loop: true }], ...over,
});
const CRATE = {
  spec: { kind: "sprite", id: "crate", role: "障碍：木条箱", description: "一只旧木条箱", styleId: STYLE.id, anchor: { x: 0.5, y: 1 }, size: { w: 24, h: 24 }, required: true },
  source: { kind: "image", background: { tolerance: 30 } },
};
const recipe = ({ withMaster = true, withCrate = false, size = { w: 64, h: 96 }, masterSource = { kind: "image", background: { tolerance: 30 } } } = {}) => ({
  format: "asset-recipe/v1", id: "master-probe", styleRef: "stylespec.json",
  authoring: withMaster
    ? [{ id: "p-scavenger-master", role: "玩家角色母版", description: "DNA 的一张渲染图：全身、正视、中性站姿", source: masterSource, characterId: "p-scavenger", size }]
    : undefined,
  assets: [
    { spec: spec(withMaster ? { masterAsset: "p-scavenger-master" } : {}), source: { kind: "image", background: { tolerance: 30 } } },
    ...(withCrate ? [CRATE] : []),
  ],
});

const STUB_DRAW = () => { throw new Error("本探针没有 drawlist 资产"); };

/** 记下每一发请求；`failMaster` 时**母版那一发不出去**（模拟它挂了）。 */
const recorder = ({ failMaster = false } = {}) => {
  const calls = [];
  const gen = async (req, report) => {
    const which = req.prompt.includes("母版参考图") ? "master"
      : req.prompt.includes("这组动作是") ? "anim"
      : "crate";
    if (which === "master" && failMaster) {
      // ⚠️ **注入的失败**：这一发**不发出去**（一分钱不花），但要像真失败那样交账。
      report?.onFailure?.({ ms: 0, attempts: 1, upstream: "gemini" });
      throw new Error("母版那一发挂了（探针注入）");
    }
    const out = await realGen(req, report);
    calls.push({ which, size: req.size, hasReference: req.reference !== undefined, hasStyleReference: req.styleReference !== undefined, prompt: req.prompt, negativePrompt: req.negativePrompt, image: out.image, call: out.call });
    return out;
  };
  return { calls, gen };
};

/** 一次真跑：返回事实（不判定）。 */
async function run(label, r, { failMaster = false, ...opts } = {}) {
  const { calls, gen } = recorder({ failMaster });
  const ledger = [];
  const dir = path.join(OUT, label);
  const rec = { label, arms: {...opts}, recipes: recipe(opts), calls: [], ledger, outcome: null, error: null, frames: {} };
  try {
    const res = await buildAssetPack({
      recipe: recipe(opts), style: STYLE, outDir: dir, recipeDir: ROOT,
      generate: STUB_DRAW, generateImage: gen, ledger, characterDna: DNA, sourceDateEpoch: 1790208000,
    });
    rec.outcome = "ok";
    // 逐臂把产物 PNG 落盘（人眼看的就是这几张）
    for (const a of res.manifest.assets) {
      rec.frames[a.id] = { frames: a.frames.length, paletteBinding: a.paletteBinding };
      // 生图原图（创作态）：动画是 `<id>.<动画名>.png`，单帧资源是 `<id>.png`
      const rel = a.animations?.length ? `authoring/generated/${a.id}.${a.animations[0].name}.png` : `authoring/generated/${a.id}.png`;
      const abs = path.join(res.packDir, rel);
      if (fs.existsSync(abs)) fs.copyFileSync(abs, path.join(OUT, `${label}.${a.id}.raw.png`));
    }
    // ⚠️ 交付态那一张（量化后的那一张）才是「最后画出来什么」
    const atlas = path.join(res.packDir, "delivery/atlas.animations.png");
    if (fs.existsSync(atlas)) fs.copyFileSync(atlas, path.join(OUT, `${label}.delivered.png`));
  } catch (e) {
    rec.outcome = "failed";
    rec.error = e instanceof Error ? e.message : String(e);
  }
  rec.calls = calls.map((c) => ({ which: c.which, size: c.size, hasReference: c.hasReference, hasStyleReference: c.hasStyleReference, requestedSize: c.call.requestedSize, ms: c.call.ms, promptLen: c.prompt.length }));
  rec.ledger = ledger.map((l) => ({ step: l.step, target: l.target, attempts: l.attempts, ms: l.ms, requestedSize: l.requestedSize, failures: l.failures }));
  fs.writeFileSync(path.join(HERE, "raw", `${label}.json`), JSON.stringify({ ...rec, images: calls.map((c) => ({ which: c.which, width: c.image.width, height: c.image.height })), prompts: calls.map((c) => ({ which: c.which, prompt: c.prompt })) }, null, 2));
  return { rec, images: calls.map((c) => ({ which: c.which, image: c.image })) };
}

console.log(`票 13 探针 —— 真·生图（base=${cfg.transport.baseUrl} · model=${cfg.transport.model ?? "默认"} · 协议 ${cfg.transport.protocol}）`);
console.log(`代理：${PROXY ?? "（直连）"}${process.env.MASTER_PROBE_PROXY ? " —— ⚠️ **探针临时覆盖**（配置里那条在跑这一次时没开）" : ""}`);
console.log(`输入：真跑的产物（世界=票 08 raw/01 · 设计=票 10 raw/01 · DNA=票 31 raw/01 的 p-scavenger）`);
console.log(`母版的 canonical 画布：64×96（与动画 32×48 同比例 2:3）· 角色 id=${DNA.characters[0].id}\n`);

const FROM_RAW = process.argv.includes("--from-raw");
const results = {};
const ARMS = [
  ["A-normal", { withMaster: true }, {}],
  ["B-control", { withMaster: false }, {}],
  ["C-conflict", { withMaster: true, masterSource: { kind: "import", ref: "inputs/master-to-animation/player-master.png" } }, {}],
  ["D-failure", { withMaster: true, withCrate: true }, { failMaster: true }],
];

if (FROM_RAW) {
  // ⚠️ **重放**：只读 `raw/*.json`，一个请求都不发 —— 汇总逻辑改了之后用它重打。
  for (const [label] of ARMS) {
    const rec = JSON.parse(fs.readFileSync(path.join(HERE, "raw", `${label}.json`), "utf8"));
    results[label] = { rec, images: (rec.images ?? []).map((i) => ({ which: i.which, image: i })) };
  }
}

for (const [label, opts, extra] of (FROM_RAW ? [] : ARMS)) {
  const { rec, images } = await run(label, null, { ...opts, ...extra });
  results[label] = { rec, images };
  console.log(`── ${label}`);
  console.log(`   结局：${rec.outcome}${rec.error ? ` · ${rec.error.split("\n")[0].slice(0, 160)}` : ""}`);
  for (const c of rec.calls)
    console.log(`   调用 ${c.which.padEnd(7)} 请求 ${c.size.w}×${c.size.h} · 参考图 ${c.hasReference ? "有" : "无"} · 风格图 ${c.hasStyleReference ? "有" : "无"} · 上游要的是 ${c.requestedSize} · ${c.ms}ms`);
  for (const im of images) console.log(`          回来的图：${im.image.width}×${im.image.height}（${im.which}）`);
  for (const l of rec.ledger) console.log(`   账 ${l.step.padEnd(6)} target=${String(l.target).padEnd(18)} attempts=${l.attempts} ${l.failures ? `failures=${l.failures}` : ""}`);
}

// ── 汇总（**只摆事实**）────────────────────────────────────────────────────
console.log("\n── 汇总 ──────────────────────────────────────────────");
const A = results["A-normal"], B = results["B-control"], C = results["C-conflict"], D = results["D-failure"];
const masterImg = A.images.find((x) => x.which === "master");
if (masterImg) {
  const { width: w, height: h } = masterImg.image;
  console.log(`① 母版那一发回来的图：**${w}×${h}**（比例 ${(w / h).toFixed(3)}）· canonical 64×96（比例 0.667）⇒ ${64 * h === w * 96 ? "一致 ✅" : "**不一致**（那条判据会硬失败）"}`);
}
// ⚠️ 比的是**落盘的原图**（不是重编码的内存图）—— 这样 `--from-raw` 重放时也成立。
const rawPng = (label) => path.join(OUT, `${label}.p-scavenger-idle.raw.png`);
if (fs.existsSync(rawPng("A-normal")) && fs.existsSync(rawPng("B-control"))) {
  const same = Buffer.compare(fs.readFileSync(rawPng("A-normal")), fs.readFileSync(rawPng("B-control"))) === 0;
  console.log(`② 有参考图（A）vs 没参考图（B）：两组都产出了图 · 两张**原图逐字节相同吗**：${same ? "**相同 ⇒ 这一发里参考图没起作用**" : "**不同 ⇒ 参考图确实进了这一发**（像不像要人眼看 raw/out/ 里那两张）"}`);
}
if (C.images.some((x) => x.which === "anim")) console.log(`③ 身份打架（DNA=拾荒者 / 参考图=手作的另一张母版）：跑完了，产物在 raw/out/C-conflict.*.png —— **谁赢由人眼看**`);
console.log(`④ 调用数与账：A ${A.rec.calls.length} 发（母版 + 动画）· B ${B.rec.calls.length} 发 · C ${C.rec.calls.length} 发 · D ${D.rec.calls.length} 发（母版那一发**没发出去**：探针注入的失败）· 每发 ${Math.round(A.rec.calls.reduce((s, c) => s + c.ms, 0) / Math.max(1, A.rec.calls.length) / 1000)}s 量级`);
console.log(`⑤ **失败传播**：D 的结局=${D.rec.outcome} · 引用母版的那一发（动画）被调了吗：${D.rec.calls.some((c) => c.which === "anim") ? "**调了**（不对）" : "没调 ✅"} · 与母版无关的箱子照造了吗：${D.rec.calls.some((c) => c.which === "crate") ? "造了 ✅" : "没造（要查）"}`);
console.log(`\n产物 PNG 落在 raw/out/（母版那张在 raw/out/A-normal/authoring/masters/）· 逐臂事实在 raw/*.json`);
console.log(`⚠️ 汇总可以**不花钱**重打：node …/run.mjs --from-raw（只读 raw/*.json，一个请求都不发）`);
