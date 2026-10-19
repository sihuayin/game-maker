// 票 10 逐帧真跑：source.kind="frames"，2.5 legacy（PNG）—— 66 张（付费）。
//   · 配方：本目录 asset-recipe.json（3 个 import 母版 + 61 帧逐帧动画 + 2 sprite + 3 背景层）
//   · 模型：gemini-2.5-flash-image（人裁 2026-10-19；config 不改，runner 显式覆盖）
//   · 端点：/models/gemini-2.5-flash-image:generateContent（legacy PNG）
//   · 代理：生图走 127.0.0.1:7890（config 里的 9098 无人监听）；文本直连 ANTHROPIC_BASE_URL
//   · 硬停：生图 ≤21 调用 / ≤84 发 · 文本 ≤3 调用 / ≤6 发 · 墙钟 45 分钟
//   · 只有拿到逐字点头、并显式 RUN_APPROVED=1 才会发上游请求。
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const C = await import(pathToFileURL(path.join(ROOT, "packages/contracts/dist/index.js")).href);
const { packAssets, verifyPack, resolveImageTransport, createProxyFetch } = A;
const { parseRecipe } = C;

if (process.env.RUN_APPROVED !== "1") {
  console.error("未批准：先拿到逐字点头，再用 RUN_APPROVED=1 启动本脚本。");
  process.exit(2);
}

const RECIPE_DIR = HERE;
const RECIPE = path.join(RECIPE_DIR, "asset-recipe.json");
const OUT = HERE;
const LOG = path.join(HERE, "http-calls.log");
const MODEL = "gemini-2.5-flash-image";
const PROXY = "http://127.0.0.1:7890";
const MAX_IMAGE_REQUESTS = 132;
const MAX_TEXT_REQUESTS = 6;
const WALL_MS = 60 * 60 * 1000;
const FINAL_PACK = path.join(OUT, "ruin-scavenger-extraction-assets", "pack", "v1");

fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(FINAL_PACK)) {
  console.error(`拒绝覆盖已存在的包：${FINAL_PACK}`);
  process.exit(2);
}
const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

// ── 免费预检：配方 / 生图配置 / 文本上游 ─────────────────────────────────────
const recipeRaw = JSON.parse(fs.readFileSync(RECIPE, "utf8"));
const parsed = parseRecipe(recipeRaw);
if (!parsed.ok) { console.error("配方不过 parseRecipe：" + parsed.errors.join(" / ")); process.exit(2); }

const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport) { console.error("没有生图凭据：" + cfg.warnings.join("；")); process.exit(2); }
if (cfg.transport.protocol !== "gemini") { console.error("本次只走 gemini，配置是 " + cfg.transport.protocol); process.exit(2); }
const imageTransport = { ...cfg.transport, model: MODEL, proxy: PROXY };

const textBase = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/+$/, "");
const textKey = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
if (!textBase || !textKey) { console.error("文本上游缺 ANTHROPIC_BASE_URL / ANTHROPIC_AUTH_TOKEN"); process.exit(2); }

// ── 计数与闸门：每一发 HTTP 都逐条落盘（不记 key）──────────────────────────
const imageBase = imageTransport.baseUrl.replace(/\/+$/, "");
const isImageUrl = (url) => url.startsWith(`${imageBase}/interactions`) || url.startsWith(`${imageBase}/models/`);
const proxyFetch = createProxyFetch({ proxy: PROXY });
let imageRequests = 0;
let textRequests = 0;
const fetchImpl = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (isImageUrl(url)) {
    const n = ++imageRequests;
    if (n > MAX_IMAGE_REQUESTS) { log(`STOP image requests ${n}`); process.exit(124); }
    log(`IMG-REQ #${n} ${url}`);
    const res = await proxyFetch(url, init);
    log(`IMG-RES #${n} ${res.status}`);
    // 只观察：把上游实际给的 MIME 与字节数记下来（不影响生成路径）。
    res.clone().json().then((j) => {
      const steps = (j?.steps ?? []).flatMap((s) => (s?.type === "model_output" ? (s.content ?? s.parts ?? []) : []));
      const parts = (j?.candidates ?? []).flatMap((c) => c?.content?.parts ?? []);
      const img = steps.find((b) => typeof b?.data === "string") ?? parts.find((p) => typeof p?.inlineData?.data === "string");
      const mime = img?.mime_type ?? img?.mimeType ?? img?.inlineData?.mimeType ?? "none";
      const len = img?.data?.length ?? img?.inlineData?.data?.length ?? 0;
      log(`IMG-MIME #${n} ${mime} b64len=${len} shape=${j?.steps ? "steps" : j?.candidates ? "candidates" : "none"}`);
    }).catch(() => log(`IMG-MIME #${n} (unparsable)`));
    return res;
  }
  if (url.startsWith(textBase)) {
    const n = ++textRequests;
    if (n > MAX_TEXT_REQUESTS) { log(`STOP text requests ${n}`); process.exit(124); }
    log(`TXT-REQ #${n} ${url}`);
    const res = await fetch(url, init);
    log(`TXT-RES #${n} ${res.status}`);
    return res;
  }
  log(`BLOCK ${url}`);
  throw new Error(`未批准的 URL：${url}`);
};

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL_MS);
log(`START model=${MODEL} proxy=${PROXY} recipe=${path.basename(RECIPE)} maxImageReq=${MAX_IMAGE_REQUESTS} maxTextReq=${MAX_TEXT_REQUESTS}`);

try {
  const result = await packAssets({
    recipePath: RECIPE,
    outRoot: OUT,
    transport: { baseUrl: textBase, apiKey: textKey },
    imageTransport,
    fetchImpl,
    concurrency: { image: 3, text: 4 },
    visualWorldPath: "visual-world.json",
  });
  clearTimeout(timer);

  const packDir = path.join(OUT, result.artifacts[0].path);
  const verified = verifyPack({ packDir });
  const out = {
    ok: verified.data.ok === true,
    packDir,
    imageRequests,
    textRequests,
    verify: verified.data,
    summary: result.summary,
    data: result.data,
  };
  fs.writeFileSync(path.join(HERE, "run-result.json"), JSON.stringify(out, null, 2) + "\n");
  log(`DONE pack=${packDir} imageReq=${imageRequests} textReq=${textRequests} verifyOk=${verified.data.ok}`);
  console.log(JSON.stringify(out, null, 2));
  if (verified.data.ok !== true) process.exit(1);
} catch (e) {
  clearTimeout(timer);
  const carried = e && typeof e === "object" && "ledger" in e ? e.ledger : undefined;
  log(`FAIL ${e instanceof Error ? e.message : String(e)} imageReq=${imageRequests} textReq=${textRequests}`);
  console.error("✗ 真跑失败：", e instanceof Error ? e.message : String(e));
  if (carried) console.error("已经花掉的：", JSON.stringify(carried, null, 1));
  process.exit(1);
}
