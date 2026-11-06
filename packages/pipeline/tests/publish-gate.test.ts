// 发布闸（P0-02b · 票 09）：报告必须属于当前包，且六条判据全跑、无 error。
//
// ⚠️ 这一组**不跑上游、不花钱**：包用入库的真 fixture（只读），报告在临时目录里手写。
//   「真链上 QA 失败 / incomplete」由 `create-game.test.ts` 那两条盯。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { CommandError, QA_JUDGEMENTS, QA_REPORT_FORMAT } from "@game-maker/contracts";
import { assertPublishableQa, manifestChecksumOf } from "../src/publish-gate.js";

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/last-train/v2");
const TD_CONFIG = path.join(ROOT, "fixtures/td-configs/counter-siege.json");
const ID = "last-train";
const VERSION = 2;

const dirs: string[] = [];
const tmp = (): string => {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-publish-gate-"));
  dirs.push(d);
  return d;
};
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

const observations = [
  { source: "inspect", outcome: "ok", lines: [] },
  { source: "review", outcome: "unavailable", reason: "测试：没配视觉上游" },
];

/** 一份六条全跑的绿报告；`over` 用来做 error / warning / incomplete / 身份变异。 */
const report = (over: Record<string, unknown> = {}): Record<string, unknown> => ({
  format: QA_REPORT_FORMAT,
  checked: [...QA_JUDGEMENTS],
  failures: [],
  observations,
  subject: { packId: ID, packVersion: VERSION, manifestChecksum: manifestChecksumOf(PACK) },
  ...over,
});

/** 写进规范 out 树：`<out>/<id>/run/v<N>/qa-report.json`。 */
function writeReport(outRoot: string, body: Record<string, unknown>, runVersion = 1): string {
  const dir = path.join(outRoot, ID, "run", `v${runVersion}`);
  fs.mkdirSync(dir, { recursive: true });
  const p = path.join(dir, "qa-report.json");
  fs.writeFileSync(p, JSON.stringify(body, null, 2) + "\n");
  return p;
}

const errOf = (fn: () => unknown): CommandError => {
  try { fn(); } catch (e) { return e as CommandError; }
  throw new Error("预期抛错，实际通过了");
};

describe("§放行：报告属于当前包、六条全跑、无 error", () => {
  it("规范 out 树自动查找", () => {
    const out = tmp();
    const p = writeReport(out, report());
    const got = assertPublishableQa({ packDir: PACK, outRoot: out });
    expect(got?.reportPath).toBe(p);
    expect(got?.manifest.id).toBe(ID);
  });

  it("⚠️ 多个候选：按 subject 精确匹配（旧的 v1 报告不能给 v2 放行）", () => {
    const out = tmp();
    writeReport(out, report({ subject: { packId: ID, packVersion: 1, manifestChecksum: manifestChecksumOf(PACK) } }), 1);
    const good = writeReport(out, report(), 2);
    expect(assertPublishableQa({ packDir: PACK, outRoot: out })?.reportPath).toBe(good);
  });

  it("显式 `qaReportPath`：包 / 报告在 out 树之外也能用（C 只负责定位，身份仍由 A 校验）", () => {
    const outside = tmp();
    const p = writeReport(outside, report(), 7);
    expect(assertPublishableQa({ packDir: PACK, qaReportPath: p })?.reportPath).toBe(p);
  });

  it("⚠️ `warning` 不阻断（与 error / incomplete 分开）", () => {
    const out = tmp();
    writeReport(out, report({
      failures: [{ judgement: "palette-binding", target: "hero", detail: "只是警告", severity: "warning" }],
    }));
    expect(assertPublishableQa({ packDir: PACK, outRoot: out })).toBeDefined();
  });

  it("⚠️ TD 配置显式跳过（P2 例外）—— 没有报告也放行**闸**，装配器自己继续", () => {
    expect(assertPublishableQa({ packDir: PACK, configPath: TD_CONFIG, outRoot: tmp() })).toBeUndefined();
  });
});

describe("§拒绝：缺报告 / 身份不符 / error / incomplete", () => {
  const bad = (fn: () => unknown, re: RegExp) => {
    const e = errOf(fn);
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(re);
    return e;
  };

  it("缺报告：退 4，文案写清查过哪里、怎么修", () => {
    const out = tmp();
    const e = bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /找不到属于当前包的 QA 报告/);
    expect(e.message).toContain(path.join(out, ID, "run"));
    expect(e.message).toMatch(/--qa-report/);
    expect(e.message).toMatch(/build/);
  });

  it("没有 outRoot 且没有显式报告 ⇒ 拒（不猜）", () => {
    bad(() => assertPublishableQa({ packDir: PACK }), /没有给 outRoot/);
  });

  it("⚠️ 旧报告没有 subject ⇒ 拒（「无法证明」不是「通过」）", () => {
    const out = tmp();
    const body = report();
    delete body.subject;
    writeReport(out, body);
    bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /没有包身份/);
  });

  it("旧 pack version ⇒ 拒，文案同时报「报告属于谁」与「当前包是谁」", () => {
    const out = tmp();
    writeReport(out, report({ subject: { packId: ID, packVersion: 1, manifestChecksum: manifestChecksumOf(PACK) } }));
    const e = bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /报告属于/);
    expect(e.message).toContain(`"${ID}" v1`);
    expect(e.message).toContain(`"${ID}" v${VERSION}`);
  });

  it("manifestChecksum 不符 ⇒ 拒（同 id/version 的声明被改过）", () => {
    const out = tmp();
    writeReport(out, report({ subject: { packId: ID, packVersion: VERSION, manifestChecksum: "sha256:" + "1".repeat(64) } }));
    bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /manifestChecksum/);
  });

  it("error ⇒ 拒，详情带判据与目标", () => {
    const out = tmp();
    writeReport(out, report({
      failures: [{ judgement: "reachability", target: "e-pickup-1", detail: "跳不到", severity: "error" }],
    }));
    const e = bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /QA 判据没过/);
    expect(e.message).toMatch(/\[reachability\] e-pickup-1/);
  });

  it("⚠️ incomplete（模拟一条 runner 没跑）⇒ 拒，点名缺哪条", () => {
    const out = tmp();
    writeReport(out, report({ checked: QA_JUDGEMENTS.filter((j) => j !== "layer-coverage") }));
    const e = bad(() => assertPublishableQa({ packDir: PACK, outRoot: out }), /QA 没跑全/);
    expect(e.message).toContain("layer-coverage");
  });
});

// ── P1 · publish-gate：config 自身的可达性现场复验（B-02 的配套闸）──────────────
//
// ⚠️ 要补的洞：报告只钉 pack 身份 ⇒ 一份**绿报告属于 config A**，仍能给**不可达的 config B**
//   放行。这里不是绑 config 身份，而是**现场重跑** `auditReachability`：当前 config 自己走不通 ⇒ 拒。
describe("§P1 · publish-gate：过不了可玩性判定的 config ⇒ 拒（绿报告也不能放行）", () => {
  const GOOD_CONFIG = path.join(ROOT, "fixtures/game-configs/last-train.json");

  /** 一份**不可达**的 config：满高的墙把世界切断（与 B-02 / QA 同一个现场）。 */
  function unreachableConfig(dir: string): string {
    const c = JSON.parse(fs.readFileSync(GOOD_CONFIG, "utf8")) as {
      world: { size: { w: number; h: number } };
      terrain: { x: number; y: number; w: number; h: number }[];
    };
    c.terrain.push({ x: 300, y: 0, w: 100, h: c.world.size.h });
    const p = path.join(dir, "config-b.json");
    fs.writeFileSync(p, JSON.stringify(c, null, 2) + "\n");
    return p;
  }

  it("显式报告分支：绿报告 + config B ⇒ `invalid`，文案是「这份 config 过不了可玩性判定」", () => {
    const d = tmp();
    const out = path.join(d, "out");
    const rp = writeReport(out, report());
    const e = errOf(() => assertPublishableQa({ packDir: PACK, configPath: unreachableConfig(d), qaReportPath: rp }));
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/这份 config 过不了可玩性判定/);
    expect(e.message).toMatch(/够不到/);
    // ⚠️ 不是「报告不能证明属于这份 config」——报告身份没问题，问题是 config 自己走不通。
    expect(e.message).not.toMatch(/报告不能用于发布/);
  });

  it("auto 查找分支：同样现场重跑（两条分支共用）", () => {
    const d = tmp();
    const out = path.join(d, "out");
    writeReport(out, report());
    const e = errOf(() => assertPublishableQa({ packDir: PACK, configPath: unreachableConfig(d), outRoot: out }));
    expect(e.kind).toBe("invalid");
    expect(e.message).toMatch(/这份 config 过不了可玩性判定/);
  });

  it("可达 config ⇒ 照常放行（不误拒手写 config）", () => {
    const out = tmp();
    writeReport(out, report());
    expect(assertPublishableQa({ packDir: PACK, configPath: GOOD_CONFIG, outRoot: out })).toBeDefined();
  });

  it("`configPath` 缺省 ⇒ 跳过（库调用 / 既有测试的边界）", () => {
    const out = tmp();
    writeReport(out, report());
    expect(assertPublishableQa({ packDir: PACK, outRoot: out })).toBeDefined();
  });

  it("config 解析失败 ⇒ 跳过，由装配器报自己的 schema 错", () => {
    const d = tmp();
    const out = path.join(d, "out");
    writeReport(out, report());
    const badConfig = path.join(d, "not-a-config.json");
    fs.writeFileSync(badConfig, "{ 这不是 JSON\n");
    expect(assertPublishableQa({ packDir: PACK, configPath: badConfig, outRoot: out })).toBeDefined();
  });
});
