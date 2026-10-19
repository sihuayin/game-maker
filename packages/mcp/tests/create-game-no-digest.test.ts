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

/** 假上游：文本工具调用回骨架；drawlist 回整帧矩形；生图回一张分离色块 PNG（与 CLI 测试同款）。 */
function fakeUpstream(): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (body["generationConfig"] !== undefined) {
      // 与 CLI 测试同款：动画 → N 个分离色块；背景/层 → 纯色；单物体 → 纯色底 + 一个块。
      const prompt = String((body as any)?.contents?.[0]?.parts?.[0]?.text ?? "");
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
      const png = encodePNG({ width: w, height: h, data });
      return json({ candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png.toString("base64") } }] } }] });
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

    // ⚠️ MCP 把 `stylePath` 原样往下传；契约要求它**相对 cwd**（绝对路径会被 `analyzeReference` 拒）。
    const styleArg = path.relative(process.cwd(), style).split(path.sep).join("/");
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
