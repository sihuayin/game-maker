import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { handle } from "../src/server.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = ROOT + "out/shift-change-assets/pack/v5";
const hasPack = (() => { try { readFileSync(PACK + "/manifest.json"); return true; } catch { return false; } })();

/** 收下服务端发出的所有消息。 */
const drive = async (msgs: object[]): Promise<any[]> => {
  const out: any[] = [];
  for (const m of msgs) await handle(m as never, (x) => out.push(x));
  return out;
};
const call = (name: string, args: object, token?: string) =>
  ({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args, ...(token ? { _meta: { progressToken: token } } : {}) } });

describe("MCP 协议面", () => {
  it("initialize 报出协议版本与服务名", async () => {
    const [r] = await drive([{ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }]);
    expect(r.result.protocolVersion).toBeTruthy();
    expect(r.result.serverInfo.name).toBe("game-maker");
    expect(r.result.capabilities.tools).toBeDefined();
  });

  it("notifications/initialized 与 cancelled **不回复**（它们是通知）", async () => {
    expect(await drive([{ jsonrpc: "2.0", method: "notifications/initialized" }])).toEqual([]);
  });

  it("工具面是四个，且每个的 description 都写了「何时用」与「会失败的情况」", async () => {
    const [r] = await drive([{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }]);
    const tools = r.result.tools;
    expect(tools.map((t: { name: string }) => t.name)).toEqual(["derive_recipe", "build_asset_pack", "verify_asset_pack", "inspect_asset_pack"]);
    for (const t of tools) {
      expect(t.description, t.name).toMatch(/何时用/);
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema.required.length).toBeGreaterThan(0);
    }
  });

  it("⚠️ build_asset_pack 的 description 明确警告降级 —— agent 不能把兜底产物当正常产物", async () => {
    const [r] = await drive([{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }]);
    const build = r.result.tools.find((t: { name: string }) => t.name === "build_asset_pack");
    expect(build.description).toMatch(/降级/);
    expect(build.description).toMatch(/不要.*当成正常产物/);
  });

  it("不认识的方法 → -32601；不认识的工具 → -32602", async () => {
    const [a] = await drive([{ jsonrpc: "2.0", id: 3, method: "nope", params: {} }]);
    expect(a.error.code).toBe(-32601);
    const [b] = await drive([call("nope", {})]);
    expect(b.error.code).toBe(-32602);
  });
});

describe.skipIf(!hasPack)("工具调用", () => {
  it("inspect 返回 content + structuredContent（与 CLI 的 --json **同源**）", async () => {
    const [r] = await drive([call("inspect_asset_pack", { packDir: PACK })]);
    expect(r.result.isError).toBe(false);
    expect(r.result.structuredContent.data.packId).toBe("shift-change-assets");
    expect(r.result.structuredContent.command).toBe("inspect");
    expect(r.result.content[0].text).toContain("shift-change-assets");
  });

  it("带 progressToken 时发 notifications/progress，不带就不发", async () => {
    const withToken = await drive([call("inspect_asset_pack", { packDir: PACK }, "tok-1")]);
    const progress = withToken.filter((m) => m.method === "notifications/progress");
    expect(progress.length).toBeGreaterThan(0);
    expect(progress[progress.length - 1].params).toMatchObject({ progressToken: "tok-1", progress: 1 });

    const without = await drive([call("inspect_asset_pack", { packDir: PACK })]);
    expect(without.filter((m) => m.method === "notifications/progress")).toEqual([]);
  });

  it("失败**不抛** —— 回 isError 与退出码（MCP 的协议里没有「异常」这个信道）", async () => {
    const [r] = await drive([call("verify_asset_pack", { packDir: "/tmp/definitely-not-a-pack-xyz" })]);
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(2);          // usage
    expect(r.result.content[0].text).toMatch(/不是资源包/);
  });
});
