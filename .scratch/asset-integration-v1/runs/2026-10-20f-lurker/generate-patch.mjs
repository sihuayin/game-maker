// 票 02 的付费生成脚本。**只有人在对话里逐字点头后**才允许运行：
//   RUN_APPROVED=1 node generate-patch.mjs
// 预算：6 张成功图 / 每帧最多 2 次尝试 / ≤12 发 HTTP / 文本 0 / 墙钟 15 分钟。
// 模型：gemini-2.5-flash-image legacy generateContent（已知回 PNG）。
//   ⚠️ 不用 game-maker.local.json 当前的 3.1-flash-lite：3.x 走 Interactions，实测只回 JPEG，
//      而 imageFromInteraction 对非 PNG 明确抛错；当前配置的 proxy 9098 也没有监听。
//   ⚠️ 不改 game-maker.local.json；本次显式覆盖 model / api / proxy。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { createGeminiGenerator, createProxyFetch, decodePNG, encodePNG, resolveImageTransport, animationFramePrompt } = A;
const { parseRecipe } = C;

if (process.env.RUN_APPROVED !== "1") {
  console.error("未批准：先拿到逐字点头，再用 RUN_APPROVED=1 启动本脚本。");
  process.exit(2);
}

const MODEL = "gemini-2.5-flash-image";
const PROXY = "http://127.0.0.1:7890";
const MAX_IMAGE_REQUESTS = 12;
const WALL_MS = 15 * 60 * 1000;
const REUSE = path.resolve(ROOT, ".scratch/style-migration-v1/runs/2026-10-19k-patch");
const PATCH = path.join(HERE, "patch");
const LOG = path.join(HERE, "http-calls.log");
const RESULT = path.join(HERE, "generate-result.json");

// 逐帧语义：追加在 animationFramePrompt 之后（不改共享提示词函数，不改母版 / 网格判据）。
const FRAMES = [
  { name: "ceiling-lurker.hang1", anim: "hang", index: 0,
    clause: "头朝下倒挂：四肢的爪勾住天花板的管道，身体垂直向下、头部在下；不要站立，脚不要着地。" },
  { name: "ceiling-lurker.hang2", anim: "hang", index: 1,
    clause: "头朝下倒挂：四肢的爪勾住天花板的管道，身体垂直向下、头部在下；不要站立，脚不要着地。" },
  { name: "ceiling-lurker.hang3", anim: "hang", index: 2,
    clause: "头朝下倒挂：四肢的爪勾住天花板的管道，身体垂直向下、头部在下；不要站立，脚不要着地。" },
  { name: "ceiling-lurker.lunge4", anim: "lunge", index: 3,
    clause: "扑击中的腾空帧：身体前倾、四肢朝前伸展，离开地面；不要直立，不要双脚平踩地面。" },
  { name: "ceiling-lurker.retreat2", anim: "retreat", index: 1,
    clause: "正在回到悬挂位：头朝下、身体向上收，爪勾住天花板；不要站立，脚不要着地。" },
  { name: "ceiling-lurker.retreat3", anim: "retreat", index: 2,
    clause: "正在回到悬挂位：头朝下、身体向上收，爪勾住天花板；不要站立，脚不要着地。" },
];

if (fs.existsSync(PATCH)) {
  console.error(`patch 目录已存在，拒绝覆盖：${PATCH}`);
  console.error("若上次中途失败：人工检查已生成的帧，另起一个 run 目录再申请点头；不要在本目录重跑。");
  process.exit(2);
}
const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport) { console.error("没有生图凭据：" + cfg.warnings.join("；")); process.exit(2); }
if (cfg.transport.protocol !== "gemini") { console.error("本次只走 gemini，配置是 " + cfg.transport.protocol); process.exit(2); }

const parsed = parseRecipe(JSON.parse(fs.readFileSync(path.join(HERE, "asset-recipe.json"), "utf8")));
if (!parsed.ok) { console.error("配方不过 parseRecipe：" + parsed.errors.join(" / ")); process.exit(2); }
const spec = parsed.value.assets.find((a) => a.spec.id === "ceiling-lurker")?.spec;
if (!spec || spec.kind !== "animation") { console.error("配方里找不到 ceiling-lurker 动画"); process.exit(2); }
const style = JSON.parse(fs.readFileSync(path.join(HERE, "stylespec.json"), "utf8"));
const dnaFile = JSON.parse(fs.readFileSync(path.join(HERE, "character-dna.json"), "utf8"));
const dna = dnaFile.characters.find((c) => c.id === spec.characterId);
if (!dna) { console.error(`character-dna.json 里没有 "${spec.characterId}"`); process.exit(2); }
const styleReference = decodePNG(fs.readFileSync(path.join(HERE, "reference.png")));
const reference = decodePNG(fs.readFileSync(path.join(HERE, "reuse/master-ceiling-lurker.png")));

const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);
const proxyFetch = createProxyFetch({ proxy: PROXY });
const base = cfg.transport.baseUrl.replace(/\/+$/, "");
const allowed = `${base}/models/${MODEL}:generateContent`;
let requests = 0;
const fetchImpl = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== allowed) throw new Error(`未批准的 URL：${url}（本次只允许 ${allowed}）`);
  requests += 1;
  if (requests > MAX_IMAGE_REQUESTS) { log(`STOP image requests ${requests}`); process.exit(124); }
  log(`IMG-REQ #${requests} ${url}`);
  const res = await proxyFetch(url, init);
  log(`IMG-RES #${requests} ${res.status} ${res.headers.get("content-type") ?? ""}`);
  return res;
};
const gen = createGeminiGenerator({
  baseUrl: cfg.transport.baseUrl,
  apiKey: cfg.transport.apiKey,
  model: MODEL,
  api: "generateContent",
  attempts: 2,
  fetchImpl,
});

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL_MS);
log(`START model=${MODEL} proxy=${PROXY} maxImageReq=${MAX_IMAGE_REQUESTS} frames=${FRAMES.length}`);

fs.cpSync(REUSE, PATCH, { recursive: true });
if (!fs.existsSync(path.join(PATCH, "authoring/generated/ceiling-lurker.hang4.png"))) {
  console.error("patch 复制不完整：缺 hang4 —— 停止");
  process.exit(2);
}

const done = [];
try {
  for (const f of FRAMES) {
    const prompt = `${animationFramePrompt(spec, style, f.anim, f.index, dna)}\n\n本帧的姿势（必须照做）：${f.clause}`;
    const r = await gen({ prompt, size: spec.size, styleReference, reference });
    const dest = path.join(PATCH, "authoring/generated", `${f.name}.png`);
    fs.writeFileSync(dest, encodePNG(r.image));
    fs.writeFileSync(dest.replace(/\.png$/, ".prompt.txt"), `${prompt}\n`);
    done.push({ name: f.name, ms: r.call.ms, attempts: r.call.attempts, model: r.call.requestedModel, bytes: fs.statSync(dest).size });
    log(`DONE ${f.name} ms=${r.call.ms} attempts=${r.call.attempts} bytes=${fs.statSync(dest).size}`);
  }
  clearTimeout(timer);
  fs.writeFileSync(RESULT, JSON.stringify({ ok: true, model: MODEL, proxy: PROXY, requests, frames: done }, null, 2) + "\n");
  console.log(JSON.stringify({ ok: true, requests, frames: done }, null, 2));
} catch (e) {
  clearTimeout(timer);
  fs.writeFileSync(RESULT, JSON.stringify({ ok: false, model: MODEL, proxy: PROXY, requests, frames: done,
    error: e instanceof Error ? e.message : String(e) }, null, 2) + "\n");
  log(`FAIL ${e instanceof Error ? e.message : String(e)} requests=${requests} done=${done.length}`);
  console.error("✗ 失败：", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
