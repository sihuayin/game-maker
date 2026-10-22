// 发布闸的**入口级**测试（P0-02b · 票 09）：任何发布路径都不能在缺 QA / error /
// incomplete 时产出 `site/v<N>`。
//
// ⚠️ 全部离线、零付费：包与配置用入库 fixture（只读），报告在临时目录里手写。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { QA_JUDGEMENTS, QA_REPORT_FORMAT } from "@game-maker/contracts";
import { manifestChecksumOf } from "@game-maker/pipeline";
import { EXIT } from "@game-maker/assets";
import { run, type CliIo } from "../src/cli.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");
const TD_PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const TD_CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const ID = "last-train";

const dirs: string[] = [];
const tmp = (tag: string): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), `gm-cli-site-gate-${tag}-`));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};

/** 一个站点装配只要「文件在」的 shell 替身。 */
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

/** 跑一次 `site --json`，返回退出码与解析后的 JSON。 */
async function site(argv: string[]): Promise<{ code: number; doc: { error?: string; data?: Record<string, unknown> } }> {
  const io = capture();
  const code = await run(["site", ...argv, "--json"], io);
  const raw = io.lines.join("");
  return { code, doc: raw === "" ? {} : JSON.parse(raw) as { error?: string; data?: Record<string, unknown> } };
}

describe("§拒绝：缺报告 / 旧包 / error / incomplete ⇒ 退 4、站点不产", () => {
  it("缺报告", async () => {
    const d = tmp("missing");
    const out = path.join(d, "out");
    const { code, doc } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.invalid);
    expect(doc.error).toMatch(/找不到属于当前包的 QA 报告/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("旧 pack（subject 不匹配）：显式报告也必须验身份", async () => {
    const d = tmp("old");
    const out = path.join(d, "out");
    const rp = writeReport(d, report({ subject: { packId: ID, packVersion: 1, manifestChecksum: manifestChecksumOf(PACK) } }));
    const { code, doc } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out, "--qa-report", rp]);
    expect(code).toBe(EXIT.invalid);
    expect(doc.error).toMatch(/报告属于/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("error", async () => {
    const d = tmp("error");
    const out = path.join(d, "out");
    writeReport(out, report({
      failures: [{ judgement: "reachability", target: "e-pickup-1", detail: "跳不到", severity: "error" }],
    }));
    const { code, doc } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.invalid);
    expect(doc.error).toMatch(/QA 判据没过/);
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });

  it("⚠️ incomplete：删掉一条判据（模拟 runner 不跑）⇒ 拒", async () => {
    const d = tmp("incomplete");
    const out = path.join(d, "out");
    writeReport(out, report({ checked: QA_JUDGEMENTS.filter((j) => j !== "layer-coverage") }));
    const { code, doc } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.invalid);
    expect(doc.error).toMatch(/QA 没跑全/);
    expect(doc.error).toContain("layer-coverage");
    expect(fs.existsSync(siteDir(out))).toBe(false);
  });
});

describe("§放行：干净包全绿 ⇒ 产站点；warning 不阻断", () => {
  it("规范 out 树自动查找报告", async () => {
    const d = tmp("green");
    const out = path.join(d, "out");
    writeReport(out, report());
    const { code, doc } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.ok);
    expect(doc.data?.["siteDir"]).toBe(`${ID}/site/v1`);
    expect(fs.existsSync(path.join(siteDir(out), "v1", "index.html"))).toBe(true);
  });

  it("warning 不阻断", async () => {
    const d = tmp("warning");
    const out = path.join(d, "out");
    writeReport(out, report({
      failures: [{ judgement: "palette-binding", target: "hero", detail: "只是警告", severity: "warning" }],
    }));
    const { code } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.ok);
    expect(fs.existsSync(path.join(siteDir(out), "v1"))).toBe(true);
  });

  it("显式 `--qa-report`：报告在 out 树之外（C 只定位，身份仍验）", async () => {
    const d = tmp("explicit");
    const out = path.join(d, "out");
    const rp = writeReport(path.join(d, "elsewhere"), report());
    const { code } = await site([PACK, "--config", CONFIG, "--shell", shellOf(d), "--out", out, "--qa-report", rp]);
    expect(code).toBe(EXIT.ok);
    expect(fs.existsSync(path.join(siteDir(out), "v1"))).toBe(true);
  });

  it("⚠️ TD（td-config/v1）显式跳过闸门（P2）—— 没有报告也能装配", async () => {
    const d = tmp("td");
    const out = path.join(d, "out");
    const { code } = await site([TD_PACK, "--config", TD_CONFIG, "--shell", shellOf(d), "--out", out]);
    expect(code).toBe(EXIT.ok);
    expect(fs.existsSync(path.join(out, "counter-siege", "site", "v1"))).toBe(true);
  });
});
