// P0-02a 的落点：**第六条判据 `layer-coverage` 的 runner**（`src/layers.ts`）。
//
// ⚠️ 测的是「真跑」而不是「写一条 `ran: true`」：
//   · 正例 —— 干净 fixture 一条都不报；
//   · 负例 —— 包里有一层盖不住世界 ⇒ 一条 `error`（target 是 `<背景 id>.<层名>`）；
//   · 视口真的被用上 —— 同一个包、换一个更宽的视口 ⇒ 同一层就该响；
//   · 解不到背景 ⇒ **一条都不报**（那是引用族的活，见 helper 尾注）；
//   · 读不回来 / 不过契约 ⇒ **抛**（与三个族同一条纪律）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import type { QaContext } from "@game-maker/contracts";
import { layerCoverageJudgement } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** 一次「运行目录 + 包目录」的现场；包是**拷**出来的（坏例不能动真 fixture）。 */
function stage(viewport = { w: 480, h: 270 }): QaContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-qa-layers-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const packDir = path.join(dir, "pack");
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(PACK, packDir, { recursive: true });
  fs.copyFileSync(CONFIG, path.join(runDir, "game-config.json"));
  return {
    runDir, packDir, gameId: "last-train", viewport,
    configPath: path.join(runDir, "game-config.json"),
    intentPath: path.join(runDir, "game-intent.json"),
    designPath: path.join(runDir, "game-design.json"),
    recipePath: path.join(runDir, "asset-recipe.json"),
  };
}

/** 改拷贝出来的包清单（坏例只动这一份）。 */
function patchManifest(ctx: QaContext, f: (m: {
  assets: { id: string; layers?: { name: string; parallax: number; tileable?: { x: boolean; y: boolean } }[] }[];
}) => void): void {
  const p = path.join(ctx.packDir, "manifest.json");
  const m = JSON.parse(fs.readFileSync(p, "utf8")) as Parameters<typeof f>[0];
  f(m);
  fs.writeFileSync(p, JSON.stringify(m, null, 2) + "\n");
}

describe("§干净 fixture：六条里的第六条**真跑**且不响", () => {
  it("`ran: true`、一条 finding 都没有", () => {
    const r = layerCoverageJudgement(stage());
    expect(r).toEqual({ ran: true, findings: [] });
  });
});

describe("§负例：盖不住世界的那一层必须响", () => {
  it("最远那层加上视差 ⇒ 一条 error，target 是 `<背景 id>.<层名>`、detail 自包含", () => {
    const ctx = stage();
    // sky：宽 480、不平铺、parallax 0（原来恒成立）。改成 0.5 ⇒ 镜头走到尽头时退掉 480 ⇒ 露底。
    patchManifest(ctx, (m) => {
      m.assets.find((a) => a.id === "bg-dusk-halt")!.layers!.find((l) => l.name === "sky")!.parallax = 0.5;
    });
    const r = layerCoverageJudgement(ctx);
    expect(r.ran).toBe(true);
    if (!r.ran) return;
    expect(r.findings).toHaveLength(1);
    expect(r.findings[0]).toMatchObject({ target: "bg-dusk-halt.sky", severity: "error" });
    // ⚠️ message 必须自包含：世界尺寸 · 视口 · 视差 · 最坏时剩多少（票 65 边界 3）
    expect(r.findings[0]!.detail).toMatch(/盖不住世界/);
    expect(r.findings[0]!.detail).toMatch(/1440×270/);
    expect(r.findings[0]!.detail).toMatch(/480×270/);
    expect(r.findings[0]!.detail).toMatch(/最坏时屏幕上只剩 0×270px/);
  });

  it("⚠️ 视口**真的被用上**：同一个包换 960 宽视口 ⇒ 那层 480 宽的不平铺层就该响", () => {
    const r = layerCoverageJudgement(stage({ w: 960, h: 270 }));
    expect(r.ran).toBe(true);
    if (!r.ran) return;
    expect(r.findings.map((f) => f.target)).toContain("bg-dusk-halt.sky");
  });
});

describe("§边界：解不到 / 读不回来", () => {
  it("背景 id 解不到 ⇒ **一条都不报**（那是引用族的活，不在这里说第二遍）", () => {
    const ctx = stage();
    const p = ctx.configPath;
    const c = JSON.parse(fs.readFileSync(p, "utf8")) as { scene: { background: { asset: string } } };
    c.scene.background.asset = "根本没有这个背景";
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
    expect(layerCoverageJudgement(ctx)).toEqual({ ran: true, findings: [] });
  });

  it("包清单读不回来 ⇒ 抛（不是一条判据的失败）", () => {
    const ctx = stage();
    fs.writeFileSync(path.join(ctx.packDir, "manifest.json"), "{ 不是 JSON");
    expect(() => layerCoverageJudgement(ctx)).toThrow(/包清单读不出来/);
  });

  it("配置读得回来、但不过契约 ⇒ 抛（带契约自己的话）", () => {
    const ctx = stage();
    fs.writeFileSync(ctx.configPath, JSON.stringify({ format: "game-config/v1" }));
    expect(() => layerCoverageJudgement(ctx)).toThrow(/配置读不回来或不过契约/);
  });
});
