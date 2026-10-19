// 测试用的**假上游**（票 15 的链要跑通，得有人替那五发文本调用答话）。
//
// ⚠️ **那几份骨架住在 `fixtures/upstream/canned.json`，不在这里**（票 16 挪的）：
//   两个包的测试都要它（`pipeline/tests` 与 `cli/tests`），而**跨包的 TS import 过不了 `rootDir`**
//   ——`tsc -p tsconfig.spec.json` 当场报 TS6059（试过，就是这条把一个越层 import 顶回来的）。
//   ⇒ 会漂的那部分（**骨架数据**）只有一处；**逻辑**（这十几行 fake）各包留一份，注释互指。
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { encodePNG } from "@game-maker/assets";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** 五份骨架 + 一份配置（**运行时读**，见文件头）。⚠️ 每一份都过得了自己的契约。 */
export const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as {
  /** ⚠️ **模型面向的那份 VWS 没有 `styleReferences`** —— 它是**调用方注入**的。 */
  visualWorld: Record<string, unknown>;
  intent: Record<string, unknown>;
  design: Record<string, unknown>;
  characterDna: Record<string, unknown>;
  gameConfig: Record<string, unknown>;
  recipe: Record<string, unknown>;
};

/** planner 会吐的那份清单（**不含 `characterRef`** —— 那一格由 pipeline 注入，票 15 的 Q13）。 */
export const recipeFor = (id: string): Record<string, unknown> => ({ ...CANNED.recipe, id });

const TOOL_INPUT: Record<string, unknown> = {
  emit_visual_world: CANNED.visualWorld, emit_game_intent: CANNED.intent, emit_game_design: CANNED.design,
  emit_character_dna: CANNED.characterDna, emit_game_config: CANNED.gameConfig,
};


/** 一张**合法**的假生图回应（v3 票 09 后 bg / 动画硬信号都走 image）。
 *
 * ⚠️ 按提示词分三种：动画分解图 → N 个分离色块；背景/层 → 整张纯色；单物体 → 纯色底 + 一个块。
 *   这不是判据，只是让 pack 的抠底/分块/量化走通。
 */
const imageReply = (body: Record<string, any>) => {
  const prompt = String(body?.contents?.[0]?.parts?.[0]?.text ?? "");
  const n = Number(/横向排开 \*\*(\d+) 个\*\*/.exec(prompt)?.[1] ?? 0);
  const anim = n > 0;
  const isBg = !anim && /背景|这一层|层\b/.test(prompt);
  const w = anim ? Math.max(512, n * 128 + 64) : 480;
  const h = anim || isBg ? 270 : 256;
  const data = Buffer.alloc(w * h * 4);
  const fill = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const s = (y * w + x) * 4; data[s] = c[0]; data[s + 1] = c[1]; data[s + 2] = c[2]; data[s + 3] = 255;
    }
  };
  fill(0, 0, w, h, isBg ? [90, 80, 70] : [255, 0, 255]);
  if (anim) {
    const bw = 64, gap = 64;
    for (let k = 0; k < n; k++) {
      const x0 = gap + k * (bw + gap);
      fill(x0, 50, x0 + bw, 220, [220, 220, 220]);
    }
  } else if (!isBg) fill(Math.floor(w / 3), Math.floor(h / 4), Math.floor((2 * w) / 3), Math.floor((3 * h) / 4), [220, 220, 220]);
  return { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: encodePNG({ width: w, height: h, data }).toString("base64") } }] } }] };
};

const json = (body: unknown, status = 200) =>
  ({ ok: status < 400, status, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

/** drawlist 那一支要的那段 JSON 文本（`pack` 里 `createDrawListGenerator` 读它）。
 *
 *  ⚠️ **帧数从提示词里数出来**（它逐帧列了「第 i 帧：…」）—— 数错了生成器会当场拒
 *  （「清单要 N 帧，模型给了 M 帧」），而那是**对的**，别去放宽它。
 *  ⚠️ 资产 **id 不出现在提示词里**（`assetTask` 给的是 `role` + `description`）⇒ 只能这么数。
 *  ⚠️ **画满整帧**（一个够大的矩形，rasterize 会裁到画布）：站点那一族判据里有一条
 *  「**最远那层必须画满**」（票 50）—— 返一个小矩形会让背景层只剩 0.2% 的像素，
 *  于是装配期当场硬失败，而那是**判据对、夹具错**。 */
const drawlistReply = (prompt: string) => {
  const n = Math.max(1, (prompt.match(/第 \d+ 帧：/g) ?? []).length);
  return {
    content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, () => ({ ops: [{ op: "rect", x: 0, y: 0, w: 4096, h: 4096, fill: "palette:0" }] })) }) }],
    model: "deepseek-flash", usage: { input_tokens: 100, output_tokens: 50 },
  };
};

export type UpstreamOptions = {
  /** 这一份清单的 id（planner 照它吐）—— 测试要它等于 run 目录名。 */
  recipeId: string;
  /** 前 N 次 `emit_game_design` 回一个**过不了 gate** 的设计（测「失败现场」用）。 */
  designFails?: number;
  /** 记下每一次请求的 body（断言「发出去的是什么」）。 */
  seen?: Record<string, unknown>[];
  /** 覆盖某一格 tool 的入参（例如把清单的 `id` 改掉）。 */
  override?: Record<string, unknown>;
};

/** 造一条假 `fetch`。⚠️ 它同时替文本与 drawlist 两路答话（生图那一支本夹具不涉及）。 */
export function fakeUpstream(opts: UpstreamOptions): typeof fetch {
  let designTrips = 0;
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    opts.seen?.push(body);
    // 生图那一支（v3 票 09 后 bg / 动画硬信号都走 image）
    if (body["generationConfig"] !== undefined) return json(imageReply(body));
    if (body["tools"] === undefined) {
      // drawlist 那一支（`content` 是**一个字符串**，与理解层那五发的块数组不同）
      const content = (body["messages"] as { content: unknown }[])[0]!.content;
      return json(drawlistReply(typeof content === "string" ? content : ""));
    }
    const name = (body["tool_choice"] as { name: string }).name;
    if (name === "emit_game_design" && opts.designFails !== undefined && designTrips < opts.designFails) {
      designTrips += 1;
      // ⚠️ 一个**过不了 gate** 的设计（空串）—— 这是「模型没干好」那一档，会重采样到底再抛
      const bad = { ...CANNED.design, world: { theme: "", setting: "", structure: "" } };
      return json({ content: [{ type: "tool_use", name, input: bad }], stop_reason: "tool_use", model: "deepseek-flash" });
    }
    const input = opts.override?.[name] ?? (name === "emit_asset_recipe" ? recipeFor(opts.recipeId) : TOOL_INPUT[name]);
    return json({
      content: [{ type: "tool_use", name, input }], stop_reason: "tool_use",
      model: "deepseek-flash", usage: { input_tokens: 1200, output_tokens: 900 },
    });
  }) as unknown as typeof fetch;
}

/** 一张真的小 PNG（参考图那一格要能解码）。 */
export function tinyPng(w = 8, h = 8): Buffer {
  // ⚠️ 票 04 之后参考图会被**确定性提色**：纯色图只能提出 1 色，而 canned 的 DNA/配方
  //   引用了 palette:0/1 ⇒ 会撞「越界」。四象限四色仍是很小的图，只用于跑通链路。
  const data = Buffer.alloc(w * h * 4);
  const colors = [[255, 0, 255], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, c = colors[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]!;
    data[s] = c[0]!; data[s + 1] = c[1]!; data[s + 2] = c[2]!; data[s + 3] = 255;
  }
  return encodePNG({ width: w, height: h, data });
}
