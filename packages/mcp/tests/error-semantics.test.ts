// 票 02（P0-06）· **MCP 的错误语义与 CLI 同一张表**（CAP-ENTRY-01）。
//
// ⚠️ 病根：设计拒绝（`DesignRejectedError` 带 `rejections`）与上游失败（带 `failure`）**不是**
//   `CommandError`，不翻译就被 `exitCodeOfError` 认成「我们的 bug」退 1。
//   CLI 早就在 `asCommandError` 里翻译了（票 16 的 Q3(b)），MCP 没有 —— 同一个失败两个壳两个码。
//   本票把翻译搬进 `contracts`，两个壳共用；这里钉 MCP 的三档：4 / 3 / 2。
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
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-mcp-err-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const ENV_KEYS = ["ANTHROPIC_BASE_URL", "ANTHROPIC_AUTH_TOKEN"] as const;
const saved = new Map<string, string | undefined>();
beforeEach(() => { for (const k of ENV_KEYS) saved.set(k, process.env[k]); });
afterEach(() => {
  for (const k of ENV_KEYS) { const v = saved.get(k); if (v === undefined) delete process.env[k]; else process.env[k] = v; }
  vi.unstubAllGlobals();
});

const tinyPng = (): Buffer => {
  const w = 8, h = 8, data = Buffer.alloc(w * h * 4);
  const colors = [[255, 0, 255], [0, 255, 0], [0, 0, 255], [255, 255, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const s = (y * w + x) * 4, c = colors[(y < h / 2 ? 0 : 2) + (x < w / 2 ? 0 : 1)]!;
    data[s] = c[0]!; data[s + 1] = c[1]!; data[s + 2] = c[2]!; data[s + 3] = 255;
  }
  return encodePNG({ width: w, height: h, data });
};
const json = (body: unknown) => ({ ok: true, status: 200, json: async () => body, text: async () => JSON.stringify(body) }) as Response;

/** 假上游：三发文本工具调用回骨架；`design` 可被替换（R12 的拒绝要靠它）。 */
const fakeUpstream = (design: Record<string, unknown>): typeof fetch =>
  (async (_u: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body)) as Record<string, unknown>;
    const name = (body["tool_choice"] as { name: string }).name;
    const TOOL: Record<string, unknown> = {
      emit_visual_world: CANNED["visualWorld"], emit_game_intent: CANNED["intent"],
      emit_game_design: design, emit_character_dna: CANNED["characterDna"],
      emit_game_config: CANNED["gameConfig"],
    };
    const input = name === "emit_asset_recipe" ? { ...(CANNED["recipe"]!), id: "wasteland" } : TOOL[name];
    return json({ content: [{ type: "tool_use", name, input }], stop_reason: "tool_use", model: "m", usage: { input_tokens: 1, output_tokens: 1 } });
  }) as unknown as typeof fetch;

const call = (name: string, args: Record<string, unknown>) => ({
  jsonrpc: "2.0" as const, id: 1, method: "tools/call", params: { name, arguments: args },
});
const drive = async (msg: unknown): Promise<any[]> => {
  const out: any[] = [];
  await handle(msg as never, (x) => out.push(x));
  return out;
};

const env = () => {
  process.env.ANTHROPIC_BASE_URL = "http://up.test";
  process.env.ANTHROPIC_AUTH_TOKEN = "k";
};
const files = () => {
  const cwd = tmp();
  const style = path.join(cwd, "style.png");
  const intent = path.join(cwd, "需求.md");
  fs.writeFileSync(style, tinyPng());
  fs.writeFileSync(intent, "做一个废土横版寻宝游戏\n");
  return { cwd, style, intent, outDir: path.join(cwd, "out") };
};

describe("§MCP 错误码与 CLI 同一张表（票 02）", () => {
  it("设计拒绝（R12 的 `rejections`）⇒ `_exitCode=4`，不是 1", async () => {
    env();
    // 设计过得了 schema，但**漏了意图层的实体** e-drone（R12 的意图覆盖）——
    // 连关卡里的引用一起清掉，免得先死在「悬空引用」那条 schema 判据上。
    const design = structuredClone(CANNED["design"]!) as {
      enemies: unknown[]; levels: { entities: string[] }[];
    };
    design.enemies = [];
    design.levels = design.levels.map((l) => ({ ...l, entities: l.entities.filter((x) => x !== "e-drone") }));
    vi.stubGlobal("fetch", fakeUpstream(design as unknown as Record<string, unknown>));

    const f = files();
    // ⚠️ 顺带给绝对路径的 `stylePath` 一条正向证据（票 02 的第三项）：MCP 自己相对化。
    const [r] = await drive(call("create_game", { stylePath: f.style, intent: f.intent, outDir: f.outDir }));
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode, r.result.content[0].text).toBe(4);
    expect(r.result.content[0].text).toMatch(/设计做不出来|R12/);
  });

  it("上游 HTTP 失败 ⇒ `_exitCode=3`，不是 1", async () => {
    env();
    vi.stubGlobal("fetch", (async () => new Response("boom", { status: 500 })) as unknown as typeof fetch);
    const f = files();
    const [r] = await drive(call("create_game", { stylePath: f.style, intent: f.intent, outDir: f.outDir }));
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(3);
  });

  it("usage（不是资源包）⇒ `_exitCode=2`", async () => {
    const empty = tmp();
    const [r] = await drive(call("verify_asset_pack", { packDir: empty }));
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(2);
  });
});
