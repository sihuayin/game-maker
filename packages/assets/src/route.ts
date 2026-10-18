// **确定性路线决策**（v3 票 09）—— 纯函数；`source.kind` 的唯一最终写入者。
//
// ⚠️ 输入是**已归一化**的数据：spec + context + capabilities + existingAssets（含预计算
//   `accessible`）+ candidate。本文件不做 I/O、不读文件、不探测环境、不判实时 transport。
//   引用可访问性由 `planAssets` 在调用前检查（第一轮 Q10 / 第四轮 Q13.2）。
import {
  ASSET_PLAN_REASON_CODES,
  AssetPlanCapabilities,
  resolveRuntimeProfile,
  type AssetPlanReasonCode,
  type AssetPlanRoute,
  type AssetSource,
  type GameDesignSpec,
  type VisualWorldSpec,
} from "@game-maker/contracts";
import type { ImageTransport } from "./image-config.js";

export { ASSET_PLAN_REASON_CODES, type AssetPlanReasonCode, type AssetPlanRoute };

/** resolver 的上下文（当前规则不读它；它是归一化输入的一部分，留给后续规则）。 */
export type RouteContext = { design: GameDesignSpec; visualWorld: VisualWorldSpec };

/** 既有素材（fixture-only；create 链传空）。`accessible` 由调用方预检查。 */
export type ExistingAsset = { id: string; ref: string; mustReuse: boolean; accessible: boolean };

export type RouteInput = {
  spec: { id: string } & Record<string, unknown>;
  context: RouteContext;
  capabilities: AssetPlanCapabilities;
  existingAssets: readonly ExistingAsset[];
  candidate: AssetPlanRoute;
};

export type RouteSuccess = {
  ok: true;
  route: AssetPlanRoute;
  reason: { code: AssetPlanReasonCode; text?: string };
  inputs: { importRef?: string; masterAsset?: string };
  candidate: AssetPlanRoute;
  participated: boolean;
};

export type RouteFailure = {
  ok: false;
  failure: "no-route" | "ref" | "capability";
  message: string;
  candidate: AssetPlanRoute;
  missing?: AssetPlanRoute;
};

export type RouteDecision = RouteSuccess | RouteFailure;

const capable = (c: AssetPlanCapabilities, r: AssetPlanRoute): boolean => c.routes[r];

const reasonText: Record<AssetPlanReasonCode, string> = {
  "import:explicit-ref": "显式既有素材引用且要求原样使用",
  "image:character": "角色资源（characterId）",
  "image:master": "带母版的资源（masterAsset）",
  "image:animation": "动画资源（kind: animation）",
  "image:background": "背景资源（kind: background）",
  "drawlist:ui-ninepatch": "九宫格 UI（kind: ui + ninePatch）",
  "image:candidate": "无硬信号时由模型候选平局选择 image",
  "drawlist:candidate": "无硬信号时由模型候选平局选择 drawlist",
};

const success = (
  route: AssetPlanRoute, code: AssetPlanReasonCode, candidate: AssetPlanRoute,
  participated: boolean, inputs: { importRef?: string; masterAsset?: string } = {},
): RouteSuccess => ({ ok: true, route, reason: { code, text: reasonText[code] }, inputs, candidate, participated });

const fail = (
  failure: RouteFailure["failure"], message: string, candidate: AssetPlanRoute, missing?: AssetPlanRoute,
): RouteFailure => ({ ok: false, failure, message, candidate, ...(missing === undefined ? {} : { missing }) });

/**
 * 路线顺序（第三轮 Q10.4）：
 * import（合格条件） > image 硬信号 > drawlist 硬信号 > 候选平局；能力缺失 / 无合法路线直接失败。
 * ⚠️ 能力检查在**选定路线之后**：选中的路线不可用就失败，**不换路**（第二轮 Q7）。
 */
export function resolveRoute(input: RouteInput): RouteDecision {
  const { spec, capabilities, existingAssets, candidate } = input;
  const id = spec.id;
  const asRecord = spec as Record<string, unknown>;

  // 1) import：显式 ref + mustReuse + accessible；候选不能触发。
  const existing = existingAssets.find((a) => a.id === id);
  if (existing?.mustReuse) {
    if (!existing.accessible) return fail("ref", `资源 "${id}" 要求原样使用既有素材，但引用不可访问："${existing.ref}"`, candidate, "import");
    if (!capable(capabilities, "import")) return fail("capability", `资源 "${id}" 需要 import，但 import 能力不可用`, candidate, "import");
    return success("import", "import:explicit-ref", candidate, false, { importRef: existing.ref });
  }

  // 2) image 硬信号：fixed order（第三轮 Q10.2）。
  const imageSignal: AssetPlanReasonCode | null =
    typeof asRecord["characterId"] === "string" ? "image:character"
    : typeof asRecord["masterAsset"] === "string" ? "image:master"
    : asRecord["kind"] === "animation" ? "image:animation"
    : asRecord["kind"] === "background" ? "image:background"
    : null;
  if (imageSignal !== null) {
    if (!capable(capabilities, "image")) return fail("capability", `资源 "${id}" 需要 image（${imageSignal}），但 image 能力不可用`, candidate, "image");
    const masterAsset = typeof asRecord["masterAsset"] === "string" ? asRecord["masterAsset"] : undefined;
    return success("image", imageSignal, candidate, false, masterAsset === undefined ? {} : { masterAsset });
  }

  // 3) drawlist 硬信号：kind ui + 有效 ninePatch（第三轮 Q10.3 窄口径）。
  if (asRecord["kind"] === "ui" && asRecord["ninePatch"] !== undefined) {
    if (!capable(capabilities, "drawlist")) return fail("capability", `资源 "${id}" 需要 drawlist（九宫格 UI），但 drawlist 能力不可用`, candidate, "drawlist");
    return success("drawlist", "drawlist:ui-ninepatch", candidate, false);
  }

  // 4) 候选平局：只接受 image / drawlist；import 候选不能触发 import。
  if (candidate === "image" || candidate === "drawlist") {
    if (!capable(capabilities, candidate)) return fail("capability", `资源 "${id}" 的候选路线 ${candidate} 不可用`, candidate, candidate);
    return success(candidate, candidate === "image" ? "image:candidate" : "drawlist:candidate", candidate, true);
  }
  return fail("no-route", `资源 "${id}" 没有硬信号，且候选 ${candidate} 不能作为最终路线（import 必须由显式既有素材 + mustReuse 触发）`, candidate);
}

/** 由设计 + image transport + 是否有既有素材，构造 sidecar 里的能力快照。 */
export function plannerCapabilitiesOf(input: {
  design: GameDesignSpec;
  imageTransport?: ImageTransport;
  hasExistingAssets: boolean;
}): AssetPlanCapabilities {
  const ref = input.design.game.runtimeProfile;
  const profile = resolveRuntimeProfile(ref);
  return {
    routes: {
      image: input.imageTransport !== undefined,
      drawlist: true, // 文本上游是 planAssets 的前提；到这里必然可用
      import: input.hasExistingAssets,
    },
    runtime: {
      profile: ref.id,
      version: ref.version,
      capabilities: profile === undefined ? [] : [...profile.capabilities],
    },
  };
}

/** 把模型候选的 source 换成 resolver 最终路线的 source（纯函数）。 */
export function sourceForDecision(
  source: AssetSource, decision: RouteSuccess, existing?: ExistingAsset,
): AssetSource {
  if (decision.route === "import") {
    if (source.kind === "import" && source.ref === decision.inputs.importRef) return source;
    const ref = decision.inputs.importRef ?? existing?.ref;
    if (ref === undefined) throw new Error("sourceForDecision: import 决策缺少 ref（这是本模块的 bug）");
    return { kind: "import", ref };
  }
  if (decision.route === "drawlist") return { kind: "drawlist" };
  // image：候选本来就是 image 时保留它的 reference/background/alphaThreshold
  return source.kind === "image" ? source : { kind: "image" };
}
