// 票 19 standby3 定向修复：单物体模板只发 1 张（2.5 legacy PNG），验证请求形状 / PNG 回应 / 端到端出包。
//   · 预算：1 次生图 / ≤4 发 HTTP · 文本 0 · 墙钟 15 分钟
//   · 只有 RUN_APPROVED=1 才发上游请求。
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

const RECIPE = path.join(HERE, "asset-recipe.json");
const OUT = HERE;
const LOG = path.join(HERE, "http-calls.log");
const MODEL = "gemini-2.5-flash-image";
const PROXY = "http://127.0.0.1:7890";
const MAX_IMAGE_REQUESTS = 4;
const MAX_TEXT_REQUESTS = 0;
const WALL_MS = 15 * 60 * 1000;
const FINAL_PACK = path.join(OUT, "standby3-fix", "pack", "v1");

fs.mkdirSync(OUT, { recursive: true });
if (fs.existsSync(FINAL_PACK)) {
  console.error(`拒绝覆盖已存在的包：${FINAL_PACK}`);
  process.exit(2);
}
const log = (line) => fs.appendFileSync(LOG, `${new Date().toISOString()} ${line}\n`);

const parsed = parseRecipe(JSON.parse(fs.readFileSync(RECIPE, "utf8")));
if (!parsed.ok) { console.error("配方不过 parseRecipe：" + parsed.errors.join(" / ")); process.exit(2); }

const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport) { console.error("没有生图凭据：" + cfg.warnings.join("；")); process.exit(2); }
if (cfg.transport.protocol !== "gemini") { console.error("本次只走 gemini，配置是 " + cfg.transport.protocol); process.exit(2); }
const imageTransport = { ...cfg.transport, model: MODEL, proxy: PROXY };

const textBase = (process.env.ANTHROPIC_BASE_URL ?? "").replace(/\/+$/, "");
const textKey = process.env.ANTHROPIC_AUTH_TOKEN ?? "";
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
    res.clone().json().then((j) => {
      const blocks = (j?.steps ?? []).flatMap((s) => (s?.type === "model_output" ? (s.content ?? s.parts ?? []) : []));
      const legacyParts = (j?.candidates ?? []).flatMap((c) => c?.content?.parts ?? []);
      const img = blocks.find((b) => typeof b?.data === "string" || typeof b?.inline_data?.data === "string")
        ?? legacyParts.find((p) => typeof p?.inlineData?.data === "string");
      const mime = img?.mime_type ?? img?.mimeType ?? img?.inline_data?.mime_type ?? img?.inlineData?.mimeType ?? "none";
      const len = img?.data?.length ?? img?.inline_data?.data?.length ?? img?.inlineData?.data?.length ?? 0;
      log(`IMG-MIME #${n} ${mime} b64len=${len} shape=${(j?.steps ? "steps" : j?.candidates ? "candidates" : "none")}`);
    }).catch(() => log(`IMG-MIME #${n} (unparsable)`));
    return res;
  }
  if (textBase && url.startsWith(textBase)) {
    const n = ++textRequests;
    if (n > MAX_TEXT_REQUESTS) { log(`STOP text requests ${n}`); process.exit(124); }
    log(`BLOCK TXT #${n} ${url}`);
    throw new Error("smoke 预算里文本调用为 0");
  }
  log(`BLOCK ${url}`);
  throw new Error(`未批准的 URL：${url}`);
};

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL_MS);
log(`START smoke model=${MODEL} proxy=${PROXY} maxImageReq=${MAX_IMAGE_REQUESTS} maxTextReq=${MAX_TEXT_REQUESTS}`);

try {
  const result = await packAssets({
    recipePath: RECIPE,
    outRoot: OUT,
    transport: { baseUrl: textBase, apiKey: textKey },
    imageTransport,
    fetchImpl,
    concurrency: { image: 1, text: 1 },
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
  console.error("✗ smoke 失败：", e instanceof Error ? e.message : String(e));
  if (carried) console.error("已经花掉的：", JSON.stringify(carried, null, 1));
  process.exit(1);
}
