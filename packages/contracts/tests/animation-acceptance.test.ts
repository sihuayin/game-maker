import { describe, expect, it } from "vitest";
import {
  ANIMATION_ACCEPTANCE_FORMAT,
  AnimationAcceptance,
  HUMAN_REVIEW_ITEM_KEYS,
  parseAnimationAcceptance,
  type AnimationAcceptance as Report,
  type HumanReviewItemKey
} from "../src/index.js";

const SHA = (c: string) => "sha256:" + c.repeat(64);

const LABELS: Record<HumanReviewItemKey, string> = {
  identity: "身份 / 轮廓 / 比例",
  pose: "姿势族",
  lighting: "明暗 / 色板",
  loop: "无呼吸 / 跳变",
  alpha: "透明边缘",
  outline: "1px 描边",
  style: "风格一致"
};

/** 最小合法报告：**无 baseline** ⇒ `baseline` / `metrics` / `verdict` 全 null。 */
function validReport(): Report {
  return {
    format: ANIMATION_ACCEPTANCE_FORMAT,
    createdAt: "2026-10-21T00:00:00.000Z",
    toolVersion: "0.0.0",
    pack: {
      id: "ruin-scavenger-extraction-assets",
      version: 7,
      manifestChecksum: SHA("a"),
      atlases: [
        { id: "animations", imageChecksum: SHA("b"), metaChecksum: SHA("c") }
      ]
    },
    baseline: null,
    animations: [
      {
        assetId: "scavenger-actor",
        anim: "idle",
        frames: [
          "scavenger-actor.idle1",
          "scavenger-actor.idle2",
          "scavenger-actor.idle3",
          "scavenger-actor.idle4"
        ],
        declared: { fps: 6, loop: true },
        metrics: null,
        verdict: null,
        findings: []
      }
    ],
    findings: [],
    human: {
      verdict: "pending",
      reviewer: null,
      reviewedAt: null,
      items: HUMAN_REVIEW_ITEM_KEYS.map((key) => ({ key, label: LABELS[key], verdict: "pending", note: "" })),
      evidence: []
    },
    runtime: { status: "unverified", evidence: [], declaredVsActual: [] }
  };
}

const parse = (input: unknown) => AnimationAcceptance.safeParse(input);

export function errorsOf(input: unknown): string {
  const r = parse(input);
  expect(r.success, "本该被拒，却通过了").toBe(false);
  return r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("\n");
}

describe("animation-acceptance/v1 —— 合法报告必须通过", () => {
  it("最小报告（无 baseline）通过", () => {
    const r = parse(validReport());
    expect(r.success, r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")).toBe(true);
  });

  it("有 baseline 的完整读数通过", () => {
    const report = structuredClone(validReport());
    report.baseline = {
      id: "scavenger-actor.idle.v7.2026-10-19",
      path: "fixtures/animation-baselines/scavenger-idle/baseline.json",
      checksum: SHA("d"),
      standardVersion: "ticket-12/2026-10-21"
    };
    const anim = report.animations[0]!;
    anim.metrics = {
      alphaMaskDiffPct: 0.4,
      bboxWidthDiffPct: 0.2,
      positionDriftPct: 0.4,
      backgroundL1: 3,
      paletteCountMin: 18,
      offPalette: 0,
      boundaryDarkPctMin: 87.4
    };
    anim.verdict = "green";
    const r = parse(report);
    expect(r.success, r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")).toBe(true);
    if (!r.success) return;
    expect(r.data.animations[0]?.metrics?.boundaryDarkPctMin).toBe(87.4);
    expect(r.data.baseline?.id).toBe("scavenger-actor.idle.v7.2026-10-19");
  });

  it("带定位字段的 finding 通过（file / assetId / anim / frame 任一）", () => {
    const report = structuredClone(validReport());
    report.findings = [
      { code: "atlas.frame.out-of-bounds", severity: "error", message: "帧矩形越界", file: "delivery/atlas.animations.json" },
      { code: "atlas.frames.count", severity: "warning", message: "计数不符", assetId: "scavenger-actor" },
      { code: "animation.frames.order", severity: "info", message: "顺序不符", anim: "idle" },
      { code: "atlas.frame.orphan", severity: "warning", message: "孤儿帧", frame: "scavenger-actor.idle1" }
    ];
    const r = parse(report);
    expect(r.success, r.success ? "" : r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join(" / ")).toBe(true);
  });

  it("declared.fps 可为 null（manifest 的 fps 是可选的）", () => {
    const report = structuredClone(validReport());
    report.animations[0]!.declared.fps = null;
    expect(parse(report).success).toBe(true);
  });

  it("runtime.status 三档都合法", () => {
    for (const status of ["verified", "unverified", "not-run"] as const) {
      const report = structuredClone(validReport());
      report.runtime.status = status;
      expect(parse(report).success, status).toBe(true);
    }
  });

  it("parseAnimationAcceptance 返回同一份报告", () => {
    const r = parseAnimationAcceptance(validReport());
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.format).toBe("animation-acceptance/v1");
    expect(r.value.animations[0]?.anim).toBe("idle");
  });
});

describe("animation-acceptance/v1 —— 坏报告必须被拒", () => {
  it("缺 pack 身份", () => {
    const report = structuredClone(validReport());
    Reflect.deleteProperty(report, "pack");
    expect(errorsOf(report)).toMatch(/pack.*Required/);
  });

  it("pack 缺 id", () => {
    const report = structuredClone(validReport());
    Reflect.deleteProperty(report.pack, "id");
    expect(errorsOf(report)).toMatch(/pack\.id.*Required/);
  });

  it("pack.atlases 的 checksum 形状不对", () => {
    const report = structuredClone(validReport());
    report.pack.atlases[0]!.imageChecksum = "not-a-checksum";
    expect(errorsOf(report)).toMatch(/pack\.atlases\.0\.imageChecksum/);
  });

  it("人裁项只有 6 项", () => {
    const report = structuredClone(validReport());
    report.human.items.pop();
    expect(errorsOf(report)).toMatch(/human\.items.*exactly 7/);
  });

  it("人裁项 7 条但 key 重复（缺 style）", () => {
    const report = structuredClone(validReport());
    report.human.items[6] = { ...report.human.items[0]!, note: "重复" };
    expect(errorsOf(report)).toMatch(/人裁项缺失或重复.*style/);
  });

  it("人裁 verdict 非法", () => {
    const report = structuredClone(validReport());
    Object.assign(report.human, { verdict: "approved" });
    expect(errorsOf(report)).toMatch(/human\.verdict/);
  });

  it("finding 没有任何定位字段", () => {
    const report = structuredClone(validReport());
    report.findings = [{ code: "atlas.unknown", severity: "error", message: "某处有问题" }];
    expect(errorsOf(report)).toMatch(/至少需要一个定位字段/);
  });

  it("finding 的 severity 非法", () => {
    const report = structuredClone(validReport());
    const finding = { code: "atlas.unknown", severity: "error" as const, message: "x", file: "a.json" };
    Object.assign(finding, { severity: "fatal" });
    report.findings = [finding];
    expect(errorsOf(report)).toMatch(/severity/);
  });

  it("runtime.status 非法", () => {
    const report = structuredClone(validReport());
    Object.assign(report.runtime, { status: "partial" });
    expect(errorsOf(report)).toMatch(/runtime\.status/);
  });

  it("format 不对", () => {
    const report = structuredClone(validReport());
    Object.assign(report, { format: "animation-acceptance/v2" });
    expect(errorsOf(report)).toMatch(/format/);
  });

  it("metrics 不能是 undefined（无 baseline 时必须显式 null）", () => {
    const report = structuredClone(validReport());
    Reflect.deleteProperty(report.animations[0]!, "metrics");
    expect(errorsOf(report)).toMatch(/animations\.0\.metrics.*Required/);
  });

  it("parseAnimationAcceptance 的错误带路径", () => {
    const report = structuredClone(validReport());
    Reflect.deleteProperty(report.pack, "version");
    const r = parseAnimationAcceptance(report);
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.errors.join("\n")).toMatch(/pack\.version/);
  });
});
