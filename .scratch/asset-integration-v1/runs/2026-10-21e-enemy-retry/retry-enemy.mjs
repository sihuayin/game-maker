// 票 15 的 A 资格脚本（Gemini 3 Pro · 3+3 帧）。只有逐字点头后才允许付费：
//   RUN_APPROVED=1 node qualify.mjs
// 零付费自检：DRY_RUN=1 node qualify.mjs
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { pathToFileURL } from "node:url";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const A = await import(pathToFileURL(path.join(ROOT, "packages/assets/dist/index.js")).href);
const {
  createGeminiGenerator, createProxyFetch, decodePNG, encodePNG, resolveImageTransport,
  dominantOpaqueColor, importFrames, keyBackground, inkBBox, dropDetachedSpecks, dropBottomGroundLines,
  emptyImage, resizeNearest,
} = A;
const requireFromAssets = createRequire(path.join(ROOT, "packages/assets/package.json"));
const { encode: encodeJPEG } = requireFromAssets("jpeg-js");

const MODE = process.env.DRY_RUN === "1" ? "dry" : process.env.RUN_APPROVED === "1" ? "live" : null;
if (!MODE) { console.error("未批准：先拿到逐字点头，再用 RUN_APPROVED=1；零付费自检用 DRY_RUN=1。"); process.exit(2); }
if (MODE === "live" && fs.existsSync(path.join(HERE, "result.json"))) { console.error("已有 result.json，拒绝覆盖"); process.exit(2); }

const PROXY = "http://127.0.0.1:7890";
const MODEL = "gemini-3-pro-image";
const MAX_SENDS = 3;
const RUN = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker");
const GEN = path.join(RUN, "ruin-scavenger-extraction-assets/pack/v7/authoring/generated");
const palette = JSON.parse(fs.readFileSync(path.join(RUN, "stylespec.json"), "utf8")).palette;
const styleReference = decodePNG(fs.readFileSync(path.join(RUN, "reference.png")));
const FLOOR = 128;

const CHARACTERS = [
  {
    key: "enemy", label: "wasteland-enemy", size: { w: 48, h: 48 }, fps: 8,
    masterPath: path.join(RUN, "reuse/master-wasteland-enemy.png"),
    frames: [
      { name: "wasteland-enemy.patrol1", prompt: path.join(GEN, "wasteland-enemy.patrol1.prompt.txt"), baseline: path.join(GEN, "wasteland-enemy.patrol1.png") },
      { name: "wasteland-enemy.patrol4", prompt: path.join(GEN, "wasteland-enemy.patrol4.prompt.txt"), baseline: path.join(GEN, "wasteland-enemy.patrol4.png") },
      { name: "wasteland-enemy.patrol6", prompt: path.join(GEN, "wasteland-enemy.patrol6.prompt.txt"), baseline: path.join(GEN, "wasteland-enemy.patrol6.png") },
    ],
  },
];
for (const c of CHARACTERS) {
  c.master = decodePNG(fs.readFileSync(c.masterPath));
  for (const f of c.frames) for (const p of [f.prompt, f.baseline]) if (!fs.existsSync(p)) { console.error("缺文件：" + p); process.exit(2); }
}

const cfg = resolveImageTransport({ env: process.env, cwd: ROOT });
if (!cfg.transport || cfg.transport.protocol !== "gemini") { console.error("Gemini 配置不可用：" + (cfg.warnings.join("；") || "protocol != gemini")); process.exit(2); }
const url = `${cfg.transport.baseUrl.replace(/\/+$/, "")}/interactions`;
const ev = (char, ...parts) => {
  const dir = path.join(HERE, "evidence", char, ...(MODE === "dry" ? ["dry"] : []), ...parts.slice(0, -1));
  fs.mkdirSync(dir, { recursive: true });
  return path.join(dir, parts[parts.length - 1]);
};
const logPath = path.join(HERE, MODE === "live" ? "http-calls.log" : "dry-run.log");
const log = (line) => fs.appendFileSync(logPath, `${new Date().toISOString()} ${line}\n`);

const makeData = () => {
  const data = Buffer.alloc(8 * 8 * 4, 0xff);
  for (let y = 2; y < 6; y++) for (let x = 2; x < 6; x++) { const i = (y * 8 + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; data[i + 3] = 255; }
  return data;
};
const syntheticJPEG = encodeJPEG({ width: 8, height: 8, data: makeData() }, 90).data;
const proxyFetch = MODE === "live" ? createProxyFetch({ proxy: PROXY }) : null;
let sends = 0;
let current = "";

const fetchImpl = async (input, init) => {
  const u = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
  if (u !== url) throw new Error(`未批准的 URL：${u}（只允许 ${url}）`);
  const n = ++sends;
  if (n > MAX_SENDS) { log(`STOP sends ${n}`); process.exit(124); }
  const body = JSON.parse(String(init?.body ?? "{}"));
  const rf = body.response_format ?? {};
  const inputs = (body.input ?? []).map((x) => ({ type: x.type, mime_type: x.mime_type, textLength: typeof x.text === "string" ? x.text.length : undefined }));
  fs.writeFileSync(ev(current.char, "requests", `${current.name}.req${n}.json`), JSON.stringify({ url: u, model: body.model, response_format: rf, inputs }, null, 2) + "\n");
  log(`REQ #${n} ${current.name} model=${body.model} mime=${rf.mime_type} aspect=${rf.aspect_ratio} size=${rf.image_size} inputs=${inputs.length}`);
  if (MODE === "dry") {
    return new Response(JSON.stringify({ steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/jpeg", data: syntheticJPEG.toString("base64") }] }] }), { status: 200, headers: { "content-type": "application/json" } });
  }
  const res = await proxyFetch(u, init);
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
  } catch { /* 原样交给生成器 */ }
  if (bytes.length) {
    const ext = mime === "image/jpeg" ? "jpg" : mime === "image/png" ? "png" : "bin";
    fs.writeFileSync(ev(current.char, "raw", `${current.name}.req${n}.${ext}`), bytes);
    log(`RES #${n} ${res.status} mime=${mime || "(none)"} bytes=${bytes.length}`);
  } else log(`RES #${n} ${res.status} no-image ${text.slice(0, 160).replace(/\s+/g, " ")}`);
  return new Response(text, { status: res.status, headers: res.headers });
};

const gen = createGeminiGenerator({
  baseUrl: cfg.transport.baseUrl, apiKey: cfg.transport.apiKey, model: MODEL,
  api: "interactions", attempts: 2, fetchImpl,
});

const measure = (img, size) => {
  const key = dominantOpaqueColor(img).color;
  const keyed = keyBackground(img, { tolerance: 30, colors: [key] }).image;
  const cleaned = dropDetachedSpecks(dropBottomGroundLines(keyed, { floor: FLOOR }), { floor: FLOOR });
  const bbox = inkBBox(cleaned, { floor: FLOOR });
  const imported = importFrames([img], {
    palette, targetWidth: size.w, targetHeight: size.h,
    background: { tolerance: 30, colors: [key] }, dropSpecks: true, dropBottomLines: true,
  })[0];
  return { key, bbox, imported, trimmedTo: imported.report.trimmedTo ?? null };
};
const alphaDiff = (x, y) => {
  let alpha = 0, rgb = 0, sum = 0; const n = x.width * x.height;
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
const paletteSet = new Set(palette.map((h) => h.toLowerCase()));
const paletteLum = palette.map((h) => {
  const r = parseInt(h.slice(1, 3), 16), g = parseInt(h.slice(3, 5), 16), b = parseInt(h.slice(5, 7), 16);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}).sort((a, b) => a - b);
const darkCut = paletteLum[Math.floor(paletteLum.length / 2)];
const analyze = (img) => {
  let off = 0, boundary = 0, dark = 0;
  const W = img.width, H = img.height;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    if (img.data[i + 3] < 128) continue;
    const hex = `#${[img.data[i], img.data[i + 1], img.data[i + 2]].map((v) => v.toString(16).padStart(2, "0")).join("")}`;
    if (!paletteSet.has(hex)) off++;
    const edge = x === 0 || y === 0 || x === W - 1 || y === H - 1 ||
      img.data[(y * W + x - 1) * 4 + 3] < 128 || img.data[(y * W + x + 1) * 4 + 3] < 128 ||
      img.data[((y - 1) * W + x) * 4 + 3] < 128 || img.data[((y + 1) * W + x) * 4 + 3] < 128;
    if (edge) { boundary++; const lum = 0.2126 * img.data[i] + 0.7152 * img.data[i + 1] + 0.0722 * img.data[i + 2]; if (lum <= darkCut) dark++; }
  }
  return { offPalette: off, boundaryPixels: boundary, boundaryDarkPct: boundary ? +(dark / boundary * 100).toFixed(1) : null };
};
const paletteCount = (img) => { const s = new Set(); for (let i = 0; i < img.width * img.height; i++) { const k = i * 4; if (img.data[k + 3] >= 128) s.add(`${img.data[k]},${img.data[k + 1]},${img.data[k + 2]}`); } return s.size; };
const hstack = (imgs, gap = 8) => {
  const h = Math.max(...imgs.map((i) => i.height)); const out = emptyImage(imgs.reduce((s, i) => s + i.width + gap, 0) - gap, h);
  let x = 0; for (const img of imgs) { for (let y = 0; y < img.height; y++) img.data.copy(out.data, (y * out.width + x) * 4, y * img.width * 4, (y + 1) * img.width * 4); x += img.width + gap; }
  return out;
};
const vstack = (rows, gap = 8) => {
  const w = Math.max(...rows.map((r) => r.width)); const out = emptyImage(w, rows.reduce((s, r) => s + r.height + gap, 0) - gap);
  let y = 0; for (const row of rows) { for (let yy = 0; yy < row.height; yy++) row.data.copy(out.data, (yy + y) * out.width * 4, yy * row.width * 4, (yy + 1) * row.width * 4); y += row.height + gap; }
  return out;
};
const upscale = (img, s = 8) => resizeNearest(img, img.width * s, img.height * s);

const timer = setTimeout(() => { log("STOP wall clock"); process.exit(124); }, 30 * 60 * 1000);
log(`START mode=${MODE} model=${MODEL} proxy=${MODE === "live" ? PROXY : "(none)"} maxSends=${MAX_SENDS}`);
const results = [];
try {
  for (const c of CHARACTERS) {
    const frames = [];
    for (const f of c.frames) {
      current = { char: c.key, name: path.basename(f.name) };
      const prompt = fs.readFileSync(f.prompt, "utf8").trim();
      const r = await gen({ prompt, size: c.size, styleReference, reference: c.master });
      fs.writeFileSync(ev(c.key, "decoded", `${f.name}.png`), encodePNG(r.image));
      fs.writeFileSync(ev(c.key, "prompts", `${f.name}.txt`), prompt + "\n");
      const got = measure(r.image, c.size);
      const base = measure(decodePNG(fs.readFileSync(f.baseline)), c.size);
      fs.writeFileSync(ev(c.key, "imported", `${f.name}.png`), encodePNG(got.imported));
      fs.writeFileSync(ev(c.key, "baseline-imported", `${f.name}.png`), encodePNG(base.imported));
      frames.push({ name: f.name, w: r.image.width, h: r.image.height, ms: r.call.ms, attempts: r.call.attempts,
        bbox: got.bbox, key: got.key, trimmedTo: got.trimmedTo, imported: got.imported, baselineImported: base.imported, baselineBbox: base.bbox, baselineKey: base.key,
        analysis: analyze(got.imported), baselineAnalysis: analyze(base.imported) });
      log(`DONE ${f.name} ${r.image.width}x${r.image.height} ms=${r.call.ms} attempts=${r.call.attempts} bbox=${JSON.stringify(got.bbox)}`);
    }
    const pairs = [];
    for (let i = 0; i < frames.length; i++) for (let j = i + 1; j < frames.length; j++) {
      const x = frames[i], y = frames[j];
      pairs.push({
        pair: `${x.name.split(".").pop()}~${y.name.split(".").pop()}`,
        alpha: alphaDiff(x.imported, y.imported),
        widthDiffPct: x.bbox && y.bbox ? +(((Math.max(x.bbox.w, y.bbox.w) / Math.min(x.bbox.w, y.bbox.w)) - 1) * 100).toFixed(1) : null,
        posDriftPct: x.bbox && y.bbox ? +((Math.max(Math.abs(x.bbox.x - y.bbox.x) / Math.max(x.w, y.w), Math.abs(x.bbox.y - y.bbox.y) / Math.max(x.h, y.h))) * 100).toFixed(1) : null,
        keyL1: x.key && y.key ? Math.abs(x.key[0] - y.key[0]) + Math.abs(x.key[1] - y.key[1]) + Math.abs(x.key[2] - y.key[2]) : null,
        baseline: {
          alpha: alphaDiff(x.baselineImported, y.baselineImported),
          widthDiffPct: x.baselineBbox && y.baselineBbox ? +(((Math.max(x.baselineBbox.w, y.baselineBbox.w) / Math.min(x.baselineBbox.w, y.baselineBbox.w)) - 1) * 100).toFixed(1) : null,
          keyL1: x.baselineKey && y.baselineKey ? Math.abs(x.baselineKey[0] - y.baselineKey[0]) + Math.abs(x.baselineKey[1] - y.baselineKey[1]) + Math.abs(x.baselineKey[2] - y.baselineKey[2]) : null,
        },
      });
    }
    const maxOf = (k) => Math.max(...pairs.map((p) => p[k] ?? 0));
    const metrics = {
      pairs,
      maxAlphaPct: +Math.max(...pairs.map((p) => p.alpha.alphaPct)).toFixed(1),
      maxWidthDiffPct: maxOf("widthDiffPct"),
      maxPosDriftPct: maxOf("posDriftPct"),
      maxKeyL1: maxOf("keyL1"),
      minPalette: Math.min(...frames.map((f) => paletteCount(f.imported))),
      maxOffPalette: Math.max(...frames.map((f) => f.analysis.offPalette)),
      minBoundaryDarkPct: Math.min(...frames.map((f) => f.analysis.boundaryDarkPct ?? 0)),
    };
    const tier = (v, g, y) => v === null ? "unknown" : v <= g ? "green" : v <= y ? "yellow" : "red";
    const tiers = {
      alpha: tier(metrics.maxAlphaPct, 1, 3), width: tier(metrics.maxWidthDiffPct, 2, 5),
      position: tier(metrics.maxPosDriftPct, 1, 3), key: tier(metrics.maxKeyL1, 10, 20),
      palette: metrics.minPalette >= 14 ? "green" : "red",
      offPalette: metrics.maxOffPalette === 0 ? "green" : "red",
      boundary: metrics.minBoundaryDarkPct >= 50 ? "green" : "red",
    };
    const overall = Object.values(tiers).includes("red") ? "red" : Object.values(tiers).includes("yellow") ? "yellow" : "green";
    fs.writeFileSync(ev(c.key, "contact.png"), encodePNG(vstack(frames.map((f) => hstack([upscale(f.baselineImported), upscale(f.imported)])))));
    const html = `<!doctype html><meta charset="utf-8"><title>${c.label} qualification preview</title>
<style>body{font-family:system-ui;background:#1b1b1b;color:#ddd;margin:24px}img{image-rendering:pixelated;background:#333;border:1px solid #555}div{display:inline-block;margin:8px}small{color:#aaa}</style>
<h2>${c.label} · qualification sample (${c.frames.length} frames, not full loop)</h2>
<div><div><small>2.5 baseline</small><br><img id="b" width="${c.size.w * 8}" height="${c.size.h * 8}"></div>
<div><small>3 Pro candidate</small><br><img id="c" width="${c.size.w * 8}" height="${c.size.h * 8}"></div></div>
<script>
const b=${JSON.stringify(frames.map((f) => `baseline-imported/${f.name}.png`))};
const c=${JSON.stringify(frames.map((f) => `imported/${f.name}.png`))};
const fps=${c.fps}; let i=0;
const bi=document.getElementById('b'), ci=document.getElementById('c');
const tick=()=>{bi.src=b[i% b.length];ci.src=c[i% c.length];i++;}; tick(); setInterval(tick,1000/fps);
</script>`;
    fs.writeFileSync(ev(c.key, "loop-preview.html"), html);
    results.push({ key: c.key, label: c.label, size: c.size, fps: c.fps, frames: frames.map(({ imported, baselineImported, ...rest }) => rest), metrics, tiers, mechanicalVerdict: overall });
  }
  clearTimeout(timer);
  const result = { ok: true, mode: MODE, model: MODEL, sends, maxSends: MAX_SENDS, characters: results, ...(MODE === "live" ? { humanVerdict: "pending" } : {}) };
  fs.writeFileSync(path.join(HERE, MODE === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  console.log(JSON.stringify(result, null, 2));
} catch (e) {
  clearTimeout(timer);
  const result = { ok: false, mode: MODE, model: MODEL, sends, characters: results, error: e instanceof Error ? e.message : String(e) };
  fs.writeFileSync(path.join(HERE, MODE === "live" ? "result.json" : "dry-run-result.json"), JSON.stringify(result, null, 2) + "\n");
  log(`FAIL ${e instanceof Error ? e.message : String(e)} sends=${sends}`);
  console.error("✗ 失败：", e instanceof Error ? e.message : String(e));
  process.exit(1);
}
