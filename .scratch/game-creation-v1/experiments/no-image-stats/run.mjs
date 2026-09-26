// NO_IMAGE 是随机还是规律？
//
// 直接打 HTTP 而不是走客户端 —— 客户端在 NO_IMAGE 时会抛，而这里要的是**原始回应**。
// 矩阵：{idle, run, jump} × {带母版参考图, 不带} × 各 6 次 = 36 次调用。
// 每次结果**立刻落盘**，中途崩了也不丢数据。
import fs from "node:fs";
const ROOT = "/Volumes/shy/some-projects/game-maker/";
const A = await import(ROOT + "packages/assets/dist/index.js");
const { transport } = A.resolveImageTransport({ env: process.env, cwd: ROOT });
const doFetch = transport.proxy ? A.createProxyFetch({ proxy: transport.proxy }) : fetch;

const style = JSON.parse(fs.readFileSync(ROOT + "fixtures/style-spec.json", "utf8"));
const spec = JSON.parse(fs.readFileSync(ROOT + "fixtures/recipes/shift-change-image-anim.json", "utf8"))
  .assets.find((a) => a.spec.id === "player-odin").spec;
const ref = A.decodePNG(fs.readFileSync(ROOT + "inputs/master-to-animation/player-master.png"));
const NEG = A.imageNegativePrompt();
const url = `${transport.baseUrl.replace(/\/+$/, "")}/models/${transport.model}:generateContent`;

const OUT = ROOT + ".scratch/game-creation-v1/experiments/no-image-stats/results.json";
const results = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, "utf8")) : [];

async function once(anim, useRef, rep) {
  const frames = spec.animations.find((a) => a.name === anim).frames;
  const size = { w: spec.size.w * frames, h: spec.size.h };
  const aspect = A.geminiAspect(size);
  const prompt = A.imagePrompt(spec, style, anim) + "\n\nAvoid: " + NEG;
  const parts = [{ text: prompt }];
  if (useRef) parts.push({ inline_data: { mime_type: "image/png", data: A.encodePNG(ref).toString("base64") } });
  const body = { contents: [{ parts }], generationConfig: { responseModalities: ["IMAGE"], imageConfig: { aspectRatio: aspect } } };
  const t0 = Date.now();
  const rec = { anim, useRef, rep, aspect, frames, at: new Date().toISOString() };
  try {
    const res = await doFetch(url, {
      method: "POST", headers: { "content-type": "application/json", "x-goog-api-key": transport.apiKey },
      body: JSON.stringify(body), signal: AbortSignal.timeout(240_000),
    });
    rec.http = res.status;
    const d = await res.json();
    if (d.error) { rec.outcome = "error"; rec.detail = JSON.stringify(d.error).slice(0, 200); }
    else {
      const c = (d.candidates ?? [])[0] ?? {};
      rec.finishReason = c.finishReason ?? null;
      rec.blockReason = d.promptFeedback?.blockReason ?? null;
      const img = (c.content?.parts ?? []).find((p) => p.inlineData);
      rec.outcome = img ? "ok" : "no_image";
      if (img) {
        const b = Buffer.from(img.inlineData.data, "base64");
        rec.bytes = b.length;
        rec.px = `${b.readUInt32BE(16)}x${b.readUInt32BE(20)}`;
      } else {
        rec.detail = JSON.stringify(c).slice(0, 200);
        rec.textParts = (c.content?.parts ?? []).filter((p) => p.text).map((p) => p.text.slice(0, 160));
      }
    }
  } catch (e) { rec.outcome = "throw"; rec.detail = String(e.message ?? e).slice(0, 200); }
  rec.ms = Date.now() - t0;
  results.push(rec);
  fs.writeFileSync(OUT, JSON.stringify(results, null, 2) + "\n");
  console.log(`${String(results.length).padStart(2)}/${36}  ${anim.padEnd(5)} ${useRef ? "有参考" : "无参考"} rep${rep}  → ${rec.outcome}${rec.finishReason ? " " + rec.finishReason : ""}  ${rec.ms}ms`);
}

for (const anim of ["idle", "run", "jump"])
  for (const useRef of [false, true])
    for (let i = 1; i <= 6; i++) await once(anim, useRef, i);
console.log("DONE");
