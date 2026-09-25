// 生成后抽查：把包里的东西拿给人看，并让**视觉模型只说差异、不判分**（票 22 问题 6）。
//
// ⚠️ 三条边界写死在这里，别松：
//   ① **它不进任何自动门禁。** R2 砍掉了评分与自动修复；这个函数的输出是**给人看的观察清单**，
//      不是分数、不驱动任何分支。一个不稳定的判据进生成路径，就是在给产物注入不确定性。
//   ② **它只说差异，不说好坏。** prompt 里明确要求「描述你看到的差异」，不要求打分。
//   ③ **它不阻断。** 拿不到结果就当没有 —— 抽查失败不该让一个已经做好的包变得不可用。
import fs from "node:fs";
import path from "node:path";
import { emptyImage, type RasterImage } from "./image.js";
import { decodePNG, encodePNG } from "./png.js";
import type { StyleSpec } from "@game-maker/contracts";

/**
 * 把包里所有帧拼成一张联系表 —— **就是给人（和视觉模型）一眼看全貌的那张图**。
 * 按 `manifest.atlases` 的顺序、按各自的帧矩形从图集里裁出来，不依赖图集本身可读。
 */
export function packContactSheet(packDir: string, { maxCell = 160, pad = 10 }: { maxCell?: number; pad?: number } = {}): RasterImage {
  const manifest = JSON.parse(fs.readFileSync(path.join(packDir, "manifest.json"), "utf8")) as {
    atlases: { meta: string; image: string }[];
  };
  const items: { img: RasterImage; scale: number }[] = [];
  for (const at of manifest.atlases) {
    const j = JSON.parse(fs.readFileSync(path.join(packDir, at.meta), "utf8")) as {
      frames: Record<string, { frame: { x: number; y: number; w: number; h: number } }>;
    };
    const img = decodePNG(fs.readFileSync(path.join(packDir, at.image)));
    for (const f of Object.values(j.frames)) {
      const sub = emptyImage(f.frame.w, f.frame.h);
      for (let y = 0; y < f.frame.h; y++)
        img.data.copy(sub.data, y * f.frame.w * 4, ((f.frame.y + y) * img.width + f.frame.x) * 4, ((f.frame.y + y) * img.width + f.frame.x + f.frame.w) * 4);
      items.push({ img: sub, scale: Math.max(1, Math.min(4, Math.floor(maxCell / Math.max(f.frame.w, f.frame.h)))) });
    }
  }
  const cellW = Math.max(...items.map((i) => i.img.width * i.scale), 1);
  const cellH = Math.max(...items.map((i) => i.img.height * i.scale), 1);
  const cols = Math.max(1, Math.min(items.length, Math.ceil(Math.sqrt(items.length * 2))));
  const rows = Math.ceil(items.length / cols);
  const sheet = emptyImage(pad + cols * (cellW + pad), pad + rows * (cellH + pad));
  for (let i = 0; i < sheet.width * sheet.height; i++) { const s = i * 4; sheet.data[s] = 24; sheet.data[s + 1] = 28; sheet.data[s + 2] = 31; sheet.data[s + 3] = 255; }
  items.forEach((it, k) => {
    const ox = pad + (k % cols) * (cellW + pad), oy = pad + Math.floor(k / cols) * (cellH + pad);
    for (let y = 0; y < it.img.height * it.scale; y++) for (let x = 0; x < it.img.width * it.scale; x++) {
      const s = (Math.floor(y / it.scale) * it.img.width + Math.floor(x / it.scale)) * 4;
      if (!it.img.data[s + 3]) continue;
      // ⚠️ Buffer.copy 是 src.copy(target, ...) —— 写反了会静默地什么都不拷（第一版就是）
      it.img.data.copy(sheet.data, ((oy + y) * sheet.width + ox + x) * 4, s, s + 4);
    }
  });
  return sheet;
}

export type ReviewOptions = {
  packDir: string;
  style: StyleSpec;
  baseUrl: string;
  apiKey: string;
  model?: string;
  /** 视觉端点的路径。默认 `/v1/messages`（票 22 实测：那条路仍然能收图）。 */
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ReviewResult =
  | { ok: true; observations: string[]; raw: string; contactSheet: RasterImage }
  | { ok: false; error: string };

/**
 * 抽查一个包：把联系表 + 参考风格一起给视觉模型，要一份「哪里不像」的观察清单。
 *
 * ⚠️ **不做的事**：不打分、不判定通过与否、不阻断。它是一份给人看的材料。
 */
export async function reviewPack(opts: ReviewOptions): Promise<ReviewResult> {
  const doFetch = opts.fetchImpl ?? fetch;
  let sheet: RasterImage;
  try { sheet = packContactSheet(opts.packDir); }
  catch (e) { return { ok: false, error: `拼不出联系表：${(e as Error).message}` }; }

  const brief = `identity: ${JSON.stringify(opts.style.identity)}
shapeLanguage: ${JSON.stringify(opts.style.shapeLanguage)}
material: ${JSON.stringify(opts.style.material)}
constraints: ${JSON.stringify(opts.style.constraints)}
palette: ${opts.style.palette.join(" ")}`;

  const body = {
    model: opts.model ?? "deepseek-v4-pro",
    max_tokens: 2000,
    thinking: { type: "disabled" },
    messages: [{
      role: "user",
      content: [
        { type: "image", source: { type: "base64", media_type: "image/png", data: encodePNG(sheet).toString("base64") } },
        {
          type: "text",
          text: `这是一套游戏资源的联系表（每一格是一个资源或动画的一帧）。下面是从参考图里提取的风格规格。

${brief}

请**只描述你看到的差异**，列成条目：这套资源里哪些地方**不像**上面这个风格规格？
不要打分，不要排名，不要给「通过 / 不通过」的结论 —— 只说你看到的事实。
如果某个维度看起来很一致，也直说。最多 8 条。`,
        },
      ],
    }],
  };

  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 180_000);
  try {
    const res = await doFetch(`${opts.baseUrl}${opts.endpoint ?? "/v1/messages"}`, {
      method: "POST", signal: ctl.signal,
      headers: { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    if (!res.ok) return { ok: false, error: `视觉上游返回 HTTP ${res.status}` };
    const j = (await res.json()) as { content?: { type: string; text?: string }[] };
    const raw = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    const observations = raw.split("\n").map((l) => l.replace(/^[\s\-*\d.、)]+/, "").trim()).filter((l) => l.length > 1);
    return { ok: true, observations, raw, contactSheet: sheet };
  } catch (e) {
    return { ok: false, error: `抽查失败（不阻断）：${(e as Error).message}` };
  } finally { clearTimeout(timer); }
}
