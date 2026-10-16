// [票 78](../../../.scratch/game-maker-v2/issues/78-reviewpack-wiring.md)：`game-maker review` 的**接线**。
//
// ⚠️ 这一份盯的是**裁定**，不是手感。三条，逐条对应人裁的话：
//   Q1 (a) 它**不在流水线里** ⇒ 这里**不测**「create/build 会不会顺便跑一遍」（那是**不该发生**的事）；
//   Q5 (乙) 「**接线必须能同时取得两者**」 ⇒ 包与原图**两样都得取到**，取不到要说得出是哪一样缺；
//   Q2 甲＋乙「**事后必须记账**」 ⇒ ⭐ 最要紧的一组：**成功要记、失败也要记**，
//     而「一次都没上路」**不记**（票 46：不许记没上路的往返）。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { buildAssetPack } from "@game-maker/assets";
import { RUN_LEDGER_FORMAT, exitCodeOfError, type AssetSpec, type RunLedger, type StyleSpec } from "@game-maker/contracts";
import { recordRunSpend, reviewRun } from "../src/index.js";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));
/** ⚠️ **原图** —— 仓里那份**永远在**的夹具（不指向 `.scratch`）。 */
const REF = ROOT + "fixtures/e2e/wasteland-platformer/style.png";
const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-review-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const STYLE = {
  id: "s", identity: ["粗野的废土"], camera: {}, composition: {}, palette: ["#1a1a1a", "#c86432"],
  lighting: {}, shapeLanguage: ["方正"], material: ["锈铁"], environment: [], characterStyle: [],
  constraints: [], confidence: 0.5,
} as unknown as StyleSpec;

const SPECK: AssetSpec = {
  kind: "sprite", id: "crate", role: "obstacle", description: "木箱", styleId: "s",
  anchor: { x: 0, y: 0 }, size: { w: 8, h: 8 }, required: true,
};
const stub = (): never => ([{
  format: "drawlist+curve/v1", id: "crate", frame: "crate",
  viewBox: [0, 0, 8, 8], expectedSize: [8, 8],
  ops: [{ op: "rect", x: 0, y: 0, w: 8, h: 8, fill: "palette:1" }],
}] as never);

const GAME_ID = "wasteland";
const RUN_CREATED_AT = "2026-10-15T00:00:00.000Z";
const RUN_WALL_MS = 12345;

/** 摆一个真实的布局：`<outRoot>/<gameId>/pack/v<N>/` ＋ `<outRoot>/<gameId>/run/v1/`。 */
async function layout() {
  const outRoot = tmp();
  const built = await buildAssetPack({
    recipe: { id: GAME_ID, styleRef: "authoring/stylespec.json", assets: [{ spec: SPECK, source: { kind: "drawlist" } }] },
    style: STYLE, outDir: outRoot, recipeDir: ROOT, generate: stub, sourceDateEpoch: 1790208000,
  });
  const runDir = path.join(outRoot, GAME_ID, "run", "v1");
  fs.mkdirSync(runDir, { recursive: true });
  fs.copyFileSync(REF, path.join(runDir, "style.png"));
  fs.writeFileSync(path.join(runDir, "visual-world.json"),
    JSON.stringify({ styleReferences: [{ path: "style.png" }] }));
  // ⚠️ 这条账是 `runUnderstanding` 定稿时（`create-game.ts:314`）写下的那份的**最小等价物**。
  fs.writeFileSync(path.join(runDir, "ledger.json"), JSON.stringify({
    format: RUN_LEDGER_FORMAT, gameId: GAME_ID, runVersion: 1, createdAt: RUN_CREATED_AT,
    run: { wallClockMs: RUN_WALL_MS, byStep: { "analyze-reference": { calls: 1, attempts: 1 } } },
    calls: [{ step: "analyze-reference", target: "visual-world", upstream: "messages", ms: 900, attempts: 1 }],
  }));
  return { outRoot, runDir, packDir: built.packDir };
}

const fakeOk = (text: string) => (async () => ({
  ok: true, status: 200,
  json: async () => ({ content: [{ type: "text", text }], usage: { input_tokens: 7000, output_tokens: 120 } }),
}) as Response) as unknown as typeof fetch;

const ledgerOf = (runDir: string): RunLedger =>
  JSON.parse(fs.readFileSync(path.join(runDir, "ledger.json"), "utf8")) as RunLedger;

const TRANSPORT = { baseUrl: "http://up.test", apiKey: "k" };

describe("票 78 · reviewRun —— 人主动调的那一发（Q1 = (a)）", () => {
  it("⭐ 取到包与原图两样，回报里印出**抽查的是哪一个包**", async () => {
    const { outRoot, runDir, packDir } = await layout();
    const r = await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: fakeOk("材质不对劲\n描边偏黑") });
    expect(r.command).toBe("review");
    expect(r.data["packDir"], "回报里必须印出抽查的是哪一个包（免得人以为是别的一个）").toBe(`${GAME_ID}/pack/v1`);
    expect(r.data["reference"]).toBe(`${GAME_ID}/run/v1/style.png`);
    expect(r.data["observations"]).toEqual(["材质不对劲", "描边偏黑"]);
    expect(packDir.endsWith(path.join(GAME_ID, "pack", "v1"))).toBe(true);
  });

  it("⚠️ 取的是这个 gameId 下**最新**那个包（run 目录里没有记着它产了哪一个）", async () => {
    const { outRoot, runDir } = await layout();
    const second = await buildAssetPack({
      recipe: { id: GAME_ID, styleRef: "authoring/stylespec.json", assets: [{ spec: SPECK, source: { kind: "drawlist" } }] },
      style: STYLE, outDir: outRoot, recipeDir: ROOT, generate: stub, sourceDateEpoch: 1790208001,
    });
    expect(second.packDir.endsWith("v2")).toBe(true);
    const r = await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: fakeOk("x") });
    expect(r.data["packDir"]).toBe(`${GAME_ID}/pack/v2`);
    expect(r.data["packVersion"]).toBe("v2");
  });

  it("⚠️ 没有包 ⇒ 说得出「先跑 build」，而且**不发那一发**（零花费）", async () => {
    const { outRoot, runDir } = await layout();
    fs.rmSync(path.join(outRoot, GAME_ID, "pack"), { recursive: true, force: true });
    let called = false;
    const spy = (async () => { called = true; return { ok: true, status: 200, json: async () => ({}) } as Response; }) as unknown as typeof fetch;
    const e = await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: spy }).then(() => { throw new Error("本该失败"); }, (x: unknown) => x);
    expect((e as Error).message).toMatch(/没有包/);
    expect(exitCodeOfError(e), "输入不对，不是上游的锅").toBe(4);
    expect(called, "包都没有，却把这一发发出去了").toBe(false);
    expect(ledgerOf(runDir).calls, "一次都没上路，账上不该多一笔").toHaveLength(1);
  });

  it("⚠️ 原图取不到（`visual-world.json` 里没有 `styleReferences`）⇒ 报得清楚，且不发那一发", async () => {
    const { outRoot, runDir } = await layout();
    fs.writeFileSync(path.join(runDir, "visual-world.json"), JSON.stringify({}));
    const e = await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: fakeOk("x") }).then(() => { throw new Error("本该失败"); }, (x: unknown) => x);
    expect((e as Error).message).toMatch(/styleReferences\[0\]\.path/);
    expect(exitCodeOfError(e)).toBe(4);
  });
});

describe("票 78 · 记账（Q2 = 乙「事后必须记账」）", () => {
  it("⭐⭐ **成功** ⇒ run 级账多一格 `review`，而 createdAt / wallClockMs **原值不动**", async () => {
    const { outRoot, runDir } = await layout();
    await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: fakeOk("还行") });
    const l = ledgerOf(runDir);
    expect(l.calls.map((c) => c.step)).toEqual(["analyze-reference", "review"]);
    expect(l.calls[1]!.target).toBe(GAME_ID);
    expect(l.run.byStep["review"], "byStep 要跟着重算").toEqual({ calls: 1, attempts: 1 });
    // ⚠️ 这两项描述的是**那次运行**，不是这一次追加 —— 重算它们就是把「人等了多久」改写成别的
    expect(l.createdAt, "createdAt 被改写了").toBe(RUN_CREATED_AT);
    expect(l.run.wallClockMs, "wallClockMs 被改写了").toBe(RUN_WALL_MS);
    expect(l.calls[0]!.step, "原来那几笔一个都不能少").toBe("analyze-reference");
  });

  it("⭐⭐ **失败也要记账**（人裁逐字：不把「不阻断」误读成「可以不记账」）", async () => {
    const { outRoot, runDir } = await layout();
    const bad = (async () => ({ ok: false, status: 500, json: async () => ({}), text: async () => "" }) as Response) as unknown as typeof fetch;
    const err = await reviewRun({ runDir, outRoot, transport: TRANSPORT, fetchImpl: bad }).then(() => { throw new Error("本该失败"); }, (x: unknown) => x);
    expect((err as Error).message).toMatch(/HTTP 500/);
    expect(exitCodeOfError(err), "发出去了却没过 ⇒ 上游那一侧").toBe(3);
    expect(ledgerOf(runDir).calls.filter((c) => c.step === "review"), "失败的那一发也可能花了钱，账不能少").toHaveLength(1);
  });

  it("⚠️ 没有 run 级账 ⇒ **抛**，不凭空造一份（人裁逐字：不许把「不阻断」读成「可以不记账」）", () => {
    const d = tmp();
    expect(() => recordRunSpend(d, [{ step: "review", target: "t", upstream: "messages", ms: 1, attempts: 1 }]))
      .toThrow(/还没有 `run\/v<N>\/ledger\.json`/);
  });

  it("⚠️ 空数组 ⇒ 什么都不做（不发那一次写盘，也不造文件）", () => {
    const d = tmp();
    expect(() => recordRunSpend(d, [])).not.toThrow();
    expect(fs.existsSync(path.join(d, "ledger.json"))).toBe(false);
  });
});
