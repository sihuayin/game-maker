import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { auditWinnable, buildTdWorld, playReference, type TdWorldDescription } from "../src/index.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const readJson = (p: string) => JSON.parse(fs.readFileSync(p, "utf8"));

/** 真包 + 真关卡，按需改一处（与 `td-world.test.ts` 同款）。 */
const world = (over: (c: Record<string, never>) => void = () => {}): TdWorldDescription => {
  const c = readJson(CONFIG);
  over(c);
  return buildTdWorld(readJson(path.join(PACK, "manifest.json")), c, { packBase: "" });
};
const errs = (w: TdWorldDescription) => auditWinnable(playReference(w), w).filter((i) => i.severity === "error");
const warns = (w: TdWorldDescription) => auditWinnable(playReference(w), w).filter((i) => i.severity === "warning");

describe("参考玩家跑一遍：**这一关通不通**（票 11 定的那一步）", () => {
  it("真关卡：**赢了、漏 1 ⇒ 一条都不报**（只在输了或赢得不干净时才报）", () => {
    const w = world();
    const run = playReference(w);
    expect(run.phase).toBe("won");
    expect(run.leaked).toBeLessThanOrEqual(2);
    expect(auditWinnable(run, w)).toEqual([]);
  });

  it("⚠️ **确定性**：同一个人跑两遍，逐字段相同", () => {
    // 没有这条，「参考玩家跑得完」就不是一条能断言的事 —— 它会飘。
    const w = world();
    expect(JSON.stringify(playReference(w))).toBe(JSON.stringify(playReference(w)));
  });

  it("**判据**：退化 = **一个敌人都没杀掉**（票 13）—— 与声望、与第几波**都无关**", () => {
    // ⚠️ 血量 ×20 打得动但打不死 ⇒ `killed === 0`。**不需要动声望** ——
    //   那正是它比「一波都没打完」好的地方：后者要求第一波漏 ≥ 声望那么多只，而第一波只有 6 只。
    const w = world((c) => { (c as { enemies: { hp: number }[] }).enemies.forEach((e) => { e.hp *= 20; }); });
    const run = playReference(w);
    expect(run.phase).toBe("lost");
    expect(run.killed).toBe(0);
    const t = errs(w).map((i) => i.message).join("\n");
    expect(t).toMatch(/一个敌人都没杀掉/);
    // ⚠️ 硬失败那条要把**两种成因**都点出来（实测表里两种都有：血量 ×20 是前者、废料 0 是后者）
    expect(t).toMatch(/打不动/);
    expect(t).toMatch(/根本没建出塔/);
    // ⚠️ 而那句方向是**量出来的**，不是口味
    expect(t).toMatch(/宁可把敌人写弱、把塔写便宜/);
  });

  it("⚠️ **只杀得动、但杀不完**（血量 ×2）⇒ **不拒**，只报警告 —— 那可能就是「难而公平」", () => {
    const w = world((c) => { (c as { enemies: { hp: number }[] }).enemies.forEach((e) => { e.hp *= 2; }); });
    const run = playReference(w);
    expect(run.phase).toBe("lost");
    expect(run.killed).toBeGreaterThan(0);                      // 杀得动
    expect(errs(w)).toEqual([]);                                // ⇒ 够不上判据
    expect(warns(w)).toHaveLength(1);
  });

  it("⚠️ 输在**中途**不是硬失败，是**警告** + 诊断 —— 「人打得赢、它打不赢」的关卡可能是好关卡", () => {
    // 血量 ×5 是实测出来「刻度整个写反」那一档：**输在第 3 波**，而不是第一波
    const w = world((c) => { (c as { enemies: { hp: number }[] }).enemies.forEach((e) => { e.hp *= 5; }); });
    const run = playReference(w);
    expect(run.phase).toBe("lost");
    expect(run.wave).toBeGreaterThan(0);                        // **不是**第一波
    expect(errs(w)).toEqual([]);                                // 没有硬失败
    expect(warns(w).map((i) => i.message).join("\n")).toMatch(/没能打完/);
  });

  it("赢了但漏了 ⇒ 也是警告（赢得不干净）", () => {
    const w = world((c) => { (c as { enemies: { hp: number }[] }).enemies.forEach((e) => { e.hp = Math.round(e.hp * 1.4); }); });
    const run = playReference(w);
    expect(run.phase).toBe("won");
    expect(run.leaked).toBeGreaterThan(0);
    expect(warns(w).map((i) => i.message).join("\n")).toMatch(/声望只剩 \d+\/\d+/);
  });
});

describe("两条诊断：**每一条都必须带着它的尺子**（票 10）", () => {
  // ⚠️ 取材要挑**够不上判据**的那一档：血量 ×20 会 `killed === 0` ⇒ 硬失败、没有诊断。
  //   血量 ×2 是「杀得动 7 个、但还是输了」（实测表里的那一行）⇒ 只报警告 + 两条诊断。
  const heavy = () => world((c) => { (c as { enemies: { hp: number }[] }).enemies.forEach((e) => { e.hp *= 2; }); });

  it("覆盖那条带尺子 —— 换个射程当尺子这个数会变，所以它只能是诊断", () => {
    const t = warns(heavy()).map((i) => i.message).join("\n");
    expect(t).toMatch(/覆盖 \d+%/);
    expect(t).toMatch(/尺子＝.+L1 射程 \d+/);
    expect(t).toMatch(/换个射程当尺子这个数会变/);
  });

  it("波次血量那条：逐波的总血、峰值、最大环比跳变", () => {
    const t = warns(heavy()).map((i) => i.message).join("\n");
    // ⚠️ 只断言**形状**，不断言具体数字 —— 数字属于**关卡**，不属于这个函数
    expect(t).toMatch(/波次血量\** \d+( \/ \d+)+/);
    expect(t).toMatch(/峰值 \d+/);
    expect(t).toMatch(/最大环比跳变 \d+\.\d+×/);
  });
});
