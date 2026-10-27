// 票 09 给 `playable-smoke.ts` 立的判据 —— smoke 结果 → `playable-smoke` 检查项。
//
//   最要紧的三条（票 05 裁定）：
//     §失败归因只有三档，且**永不产 `AGENT_LIMITATION`**（无真人/无通路证据就不提前归因）。
//     §确定性玩法失败 = 非超时的 stage（floor/win/runtime），超时（move/pickup/navigate）归 UNKNOWN。
//     §3/4 场景（navigate）归 UNKNOWN + 写已知限制，措辞事实化。
import { describe, expect, it } from "vitest";
import {
  mapPlayableSmoke, PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES,
  playableSmokeEvidence, playableSmokeKnownLimitations,
} from "../src/playable-smoke.js";
import type { PlayableSmokeResult } from "../src/playable-smoke.js";

const nav: PlayableSmokeResult = {
  ok: false, stage: "navigate",
  reason: "超时 45000ms 未完成核心循环：x=79.0 collected=1/4 won=false onFloor=false",
};

describe("mapPlayableSmoke（票 09 项 1）", () => {
  it("ok:true → pass", () => {
    expect(mapPlayableSmoke({ ok: true, stage: "won" })).toEqual({ status: "pass" });
  });

  it("ok:false 且超时（未知原因）→ incomplete + UNKNOWN", () => {
    expect(mapPlayableSmoke({ ok: false, stage: "pickup", reason: "超时" }))
      .toEqual({ status: "incomplete", detail: "UNKNOWN" });
  });

  it("ok:false 且命中确定性玩法失败（掉穿地面）→ fail + GAMEPLAY_FAILURE", () => {
    expect(mapPlayableSmoke({ ok: false, stage: "floor", reason: "玩家掉穿地面" }))
      .toEqual({ status: "fail", detail: "GAMEPLAY_FAILURE" });
  });

  it("3/4 场景（navigate、collected=1/4）→ incomplete + UNKNOWN，不是 fail、不是 AGENT_LIMITATION", () => {
    expect(mapPlayableSmoke(nav)).toEqual({ status: "incomplete", detail: "UNKNOWN" });
  });

  it("smoke 未跑（前置失败）→ blocked", () => {
    expect(mapPlayableSmoke(undefined)).toEqual({ status: "blocked" });
  });
});

describe("确定性玩法失败 stage 表（票 09 项 1 的判据）", () => {
  it("三个非超时失败 stage 都在表里，超时的不在", () => {
    expect([...PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES].sort()).toEqual(["floor", "runtime", "win"]);
    for (const s of ["move", "pickup", "navigate"])
      expect(PLAYABLE_SMOKE_GAMEPLAY_FAILURE_STAGES.includes(s as never)).toBe(false);
  });
});

describe("playableSmokeKnownLimitations（票 09 项 3）", () => {
  it("navigate 超时 → 写已知限制，措辞事实化", () => {
    const k = playableSmokeKnownLimitations(nav);
    expect(k).toHaveLength(1);
    expect(k[0]).toContain("原因未确定"); // 事实化，不写成「试玩器受限」的确定结论
    expect(k[0]).not.toContain("AGENT_LIMITATION");
  });

  it("pass / 确定性失败 / 没跑 → 不写已知限制", () => {
    expect(playableSmokeKnownLimitations({ ok: true, stage: "won" })).toEqual([]);
    expect(playableSmokeKnownLimitations({ ok: false, stage: "floor" })).toEqual([]);
    expect(playableSmokeKnownLimitations(undefined)).toEqual([]);
  });
});

describe("playableSmokeEvidence（票 09 项 2）", () => {
  it("恒有三件：result.json / console.json / exceptions.json", () => {
    const e = playableSmokeEvidence({ ok: true, stage: "won" }, "smoke/playable");
    expect(e.map((x) => x.ref)).toEqual(["smoke-result", "smoke-console", "smoke-exceptions"]);
    expect(e[0]!.path).toBe("smoke/playable/result.json");
  });

  it("失败再补一张 fail-<stage>.png", () => {
    const e = playableSmokeEvidence(nav, "smoke/playable");
    expect(e.map((x) => x.ref)).toEqual(["smoke-result", "smoke-console", "smoke-exceptions", "smoke-screenshot"]);
    expect(e[3]!.path).toBe("smoke/playable/fail-navigate.png");
  });

  it("尾斜杠不重复", () => {
    expect(playableSmokeEvidence(nav, "smoke/playable/")[3]!.path).toBe("smoke/playable/fail-navigate.png");
  });
});
