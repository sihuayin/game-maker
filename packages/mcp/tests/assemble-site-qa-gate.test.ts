// MCP `assemble_site` 的发布闸（P0-02b · 票 09）：与 CLI 同一把闸、同一套结果。
//
// ⚠️ 离线、零付费：包与配置用入库 fixture，报告在临时目录里手写。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { QA_JUDGEMENTS, QA_REPORT_FORMAT } from "@game-maker/contracts";
import { manifestChecksumOf } from "@game-maker/pipeline";
import { handle } from "../src/server.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");
const ID = "last-train";

const dirs: string[] = [];
const tmp = (tag: string): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `gm-mcp-site-gate-${tag}-`));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const shellOf = (d: string): string => {
  const p = path.join(d, "shell.js");
  fs.writeFileSync(p, "// shell stub\n");
  return p;
};

const OBSERVATIONS = [
  { source: "inspect", outcome: "ok", lines: [] },
  { source: "review", outcome: "unavailable", reason: "测试：没配视觉上游" },
];

const report = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  format: QA_REPORT_FORMAT,
  checked: [...QA_JUDGEMENTS],
  failures: [],
  observations: OBSERVATIONS,
  subject: { packId: ID, packVersion: 2, manifestChecksum: manifestChecksumOf(PACK) },
  ...over,
});

function writeReport(outRoot: string, body: Record<string, unknown>, runVersion = 1): string {
  const dir = path.join(outRoot, ID, "run", `v${runVersion}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "qa-report.json");
  fs.writeFileSync(p, JSON.stringify(body, null, 2) + "\n");
  return p;
}

const siteDir = (out: string) => path.join(out, ID, "site");

async function assembleSite(args: Record<string, unknown>): Promise<any> {
  const out: any[] = [];
  await handle({
    jsonrpc: "2.0", id: 9, method: "tools/call",
    params: { name: "assemble_site", arguments: args },
  } as never, (x) => out.push(x));
  return out.find((x) => x.id === 9)!.result;
}

describe("§拒绝：缺报告 / 旧包 / error / incomplete", () => {
  it("缺报告 ⇒ isError、退 4、站点不产", async () => {
    const d = tmp("missing");
    const out = path.join(d, "out");
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out });
    expect(r.isError).toBe(true);
    expect(r._exitCode).toBe(4);
    expect(r.content[0].text).toMatch(/找不到属于当前包的 QA 报告/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("旧包（subject 不匹配）⇒ 拒", async () => {
    const d = tmp("old");
    const out = path.join(d, "out");
    const rp = writeReport(d, report({ subject: { packId: ID, packVersion: 1, manifestChecksum: manifestChecksumOf(PACK) } }));
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out, qaReportPath: rp });
    expect(r.isError).toBe(true);
    expect(r._exitCode).toBe(4);
    expect(r.content[0].text).toMatch(/报告属于/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("error ⇒ 拒", async () => {
    const d = tmp("error");
    const out = path.join(d, "out");
    writeReport(out, report({
      failures: [{ judgement: "reachability", target: "e-pickup-1", detail: "跳不到", severity: "error" }],
    }));
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out });
    expect(r.isError).toBe(true);
    expect(r._exitCode).toBe(4);
    expect(r.content[0].text).toMatch(/QA 判据没过/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("incomplete（模拟一条 runner 没跑）⇒ 拒", async () => {
    const d = tmp("incomplete");
    const out = path.join(d, "out");
    writeReport(out, report({ checked: QA_JUDGEMENTS.filter((j) => j !== "layer-coverage") }));
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out });
    expect(r.isError).toBe(true);
    expect(r._exitCode).toBe(4);
    expect(r.content[0].text).toMatch(/QA 没跑全/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });
});

describe("§放行：六条全跑、无 error", () => {
  it("规范 out 树自动查找 ⇒ 产站点", async () => {
    const d = tmp("green");
    const out = path.join(d, "out");
    writeReport(out, report());
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out });
    expect(r.isError).not.toBe(true);
    expect(r._exitCode).toBeUndefined();
    expect(r.structuredContent.data.siteDir).toBe(`${ID}/site/v1`);
    expect(fs.existsSync(path.join(siteDir(out), "v1", "index.html"))).toBe(true);
  });

  it("显式 qaReportPath（out 树之外）", async () => {
    const d = tmp("explicit");
    const out = path.join(d, "out");
    const rp = writeReport(path.join(d, "elsewhere"), report());
    const r = await assembleSite({ packDir: PACK, configPath: CONFIG, shellPath: shellOf(d), outDir: out, qaReportPath: rp });
    expect(r.isError).not.toBe(true);
    expect(fs.existsSync(path.join(siteDir(out), "v1"))).toBe(true);
  });
});
