import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";

export function sha256Text(text) {
  return "sha256:" + crypto.createHash("sha256").update(text).digest("hex");
}

export function writeText(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, text);
}

export function writeJson(p, value) {
  writeText(p, JSON.stringify(value, null, 2) + "\n");
}

export function updateLog(sha, { baselineId, omit = [] } = {}) {
  const fields = [
    ["reason", "initial freeze"],
    ["subject", "pack v1 / site v1 / shell 2"],
    ["oldSha256", "none (initial freeze)"],
    ["newSha256", sha],
    ["evidence", "test fixture"],
    ["verifiedBy", "test"],
    ["recordedIn", "test"],
  ];
  const lines = fields.filter(([k]) => !omit.includes(k)).map(([k, v]) => `- ${k}: ${v}`);
  if (baselineId !== undefined) lines.push(`- baselineId: ${baselineId}`);
  return `# MANIFEST-UPDATES\n\n## 2026-11-01 · freeze test baseline\n\n${lines.join("\n")}\n`;
}

export function makeFixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "p0-04-registry-"));
  const subject = {
    packId: "pack",
    packVersion: 1,
    siteVersion: 1,
    shellVersion: "2",
    manifestChecksum: "sha256:" + "1".repeat(64),
    configChecksum: "sha256:" + "2".repeat(64),
  };
  const aManifest = {
    format: "delivery-evidence-manifest/v1",
    generatedAt: "2026-11-01T00:00:00.000Z",
    subject,
    roots: { out: "work" },
    files: [{ root: "out", path: "a.txt", role: "delivery", required: true, bytes: 5, sha256: sha256Text("hello") }],
    records: [],
  };
  const bManifest = {
    format: "delivery-evidence-manifest/v1",
    generatedAt: "2026-11-01T00:00:00.000Z",
    subject,
    roots: { out: "../freeze" },
    files: [{ root: "out", path: "pack/a.txt", role: "delivery", required: true, bytes: 5, sha256: sha256Text("hello") }],
    records: [],
  };
  const aManifestText = JSON.stringify(aManifest, null, 2) + "\n";
  const bManifestText = JSON.stringify(bManifest, null, 2) + "\n";
  const aSha = sha256Text(aManifestText);
  const bSha = sha256Text(bManifestText);
  const aDir = path.join(root, ".scratch/a/manifest");
  const bDir = path.join(root, ".scratch/b/manifest");
  writeText(path.join(aDir, "expected-hashes.json"), aManifestText);
  writeText(path.join(aDir, "expected-hashes.sha256"), aSha + "\n");
  writeText(path.join(aDir, "MANIFEST-UPDATES.md"), updateLog(aSha));
  writeText(path.join(bDir, "final-manifest.json"), bManifestText);
  writeText(path.join(bDir, "expected-hashes.sha256"), bSha + "\n");
  writeText(path.join(bDir, "MANIFEST-UPDATES.md"), updateLog(bSha, { baselineId: "p0-02-second-demo-v2" }));
  writeText(path.join(root, ".scratch/a/work/a.txt"), "hello");
  writeText(path.join(root, ".scratch/b/freeze/pack/a.txt"), "hello");
  const freezeHash = sha256Text("hello").slice("sha256:".length);
  writeText(path.join(root, ".scratch/b/freeze-sha256.txt"), `${freezeHash}  a.txt\n`);
  const registry = {
    format: "baseline-registry/v1",
    baselines: [
      {
        id: "fpvs-v1",
        name: "FPVS-V1",
        manifestFormat: "delivery-evidence-manifest/v1",
        manifest: ".scratch/a/manifest/expected-hashes.json",
        anchor: ".scratch/a/manifest/expected-hashes.sha256",
        updateLog: ".scratch/a/manifest/MANIFEST-UPDATES.md",
        identity: { packId: "pack", packVersion: 1, siteVersion: 1, shellVersion: "2" },
      },
      {
        id: "p0-02-second-demo-v2",
        name: "P0-02 Second Demo V2",
        manifestFormat: "delivery-evidence-manifest/v1",
        manifest: ".scratch/b/manifest/final-manifest.json",
        anchor: ".scratch/b/manifest/expected-hashes.sha256",
        updateLog: ".scratch/b/manifest/MANIFEST-UPDATES.md",
        freezeHashes: ".scratch/b/freeze-sha256.txt",
        identity: { packId: "pack", packVersion: 1, siteVersion: 1, shellVersion: "2" },
      },
    ],
  };
  const registryPath = path.join(root, ".scratch/baselines/registry.json");
  writeJson(registryPath, registry);
  return {
    root, registry, registryPath, subject,
    aManifestPath: path.join(aDir, "expected-hashes.json"),
    aAnchorPath: path.join(aDir, "expected-hashes.sha256"),
    aLogPath: path.join(aDir, "MANIFEST-UPDATES.md"),
    bManifestPath: path.join(bDir, "final-manifest.json"),
    bAnchorPath: path.join(bDir, "expected-hashes.sha256"),
    bLogPath: path.join(bDir, "MANIFEST-UPDATES.md"),
    freezeHashesPath: path.join(root, ".scratch/b/freeze-sha256.txt"),
    aManifestSha: aSha,
    bManifestSha: bSha,
    aManifestText,
    bManifestText,
  };
}

export function expectCode(fn, code) {
  try {
    fn();
  } catch (e) {
    if (e?.code !== code) throw new Error(`expected code ${code}, got ${e?.code}: ${e?.message}`);
    return;
  }
  throw new Error(`expected ${code}, but no error was thrown`);
}
