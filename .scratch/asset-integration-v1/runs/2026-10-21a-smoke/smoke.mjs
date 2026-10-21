// 票 09 的同动画 2 帧 smoke。**只有人在对话里逐字点头后**才允许发付费请求：
//   RUN_APPROVED=1 node smoke.mjs
// 零付费自检（不发任何 HTTP）：
//   DRY_RUN=1 node smoke.mjs
//
// 模型：gemini-nano-banana-2.1 · Interactions · JPEG（票 07 的 Q1/Q2 裁定）。
//   ⚠️ 不修改 game-maker.local.json；本次显式覆盖 model / api / proxy。
// 预算：2 帧；每帧 attempts=2；全局 ≤4 发 HTTP；≤$0.16；墙钟 15 分钟。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const {
  createGeminiGenerator, createProxyFetch, decodePNG, encodePNG, resolveImageTransport,
  dominantOpaqueColor, importFrames, keyBackground, inkBBox, emptyImage, resizeNearest,
} = A;
const requireFromAssets = createRequire(path.join(ROOT, "packages/assets/package.json"));
const { encode: encodeJPEG } = requireFromAssets("jpeg-js");

const MODEL = "gemini-nano-banana-2.1";
const API = "interactions";
const PROXY = "http://127.0.0.1:7890";
const MAX_IMAGE_REQUESTS = 4;
const WALL_MS = 15 * 60 * 1000;
const RUN = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker");
const PACK = path.join(RUN, "ruin-scavenger-extraction-assets/pack/v7");
const GEN = path.join(PACK, "authoring/generated");

const mode = process.env.DRY_RUN === "1" ? "dry" : process.env.RUN_APPROVED === "1" ? "live" : null;
if (!mode) {
  console.error("未批准：先拿到逐字点头，再用 RUN_APPROVED=1 启动；零付费自检用 DRY_RUN=1。");
  process.exit(2);
}

const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport) { console.error("没有生图凭据：" + cfg.warnings.join("；")); process.exit(2); }
if (cfg.transport.protocol !== "gemini") { console.error("本次只走 gemini，配置是 " + cfg.transport.protocol); process.exit(2); }
const base = cfg.transport.baseUrl.replace(/\/+$/, "");
const allowed = `${base}/interactions`;

const recipe = JSON.parse(fs.readFileSync(path.join(RUN, "asset-recipe.json"), "utf8"));
const spec = recipe.assets.find((a) => a.spec?.id === "scavenger-actor")?.spec;
if (!spec || spec.kind !== "animation") { console.error("配方里找不到 scavenger-actor 动画"); process.exit(2); }
const style = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8"));
const palette = style.palette;
const styleReference = decodePNG(fs.readFileSync(path.join(RUN, "reference.png")));
const reference = decodePNG(fs.readFileSync(path.join(RUN, "reuse/master-scavenger-actor.png")));

const FRAMES = [
  { name: "scavenger-actor.idle1", promptPath: path.join(GEN, "scavenger-actor.idle1.prompt.txt"), baselinePath: path.join(GEN, "scavenger-actor.idle1.png") },
  { name: "scavenger-actor.idle2", promptPath: path.join(GEN, "scavenger-actor.idle2.prompt.txt"), baselinePath: path.join(GEN, "scavenger-actor.idle2.png") },
];
for (const f of FRAMES) {
  for (const p of [f.promptPath, f.baselinePath]) if (!fs.existsSync(p)) { console.error("缺文件：" + p); process.exit(2); }
}

fs.mkdirSync(path.join(HERE, "evidence/raw"), { recursive: true });
fs.mkdirSync(path.join(HERE, "evidence/requests"), { recursive: true });
if (mode === "dry") fs.mkdirSync(path.join(HERE, "evidence/dry"), { recursive: true });
const logPath = path.join(HERE, mode === "live" ? "http-calls.log" : "dry-run.log");
const log = (line) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);

// 合成一张 8×8 的黑方块白底 JPEG —— 仅 DRY_RUN 用来验证请求体与解码路径，绝不发出去。
const syntheticData = Buffer.alloc(8 * 8 * 4, 0xff);
for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
  const i = (y * 8 + x) * 4; syntheticData[i] = syntheticData[i + 1] = syntheticData[i + 2] = 0; syntheticData[i + 3] = 255;
}
const syntheticJPEG = encodeJPEG({ width: 8, height: 8, data: syntheticData }, 90).data;

const proxyFetch = mode === "live" ? createProxyFetch({ proxy: PROXY }) : null;
let requests = 0;
let current = "";
const dryBodies = [];

const fetchImpl = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== allowed) throw new Error(`未批准的 URL：${url}（本次只允许 ${allowed}）`);
  const body = JSON.parse(String(init?.body ?? "{}"));
  const rf = body.response_format ?? {};
  const inputSummary = (body.input ?? []).map((x) => ({ type: x.type, mime_type: x.mime_type, textLength: typeof x.text === "string" ? x.text.length : undefined }));
  const reqNo = ++requests;

  if (mode === "dry") {
    dryBodies.push({ url, model: body.model, response_format: rf, input: inputSummary });
    fs.writeFileSync(path.join(HERE, "evidence/requests", `${current}.dry.json`), JSON.stringify({ url, body }, null, 2) + "\n");
    log(`DRY-REQ #${reqNo} ${url} model=${body.model} mime=${rf.mime_type} aspect=${rf.aspect_ratio} size=${rf.image_size} inputs=${inputSummary.length}`);
    return new Response(JSON.stringify({
      steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/jpeg", data: syntheticJPEG.toString("base64") }] }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  }

  if (requests > MAX_IMAGE_REQUESTS) { log(`STOP image requests ${requests}`); process.exit(124); }
  fs.writeFileSync(path.join(HERE, "evidence/requests", `${current}.req${reqNo}.json`), JSON.stringify({
    url, model: body.model, response_format: rf,
    inputs: (body.input ?? []).map((x) => ({ type: x.type, mime_type: x.mime_type, textLength: typeof x.text === "string" ? x.text.length : undefined })),
  }, null, 2) + "\n");
  log(`IMG-REQ #${reqNo} ${url} model=${body.model} mime=${rf.mime_type} aspect=${rf.aspect_ratio} size=${rf.image_size} inputs=${inputSummary.length}`);

  const res = await proxyFetch(url, init);
  const text = await res.text();
  let mime = "", bytes = Buffer.alloc(0);
  try {
    const json = JSON.parse(text);
    const blocks = [];
    if (json.output_image) blocks.push(json.output_image);
    if (json.outputImage) blocks.push(json.outputImage);
    for (const step of json.steps ?? []) if (step.type === "model_output") blocks.push(...(step.content ?? []), ...(step.parts ?? []));
    for (const b of blocks) {
      const inline = b.inline_data ?? b.inlineData;
      const data = b.data ?? inline?.data;
      if (typeof data !== "string" || !data) continue;
      mime = b.mime_type ?? b.mimeType ?? inline?.mime_type ?? inline?.mimeType ?? "";
      bytes = Buffer.from(data, "base64");
      break;
    }
  } catch { /* 非 JSON 的失败报文原样交给生成器 */ }
  if (bytes.length) {
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "bin";
    const rawPath = path.join(HERE, "evidence/raw", `${current}.req${reqNo}.${ext}`);
    fs.writeFileSync(rawPath, bytes);
    log(`IMG-RES #${reqNo} ${res.status} mime=${mime || "(none)"} bytes=${bytes.length} raw=${path.relative(HERE, rawPath)}`);
  } else {
    log(`IMG-RES #${reqNo} ${res.status} no-image ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return new Response(text, { status: res.status, headers: res.headers });
};

const gen = createGeminiGenerator({
  baseUrl: cfg.transport.baseUrl,
  apiKey: cfg.transport.apiKey,
  model: MODEL,
  api: API,
  attempts: 2,
  fetchImpl,
});

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, WALL_MS);
log(`START mode=${mode} model=${MODEL} api=${API} proxy=${mode === "live" ? PROXY : "(none)"} maxImageReq=${MAX_IMAGE_REQUESTS} frames=${FRAMES.length}`);

const hstack = (imgs, gap = 8) => {
  const h = Math.max(...imgs.map((i) => i.height));
  const out = emptyImage(imgs.reduce((s, i) => s + i.width + gap, 0) - gap, h);
  let x = 0;
  for (const img of imgs) {
    for (let y = 0; y < img.height; y++) img.data.copy(out.data, (y * out.width + x) * 4, y * img.width * 4, (y + 1) * img.width * 4);
    x += img.width + gap;
  }
  return out;
};
const thumb = (img, h = 296) => resizeNearest(img, Math.max(1, Math.round((img.width * h) / img.height)), h);
const upscale = (img, s = 8) => resizeNearest(img, img.width * s, img.height * s);

const frames = [];
try {
  for (const f of FRAMES) {
    current = f.name;
    const prompt = fs.readFileSync(f.promptPath, "utf8").trim();
    const r = await gen({ prompt, size: spec.size, styleReference, reference });
    const evDir = mode === "dry" ? path.join(HERE, "evidence", "dry") : path.join(HERE, "evidence");
    const decodedPath = path.join(evDir, `${f.name}.decoded.png`);
    fs.writeFileSync(decodedPath, encodePNG(r.image));
    fs.writeFileSync(path.join(evDir, `${f.name}.prompt.txt`), prompt + "\n");

    const measure = (img) => {
      const key = dominantOpaqueColor(img).color;
      const keyed = keyBackground(img, { tolerance: 30, colors: [key] }).image;
      const bbox = inkBBox(keyed);
      const imported = importFrames([img], {
        palette, targetWidth: spec.size.w, targetHeight: spec.size.h,
        background: { tolerance: 30, colors: [key] }, dropSpecks: true, dropBottomLines: true,
      })[0];
      return { key, bbox, imported, trimmedTo: imported.report.trimmedTo ?? null };
    };

    const got = measure(r.image);
    const baseline = decodePNG(fs.readFileSync(f.baselinePath));
    const ref = measure(baseline);
    fs.writeFileSync(path.join(evDir, `${f.name}.imported.png`), encodePNG(got.imported));
    fs.writeFileSync(path.join(evDir, `${f.name}.baseline-imported.png`), encodePNG(ref.imported));

    frames.push({
      name: f.name, bytes: fs.statSync(decodedPath).size,
      model: r.call.requestedModel, ms: r.call.ms, attempts: r.call.attempts,
      decoded: { w: r.image.width, h: r.image.height },
      baseline: { w: baseline.width, h: baseline.height },
      bbox: got.bbox, baselineBbox: ref.bbox,
      imported: { w: got.imported.width, h: got.imported.height, trimmedTo: got.trimmedTo },
      baselineImported: { w: ref.imported.width, h: ref.imported.height, trimmedTo: ref.trimmedTo },
      key: got.key, baselineKey: ref.key,
    });
    log(`DONE ${f.name} ${r.image.width}x${r.image.height} ms=${r.call.ms} attempts=${r.call.attempts} bbox=${JSON.stringify(got.bbox)} baseline=${baseline.width}x${baseline.height} bbox=${JSON.stringify(ref.bbox)}`);
  }

  const drift = (p, q) => p && q ? { dx: q.x - p.x, dy: q.y - p.y, dw: q.w - p.w, dh: q.h - p.h } : null;
  const drift21 = drift(frames[0]?.bbox, frames[1]?.bbox);
  const drift25 = drift(frames[0]?.baselineBbox, frames[1]?.baselineBbox);

  if (mode === "live") {
    const [f1, f2] = FRAMES;
    const imported = (name) => decodePNG(fs.readFileSync(path.join(HERE, "evidence", `${name}.imported.png`)));
    const baselineImported = (name) => decodePNG(fs.readFileSync(path.join(HERE, "evidence", `${name}.baseline-imported.png`)));
    fs.writeFileSync(path.join(HERE, "evidence", "contact-imported.png"),
      encodePNG(hstack([baselineImported(f1.name), imported(f1.name), baselineImported(f2.name), imported(f2.name)].map((img) => upscale(img)))));
    fs.writeFileSync(path.join(HERE, "evidence", "contact-raw.png"),
      encodePNG(hstack([
        thumb(decodePNG(fs.readFileSync(f1.baselinePath))),
        thumb(decodePNG(fs.readFileSync(path.join(HERE, "evidence", `${f1.name}.decoded.png`)))),
        thumb(decodePNG(fs.readFileSync(f2.baselinePath))),
        thumb(decodePNG(fs.readFileSync(path.join(HERE, "evidence", `${f2.name}.decoded.png`)))),
      ])));
  }

  clearTimeout(timer);
  const result = {
    ok: true, mode, model: MODEL, api: API, proxy: mode === "live" ? PROXY : null,
    requests, frames, ...(mode === "live" ? { drift21, drift25, verdict: "pending-human" } : { dryBodies }),
  };
  fs.writeFileSync(path.join(HERE, mode === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  clearTimeout(timer);
  const result = { ok: false, mode, model: MODEL, api: API, requests, frames, error: e instanceof Error ? e.message : String(e) };
  fs.writeFileSync(path.join(HERE, mode === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  log(`FAIL ${e instanceof Error ? e.message : String(e)} requests=${requests}`);
  console.error("✗ 失败：", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
