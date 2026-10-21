import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { ASSET_PACK_FORMAT, parseAnimationAcceptance } from "@game-maker/contracts";
import { handle } from "../src/server.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

/** 一份包是不是**用当前契约构建的**。 */
const isCurrent = (dir: string) => {
  try { return JSON.parse(readFileSync(dir + "/manifest.json", "utf8")).format === ASSET_PACK_FORMAT; }
  catch { return false; }
};

// ⚠️ 不写死版本号（同 cli.test.ts 的理由）
const SCRATCH = (() => {
  const base = ROOT + "out/shift-change-assets/pack";
  try {
    const vs = readdirSync(base).map((d) => /^v(\d+)$/.exec(d)).filter((m) => m !== null).map((m) => Number(m![1])).sort((a, b) => b - a);
    return vs.length > 0 ? `${base}/v${vs[0]}` : `${base}/v0`;
  } catch { return `${base}/v0`; }
})();

// ⚠️ **门槛与回落与 `cli.test.ts` 同一条**（2026-10-13 · 票 45）：`out/` 是本机垃圾场
//   （`.gitignore:10`），包逐版新增、永不覆盖 ⇒ 契约一升版，本机最近那份当场变成**旧契约**的包
//   （实测：v1 ⇒ `inspect` 按契约拒 → `isError`）。本机那份又**不会自己变新**（重建=花钱）
//   ⇒ 回落到入库的 `fixtures/packs/counter-siege/v4`（真包、真 checksum、清检出上也在）。
const PACK = isCurrent(SCRATCH) ? SCRATCH : ROOT + "fixtures/packs/counter-siege/v4";
// ⚠️ 留着这层 skip 只是**兜底**（fixture 被挪走/删了）—— 正常路径下它**不再是**那扇门。
const hasPack = isCurrent(PACK);
// ⚠️ **期望的 id 从**被选中那份包自己**的 manifest 读**（2026-10-13 · 票 45）：
//   原先写死 `"shift-change-assets"`（本机那一次真跑的名字），换成回落之后那句话就是**假**的。
//   而这条判据要说的本来是「**MCP 把包的 id 原样带出来**」，不是「那个包叫什么」——
//   从 manifest 读反而**更贴原意**，也让「本机那份 / fixture 那份」两路共存。
const PACK_ID = (() => {
  try { return JSON.parse(readFileSync(PACK + "/manifest.json", "utf8")).id as string; }
  catch { return ""; }
})();

/** 收下服务端发出的所有消息。 */
const drive = async (msgs: object[]): Promise<any[]> => {
  const out: any[] = [];
  for (const m of msgs) await handle(m as never, (x) => out.push(x));
  return out;
};
const call = (name: string, args: object, token?: string) =>
  ({ jsonrpc: "2.0", id: 9, method: "tools/call", params: { name, arguments: args, ...(token ? { _meta: { progressToken: token } } : {}) } });

/** 验收用的真实输入（与 `packages/assets/tests/acceptance.test.ts` 同一份）。 */
const V7 = path.join(ROOT, ".scratch/asset-integration-v1/runs/2026-10-20f-lurker/ruin-scavenger-extraction-assets/pack/v7");
const BASELINE = path.join(ROOT, "fixtures/animation-baselines/scavenger-idle");
const SIEGE = path.join(ROOT, "fixtures/packs/counter-siege/v4");

const dirs: string[] = [];
const tmp = (tag: string): string => {
  const d = mkdtempSync(path.join(tmpdir(), `mcp-accept-${tag}-`));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });

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

  it("工具面是八个，且每个的 description 都写了「何时用」与「会失败的情况」", async () => {
    // ⚠️ 票 30 落地时是**四个**；票 33 加了 `assemble_site`（装配）；票 49 加了 `compile_game`
    //   （需求 → 配置）。后两个合起来才是 R6 那条「一段需求 → 打开即玩」的完整入口。
    //   ⚠️ **票 16 加了 `create_game`** —— 它才是那条 R6 入口的**字面兑现**（一步到底），
    //   而前两个留在这里是因为「想在生图之前看一眼清单」那条路仍然要它们。
    //   ⚠️ **Phase 1 票 07 加了 `accept_asset_pack`**（结构验收，与 CLI `accept` 共用 core）。
    const [r] = await drive([{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }]);
    const tools = r.result.tools;
    expect(tools.map((t: { name: string }) => t.name)).toEqual(
      ["plan_assets", "build_asset_pack", "verify_asset_pack", "accept_asset_pack", "create_game", "inspect_asset_pack", "compile_runtime", "assemble_site"]);
    for (const t of tools) {
      expect(t.description, t.name).toMatch(/何时用/);
      expect(t.inputSchema.type).toBe("object");
      expect(t.inputSchema.required.length).toBeGreaterThan(0);
    }
  });

  it("⚠️ build_asset_pack 的 description 说明**没有兜底** —— 上游不可达就是失败，不是降级", async () => {
    const [r] = await drive([{ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} }]);
    const build = r.result.tools.find((t: { name: string }) => t.name === "build_asset_pack");
    expect(build.description).toMatch(/没有兜底/);
    expect(build.description).toMatch(/退出码 3/);
    expect(build.description).not.toMatch(/降级链是自动的/);
  });

  it("不认识的方法 → -32601；不认识的工具 → -32602", async () => {
    const [a] = await drive([{ jsonrpc: "2.0", id: 3, method: "nope", params: {} }]);
    expect(a.error.code).toBe(-32601);
    const [b] = await drive([call("nope", {})]);
    expect(b.error.code).toBe(-32602);
  });
});

describe("accept_asset_pack（与 CLI 共用同一份验收 core）", () => {
  it("v7 + baseline：结构全绿，报告落盘且 structuredContent 与报告同源", async () => {
    const outDir = tmp("v7");
    const [r] = await drive([call("accept_asset_pack", { packDir: V7, baselineDir: BASELINE, outDir })]);
    expect(r.result.isError).toBe(false);
    expect(r.result._exitCode).toBeUndefined();

    const sc = r.result.structuredContent;
    expect(sc.command).toBe("accept");
    expect(sc.data).toMatchObject({
      packId: "ruin-scavenger-extraction-assets",
      packVersion: 7,
      baselineId: "scavenger-actor.idle.v7.2026-10-19",
      hasErrors: false,
      findings: { total: 0, errors: 0, warnings: 0, info: 0 },
      reportVersion: 1,
    });
    expect(sc.data.report).toBe("ruin-scavenger-extraction-assets/acceptance/v1/report.json");
    expect(sc.data.reportMarkdown).toBe("ruin-scavenger-extraction-assets/acceptance/v1/report.md");

    // 报告真的落盘，且就是 `acceptAnimationPack` 生产的那一份（不是壳里另拼的文案）。
    const jsonPath = path.join(outDir, sc.data.report);
    expect(existsSync(jsonPath)).toBe(true);
    expect(existsSync(path.join(outDir, sc.data.reportMarkdown))).toBe(true);
    const parsed = parseAnimationAcceptance(JSON.parse(readFileSync(jsonPath, "utf8")));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.value.baseline?.id).toBe(sc.data.baselineId);
      const idle = parsed.value.animations.find((a) => a.assetId === "scavenger-actor" && a.anim === "idle");
      expect(idle?.metrics).not.toBeNull();
    }
    expect(r.result.content[0].text).toContain("结构验收");
    expect(r.result.content[0].text).toContain(sc.data.report);
  }, 120_000);

  it("有 error findings：仍返回结构化报告，但 isError + _exitCode 1", async () => {
    // 复制一份真包，从图集 JSON 里删掉一个 manifest 声明过的帧，并把 manifest 里
    // `files[]` 的 meta checksum 同步改掉：`verifyPack` 照常通过，缺帧落进 findings
    // （而不是被判成「输入不合法」）。
    const packDir = path.join(tmp("findings"), "pack");
    cpSync(SIEGE, packDir, { recursive: true });
    const manifestPath = path.join(packDir, "manifest.json");
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    const asset = manifest.assets.find((a: { frames?: unknown[] }) => (a.frames?.length ?? 0) > 0);
    const atlas = manifest.atlases.find((a: { id: string }) => a.id === asset.atlasId);
    const frameName = asset.frames[0].name;
    const metaPath = path.join(packDir, atlas.meta);
    const atlasJson = JSON.parse(readFileSync(metaPath, "utf8"));
    delete atlasJson.frames[frameName];
    writeFileSync(metaPath, JSON.stringify(atlasJson, null, 2) + "\n");
    const sha = (buf: Buffer): string => "sha256:" + createHash("sha256").update(buf).digest("hex");
    for (const f of manifest.files) {
      if (f.path !== atlas.meta) continue;
      const buf = readFileSync(path.join(packDir, f.path));
      f.bytes = buf.length;
      f.checksum = sha(buf);
    }
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2) + "\n");

    const outDir = tmp("findings-out");
    const [r] = await drive([call("accept_asset_pack", { packDir, outDir })]);
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(1);

    const sc = r.result.structuredContent;
    expect(sc.command).toBe("accept");
    expect(sc.data.hasErrors).toBe(true);
    expect(sc.data.findings.errors).toBeGreaterThan(0);
    expect(sc.data.report).toMatch(/\/acceptance\/v1\/report\.json$/);

    const parsed = parseAnimationAcceptance(JSON.parse(readFileSync(path.join(outDir, sc.data.report), "utf8")));
    expect(parsed.ok).toBe(true);
    if (parsed.ok)
      expect(parsed.value.findings.some((f) => f.code === "atlas.frame.missing" && f.severity === "error")).toBe(true);
    expect(r.result.content[0].text).toMatch(/error findings/);
  });

  it("坏包：core 抛 invalid → 走现有 catch，_exitCode 4（不写报告）", async () => {
    const packDir = tmp("bad-pack");
    writeFileSync(path.join(packDir, "manifest.json"), "{}");
    const outDir = tmp("bad-out");
    const [r] = await drive([call("accept_asset_pack", { packDir, outDir })]);
    expect(r.result.isError).toBe(true);
    expect(r.result._exitCode).toBe(4);
    expect(r.result.content[0].text).toMatch(/^✗ /);
    expect(r.result.structuredContent).toBeUndefined();
    expect(readdirSync(outDir)).toEqual([]);
  });
});

describe.skipIf(!hasPack)("工具调用", () => {
  it("inspect 返回 content + structuredContent（与 CLI 的 --json **同源**）", async () => {
    const [r] = await drive([call("inspect_asset_pack", { packDir: PACK })]);
    expect(r.result.isError).toBe(false);
    expect(r.result.structuredContent.data.packId).toBe(PACK_ID);
    expect(r.result.structuredContent.command).toBe("inspect");
    expect(r.result.content[0].text).toContain(PACK_ID);
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
