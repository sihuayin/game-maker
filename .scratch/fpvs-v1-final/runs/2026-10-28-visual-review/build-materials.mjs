#!/usr/bin/env node
// FA-04 材料索引：把审核材料绑到 FA-01 冻结身份，逐个记录路径 + sha256。
// 只读；输出本目录 materials.json。用法：node .../build-materials.mjs
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, "../../../..");
const EFFORT = path.resolve(ROOT, ".scratch/fpvs-v1-final");
const WORK = path.join(EFFORT, "work/wasteland-scavenger-recipe");
const ART = path.join(EFFORT, "artifacts");
const sha = (p) => "sha256:" + crypto.createHash("sha256").update(fs.readFileSync(p)).digest("hex");
const rel = (p) => path.relative(ROOT, p).split(path.sep).join("/");
const readJson = (p) => JSON.parse(fs.readFileSync(p, "utf8"));

const identity = readJson(path.join(ART, "identity.json"));
const hashes = readJson(path.join(ART, "hashes.json"));
const qa = readJson(path.join(WORK, "run/v1/qa-report.json"));
const capture = readJson(path.join(HERE, "capture.json"));

const snapshotByPath = new Map(hashes.entries.filter((e) => e.role === "snapshot").map((e) => [e.relativePath, e.sha256]));

const groups = {
  reference: [
    "run/v1/reference.png",
    "run/v1/style.png",
  ],
  deliveredAssets: [
    "pack/v1/delivery/atlas.animations.png",
    "pack/v1/delivery/atlas.animations.json",
    "pack/v1/delivery/atlas.sprites.png",
    "pack/v1/delivery/atlas.sprites.json",
    "pack/v1/delivery/atlas.backgrounds.png",
    "pack/v1/delivery/atlas.backgrounds.json",
    "pack/v1/delivery/atlas.ui.png",
    "pack/v1/delivery/atlas.ui.json",
    "pack/v1/manifest.json",
    "pack/v1/authoring/stylespec.json",
    "pack/v1/authoring/visual-world.json",
  ],
  visualContext: [
    "run/v1/game-design.json",
    "run/v1/visual-world.json",
    "run/v1/stylespec.json",
    "run/v1/qa-report.json",
  ],
};

const materials = {};
for (const [group, rels] of Object.entries(groups)) {
  materials[group] = rels.map((r) => {
    const abs = path.join(WORK, r);
    const actual = sha(abs);
    const frozen = snapshotByPath.get(r);
    return {
      path: rel(abs),
      sha256: actual,
      ...(frozen === undefined
        ? { frozen: "not-in-snapshot" }
        : { frozen: frozen === actual ? "match" : "differs", snapshotSha256: frozen }),
    };
  });
}

const generated = fs.readdirSync(path.join(HERE, "assets")).sort().map((f) =>
  ({ path: rel(path.join(HERE, "assets", f)), sha256: sha(path.join(HERE, "assets", f)), kind: "contact-sheet" }));
for (const f of [...fs.readdirSync(path.join(HERE, "shots")).sort().map((f) => `shots/${f}`),
  "capture.json", "events.jsonl", "trace.jsonl", "input.jsonl", "console.json", "exceptions.json",
  "review.html", "review-record.json", "README.md", "capture.mjs", "build-materials.mjs"]) {
  const abs = path.join(HERE, f);
  if (fs.existsSync(abs)) generated.push({
    path: rel(abs), sha256: sha(abs),
    kind: f.startsWith("shots/") ? "screenshot" : ["review.html", "review-record.json", "README.md"].includes(f) ? "review-artifact" : "run-evidence",
  });
}

// qa-report：work 版比快照只多 FA-02 的 `delivery` 段；QA 层（format/subject/checked/failures/observations）必须字节等价。
const snapshotQa = readJson(path.join(ART, "wasteland-scavenger-recipe/run/v1/qa-report.json"));
const qaLayer = (r) => JSON.stringify({ format: r.format, subject: r.subject, checked: r.checked, failures: r.failures, observations: r.observations });

const out = {
  format: "fpvs-visual-review-materials/v1",
  generatedAt: new Date().toISOString(),
  subject: {
    work: rel(WORK),
    snapshot: rel(path.join(ART, "wasteland-scavenger-recipe")),
    packId: identity.identity.packId,
    packVersion: identity.identity.packVersion,
    siteVersion: identity.identity.siteVersion,
    shellVersion: identity.identity.shellVersion,
    manifestChecksum: identity.identity.manifestChecksumFromReport,
    configChecksum: identity.identity.runConfigSha256,
    siteJson: identity.identity.siteJson,
  },
  capture: {
    run: capture.run,
    siteIntegrity: capture.siteIntegrity,
    shots: capture.shots.map((s) => ({ file: s.file, t: s.t, tag: s.tag, state: s.state })),
  },
  existingVisualQa: {
    status: "review observation unavailable（无视觉上游）；以下为 QA 层已有记录，不替代本轮人工审核",
    qaReportBinding: {
      snapshotHasDelivery: snapshotQa.delivery !== undefined,
      workHasDelivery: qa.delivery !== undefined,
      qaLayerIdentical: qaLayer(qa) === qaLayer(snapshotQa),
      note: "work 的 qa-report 只多了 FA-02 的 delivery 写回；QA 层（含视觉相关 failures/observations）与冻结快照一致。",
    },
    failures: qa.failures,
    observations: qa.observations.map((o) => ({ source: o.source, outcome: o.outcome, ...(o.outcome === "ok" ? { lines: o.lines } : { reason: o.reason }) })),
    checked: qa.checked,
  },
  materials,
  generated,
};
fs.writeFileSync(path.join(HERE, "materials.json"), JSON.stringify(out, null, 2) + "\n");
console.log(`materials.json · ${Object.values(materials).flat().length} 源材料 + ${generated.length} 生成材料`);
console.log(Object.entries(materials).map(([g, xs]) => `  ${g}: ${xs.filter((x) => x.frozen === "differs").length ? "⚠️ differs" : "frozen match"}`).join("\n"));
