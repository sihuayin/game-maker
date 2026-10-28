#!/usr/bin/env node
// FA-01 冻结验收对象：只读快照 + 可写工作区 + 身份记录 + 字节哈希清单。
// 只读源与历史产物；不改 packages/、fixtures/、game-maker.local.json。
// 用法：node .scratch/fpvs-v1-final/freeze.mjs [--force]
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const FORCE = process.argv.includes('--force');
const ROOT = path.resolve('.');
const EFFORT = path.join(ROOT, '.scratch/fpvs-v1-final');
const SOURCE = path.join(ROOT, '.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe');
const SNAPSHOT = path.join(EFFORT, 'artifacts/wasteland-scavenger-recipe');
const REFERENCE = path.join(EFFORT, 'artifacts/reference');
const WORK = path.join(EFFORT, 'work/wasteland-scavenger-recipe');
const PLAYTEST_REF = path.join(ROOT, '.scratch/playtest-v1/runs/2026-10-27-acceptance/artifacts/wasteland-scavenger-recipe/run/v1/playtest/v1');
const PRIOR_DELIVERY_REF = path.join(ROOT, '.scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json');

function die(msg) { console.error(`freeze: ${msg}`); process.exit(1); }
function sha256(file) { return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex'); }
function rel(p, base) { return path.relative(base, p).split(path.sep).join('/'); }
function listFiles(dir, base = dir) {
  const out = [];
  for (const name of fs.readdirSync(dir).sort()) {
    const p = path.join(dir, name);
    const st = fs.lstatSync(p);
    if (st.isDirectory()) out.push(...listFiles(p, base));
    else if (st.isFile()) out.push(rel(p, base));
    else die(`unsupported entry: ${p}`);
  }
  return out;
}
function hashTree(dir) {
  const m = new Map();
  for (const r of listFiles(dir)) m.set(r, { bytes: fs.statSync(path.join(dir, r)).size, sha256: sha256(path.join(dir, r)) });
  return m;
}
function compare(a, b, label) {
  const mismatches = [];
  const keys = new Set([...a.keys(), ...b.keys()]);
  for (const k of [...keys].sort()) {
    const x = a.get(k), y = b.get(k);
    if (!x || !y) mismatches.push({ relativePath: k, reason: !x ? 'missing-in-left' : 'missing-in-right' });
    else if (x.sha256 !== y.sha256 || x.bytes !== y.bytes) mismatches.push({ relativePath: k, reason: 'bytes-differ' });
  }
  return { label, same: mismatches.length === 0, checkedLeft: a.size, checkedRight: b.size, mismatches };
}
function isReadOnly(dir) {
  const offenders = [];
  (function walk(p) {
    const st = fs.statSync(p);
    if ((st.mode & 0o222) !== 0) offenders.push(rel(p, dir) || '.');
    if (st.isDirectory()) for (const n of fs.readdirSync(p)) walk(path.join(p, n));
  })(dir);
  return { readOnly: offenders.length === 0, writableEntries: offenders.slice(0, 20), writableCount: offenders.length };
}
function ensureEmptyOrForce(dir) {
  if (!fs.existsSync(dir)) return;
  const entries = fs.readdirSync(dir);
  if (entries.length === 0) return;
  if (!FORCE) die(`${rel(dir, ROOT)} is not empty (use --force to replace)`);
  try { execFileSync('chmod', ['-R', 'u+w', dir]); } catch {}
  fs.rmSync(dir, { recursive: true, force: true });
}
function cp(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.cpSync(src, dst, { recursive: true, preserveTimestamps: true });
}
function criticalCheck(root) {
  const files = listFiles(root);
  const exact = [
    'site/v1/site.json', 'site/v1/index.html', 'site/v1/shell.js', 'site/v1/game-config.json',
    'run/v1/game-config.json', 'run/v1/qa-report.json', 'run/v1/intent.md',
    'run/v1/reference.png', 'run/v1/style.png', 'run/v1/game-design.json',
    'run/v1/game-intent.json', 'run/v1/stylespec.json', 'run/v1/visual-world.json',
    'pack/v1/manifest.json', 'pack/v1/ledger.json', 'pack/v1/coverage.json',
    'pack/v1/authoring/stylespec.json', 'pack/v1/authoring/visual-world.json',
  ];
  const patterns = [
    ['pack/v1/delivery/atlas.*.json', /^pack\/v1\/delivery\/atlas\..+\.json$/],
    ['pack/v1/delivery/atlas.*.png', /^pack\/v1\/delivery\/atlas\..+\.png$/],
    ['pack/v1/authoring/drawlist/*.json', /^pack\/v1\/authoring\/drawlist\/.+\.json$/],
    ['pack/v1/authoring/generated/*', /^pack\/v1\/authoring\/generated\/.+$/],
    ['pack/v1/authoring/masters/*', /^pack\/v1\/authoring\/masters\/.+$/],
    ['run/v1/visual-design/**', /^run\/v1\/visual-design\/.+$/],
  ];
  const result = [];
  for (const f of exact) result.push({ expected: f, matched: files.includes(f), missing: !files.includes(f) });
  for (const [label, re] of patterns) {
    const matches = files.filter((f) => re.test(f));
    result.push({ expected: label, matched: matches.length > 0, missing: matches.length === 0, matches: matches.slice(0, 5) });
  }
  return result;
}

if (!fs.existsSync(SOURCE)) die(`source missing: ${SOURCE}`);
if (!fs.existsSync(PLAYTEST_REF)) die(`historical playtest missing: ${PLAYTEST_REF}`);
if (!fs.existsSync(PRIOR_DELIVERY_REF)) die(`prior delivery missing: ${PRIOR_DELIVERY_REF}`);

ensureEmptyOrForce(SNAPSHOT);
ensureEmptyOrForce(REFERENCE);
ensureEmptyOrForce(WORK);

const sourceHashes = hashTree(SOURCE);

cp(SOURCE, SNAPSHOT);
cp(SOURCE, WORK);
cp(PLAYTEST_REF, path.join(REFERENCE, 'playtest-v1/attempt-v1'));
cp(PRIOR_DELIVERY_REF, path.join(REFERENCE, 'prior-delivery-stage-c/qa-report.json'));

// 快照与历史证据只读；工作区保持可写。
execFileSync('chmod', ['-R', 'a-w', SNAPSHOT, REFERENCE]);

const snapshotHashes = hashTree(SNAPSHOT);
const workHashes = hashTree(WORK);
const referenceHashes = hashTree(REFERENCE);

const snapshotVsSource = compare(snapshotHashes, sourceHashes, 'snapshot-vs-source');
const workVsSnapshot = compare(workHashes, snapshotHashes, 'work-vs-snapshot');
const sourceAfter = hashTree(SOURCE);
const sourceStable = compare(sourceAfter, sourceHashes, 'source-before-vs-after');
const snapshotReadOnly = isReadOnly(SNAPSHOT);
const referenceReadOnly = isReadOnly(REFERENCE);

if (!snapshotVsSource.same) die(`snapshot differs from source: ${JSON.stringify(snapshotVsSource.mismatches.slice(0, 5))}`);
if (!workVsSnapshot.same) die(`work differs from snapshot: ${JSON.stringify(workVsSnapshot.mismatches.slice(0, 5))}`);
if (!sourceStable.same) die(`source changed during freeze: ${JSON.stringify(sourceStable.mismatches.slice(0, 5))}`);
if (!snapshotReadOnly.readOnly) die(`snapshot is not read-only: ${snapshotReadOnly.writableCount} writable entries`);
if (!referenceReadOnly.readOnly) die(`reference is not read-only: ${referenceReadOnly.writableCount} writable entries`);

const siteJson = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, 'site/v1/site.json'), 'utf8'));
const qaReport = JSON.parse(fs.readFileSync(path.join(SNAPSHOT, 'run/v1/qa-report.json'), 'utf8'));
const historicalResult = JSON.parse(fs.readFileSync(path.join(REFERENCE, 'playtest-v1/attempt-v1/result.json'), 'utf8'));
const manifestSha = sha256(path.join(SNAPSHOT, 'pack/v1/manifest.json'));
const runConfigSha = sha256(path.join(SNAPSHOT, 'run/v1/game-config.json'));
const siteConfigSha = sha256(path.join(SNAPSHOT, 'site/v1/game-config.json'));
const reportManifestChecksum = qaReport?.subject?.manifestChecksum ?? null;
const historicalIdentity = historicalResult?.identity ?? null;

const critical = criticalCheck(SNAPSHOT);
const missingCritical = critical.filter((c) => c.missing);
if (missingCritical.length) die(`critical files missing: ${JSON.stringify(missingCritical)}`);

const generatedAt = new Date().toISOString();
const identity = {
  format: 'fpvs-final-identity/v1',
  generatedAt,
  source: {
    root: rel(SOURCE, ROOT),
    pack: 'pack/v1',
    run: 'run/v1',
    site: 'site/v1',
  },
  snapshot: {
    root: rel(SNAPSHOT, ROOT),
    readOnly: snapshotReadOnly.readOnly,
    readOnlyProof: { writableCount: snapshotReadOnly.writableCount, mode: 'chmod -R a-w' },
  },
  work: { root: rel(WORK, ROOT), writable: true },
  identity: {
    packId: qaReport?.subject?.packId ?? null,
    packVersion: qaReport?.subject?.packVersion ?? null,
    shellVersion: siteJson.shell ?? null,
    siteVersion: 1,
    siteJson,
    configFile: 'run/v1/game-config.json',
    siteConfigFile: 'site/v1/game-config.json',
    manifestChecksumFromReport: reportManifestChecksum,
    manifestFileSha256: `sha256:${manifestSha}`,
    manifestChecksumMatchesFile: reportManifestChecksum === `sha256:${manifestSha}`,
    runConfigSha256: `sha256:${runConfigSha}`,
    siteConfigSha256: `sha256:${siteConfigSha}`,
    runConfigEqualsSiteConfig: runConfigSha === siteConfigSha,
    historicalPlaytestIdentity: historicalIdentity,
  },
  inputs: {
    referenceImage: 'run/v1/reference.png',
    styleImage: 'run/v1/style.png',
    intentFile: 'run/v1/intent.md',
    gameIntent: 'run/v1/game-intent.json',
    gameDesign: 'run/v1/game-design.json',
    stylespec: 'run/v1/stylespec.json',
    visualWorld: 'run/v1/visual-world.json',
  },
  reports: {
    qaReport: 'run/v1/qa-report.json',
    historicalPlaytest: 'artifacts/reference/playtest-v1/attempt-v1/result.json',
    priorDeliveryReport: 'artifacts/reference/prior-delivery-stage-c/qa-report.json',
  },
  verification: {
    snapshotVsSource,
    workVsSnapshot,
    sourceStable,
    snapshotReadOnly,
    referenceReadOnly,
    critical,
  },
};

const entries = [];
for (const [role, dir, hashes] of [
  ['snapshot', SNAPSHOT, snapshotHashes],
  ['reference', REFERENCE, referenceHashes],
]) {
  for (const [relativePath, h] of [...hashes.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    entries.push({
      role,
      path: rel(path.join(dir, relativePath), EFFORT),
      relativePath,
      bytes: h.bytes,
      sha256: `sha256:${h.sha256}`,
    });
  }
}

const hashes = {
  format: 'fpvs-final-hashes/v1',
  generatedAt,
  algorithm: 'sha256',
  roots: {
    snapshot: rel(SNAPSHOT, EFFORT),
    reference: rel(REFERENCE, EFFORT),
    work: rel(WORK, EFFORT),
  },
  entries,
  counts: {
    snapshotFiles: snapshotHashes.size,
    referenceFiles: referenceHashes.size,
    workFiles: workHashes.size,
  },
  critical,
  missing: missingCritical,
  comparisons: { snapshotVsSource, workVsSnapshot, sourceStable },
  readOnly: { snapshot: snapshotReadOnly, reference: referenceReadOnly },
};

fs.writeFileSync(path.join(EFFORT, 'artifacts/identity.json'), JSON.stringify(identity, null, 2) + '\n');
fs.writeFileSync(path.join(EFFORT, 'artifacts/hashes.json'), JSON.stringify(hashes, null, 2) + '\n');

console.log(JSON.stringify({
  ok: true,
  generatedAt,
  snapshotFiles: snapshotHashes.size,
  referenceFiles: referenceHashes.size,
  workFiles: workHashes.size,
  manifestChecksumMatchesFile: identity.identity.manifestChecksumMatchesFile,
  runConfigEqualsSiteConfig: identity.identity.runConfigEqualsSiteConfig,
  historicalIdentity,
  readOnly: { snapshot: snapshotReadOnly.readOnly, reference: referenceReadOnly.readOnly },
  comparisons: { snapshotVsSource: snapshotVsSource.same, workVsSnapshot: workVsSnapshot.same, sourceStable: sourceStable.same },
}, null, 2));
