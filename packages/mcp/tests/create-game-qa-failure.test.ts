// MCP `create_game` 的 QA 失败路径（P0-02b · 票 09）。
//
// ⚠️ 真链、离线、零付费：假上游把拾取物摆到跳不到的高度 ⇒ `reachability` 报 error。
//   要钉的是**发布语义**：报错、退 4、**站点不产**、而报告**照样在盘**（它是诊断）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { encodePNG } from "@game-maker/assets";
import { handle } from "../src/server.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const CANNED = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/upstream/canned.json"), "utf8")) as Record<string, Record<string, unknown>>;

const dirs: string[] = [];
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-mcp-qa-failure-"));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const ENV_KEYS = [
  "ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN",
  "GAME_MAKER_IMAGE_PROTOCOL", "GAME_MAKER_IMAGE_BASE_URL", "GAME_MAKER_IMAGE_API_KEY",
] as const;
const saved = new Map<string, string | undefined>();
beforeEach(() => { for (const k of ENV_KEYS) saved.set(k, process.env[k]); });
afterEach(() => {
  for (const k of ENV_KEYS) {
    const v = saved.get(k);
    if (v === undefined) delete process.env[k]; else process.env[k] = v;
  }
  vi.unstubAllGlobals();
});

const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

/** 与 `create-game-no-digest.test.ts` 同款；**唯一区别**：`emit_game_config` 返回一份不可达的配置。 */
function fakeUpstream(): typeof fetch {
  return (async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    if (body["response_format"] !== undefined || body["generationConfig"] !== undefined) {
      const prompt = String((body as any)?.input?.[0]?.text ?? (body as any)?.contents?.[0]?.parts?.[0]?.text ?? "");
      const n = Number(/横向排开 \*\*(\d+) 个\*\*/.exec(prompt)?.[1] ?? 0);
      const anim = n > 0;
      const isBg = !anim && /背景|这一层|层\b/.test(prompt);
      const master = /画布是 (\d+)×(\d+) 像素/.exec(prompt);
      const scaled = /交付管线会把它两方向独立缩放到 (\d+)×(\d+) 像素/.exec(prompt);
      const ratio = /画布长宽比必须精确是 (\d+) : (\d+)/.exec(prompt);
      const target = master
        ? { w: Number(master[1]), h: Number(master[2]) }
        : scaled ? { w: Number(scaled[1]) * Math.max(1, n), h: Number(scaled[2]) }
          : ratio ? { w: Number(ratio[1]), h: Number(ratio[2]) }
            : { w: anim ? Math.max(512, n * 128 + 64) : 480, h: anim || isBg ? 270 : 256 };
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
        for (let i = 0; i < n; i++) {
          const x0 = i * slot + Math.floor((slot - bw) / 2);
          fill(x0, y0, x0 + bw, y0 + bh, [220, 220, 220]);
        }
      } else if (!isBg) fill(Math.floor(w / 3), Math.floor(h / 4), Math.floor((2 * w) / 3), Math.floor((3 * h) / 4), [220, 220, 220]);
      const png = encodePNG({ width: w, height: h, data }).toString("base64");
      return json(body["response_format"] !== undefined
        ? { steps: [{ type: "model_output", content: [{ type: "image", mime_type: "image/png", data: png }] }] }
        : { candidates: [{ content: { parts: [{ inlineData: { mimeType: "image/png", data: png } }] } }] });
    }
    if (body["tools"] !== undefined) {
      const bad = structuredClone(CANNED["gameConfig"]!) as { entities: { id: string; at: { x: number; y: number } }[] };
      bad.entities.find((e) => e.id === "e-pickup-1")!.at = { x: 120, y: 60 };
      const TOOL: Record<string, unknown> = {
        emit_visual_world: CANNED["visualWorld"], emit_game_intent: CANNED["intent"],
        emit_game_design: CANNED["design"], emit_character_dna: CANNED["characterDna"],
        emit_game_config: bad,
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
  const w = 8, h = 8, data = Buffer.alloc(w * h * 4);
  const colors = [[255, 0, 255], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, c = colors[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]!;
    data[s] = c[0]!; data[s + 1] = c[1]!; data[s + 2] = c[2]!; data[s + 3] = 255;
  }
  return encodePNG({ width: w, height: h, data });
};

describe("§MCP create_game：QA 失败 ⇒ 退 4、站点不产、报告在盘", () => {
  it("reachability error 挡住发布", async () => {
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

    const out: any[] = [];
    await handle({
      jsonrpc: "2.0", id: 9, method: "tools/call",
      params: { name: "create_game", arguments: { stylePath: style, intent, outDir } },
    } as never, (x) => out.push(x));

    const r = out.find((x) => x.id === 9)!;
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(4);
    expect(r.result.content[0].text).toMatch(/QA 判据没过/);
    expect(r.result.content[0].text).toMatch(/\[reachability\]/);

    // ⚠️ **站点不产**，而报告**在盘**（诊断先落盘，再阻断）
    expect(fs.existsSync(path.join(outDir, "wasteland", "site"))).toBe(false);
    const report = JSON.parse(fs.readFileSync(path.join(outDir, "wasteland", "run", "v1", "qa-report.json"), "utf8")) as {
      checked: string[];
      failures: { judgement: string; severity: string }[];
      subject?: { packId: string; packVersion: number };
    };
    expect(report.failures).toContainEqual(expect.objectContaining({ judgement: "reachability", severity: "error" }));
    expect(report.checked).toContain("reachability");
    expect(report.subject).toMatchObject({ packId: "wasteland", packVersion: 1 });
  }, 120_000);
});
