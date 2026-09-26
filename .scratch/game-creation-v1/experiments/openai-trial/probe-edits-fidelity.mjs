// 决定性的一问：`/images/edits` **真的把图传过去了吗**，还是只是「收了参数、照样自由发挥」？
// 上一版探针的提示词是「画一个红方块」—— 那两者都会给红方块，分不出来。
// 这一版提示词是「照着我给的这张图画」，然后量输出与输入像不像。
// 对照组：同提示词走 /images/generations（没有输入图）。
import fs from "node:fs";
import path from "node:path";
import { createProxyFetch, decodePNG, encodePNG } from "../../../../packages/assets/dist/index.js";

const cfg = JSON.parse(fs.readFileSync(path.resolve("game-maker.local.json"), "utf8")).image;
const doFetch = cfg.proxy ? createProxyFetch({ proxy: cfg.proxy }) : fetch;
const base = cfg.baseUrl.replace(/\/+$/, "");
const src = decodePNG(fs.readFileSync("inputs/master-to-animation/player-master.png"));

const PROMPT = "Reproduce the attached image exactly as given: same character, same colors, same pose, " +
  "same flat background. Do not invent anything new.";

/** 两张图缩到同一尺寸后的平均色差。只用来分辨「像」和「不像」。 */
function distance(a, b) {
  const W = 64, H = 64;
  const px = (img, x, y) => { const i = (Math.floor(y * img.height / H) * img.width + Math.floor(x * img.width / W)) * 4; return [img.data[i], img.data[i + 1], img.data[i + 2]]; };
  let sum = 0;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const p = px(a, x, y), q = px(b, x, y);
    sum += Math.sqrt((p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2 + (p[2] - q[2]) ** 2);
  }
  return sum / (W * H);
}

const multipart = (fields, files) => {
  const B = "----gm" + Math.random().toString(16).slice(2);
  const parts = [];
  for (const [k, v] of Object.entries(fields)) parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`));
  files.forEach((f, i) => parts.push(Buffer.from(`--${B}\r\nContent-Disposition: form-data; name="image[]"; filename="input-${i}.png"\r\nContent-Type: image/png\r\n\r\n`), encodePNG(f), Buffer.from("\r\n")));
  parts.push(Buffer.from(`--${B}--\r\n`));
  const body = Buffer.concat(parts);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${B}`, "content-length": String(body.length) } };
};

async function run(name, url, headers, body) {
  const t0 = Date.now();
  const r = await doFetch(url, { method: "POST", headers: { ...headers, authorization: `Bearer ${cfg.apiKey}` }, body });
  const text = await r.text();
  if (!r.ok) { console.log(`${name} → http=${r.status} t=${((Date.now() - t0) / 1000).toFixed(1)}s ${text.slice(0, 180)}`); return; }
  const doc = JSON.parse(text);
  const img = decodePNG(Buffer.from(doc.data[0].b64_json, "base64"));
  const f = `.scratch/game-creation-v1/experiments/openai-trial/fidelity-${name}.png`;
  fs.writeFileSync(f, Buffer.from(doc.data[0].b64_json, "base64"));
  console.log(`${name} → http=200 t=${((Date.now() - t0) / 1000).toFixed(1)}s  ${img.width}×${img.height}  与输入图的平均色差 ${distance(src, img).toFixed(1)}  → ${f}`);
}

const m = multipart({ model: cfg.model, prompt: PROMPT, n: "1", size: "1024x1024" }, [src]);
await run("edits", `${base}/images/edits`, m.headers, m.body);
await run("generations", `${base}/images/generations`, { "content-type": "application/json" },
  JSON.stringify({ model: cfg.model, prompt: PROMPT, n: 1, size: "1024x1024" }));
// 基准：输入图与它自己的色差（恒为 0）—— 用来读上面那两个数
console.log(`基准色差 0（输入图自比）· 随机方图与输入的色差量级在 60~120`);
