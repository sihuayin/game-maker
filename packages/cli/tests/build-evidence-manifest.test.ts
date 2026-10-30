// 票 07 / 票 13：`build-evidence-manifest` CLI 薄壳。
import crypto from "node:crypto";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { EXIT, QA_JUDGEMENTS, QA_REPORT_FORMAT, buildDeliveryReport } from "@game-maker/contracts";
import { run, type CliIo } from "../src/cli.js";

const dirs: string[] = [];
const tmp = (): string => { const d = mkdtempSync(path.join(tmpdir(), "gm-manifest-cli-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) rmSync(d, { recursive: true, force: true }); });
const capture = (): CliIo & { lines: string[]; errors: string[] } => {
  const lines: string[] = [], errors: string[] = [];
  return { lines, errors, out: (s) => lines.push(s), err: (s) => errors.push(s) };
};
const runC = (argv: string[]) => { const io = capture(); return run(argv, io).then((code) => ({ code, io })); };
const writeJson = (p: string, v: unknown) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const write = (p: string, s: string) => { mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, s); };
const sha = (p: string) => `sha256:${crypto.createHash("sha256").update(readFileSync(p)).digest("hex")}`;

function fixture(): { base: string; specPath: string; outPath: string } {
  const base = tmp();
  const out = path.join(base, "out");
  const game = path.join(out, "g");
  const manifestPath = path.join(game, "pack", "v1", "manifest.json");
  writeJson(manifestPath, { id: "g", version: 1, assets: [], files: [] });
  const configText = JSON.stringify({ format: "game-config/v1", entities: [] }, null, 2) + "\n";
  write(path.join(game, "run", "v1", "game-config.json"), configText);
  writeJson(path.join(game, "site", "v1", "site.json"), { shell: "2", pack: "v1", config: "game-config.json" });
  write(path.join(game, "site", "v1", "game-config.json"), configText);
  write(path.join(game, "site", "v1", "index.html"), "<html/>");
  write(path.join(game, "site", "v1", "shell.js"), "//\n");
  const subject = { packId: "g", packVersion: 1, siteVersion: 1, shellVersion: "2", manifestChecksum: sha(manifestPath), configChecksum: sha(path.join(game, "run", "v1", "game-config.json")) };
  const delivery = buildDeliveryReport({
    runId: "g/run/v1", pack: { packId: "g", packVersion: 1, manifestChecksum: subject.manifestChecksum },
    config: { file: "g/run/v1/game-config.json" }, site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass" },
  });
  writeJson(path.join(game, "run", "v1", "qa-report.json"), {
    format: QA_REPORT_FORMAT, subject: { packId: "g", packVersion: 1, manifestChecksum: subject.manifestChecksum },
    checked: [...QA_JUDGEMENTS], failures: [],
    observations: [{ source: "inspect", outcome: "ok", lines: [] }, { source: "review", outcome: "unavailable", reason: "fixture" }],
    delivery,
  });
  const specPath = path.join(base, "manifest", "spec.json");
  const outPath = path.join(base, "manifest", "expected.json");
  writeJson(specPath, {
    format: "delivery-evidence-manifest-spec/v1", subject, roots: { out: "../out" },
    entries: [{ kind: "dir", root: "out", path: "g", role: "delivery", required: true }],
    records: [{ root: "out", path: "g/run/v1/qa-report.json", role: "qa-report", required: true, identity: true }],
  });
  return { base, specPath, outPath };
}

describe("build-evidence-manifest（CLI）", () => {
  it("缺 --spec / --out → exit 2", async () => {
    const { specPath, outPath } = fixture();
    expect((await runC(["build-evidence-manifest", "--out", outPath])).code).toBe(EXIT.usage);
    expect((await runC(["build-evidence-manifest", "--spec", specPath])).code).toBe(EXIT.usage);
  });

  it("有效 spec → exit 0，清单落盘；默认不覆盖；--force 可重建", async () => {
    const { specPath, outPath } = fixture();
    const first = await runC(["build-evidence-manifest", "--spec", specPath, "--out", outPath]);
    expect(first.code).toBe(EXIT.ok);
    expect(existsSync(outPath)).toBe(true);
    const second = await runC(["build-evidence-manifest", "--spec", specPath, "--out", outPath]);
    expect(second.code).not.toBe(EXIT.ok);
    const forced = await runC(["build-evidence-manifest", "--spec", specPath, "--out", outPath, "--force"]);
    expect(forced.code).toBe(EXIT.ok);
  });

  it("--out 在 root 内 → 非 0", async () => {
    const { base, specPath } = fixture();
    const { code } = await runC(["build-evidence-manifest", "--spec", specPath, "--out", path.join(base, "out", "manifest.json")]);
    expect(code).not.toBe(EXIT.ok);
  });
});
