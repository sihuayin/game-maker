// 票 14 的候选筛查脚本（Option 2：Gemini 3 Pro + 现有 _openai 中转）。
// 只有人在对话里逐字点头后才允许发付费请求：
//   RUN_APPROVED=1 node screen.mjs
// 零付费自检（不发任何 HTTP）：
//   DRY_RUN=1 node screen.mjs
//
// 候选 A：gemini-3-pro-image · Interactions · JPEG · 现有顶层 image 的 Gemini key + 7890
// 候选 B：_openai 中转（model gpt-image-2.5）· /images/edits multipart · 7890
//   ⚠️ B 不是官方端点；计价未验证；结果必须标注 relay。
// 每候选 2 帧（scavenger-actor.idle1/idle2）；A ≤3 发、B ≤4 发；每候选 ≤$0.50。
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const {
  createGeminiGenerator, createOpenAIGenerator, createProxyFetch, decodePNG, encodePNG,
  resolveImageTransport, dominantOpaqueColor, importFrames, keyBackground, inkBBox,
  dropDetachedSpecks, dropBottomGroundLines, emptyImage, resizeNearest,
} = A;
const requireFromAssets = createRequire(path.join(ROOT, "packages/assets/package.json"));
const { encode: encodeJPEG } = requireFromAssets("jpeg-js");

const MODE = process.env.DRY_RUN === "1" ? "dry" : process.env.RUN_APPROVED === "1" ? "live" : null;
if (!MODE) {
  console.error("未批准：先拿到逐字点头，再用 RUN_APPROVED=1 启动；零付费自检用 DRY_RUN=1。");
  process.exit(2);
}
if (MODE === "live" && fs.existsSync(path.join(HERE, "result.json"))) {
  console.error("本 run 已有 result.json，拒绝覆盖；另起一个 run 目录再申请点头。");
  process.exit(2);
}

const PROXY = "http://127.0.0.1:7890";
const GEMINI_MODEL = "gemini-3-pro-image";
const RUN = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker");
const GEN = path.join(RUN, "ruin-scavenger-extraction-assets/pack/v7/authoring/generated");
const palette = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8")).palette;
const styleReference = decodePNG(fs.readFileSync(path.join(RUN, "reference.png")));
const reference = decodePNG(fs.readFileSync(path.join(RUN, "reuse/master-scavenger-actor.png")));
const FLOOR = 128;
const TARGET = { w: 48, h: 64 };
const FRAMES = [
  { name: "scavenger-actor.idle1", promptPath: path.join(GEN, "scavenger-actor.idle1.prompt.txt"), baselinePath: path.join(GEN, "scavenger-actor.idle1.png") },
  { name: "scavenger-actor.idle2", promptPath: path.join(GEN, "scavenger-actor.idle2.prompt.txt"), baselinePath: path.join(GEN, "scavenger-actor.idle2.png") },
];

const ev = (candidate, ...parts) => {
  const dir = path.join(HERE, "evidence", candidate, ...(MODE === "dry" ? ["dry"] : []), ...parts.slice(0, -1));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, parts[parts.length - 1]);
};

// ---- config ----
const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport || cfg.transport.protocol !== "gemini") {
  console.error("Gemini 配置不可用：" + (cfg.warnings.join("；") || "protocol != gemini"));
  process.exit(2);
}
let relay;
try {
  const local = JSON.parse(fs.readFileSync(path.join(ROOT, "game-maker.local.json"), "utf8"));
  relay = local._openai;
} catch (e) {
  console.error("读不到 game-maker.local.json / _openai：" + (e instanceof Error ? e.message : String(e)));
  process.exit(2);
}
if (!relay || relay.protocol !== "openai" || typeof relay.baseUrl !== "string" || typeof relay.apiKey !== "string" || !relay.apiKey) {
  console.error("_openai 段不完整（需要 protocol=openai / baseUrl / apiKey）");
  process.exit(2);
}
const relayModel = typeof relay.model === "string" && relay.model ? relay.model : "gpt-image-2.5";
const openaiBase = relay.baseUrl.replace(/\/+$/, "");
const openaiUrl = `${openaiBase}/images/edits`; // 带参考图 → edits
const geminiUrl = `${cfg.transport.baseUrl.replace(/\/+$/, "")}/interactions`;

const logPath = path.join(HERE, MODE === "live" ? "http-calls.log" : "dry-run.log");
const log = (line) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);

// ---- synthetic images for dry-run ----
const makeData = () => {
  const data = Buffer.alloc(8 * 8 * 4, 0xff);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) {
    const i = (y * 8 + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = 255;
  }
  return data;
};
const syntheticJPEG = encodeJPEG({ width: 8, height: 8, data: makeData() }, 90).data;
const syntheticPNG = encodePNG({ width: 8, height: 8, data: makeData() });

// ---- live proxy + counters ----
const proxyFetch = MODE === "live" ? createProxyFetch({ proxy: PROXY }) : null;
const counters = { gemini: 0, openai: 0 };
const caps = { gemini: 3, openai: 4 };
let current = "";

const geminiFetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== geminiUrl) throw new Error(`未批准的 URL：${url}（只允许 ${geminiUrl}）`);
  const n = ++counters.gemini;
  if (n > caps.gemini) { log(`STOP gemini sends ${n}`); process.exit(124); }
  const body = JSON.parse(String(init?.body ?? "{}"));
  const rf = body.response_format ?? {};
  const inputSummary = (body.input ?? []).map((x) => ({ type: x.type, mime_type: x.mime_type, textLength: typeof x.text === "string" ? x.text.length : undefined }));
  fs.writeFileSync(ev("gemini3pro", "requests", `${current}.req${n}.json`), JSON.stringify({ url, model: body.model, response_format: rf, inputs: inputSummary }, null, 2) + "\n");
  log(`GEMINI-REQ #${n} ${url} model=${body.model} mime=${rf.mime_type} aspect=${rf.aspect_ratio} size=${rf.image_size} inputs=${inputSummary.length}`);

  if (MODE === "dry") {
    return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/jpeg", data: syntheticJPEG.toString("base64") }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
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
  } catch { /* 非 JSON 原样交给生成器 */ }
  if (bytes.length) {
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "bin";
    const p = ev("gemini3pro", "raw", `${current}.req${n}.${ext}`);
    fs.writeFileSync(p, bytes);
    log(`GEMINI-RES #${n} ${res.status} mime=${mime || "(none)"} bytes=${bytes.length}`);
  } else {
    log(`GEMINI-RES #${n} ${res.status} no-image ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return new Response(text, { status: res.status, headers: res.headers });
};

const openaiFetch = async (input, init) => {
  const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (url !== openaiUrl) throw new Error(`未批准的 URL：${url}（只允许 ${openaiUrl}）`);
  const n = ++counters.openai;
  if (n > caps.openai) { log(`STOP openai sends ${n}`); process.exit(124); }
  const isBuf = init?.body instanceof Buffer;
  const raw = isBuf ? init.body : Buffer.from(String(init?.body ?? ""));
  const text = raw.toString("latin1");
  const field = (k) => text.match(new RegExp(`name="${k}"\\r\\n\\r\\n([^\\r]*)`))?.[1];
  const images = (text.match(/name="image\[\]"/g) ?? []).length;
  const summary = { url, contentType: init?.headers?.["content-type"], contentLength: init?.headers?.["content-length"], bodyLength: raw.length, model: field("model"), n: field("n"), size: field("size"), images, promptLength: field("prompt")?.length };
  fs.writeFileSync(ev("openai-relay", "requests", `${current}.req${n}.json`), JSON.stringify(summary, null, 2) + "\n");
  log(`OPENAI-REQ #${n} ${url} model=${summary.model} n=${summary.n} size=${summary.size} images=${images} contentLength=${summary.contentLength} body=${raw.length}`);

  if (MODE === "dry") {
    return new Response(JSON.stringify({ created: 1, data: [{ b64_json: syntheticPNG.toString("base64") }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  const res = await proxyFetch(url, init);
  const bodyText = await res.text();
  let bytes = Buffer.alloc(0);
  try {
    const json = JSON.parse(bodyText);
    const b64 = json.data?.[0]?.b64_json;
    if (typeof b64 === "string" && b64) bytes = Buffer.from(b64, "base64");
  } catch { /* 非 JSON 原样交给生成器 */ }
  if (bytes.length) {
    const p = ev("openai-relay", "raw", `${current}.req${n}.png`);
    fs.writeFileSync(p, bytes);
    log(`OPENAI-RES #${n} ${res.status} bytes=${bytes.length} (relay output; MIME assumed PNG)`);
  } else {
    log(`OPENAI-RES #${n} ${res.status} no-b64 ${bodyText.slice(0, 160).replace(/\s+/g, " ")}`);
  }
  return new Response(bodyText, { status: res.status, headers: res.headers });
};

// ---- generators ----
const gemini = createGeminiGenerator({
  baseUrl: cfg.transport.baseUrl, apiKey: cfg.transport.apiKey, model: GEMINI_MODEL,
  api: "interactions", attempts: 2, fetchImpl: geminiFetch,
});
const openai = createOpenAIGenerator({
  baseUrl: relay.baseUrl, apiKey: relay.apiKey, model: relayModel, attempts: 2, fetchImpl: openaiFetch,
});

// ---- measure / import ----
const measure = (img) => {
  const key = dominantOpaqueColor(img).color;
  const keyed = keyBackground(img, { tolerance: 30, colors: [key] }).image;
  const cleaned = dropDetachedSpecks(dropBottomGroundLines(keyed, { floor: FLOOR }), { floor: FLOOR });
  const bbox = inkBBox(cleaned, { floor: FLOOR });
  const imported = importFrames([img], {
    palette, targetWidth: TARGET.w, targetHeight: TARGET.h,
    background: { tolerance: 30, colors: [key] }, dropSpecks: true, dropBottomLines: true,
  })[0];
  return { key, bbox, imported, trimmedTo: imported.report.trimmedTo ?? null };
};
const alphaDiff = (x, y) => {
  let alpha = 0, rgb = 0, sum = 0;
  const n = x.width * x.height;
  for (let i = 0; i < n; i++) {
    const s = i * 4;
    if ((x.data[s + 3] >= 128) !== (y.data[s + 3] >= 128)) alpha++;
    if (x.data[s + 3] >= 128 && y.data[s + 3] >= 128) {
      const l = Math.abs(x.data[s] - y.data[s]) + Math.abs(x.data[s + 1] - y.data[s + 1]) + Math.abs(x.data[s + 2] - y.data[s + 2]);
      if (l > 0) rgb++; sum += l;
    }
  }
  return { alphaDiff: alpha, alphaPct: +(alpha / n * 100).toFixed(1), rgbChanged: rgb, rgbPct: +(rgb / n * 100).toFixed(1), meanL1: +(sum / n).toFixed(2) };
};
const hstack = (imgs, gap = 8) => {
  const h = Math.max(...imgs.map((i) => i.height));
  const out = emptyImage(imgs.reduce((s, i) => s + i.width + gap, 0) - gap, h);
  let x = 0;
  for (const img of imgs) { for (let y = 0; y < img.height; y++) img.data.copy(out.data, (y * out.width + x) * 4, y * img.width * 4, (y + 1) * img.width * 4); x += img.width + gap; }
  return out;
};
const upscale = (img, s = 8) => resizeNearest(img, img.width * s, img.height * s);
const paletteCount = (img) => { const s = new Set(); for (let i = 0; i < img.width * img.height; i++) { const k = i * 4; if (img.data[k + 3] >= 128) s.add(`${img.data[k]},${img.data[k + 1]},${img.data[k + 2]}`); } return s.size; };

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, 30 * 60 * 1000);
log(`START mode=${MODE} A=${GEMINI_MODEL} B=${relayModel} proxy=${MODE === "live" ? PROXY : "(none)"} caps=A${caps.gemini}/B${caps.openai}`);

const candidates = [
  { key: "gemini3pro", label: "A · Gemini 3 Pro", gen: gemini, costPerImage: 0.134 },
  { key: "openai-relay", label: "B1 · OpenAI relay", gen: openai, costPerImage: null },
];
const results = [];
try {
  for (const c of candidates) {
    const frames = [];
    for (const f of FRAMES) {
      current = `${c.key}-${path.basename(f.name)}`;
      const prompt = fs.readFileSync(f.promptPath, "utf8").trim();
      const r = await c.gen({ prompt, size: TARGET, styleReference, reference });
      const decodedPath = ev(c.key, "decoded", `${f.name}.png`);
      fs.writeFileSync(decodedPath, encodePNG(r.image));
      fs.writeFileSync(ev(c.key, "prompts", `${f.name}.txt`), prompt + "\n");
      const got = measure(r.image);
      const baseline = measure(decodePNG(fs.readFileSync(f.baselinePath)));
      fs.writeFileSync(ev(c.key, "imported", `${f.name}.png`), encodePNG(got.imported));
      fs.writeFileSync(ev(c.key, "baseline-imported", `${f.name}.png`), encodePNG(baseline.imported));
      frames.push({ name: f.name, w: r.image.width, h: r.image.height, ms: r.call.ms, attempts: r.call.attempts,
        bbox: got.bbox, key: got.key, trimmedTo: got.trimmedTo, imported: got.imported, baselineImported: baseline.imported, baselineBbox: baseline.bbox, baselineKey: baseline.key });
      log(`DONE ${c.key} ${f.name} ${r.image.width}x${r.image.height} ms=${r.call.ms} attempts=${r.call.attempts} bbox=${JSON.stringify(got.bbox)}`);
    }
    const [x, y] = frames;
    const widthDiffPct = x.bbox && y.bbox ? +(((Math.max(x.bbox.w, y.bbox.w) / Math.min(x.bbox.w, y.bbox.w)) - 1) * 100).toFixed(1) : null;
    const posDriftPct = x.bbox && y.bbox ? +((Math.max(Math.abs(x.bbox.x - y.bbox.x) / Math.max(x.w, y.w), Math.abs(x.bbox.y - y.bbox.y) / Math.max(x.h, y.h))) * 100).toFixed(1) : null;
    const keyL1 = x.key && y.key ? Math.abs(x.key[0] - y.key[0]) + Math.abs(x.key[1] - y.key[1]) + Math.abs(x.key[2] - y.key[2]) : null;
    const metrics = {
      frames, alpha: alphaDiff(x.imported, y.imported), widthDiffPct, posDriftPct, keyL1,
      paletteCount: [paletteCount(x.imported), paletteCount(y.imported)],
      baseline: { alpha: alphaDiff(x.baselineImported, y.baselineImported), widthDiffPct: x.baselineBbox && y.baselineBbox ? +(((Math.max(x.baselineBbox.w, y.baselineBbox.w) / Math.min(x.baselineBbox.w, y.baselineBbox.w)) - 1) * 100).toFixed(1) : null,
        keyL1: x.baselineKey && y.baselineKey ? Math.abs(x.baselineKey[0] - y.baselineKey[0]) + Math.abs(x.baselineKey[1] - y.baselineKey[1]) + Math.abs(x.baselineKey[2] - y.baselineKey[2]) : null },
    };
    // contact sheet: 2.5 idle1 | candidate idle1 | 2.5 idle2 | candidate idle2
    fs.writeFileSync(ev(c.key, "contact.png"), encodePNG(hstack([x.baselineImported, x.imported, y.baselineImported, y.imported].map((i) => upscale(i)))));
    const cost = c.costPerImage === null ? null : +(frames.length * c.costPerImage).toFixed(3);
    results.push({ key: c.key, label: c.label, sends: c.key === "gemini3pro" ? counters.gemini : counters.openai, metrics: { ...metrics, frames: frames.map(({ imported, baselineImported, ...rest }) => rest) }, costEstimate: cost, costNote: c.costPerImage === null ? "relay 计价未验证；未按官方价冒充实际花费" : "仅输出价；输入另计" });
  }
  clearTimeout(timer);
  const result = { ok: true, mode: MODE, candidates: results, counters, caps, ...(MODE === "live" ? { verdict: "pending-human" } : {}) };
  fs.writeFileSync(path.join(HERE, MODE === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  clearTimeout(timer);
  const result = { ok: false, mode: MODE, candidates: results, counters, error: e instanceof Error ? e.message : String(e) };
  fs.writeFileSync(path.join(HERE, MODE === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  log(`FAIL ${e instanceof Error ? e.message : String(e)}`);
  console.error("✗ 失败：", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
