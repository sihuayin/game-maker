// 生成后抽查：把包里的东西拿给人看，并让**视觉模型只说差异、不判分**（票 22 问题 6）。
//
// ⚠️ **2026-10-16（票 78）**：它从「零消费者」变成了 `game-maker review` 那一支的**实现**
//   （人主动调 · **不接入自动创建链** · `reject` 语义一个字没变）。两件事随之落定：
//   · **两张图都喂**（Q5 = (乙)）：联系表是**被检查的对象**、原图是**比对的基准** ⇒ `referenceImagePath` **必填**；
//   · **这一发要记账**（Q2 = 乙）：返回值带一枚 `LedgerCall`，由调用方写进 **run 级那份账**
//     （⚠️ **不写包内那份** —— 它进 `files[]`、被 `verify` 按 checksum 校验，追加一行会让那个包 verify 不过）。
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
import { STYLE_MEDIA_TYPES, type LedgerCall, type LedgerUsage, type StyleSpec } from "@game-maker/contracts";

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
  /**
   * **原图** —— 风格比对的**基准**（[票 78](../../../.scratch/game-maker-v2/issues/78-reviewpack-wiring.md)
   * 的 Q5 = (乙)：人裁逐字「联系表是被检查对象，原图是风格比对基准。
   * **接线必须能同时取得两者**；不能只把联系表替换成原图」）。
   *
   * ⚠️ **它是必填的，不是可选项** —— 只喂联系表那次「对比」根本不成立
   *   （要回答的是「**这套资源哪里不像那个风格**」，没有基准就没有「像不像」）。
   *   写成必填是让那条裁定**结构性**成立，而不是靠调用方记得传。
   * ⚠️ **它不在包里**（票 78 量到：`pack/<v>/authoring/` 下没有任何参考图，而包里那份
   *   `visual-world.json` 的 `styleReferences[].path` 在那儿是**悬空**的）⇒ 调用方自己去找它
   *   （CLI 那一头是从 `run/v<N>/` 拿的）。
   * ⚠️ 媒体类型**按扩展名**判（`STYLE_MEDIA_TYPES`），**不解析图片内容**（票 08 的 R1-Q7）。
   */
  referenceImagePath: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
  /** 视觉端点的路径。默认 `/v1/messages`（票 22 实测：那条路仍然能收图）。 */
  endpoint?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

export type ReviewResult =
  | { ok: true; observations: string[]; raw: string; contactSheet: RasterImage; call: LedgerCall }
  /**
   * ⚠️ **失败也把 `call` 带出来**（票 78 的 Q2 = 乙：「事后必须记账」）——
   *   一次**发了出去却没过**的抽查也是花掉的一笔，而它今天是**最容易被漏掉**的那一半
   *   （票 46 / 48 治的就是这个形状）。⇒ 只有「**根本没发出去**」时它才缺席
   *   （拼不出联系表 ⇒ 一次都没上路 ⇒ `trips === 0`）。
   */
  | { ok: false; error: string; call?: LedgerCall };

/**
 * 抽查一个包：把联系表 + 参考风格一起给视觉模型，要一份「哪里不像」的观察清单。
 *
 * ⚠️ **不做的事**：不打分、不判定通过与否、不阻断。它是一份给人看的材料。
 */
export async function reviewPack(opts: ReviewOptions): Promise<ReviewResult> {
  const doFetch = opts.fetchImpl ?? fetch;

  // ⚠️ **这一发不重采样**：抽查看的是「**现在长什么样**」，重抽一次看到的是同一批图。
  //   ⇒ 一格 = 一次往返（`attempts` 恒为 1），而 `t0` 在**发出去之前**就起。
  const t0 = Date.now();
  let usage: LedgerUsage | undefined;
  /**
   * ⚠️ **账什么时候记**：只要**这条路走到了「发」**就记 —— 成没成都记。
   *   这与 `analyze-reference` 的 `onceThrough` 是同一条判据（它把 fetch 抛出的
   *   ECONNREFUSED / 超时都归成 `kind: "upstream"`，而那一档**是要记的**）；
   *   真正**不记**的只有「**一次都没上路**」—— 那一档在这里是「拼不出联系表」与「原图读不出来」。
   *   ⚠️ 换句话说：**账的纪律是不许把钱说小**，而这一层分不出「连不上」与「断了」。
   */
  const record = (): LedgerCall => ({
    step: "review", target: packId, upstream: "messages", ms: Date.now() - t0, attempts: 1,
    ...(usage === undefined ? {} : { usage }),
  });

  let sheet: RasterImage;
  try { sheet = packContactSheet(opts.packDir); }
  catch (e) { return { ok: false, error: `拼不出联系表：${(e as Error).message}` }; }

  // ⚠️ **原图**（票 78 的 Q5 = (乙)）：它**不在包里**，由调用方给 —— 读不出来就一次都别上路。
  let reference: Record<string, unknown>;
  try { reference = imageBlockOf(opts.referenceImagePath); }
  catch (e) { return { ok: false, error: (e as Error).message }; }

  // ⚠️ `target` = **包的 id**（账要回答得出「抽查的是哪一个包」）。`packContactSheet` 刚读过这份 manifest，
  //   所以这里解析不出来只可能是并发改盘 —— 读不到就退回目录名，别让记账挡住抽查。
  let packId: string;
  try { packId = (JSON.parse(fs.readFileSync(path.join(opts.packDir, "manifest.json"), "utf8")) as { id?: string }).id ?? path.basename(opts.packDir); }
  catch { packId = path.basename(opts.packDir); }

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
        // ⚠️ **两张都喂**（票 78 的 Q5 = (乙)）：**基准**在前、**被检查的对象**在后。
        reference,
        { type: "image", source: { type: "base64", media_type: "image/png", data: encodePNG(sheet).toString("base64") } },
        {
          type: "text",
          text: `上面两张图，**第一张是原图**（风格基准），**第二张是这套游戏资源的联系表**
（每一格是一个资源或动画的一帧）。下面是从那张原图里提取的风格规格。

${brief}

请**只描述你看到的差异**，列成条目：这套资源里哪些地方**不像**上面这个风格规格（也就是不像第一张原图）？
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
    if (!res.ok) return { ok: false, error: `视觉上游返回 HTTP ${res.status}`, call: record() };
    const j = (await res.json()) as {
      content?: { type: string; text?: string }[];
      usage?: { input_tokens?: unknown; output_tokens?: unknown };
    };
    usage = usageOf(j.usage);
    const raw = (j.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("").trim();
    const observations = raw.split("\n").map((l) => l.replace(/^[\s\-*\d.、)]+/, "").trim()).filter((l) => l.length > 1);
    return { ok: true, observations, raw, contactSheet: sheet, call: record() };
  } catch (e) {
    return { ok: false, error: `抽查失败（不阻断）：${(e as Error).message}`, call: record() };
  } finally { clearTimeout(timer); }
}

/**
 * 把一张**本地图**读成一个 image block。⚠️ 媒体类型**按扩展名**判、**不解析图片内容**
 * （票 08 的 R1-Q7）—— 白名单住 `contracts`（`STYLE_MEDIA_TYPES`），与 `analyze-reference` 是**同一份**。
 */
function imageBlockOf(p: string): Record<string, unknown> {
  const ext = path.extname(p).toLowerCase();
  const media = STYLE_MEDIA_TYPES[ext];
  if (media === undefined)
    throw new Error(`原图 ${p} 的扩展名 "${ext}" 不在白名单里（${Object.keys(STYLE_MEDIA_TYPES).join(" / ")}）` +
      " —— 我们**按扩展名**判媒体类型，不解析图片内容（票 08 的 R1-Q7）。");
  let bytes: Buffer;
  try { bytes = fs.readFileSync(p); } catch (e) { throw new Error(`原图读不出来：${p} —— ${(e as Error).message}`); }
  return { type: "image", source: { type: "base64", media_type: media, data: bytes.toString("base64") } };
}

/**
 * 上游自报的用量 —— 只搬认得的两个键。
 * ⚠️ **上游没给就整个 `usage` 缺席，不许填 0**（票 19：那等于把一个不知道的事说成知道的）。
 *   ⚠️ 也**不做单位换算**：账里只记 token 与张数这类事实，钱是它们的纯函数（票 19 的 Q7）。
 */
function usageOf(u: { input_tokens?: unknown; output_tokens?: unknown } | undefined): LedgerUsage | undefined {
  const out: LedgerUsage = {
    ...(typeof u?.input_tokens === "number" ? { inputTokens: u.input_tokens } : {}),
    ...(typeof u?.output_tokens === "number" ? { outputTokens: u.output_tokens } : {}),
  };
  return Object.keys(out).length === 0 ? undefined : out;
}
