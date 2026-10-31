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

describe("verify-delivery CLI trust anchor（P0-03-01）", () => {
  const readNewestReport = (outDir: string): Record<string, unknown> => {
    const dirs = reportDirs(outDir);
    expect(dirs.length).toBe(1);
    return JSON.parse(fs.readFileSync(path.join(outDir, dirs[0]!, "report.json"), "utf8"));
  };

  it("--expected-manifest-sha 匹配 ⇒ trust.anchor=matched，报告记录", async () => {
    const fx = makeMinimal();
    const digest = sha(fx.manifestPath);
    const { code } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath, "--expected-manifest-sha", digest, "--out", fx.outDir,
    ]);
    expect(code).toBe(1); // 最小 fixture 的六项前置缺失 ⇒ blocked；锚点匹配不改变它
    const report = readNewestReport(fx.outDir);
    expect(report.trust).toMatchObject({ mode: "digest", source: "cli", expectedSha256: digest, result: "matched" });
  });

  it("摘要不匹配 ⇒ fail + anchor.manifest-digest", async () => {
    const fx = makeMinimal();
    const { code } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath,
      "--expected-manifest-sha", "sha256:" + "f".repeat(64), "--out", fx.outDir,
    ]);
    expect(code).toBe(1);
    const report = readNewestReport(fx.outDir);
    expect(report.status).toBe("fail");
    expect(report.trust).toMatchObject({ result: "mismatch" });
    expect((report.diagnostics as Array<{ rule: string }>).some((d) => d.rule === "anchor.manifest-digest")).toBe(true);
  });

  it("摘要格式错 ⇒ usage 2，且不写报告", async () => {
    const fx = makeMinimal();
    const { code, io } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath, "--expected-manifest-sha", "deadbeef", "--out", fx.outDir,
    ]);
    expect(code).toBe(2);
    expect(io.errors.join("")).toContain("--expected-manifest-sha");
    expect(fs.existsSync(fx.outDir)).toBe(false);
  });

  it("--base-manifest 没有摘要 ⇒ usage 2", async () => {
    const fx = makeMinimal();
    const base = path.join(fx.dir, "base.json");
    fs.copyFileSync(fx.manifestPath, base);
    const { code } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath, "--base-manifest", base, "--out", fx.outDir,
    ]);
    expect(code).toBe(2);
    expect(fs.existsSync(fx.outDir)).toBe(false);
  });

  it("--base-manifest 字节一致 ⇒ digest+base matched", async () => {
    const fx = makeMinimal();
    const digest = sha(fx.manifestPath);
    const base = path.join(fx.dir, "base.json");
    fs.copyFileSync(fx.manifestPath, base);
    const { code } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath, "--expected-manifest-sha", digest,
      "--base-manifest", base, "--out", fx.outDir,
    ]);
    expect(code).toBe(1);
    const report = readNewestReport(fx.outDir);
    expect(report.trust).toMatchObject({
      mode: "digest+base", result: "matched", baseManifest: { sha256: digest, byteEqual: true },
    });
  });
});

describe("N15（P0-03-02）", () => {
  it("重复文件清单 ⇒ invalid 4，且不写报告", async () => {
    const fx = makeMinimal();
    const manifest = JSON.parse(fs.readFileSync(fx.manifestPath, "utf8"));
    manifest.files.push({ ...manifest.files[0] });
    fs.writeFileSync(fx.manifestPath, JSON.stringify(manifest, null, 2) + "\n");
    const { code } = await runC(["verify-delivery", "--manifest", fx.manifestPath, "--out", fx.outDir]);
    expect(code).toBe(4);
    expect(fs.existsSync(fx.outDir)).toBe(false);
  });
});

describe("verify-delivery CLI baseline-update anchor mode（P0-03-05）", () => {
  const newest = (outDir: string): Record<string, unknown> => {
    const dirs = reportDirs(outDir);
    expect(dirs.length).toBe(1);
    return JSON.parse(fs.readFileSync(path.join(outDir, dirs[0]!, "report.json"), "utf8"));
  };
  it("--anchor-mode baseline-update ⇒ trust.mode=baseline-update", async () => {
    const fx = makeMinimal();
    const digest = sha(fx.manifestPath);
    const { code } = await runC([
      "verify-delivery", "--manifest", fx.manifestPath,
      "--expected-manifest-sha", digest, "--anchor-mode", "baseline-update", "--out", fx.outDir,
    ]);
    expect(code).toBe(1); // 最小 fixture 六项前置缺失；锚点匹配不改变 blocked
    const report = newest(fx.outDir);
    expect(report.trust).toMatchObject({ mode: "baseline-update", result: "matched" });
  });
});
