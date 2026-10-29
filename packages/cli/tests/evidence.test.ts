// `verify-delivery` CLI 薄壳（票 05）：参数、`--out` 越界、退出码、报告落盘。
// 完整 pass 路径由 `pnpm test:evidence` 对冻结基线跑；这里用最小清单覆盖壳层边界。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { afterEach, describe, expect, it } from "vitest";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });

const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const sha = (p: string) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");

function makeMinimal(): { dir: string; delivery: string; manifestPath: string; outDir: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-delivery-cli-"));
  dirs.push(dir);
  const delivery = path.join(dir, "delivery");
  fs.mkdirSync(delivery, { recursive: true });
  fs.writeFileSync(path.join(delivery, "a.json"), "{}\n");
  const manifestPath = path.join(dir, "manifest", "expected.json");
  fs.mkdirSync(path.dirname(manifestPath), { recursive: true });
  fs.writeFileSync(manifestPath, JSON.stringify({
    format: "delivery-evidence-manifest/v1",
    generatedAt: "2026-10-29T00:00:00.000Z",
    subject: {
      packId: "fixture", packVersion: 1, siteVersion: 1, shellVersion: "1",
      manifestChecksum: "sha256:" + "a".repeat(64), configChecksum: "sha256:" + "b".repeat(64),
    },
    roots: { delivery: "../delivery" },
    files: [{
      root: "delivery", path: "a.json", role: "fixture", required: true,
      bytes: fs.statSync(path.join(delivery, "a.json")).size, sha256: sha(path.join(delivery, "a.json")),
    }],
    records: [],
  }, null, 2) + "\n");
  return { dir, delivery, manifestPath, outDir: path.join(dir, "out") };
}

const reportDirs = (outDir: string): string[] => fs.existsSync(outDir)
  ? fs.readdirSync(outDir).filter((n) => n.endsWith("-delivery-verification"))
  : [];

describe("verify-delivery CLI", () => {
  it("缺 --manifest ⇒ usage 2", async () => {
    const { code } = await runC(["verify-delivery"]);
    expect(code).toBe(2);
  });

  it("清单读不出 / 不过 schema ⇒ invalid 4", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "verify-delivery-cli-"));
    dirs.push(dir);
    const bad = path.join(dir, "bad.json");
    fs.writeFileSync(bad, "{ not json");
    const { code } = await runC(["verify-delivery", "--manifest", bad, "--out", path.join(dir, "out")]);
    expect(code).toBe(4);
    expect(fs.existsSync(path.join(dir, "out"))).toBe(false);
  });

  it("--out 位于声明 root 内 ⇒ usage 2，且不写任何东西", async () => {
    const fx = makeMinimal();
    const inside = path.join(fx.delivery, "out");
    const { code, io } = await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", inside]);
    expect(code).toBe(2);
    expect(io.errors.join("")).toContain("--out 不能位于证据 root 内");
    expect(fs.existsSync(inside)).toBe(false);
  });

  it("必需证据通过、六项前置缺失 ⇒ blocked 1，报告仍落盘", async () => {
    const fx = makeMinimal();
    const { code, io } = await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", fx.outDir]);
    expect(code).toBe(1);
    const dirs = reportDirs(fx.outDir);
    expect(dirs.length).toBe(1);
    const dir = path.join(fx.outDir, dirs[0]!);
    const report = JSON.parse(fs.readFileSync(path.join(dir, "report.json"), "utf8"));
    expect(report.status).toBe("blocked");
    expect(report.exitCode).toBe(1);
    expect(fs.existsSync(path.join(dir, "report.md"))).toBe(true);
    expect(io.lines.join("")).toContain("证据完整性验收：blocked");
  });

  it("内容篡改 ⇒ fail 1，报告落盘且可定位", async () => {
    const fx = makeMinimal();
    fs.writeFileSync(path.join(fx.delivery, "a.json"), "{ tampered }\n");
    const { code } = await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", fx.outDir]);
    expect(code).toBe(1);
    const dirs = reportDirs(fx.outDir);
    const report = JSON.parse(fs.readFileSync(path.join(fx.outDir, dirs[0]!, "report.json"), "utf8"));
    expect(report.status).toBe("fail");
    expect(report.results.files.find((f: { path: string }) => f.path === "a.json").status).toBe("hash-mismatch");
  });

  it("重复运行的报告目录不覆盖", async () => {
    const fx = makeMinimal();
    await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", fx.outDir]);
    await new Promise((r) => setTimeout(r, 5));
    await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", fx.outDir]);
    expect(reportDirs(fx.outDir).length).toBe(2);
  });
});
