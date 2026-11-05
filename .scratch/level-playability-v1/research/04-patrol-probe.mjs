// 04 附：把「巡逻 hazard 当整段行程实心」的朴素判据跑在历史语料上，量误报（E3）。
// 运行：node .scratch/level-playability-v1/research/04-patrol-probe.mjs
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { auditReachability, parseAssetPack, parseGameConfig } from "../../../packages/contracts/dist/index.js";

const ROOT = path.resolve(import.meta.dirname, "../../..");
const SKIP = new Set(["node_modules", ".git", "dist", ".vite", "coverage"]);
const JSON_DIRS = ["out", "fixtures", ".scratch", "packages/demo/fixtures"];
function walk(dir, out) { let es; try { es = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; } for (const d of es) { const p = path.join(dir, d.name); if (d.isDirectory()) { if (!SKIP.has(d.name)) walk(p, out); } else if (d.isFile() && d.name.endsWith(".json")) out.push(p); } }
const sha = (s) => crypto.createHash("sha256").update(s).digest("hex");
const files = []; for (const d of JSON_DIRS) walk(path.join(ROOT, d), files);
const configs = [], manifests = [];
for (const f of files) { let raw; try { raw = JSON.parse(fs.readFileSync(f, "utf8")); } catch { continue; } if (!raw || typeof raw !== "object") continue;
  if (raw.format === "game-config/v1") configs.push({ file: f, raw, hash: sha(JSON.stringify(raw)) });
  if (raw.format === "assetpack/v1" || (Array.isArray(raw.assets) && raw.id !== undefined && raw.version !== undefined && raw.files !== undefined)) manifests.push({ file: f, value: { ...raw, assets: raw.assets.filter((a) => a && typeof a === "object" && typeof a.id === "string") } }); }
const refsOf = (c) => { const ids = new Set([c.player.asset, c.scene.background.asset, c.hud.panel.asset, c.hud.pip.asset]); for (const e of c.entities) ids.add(e.asset); return ids; };
const covers = (m, ids) => { const h = new Set(m.assets.map((a) => a.id)); for (const id of ids) if (!h.has(id)) return false; return true; };
const ver = (p) => { const m = /\/v(\d+)\/manifest\.json$/.exec(p.split(path.sep).join("/")); return m ? Number(m[1]) : 0; };
function candidatesFor(file) { const dirs = []; let d = path.dirname(file); for (let i = 0; i < 4; i++) { dirs.push(d); d = path.dirname(d); } const out = [];
  for (const root of dirs) { const pr = path.join(root, "pack"); let vs = []; try { vs = fs.readdirSync(pr); } catch {}
    for (const v of vs) { const mp = path.join(pr, v, "manifest.json"); if (fs.existsSync(mp)) { const hit = manifests.find((x) => x.file === mp); if (hit) out.push(hit); } }
    for (const rel of ["manifest.json", "pack/manifest.json"]) { const mp = path.join(root, rel); const hit = manifests.find((x) => x.file === mp); if (hit) out.push(hit); } }
  return out.sort((a, b) => ver(b.file) - ver(a.file)); }
const common = (a, b) => { const aa = a.split(path.sep), bb = b.split(path.sep); let i = 0; while (i < aa.length && i < bb.length && aa[i] === bb[i]) i++; return i; };
const unique = new Map(); for (const c of configs) unique.set(c.hash, c);
const res = { paired: 0, configsWithMovingHazard: 0, naivePatrolSweepAddsError: 0, cases: [] };
for (const c of unique.values()) {
  const p = parseGameConfig(c.raw); if (!p.ok) continue; const cfg = p.value; const ids = refsOf(cfg);
  let man = candidatesFor(c.file).find((m) => covers(m.value, ids));
  if (!man) man = manifests.filter((m) => covers(m.value, ids)).sort((a, b) => common(b.file, c.file) - common(a.file, c.file))[0];
  if (!man) continue; res.paired++;
  if (!cfg.entities.some((e) => e.kind === "hazard" && e.motion)) continue; res.configsWithMovingHazard++;
  const base = auditReachability(cfg, man.value).map((i) => i.where);
  const clone = JSON.parse(JSON.stringify(cfg));
  for (const e of clone.entities) if (e.kind === "hazard" && e.motion) e.kind = "solid"; // 保留 motion ⇒ 整段行程
  const naive = auditReachability(clone, man.value).map((i) => i.where);
  const added = naive.filter((w) => !base.includes(w));
  if (added.length) { res.naivePatrolSweepAddsError++; res.cases.push({ file: path.relative(ROOT, c.file), base, naive, added }); }
}
console.log(JSON.stringify(res, null, 2));
