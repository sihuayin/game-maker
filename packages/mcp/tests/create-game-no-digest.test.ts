// v3 终端摘要的**反证**：MCP `create_game` 的文本与 structuredContent 都不出现新增摘要行。
// ⚠️ 这条测试跑一条**完整但离线**的 create_game 链（fake upstream + drawlist/image 假回应），
//   因为「MCP 输出不变」是行为，不是一句注释。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodePNG } from "@game-maker/assets";
import { handle } from "../src/server.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as Record<string, Record<string, unknown>>;
const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-mcp-digest-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const ENV_KEYS = [
  "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN",
  "GAME_MAKER_IMAGE_PROTOCOL", "GAME_MAKER_IMAGE_BASE_URL", "GAME_MAKER_IMAGE_API_KEY",
] as const;
const saved = new Map<string, string | undefined>();
beforeEach(() => {
  for (const k of ENV_KEYS) saved.set(k, process.env[k]);
});
afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = saved.get(k);
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  vi.unstubAllGlobals();
});

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;


/**
 * **按提示词里要求的比例出图**（票 04：像素阈值要求「源图 → 目标」长宽比一致）。
 *
 * ⚠️ 这是**测试夹具**在模仿一个守规矩的上游；生产链不经过这里。
 *   - 母版：`画布是 W×H 像素`；
 *   - 单物体 / 动画：`交付管线会把它两方向独立缩放到 W×H 像素`（动画分解图画布是 N 倍宽）；
 *   - 背景层：`画布长宽比必须精确是 W : H`。
 *   解析不到 ⇒ 回落到原来的固定尺寸（旧夹具的行为不变）。
 */
function targetSizeOf(prompt: string, n: number): { w: number; h: number } | undefined {
  const master = /画布是 (\d+)×(\d+) 像素/.exec(prompt);
  if (master) return { w: Number(master[1]), h: Number(master[2]) };
  const scaled = /交付管线会把它两方向独立缩放到 (\d+)×(\d+) 像素/.exec(prompt);
  if (scaled) return { w: Number(scaled[1]) * Math.max(1, n), h: Number(scaled[2]) };
  const ratio = /画布长宽比必须精确是 (\d+) : (\d+)/.exec(prompt);
  if (ratio) return { w: Number(ratio[1]), h: Number(ratio[2]) };
  return undefined;
}

/** 假上游：文本工具调用回骨架；drawlist 回整帧矩形；生图回一张分离色块 PNG（与 CLI 测试同款）。 */
function fakeUpstream(): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (body["response_format"] !== undefined || body["generationConfig"] !== undefined) {
      // 与 CLI 测试同款：动画 → N 个分离色块；背景/层 → 纯色；单物体 → 纯色底 + 一个块。
      const prompt = String((body as any)?.input?.[0]?.text ?? (body as any)?.contents?.[0]?.parts?.[0]?.text ?? "");
      const n = Number(/横向排开 \*\*(\d+) 个\*\*/.exec(prompt)?.[1] ?? 0);
      const anim = n > 0;
      const isBg = !anim && /背景|这一层|层\b/.test(prompt);
      const target = targetSizeOf(prompt, n) ?? { w: anim ? Math.max(512, n * 128 + 64) : 480, h: anim || isBg ? 270 : 256 };
      const k = Math.max(1, Math.floor(512 / Math.max(target.w, target.h)));
      const w = target.w * k, h = target.h * k;
      const data = Buffer.alloc(w * h * 4);
      const fill = (x0: number, y0: number, x1: number, y1: number, c: [number, number, number]) => {
        for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
          const s = (y * w + x) * 4; data[s] = c[0]; data[s + 1] = c[1]; data[s + 2] = c[2]; data[s + 3] = 255;
        }
      };
      fill(0, 0, w, h, isBg ? [90, 80, 70] : [255, 0, 255]);
      if (anim) {
        const slot = Math.floor(w / n);
        const bw = Math.max(1, Math.floor(slot * 0.5)), bh = Math.max(1, Math.floor(h * 0.6));
        const y0 = Math.floor(h * 0.2);
        for (let k = 0; k < n; k++) {
          const x0 = k * slot + Math.floor((slot - bw) / 2);
          fill(x0, y0, x0 + bw, y0 + bh, [220, 220, 220]);
        }
      } else if (!isBg) fill(Math.floor(w / 3), Math.floor(h / 4), Math.floor((2 * w) / 3), Math.floor((3 * h) / 4), [220, 220, 220]);
      const png = encodePNG({ width: w, height: h, data }).toString("base64");
      return json(body["response_format"] !== undefined
        ? { steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: png }] }] }
        : { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] });
    }
    if (body["tools"] !== undefined) {
      const TOOL: Record<string, unknown> = {
        emit_visual_world: CANNED["visualWorld"], emit_game_intent: CANNED["intent"],
        emit_game_design: CANNED["design"], emit_character_dna: CANNED["characterDna"],
        emit_game_config: CANNED["gameConfig"],
      };
      const name = (body["tool_choice"] as { name: string }).name;
      const input = name === "emit_asset_recipe" ? { ...(CANNED["recipe"]!), id: "wasteland" } : TOOL[name];
      return json({ content: [{ type: "tool_use", name, input }], stop_reason: "tool_use", model: "deepseek-flash", usage: { input_tokens: 1, output_tokens: 1 } });
    }
    const content = (body["messages"] as { content: unknown }[])[0]!.content;
    const text = typeof content === "string" ? content : "";
    const n = Math.max(1, (text.match(/第 \d+ 帧：/g) ?? []).length);
    return json({ content: [{ type: "text", text: JSON.stringify({ frames: Array.from({ length: n }, () => ({ ops: [{ op: "rect", x: 0, y: 0, w: 4096, h: 4096, fill: "palette:0" }] })) }) }], model: "deepseek-flash" });
  }) as unknown as typeof fetch;
}

const tinyPng = (): Buffer => {
  // ⚠️ 票 04 之后参考图会被**确定性提色**：纯色图只能提出 1 色，而 canned 的 DNA/配方
  //   引用了 palette:0/1 ⇒ 会撞「越界」。四象限四色仍是很小的图，只用于跑通链路。
  const w = 8, h = 8, data = Buffer.alloc(w * h * 4);
  const colors = [[255, 0, 255], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, c = colors[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]!;
    data[s] = c[0]!; data[s + 1] = c[1]!; data[s + 2] = c[2]!; data[s + 3] = 255;
  }
  return encodePNG({ width: w, height: h, data });
};

describe("§v3 终端摘要 · MCP 输出不变", () => {
  it("create_game 的 content 与 structuredContent 都不出现摘要行", async () => {
    process.env.ANTHROPIC_BASE_URL = "http://up.test";
    process.env.ANTHROPIC_AUTH_TOKEN = "k";
    process.env.GAME_MAKER_IMAGE_PROTOCOL = "gemini";
    process.env.GAME_MAKER_IMAGE_BASE_URL = "http://up.test";
    process.env.GAME_MAKER_IMAGE_API_KEY = "k";
    vi.stubGlobal("fetch", fakeUpstream());

    const cwd = tmp();
    const style = path.join(cwd, "style.png");
    const intent = path.join(cwd, "需求.md");
    fs.writeFileSync(style, tinyPng());
    fs.writeFileSync(intent, "做一个废土横版寻宝游戏\n");
    const outDir = path.join(cwd, "out");

    // ⚠️ **票 02（P0-06）之后 MCP 自己做相对化**（与 CLI 的 `styleRefOf` 同一处实现）：
    //   agent 给绝对路径是常态，这里直接给绝对路径 —— 它必须成功。
    const styleArg = style;
    const out: any[] = [];
    await handle({
      jsonrpc: "2.0", id: 9, method: "tools/call",
      params: { name: "create_game", arguments: { stylePath: styleArg, intent, outDir } },
    } as never, (x) => out.push(x));

    const r = out.find((x) => x.id === 9)!;
    expect(r.result.isError, JSON.stringify(r)).not.toBe(true);
    // 报告里 inspect 观察确实 ok（摘要**本可以**出现）—— 但 MCP 的两个出口都没有它
    const qa = JSON.parse(fs.readFileSync(path.join(outDir, "wasteland", "run", "v1", "qa-report.json"), "utf8")) as {
      observations: { source: string; outcome: string }[];
    };
    expect(qa.observations.find((o) => o.source === "inspect")!.outcome).toBe("ok");
    expect(r.result.content[0].text).not.toMatch(/资源观察摘要/);
    expect(r.result.structuredContent.summary.join("\n")).not.toMatch(/资源观察摘要/);
    expect(r.result.structuredContent.data.inspectData).toBeUndefined();
  });
});
