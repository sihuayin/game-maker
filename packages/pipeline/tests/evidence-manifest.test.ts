// 票 07 / 票 13：spec → delivery-evidence-manifest/v1 的生成核心。
import crypto from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  QA_JUDGEMENTS, QA_REPORT_FORMAT, buildDeliveryReport,
} from "@game-maker/contracts";
import { buildEvidenceManifest } from "../src/evidence-manifest.js";

const dirs: string[] = [];
afterEach(() => { for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true }); });
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-manifest-")); dirs.push(d); return d; };
const writeJson = (p: string, v: unknown) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, JSON.stringify(v, null, 2) + "\n"); };
const write = (p: string, s: string) => { fs.mkdirSync(path.dirname(p), { recursive: true }); fs.writeFileSync(p, s); };
const sha = (p: string) => `sha256:${crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex")}`;

function fixture(): { base: string; specPath: string; outPath: string; subject: Record<string, unknown> } {
  const base = tmp();
  const out = path.join(base, "out");
  const game = path.join(out, "g");
  const manifestPath = path.join(game, "pack", "v1", "manifest.json");
  writeJson(manifestPath, { id: "g", version: 1, assets: [], files: [] });
  const configText = JSON.stringify({ format: "game-config/v1", entities: [], terrain: [], objective: { kind: "collect-then-reach", gate: "g" } }, null, 2) + "\n";
  write(path.join(game, "run", "v1", "game-config.json"), configText);
  write(path.join(game, "site", "v1", "game-config.json"), configText);
  writeJson(path.join(game, "site", "v1", "site.json"), { shell: "2", pack: "v1", config: "game-config.json" });
  write(path.join(game, "site", "v1", "index.html"), "<html>fixture</html>");
  write(path.join(game, "site", "v1", "shell.js"), "// fixture\n");
  const manifestChecksum = sha(manifestPath);
  const configChecksum = sha(path.join(game, "run", "v1", "game-config.json"));
  const subject = { packId: "g", packVersion: 1, siteVersion: 1, shellVersion: "2", manifestChecksum, configChecksum };
  const delivery = buildDeliveryReport({
    runId: "g/run/v1",
    pack: { packId: "g", packVersion: 1, manifestChecksum },
    config: { file: "g/run/v1/game-config.json" },
    site: { version: 1, shell: "2" },
    checks: [
      { key: "asset-pack", status: "pass" }, { key: "config", status: "pass" }, { key: "qa", status: "pass" },
      { key: "site", status: "pass" }, { key: "playable-smoke", status: "pass" }, { key: "visual-review", status: "pass" },
    ],
    visualReview: { status: "pass" },
  });
  writeJson(path.join(game, "run", "v1", "qa-report.json"), {
    format: QA_REPORT_FORMAT,
    subject: { packId: "g", packVersion: 1, manifestChecksum },
    checked: [...QA_JUDGEMENTS],
    failures: [],
    observations: [
      { source: "inspect", outcome: "ok", lines: [] },
      { source: "review", outcome: "unavailable", reason: "fixture" },
    ],
    delivery,
  });
  writeJson(path.join(game, "run", "v1", "mechanic-coverage.json"), {
    format: "mechanic-coverage/v2", subject, mechanics: [],
    probe: { executed: true, ranAt: "2026-10-30T00:00:00.000Z", results: [] }, verdict: "satisfied",
  });
  write(path.join(base, "extras", "note.txt"), "extra\n");
  write(path.join(base, "empty", ".keep"), "");
  const specDir = path.join(base, "manifest");
  const specPath = path.join(specDir, "spec.json");
  const outPath = path.join(specDir, "expected.json");
  writeJson(specPath, {
    format: "delivery-evidence-manifest-spec/v1",
    subject,
    roots: { out: "../out", extras: "../extras" },
    entries: [
      { kind: "dir", root: "out", path: "g", role: "delivery", required: true },
      { kind: "file", root: "extras", path: "note.txt", role: "fixture", required: false },
    ],
    records: [
      { root: "out", path: "g/run/v1/qa-report.json", role: "qa-report", required: true, identity: true },
      { root: "out", path: "g/run/v1/mechanic-coverage.json", role: "mechanic-coverage", required: true, identity: true },
    ],
    generatedBy: "test",
  });
  return { base, specPath, outPath, subject };
}

describe("buildEvidenceManifest（票 07 / 票 13）", () => {
  it("展开目录 + 显式文件：确定性排序、sha256/bytes、roots 相对清单目录", () => {
    const fx = fixture();
    const r = buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath });
    expect(r.files).toBeGreaterThan(5);
    expect(r.records).toBe(2);
    const keys = r.manifest.files.map((f) => `${f.root}:${f.path}`);
    expect(keys).toEqual([...keys].sort((a, b) => a.split(":")[0]!.localeCompare(b.split(":")[0]!) || a.split(":")[1]!.localeCompare(b.split(":")[1]!)));
    expect(r.manifest.roots.out).toBe("../out");
    expect(r.manifest.roots.extras).toBe("../extras");
    const qa = r.manifest.files.find((f) => f.path.endsWith("qa-report.json"))!;
    expect(qa.sha256).toBe(sha(path.join(fx.base, "out/g/run/v1/qa-report.json")));
    expect(qa.bytes).toBe(fs.statSync(path.join(fx.base, "out/g/run/v1/qa-report.json")).size);
    expect(r.manifest.subject).toMatchObject(fx.subject);
    expect(fs.existsSync(fx.outPath)).toBe(true);
    expect(fs.readdirSync(path.dirname(fx.outPath)).filter((n) => n.includes(".tmp"))).toEqual([]);
  });

  it("默认拒绝覆盖；--force 才重建", () => {
    const fx = fixture();
    buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath });
    expect(() => buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath })).toThrow(/拒绝覆盖/);
    expect(() => buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath, force: true })).not.toThrow();
  });

  it("缺文件 / record 不在 files / 目录为空 / subject 不符 ⇒ invalid", () => {
    const fx = fixture();
    const spec = JSON.parse(fs.readFileSync(fx.specPath, "utf8"));
    const run = (mut: (s: Record<string, unknown>) => void) => {
      const copy = JSON.parse(JSON.stringify(spec));
      mut(copy);
      const p = path.join(fx.base, "manifest", `bad-${Math.random().toString(36).slice(2)}.json`);
      writeJson(p, copy);
      expect(() => buildEvidenceManifest({ specPath: p, outPath: path.join(fx.base, "manifest", `o-${Math.random().toString(36).slice(2)}.json`) })).toThrow();
    };
    run((s) => { (s.entries as Array<Record<string, unknown>>).push({ kind: "file", root: "out", path: "g/nope.json", role: "x", required: true }); });
    run((s) => { (s.records as Array<Record<string, unknown>>)[0]!.path = "g/nope.json"; });
    run((s) => { (s.entries as Array<Record<string, unknown>>).push({ kind: "dir", root: "out", path: "g/site/v1", role: "x", required: true, excludeExt: ["", ".html", ".js", ".json"] }); });
    run((s) => { (s.subject as Record<string, unknown>).configChecksum = "sha256:" + "f".repeat(64); });
  });

  it("--out 落在声明 root 内 ⇒ 拒绝", () => {
    const fx = fixture();
    expect(() => buildEvidenceManifest({ specPath: fx.specPath, outPath: path.join(fx.base, "out", "manifest.json") })).toThrow();
  });

  it("确定性：两次 force 生成的 files/roots/records/subject 相同", () => {
    const fx = fixture();
    const a = buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath });
    const b = buildEvidenceManifest({ specPath: fx.specPath, outPath: fx.outPath, force: true });
    expect(b.manifest.files).toEqual(a.manifest.files);
    expect(b.manifest.roots).toEqual(a.manifest.roots);
    expect(b.manifest.records).toEqual(a.manifest.records);
    expect(b.manifest.subject).toEqual(a.manifest.subject);
  });
});
