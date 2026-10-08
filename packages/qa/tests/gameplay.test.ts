// 票 18 的判据：**引用族 + 可达性**，以及「其余八项为什么不是判据」。
//
// ⚠️ 夹具是**真配置 + 真包**（`fixtures/game-configs/last-train.json` + `fixtures/packs/last-train/v2`），
//   故意损坏那几条把它**拷出来**再改 —— 与票 17 同一个做法：证明判据**真的会响**。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { auditGameConfig, parseAssetPack, parseGameConfig, type QaContext, type QaFamilyResult } from "@game-maker/contracts";
import { gameplayQaRunner } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");

const dirs: string[] = [];
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

/** 一次「运行目录 + 包目录」的现场。⚠️ fixture 是**拷**出来的 —— 损坏那几条不能动真 fixture。 */
function stage(): QaContext {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "gm-qa-gameplay-"));
  dirs.push(dir);
  const runDir = path.join(dir, "run");
  const packDir = path.join(dir, "pack");
  fs.mkdirSync(runDir, { recursive: true });
  fs.cpSync(PACK, packDir, { recursive: true });
  fs.copyFileSync(CONFIG, path.join(runDir, "game-config.json"));
  return { runDir, packDir, configPath: path.join(runDir, "game-config.json"), gameId: "last-train" };
}
const run = (ctx: QaContext): Promise<QaFamilyResult> => gameplayQaRunner(ctx);

/** 改运行目录里那份 config（**交付态**那一份，不是夹具）。 */
function patchConfig(ctx: QaContext, f: (c: any) => void): void {
  const p = ctx.configPath;
  const c = JSON.parse(fs.readFileSync(p, "utf8"));
  f(c);
  fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
}
/** ⚠️ **测试自己的**摊平小工具 —— 投影与装配归票 20。 */
const flat = (r: QaFamilyResult) => Object.entries(r.judgements)
  .flatMap(([j, res]) => (res.ran ? res.findings.map((f) => ({ ...f, judgement: j })) : []));
const keys = (r: QaFamilyResult) => Object.keys(r.judgements).sort();

describe("§干净的真配置：两条判据都跑、都没有怨言", () => {
  it("⚠️ **只声明自己那两条** —— 另外四条缺席（不是 `ran:false`）", async () => {
    const r = await run(stage());
    expect(keys(r)).toEqual(["reachability", "reference-resolution"]);
    expect(flat(r)).toEqual([]);
  });

  it("观察那一栏空着 —— 本族不产观察（`inspect` 归票 20 · `review` 归票 22）", async () => {
    expect((await run(stage())).observations).toEqual([]);
  });
});

describe("§引用族：**真的会响**（哪怕链上它恒绿 —— 见 `gameplay.ts` 文件头二）", () => {
  it("把一个动作名指到**清单里没有的动画** ⇒ 一条 `error`，`target` 是 `game-config`", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => { c.player.anims.idle = "查无此动画"; });
    const all = flat(await run(ctx));
    expect(all).toHaveLength(1);
    const f = all[0]!;
    expect(f.judgement).toBe("reference-resolution");
    expect(f.target).toBe("game-config");          // ⚠️ 账的词汇，不是 `ConfigIssue.where` 那种人话
    expect(f.severity).toBe("error");
    expect(f.detail).toContain("player.anims.idle");   // ⚠️ 局部性靠 `detail` 里那行 `where` 前缀
  });

  it("把 `scene.background` 指到一个**不是 background** 的资源 ⇒ 也响（种类也要对）", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => { c.scene.background.asset = "player-traveler"; });
    expect(flat(await run(ctx)).some((f) => /这里要的是 background/.test(f.detail))).toBe(true);
  });

  it("⚠️ **多个问题合成一条 finding**（票 18 的 Q4：`(judgement, target)` 只报一次，细节并进 `detail`）", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => {
      c.player.anims.idle = "查无此动画";
      c.hud.panel.asset = "查无此资源";
      c.entities[0].asset = "也没这个";
    });
    const all = flat(await run(ctx));
    expect(all).toHaveLength(1);
    expect(all[0]!.detail.split("\n")).toHaveLength(3);   // 三行，每行一个 `where`
  });

  it("而**没有问题**时是**空数组** —— 「成功」不是一个变体（票 06）", async () => {
    const r = await run(stage());
    expect(r.judgements["reference-resolution"]).toEqual({ ran: true, findings: [] });
  });
});

describe("§⚠️ 引用族**只吃引用族** —— 自洽族不进这一条（票 18 的 Q1(b)）", () => {
  it("把 HUD 面板扔到世界外 ⇒ `reference-resolution` **一声不响**，而 `auditGameConfig` 会响", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => { c.hud.panel.at = { x: 9999, y: 262 }; });
    const r = await run(ctx);
    expect(r.judgements["reference-resolution"]).toEqual({ ran: true, findings: [] });

    // ⚠️ 反证：**同一份配置**，走 `auditGameConfig` 那条路就听得见 —— 那件事归它（自洽族）
    const pack = parseAssetPack(JSON.parse(fs.readFileSync(path.join(ctx.packDir, "manifest.json"), "utf8")));
    const cfg = parseGameConfig(JSON.parse(fs.readFileSync(ctx.configPath, "utf8")));
    if (!pack.ok || !cfg.ok) throw new Error("夹具坏了");
    expect(auditGameConfig(cfg.value, pack.value).some((i) => /世界之外/.test(i.message))).toBe(true);
  });

  it("出生点卡在 solid 里 ⇒ 也**一声不响**（那是自洽族的硬失败，不是这一条）", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => { c.player.at = { x: 500, y: 230 }; });   // 行李堆那一格
    expect((await run(ctx)).judgements["reference-resolution"]).toEqual({ ran: true, findings: [] });
  });
});

describe("§可达性：**真的会响**", () => {
  it("挖一条 200px 的沟 ⇒ 一条 `error`，`detail` 里逐条点名够不到的实体", async () => {
    const ctx = stage();
    patchConfig(ctx, (c) => {
      c.terrain = [{ x: 0, y: 250, w: 200, h: 20 }, { x: 400, y: 250, w: 1040, h: 20 }];
    });
    const all = flat(await run(ctx));
    expect(all).toHaveLength(1);
    const f = all[0]!;
    expect(f.judgement).toBe("reachability");
    expect(f.target).toBe("game-config");
    expect(f.severity).toBe("error");
    for (const id of ["suitcase-1", "suitcase-2", "suitcase-3", "signal"]) expect(f.detail).toContain(id);
  });

  it("⚠️ **只有「够不到」才报 `error`** —— 这一条判据从不报「可达」", async () => {
    const r = await run(stage());
    expect(r.judgements["reachability"]).toEqual({ ran: true, findings: [] });
  });
});

describe("§边界：**抛**（那是调用方的输入，不是一条判据的失败）", () => {
  it("配置不过契约 ⇒ 抛", async () => {
    const ctx = stage();
    fs.writeFileSync(ctx.configPath, "{ 不是 JSON }");
    await expect(run(ctx)).rejects.toThrowError(/配置读不出来/);
  });

  it("包清单读不到 ⇒ 抛", async () => {
    const ctx = stage();
    fs.rmSync(path.join(ctx.packDir, "manifest.json"));
    await expect(run(ctx)).rejects.toThrowError(/包清单读不出来/);
  });
});
