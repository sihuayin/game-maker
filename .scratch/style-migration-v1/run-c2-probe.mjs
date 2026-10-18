// C 阶段：玩家风格探针（母版 + idle/run/jump = 4 张）。
// 预算：4 张图 / ≤12 发 HTTP / 30 分钟硬停。DRY_RUN=1 用假生成器，零上游。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { buildAssetPack, createGeminiGenerator, createProxyFetch, resolveImageTransport } = A;
const { parseRecipe } = C;

const RUN = path.join(HERE, "runs/2026-10-18d/ruin-scavenger-extraction-assets/run/v1");
const DRY = process.env.DRY_RUN === "1";
const OUT = path.join(HERE, DRY ? "runs/2026-10-18f-dry" : "runs/2026-10-18f");
const LOG = path.join(OUT, "image-calls.log");
const PROXY = "http://127.0.0.1:7890";
const MAX_IMAGES = 4;
const MAX_REQUESTS = 12;
const WALL_MS = 30 * 60 * 1000;
fs.mkdirSync(OUT, { recursive: true });
const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

const recipeRaw = JSON.parse(fs.readFileSync(path.join(RUN, "probe-player-recipe-c2.json"), "utf8"));
const parsed = parseRecipe(recipeRaw);
if (!parsed.ok) throw new Error("recipe invalid: " + parsed.errors.join(" / "));
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const dna = JSON.parse(fs.readFileSync(path.join(RUN, "character-dna.json"), "utf8"));

let images = 0, requests = 0;
const ledger = [];
log(`START dry=${DRY} maxImages=${MAX_IMAGES} maxRequests=${MAX_REQUESTS}`);

/** 假生成器：品红边 + 中间色块，让抠底/切帧能走通（与 assets 测试同款）。 */
function fakeImage(w, h) {
  // 玩家 canonical 帧宽 48；请求宽度 = 48 × 帧数（母版是 48×64，一帧）。
  const n = Math.max(1, Math.round(w / 48));
  const fw = w / n;
  const data = Buffer.alloc(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const o = (y * w + x) * 4;
    const slot = Math.min(n - 1, Math.floor(x / fw));
    const lx = x - slot * fw;
    const inner = lx >= fw * 0.25 && lx < fw * 0.75 && y >= h * 0.2 && y < h * 0.8;
    data[o] = inner ? 120 : 255; data[o + 1] = inner ? 90 : 0; data[o + 2] = inner ? 60 : 255; data[o + 3] = 255;
  }
  return { width: w, height: h, data };
}
const fakeGen = async (req) => {
  images += 1;
  if (images > MAX_IMAGES) { log(`STOP image budget ${images}`); throw new Error("IMAGE_BUDGET"); }
  log(`FAKE #${images} ${req.size.w}x${req.size.h}`);
  return { image: fakeImage(req.size.w, req.size.h), call: { protocol: "gemini", requestedSize: `${req.size.w}x${req.size.h}`, ms: 1, attempts: 1 } };
};

let generateImage;
if (DRY) {
  generateImage = fakeGen;
} else {
  const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
  if (!cfg.transport) throw new Error("没有生图凭据：" + cfg.warnings.join("；"));
  if (cfg.transport.protocol !== "gemini") throw new Error("本次只走 gemini，配置是 " + cfg.transport.protocol);
  const proxyFetch = createProxyFetch({ proxy: PROXY });
  const fetchImpl = async (url, init) => {
    requests += 1;
    if (requests > MAX_REQUESTS) { log(`STOP request budget ${requests}`); process.exit(124); }
    log(`REQ #${requests} ${url}`);
    try { const r = await proxyFetch(url, init); log(`RES #${requests} ${r.status}`); return r; }
    catch (e) { log(`ERR #${requests} ${e instanceof Error ? e.message : String(e)}`); throw e; }
  };
  const gen = createGeminiGenerator({
    baseUrl: cfg.transport.baseUrl, apiKey: cfg.transport.apiKey,
    ...(cfg.transport.model ? { model: cfg.transport.model } : {}),
    attempts: 3, fetchImpl,
  });
  generateImage = async (req, report) => {
    images += 1;
    if (images > MAX_IMAGES) { log(`STOP image budget ${images}`); throw new Error("IMAGE_BUDGET"); }
    log(`IMG #${images} head=${req.prompt.slice(0, 50).replace(/\s+/g, " ")}`);
    const out = await gen(req, report);
    log(`IMG #${images} done attempts=${out.call.attempts}`);
    return out;
  };
}

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL_MS);
try {
  const result = await buildAssetPack({
    recipe: parsed.value, style, recipeDir: RUN, outDir: OUT,
    generate: () => { throw new Error("probe 配方里没有 drawlist 资源"); },
    generateImage, characterDna: dna, ledger,
    concurrency: { image: 1, text: 1 },
  });
  clearTimeout(timer);
  log(`DONE pack=${result.packDir} images=${images} requests=${requests}`);
  console.log(JSON.stringify({ ok: true, packDir: result.packDir, images, requests, ledger }, null, 2));
} catch (e) {
  clearTimeout(timer);
  log(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  console.error("✗ 探针失败：", e instanceof Error ? e.message : String(e));
  console.error("已发出：", JSON.stringify(ledger, null, 1));
  process.exit(1);
}
