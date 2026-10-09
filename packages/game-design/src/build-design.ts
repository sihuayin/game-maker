// 票 10 的**纯**那一半：装配 + **拒绝**。I/O 在 `compile-design.ts`。
//
// 拆开的理由与票 08 的 `build-visual-world.ts` 一样：这一半**不碰网络**，
// 所以「注入对不对」「拒绝判得对不对」可以**不用假 fetch 直接测** —— 那是最难写对的两件事。
//
// ⚠️ **为什么这一步有装配步，而票 09 没有**（两票的对照，别以为谁写漏了）：
//   `GameIntentSpec` 里**没有一个字段是调用方才知道的**（它是「用户说了什么」，模型全知）；
//   而 `GameDesignSpec` 里有**三个**：`game.runtimeProfile` 是我们这一代外壳的**身份**、
//   `game.genre` 是 `RuntimeProfile.id`、`game.camera` 是世界视角的字面 ——
//   模型被要求**照抄**（票 08 让模型照抄 `style.id` 的同款），装配时**强制覆盖**。
//
// ⚠️ **R12 的拒绝发生在这里，而它「不是失败」**（票 10 的 Q3c）：
//   拒绝说的是「**这份设计做不出来**」，不是说「模型没干好」。所以调用方**不重采样**、
//   `failures[]` 里**不留痕**（那一发上游调用是**成功**的）。
//   把它和 `schema` 那些混在一个桶里，就是票 27 的 Q4(ii) 立 `CALL_FAILURES` 要治的病。
import {
  auditIntentCoverage, GameDesignSpecSchema,
  type Capability, type GameDesignSpec, type GameIntentSpec, type RuntimeProfile, type VisualWorldSpec,
} from "@game-maker/contracts";

/**
 * **相机模式 → 承载它需要的那条外壳能力**（票 10 的 Q1 ④ / Q3b(ii)）。
 *
 * ⚠️ `null` = **这一代的词表里没有能承载它的能力** ⇒ 一填就拒。
 * ⚠️ **别把它写成 `capabilities.some((c) => c.startsWith("camera:"))` 那种笼统判断** ——
 *   外壳的 `camera:parallax` 是**分层视差**，它不是一种相机模式；拿它当「支持任何相机」
 *   会把这个拒绝面**悄悄关掉**（俯视的参考图会静默通过，做出一个视角不对的游戏）。
 *   第二代的成员落地那天，往这张表里加一行 —— 它和 `RuntimeProfile` 一样是**留的位**。
 */
export const CAMERA_MODE_NEEDS: Record<VisualWorldSpec["camera"]["mode"], Capability | null> = {
  side: "camera:side-scroll",
  "top-down": null,
  isometric: null,
  "first-person": null,
  other: null
};

/** 一条拒绝的**理由**。⚠️ 闭集 —— 加一档就是加一个值（与 `CALL_FAILURES` 同款纪律）。 */
export const REJECT_REASONS = [
  "intent-entity-missing",   // 意图里的实体在设计层没有对家
  "intent-mechanic-missing", // 意图里的机制在设计层没有对家 —— R12 今天最常响的那一档
  "camera-unsupported",      // 参考图的视角，这一代外壳承载不了
  "mechanic-unsupported",    // 设计层填了一条 profile 没有的机制（今天恒空）
  "capability-unsupported"   // 设计层要了一条 profile 没有的能力（今天恒空）
] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type Rejection = { reason: RejectReason; detail: string };

export type BuildDesignInput = {
  /** 模型吐出来的那一份（含它照抄的三个值 —— 我们会覆盖）。 */
  fromModel: GameDesignSpec;
  intent: GameIntentSpec;
  vws: VisualWorldSpec;
  /** **已解析**的那一代外壳。⚠️ 解析归调用方（查不到 = 调用方的错，不是设计的错）。 */
  profile: RuntimeProfile;
};

export type BuildDesignOutcome =
  /** 过完契约（**含顶层那条 gate**）的成品。 */
  | { ok: true; spec: GameDesignSpec }
  /** 模型没干好 ⇒ 调用方**重采样**。 */
  | { ok: false; kind: "schema"; detail: string }
  /** 做不出来 ⇒ 调用方**立刻停、不重采样**（R12）。 */
  | { ok: false; kind: "rejected"; rejections: Rejection[]; detail: string };

/** 三个照抄值的唯一来源。⚠️ 取值口径见 `game-design.ts` 里 `game.genre` / `game.camera` 的注释。 */
export const callerKnownGame = (profile: RuntimeProfile, vws: VisualWorldSpec) => ({
  genre: profile.id,
  camera: vws.camera.mode,
  runtimeProfile: { id: profile.id, version: profile.version }
});

/**
 * 意图里的实体与机制，**在设计里都有对家吗**（票 10 的 Q3b(i)）。
 *
 * ⚠️ 这是 R12 **今天最常响**的那条，也是本票唯一能看见它的地方：意图层的 `mechanics[].name`
 *   是**自由文本**（票 03 故意留的），设计层的 `mechanic` 是**封闭枚举** ——
 *   用户要「二段跳」，那一格**填不出来**。
 *
 * ⚠️ **它是单向的**（票 10 的 R2-Q1 裁定）：查的是 **意图 ⊆ 设计**。
 *   设计层是「**意图覆盖 + 需求补全**」，**不是**意图的镜像 ——
 *   **它可以多**（需求说得出来、意图没点名的实体，那叫补全，是它的活），
 *   **不可以少、不可以改、不可以串桶**。
 *   ⇒ 这里**不查**「设计里多出来的东西」：那是**合法的**，而「多出来的那个有没有依据」
 *     （依据是需求还是模型自己的口味）**不可机械判定** ⇒ 它**不是判据**（R3：判据只收
 *     「精确可算 + 错了一定不是设计」），只活在提示词纪律里。谁也别把它写成一条永远绿的判据。
 *
 * ⚠️ **票 19 之后本函数只剩「话」**：集合差是 `contracts` 的 `auditIntentCoverage()`
 *   —— 本包与 QA 的意图族共用它。而**文本那一半在这两处都不存在**（票 19 量出它 0% 命中，
 *   见那个文件的头一）。
 */
function intentCoverage(design: GameDesignSpec, intent: GameIntentSpec): Rejection[] {
  // ⚠️ **集合差本身住 contracts**（`auditIntentCoverage`，票 19 抽上来的）—— 这里只剩**话**。
  //   抽的理由：QA 的意图族要用**同一处实现**（`packages/qa` 的白名单只有 `contracts`，
  //   够不着本包），而写第二遍就是第二份真相（`auditReferences` 被抽出去的同款动作）。
  return auditIntentCoverage(intent, design).map((m): Rejection => {
    if (m.kind === "mechanic")
      return {
        reason: "intent-mechanic-missing",
        detail: `意图里的机制「${m.saidAs}」（\`${m.id}\`）在设计层没有对家。⚠️ 设计层的机制是**封闭枚举** ` +
          "（只有外壳真做得了的那几条），所以这条要么**外壳做不了它**、要么**它被丢掉了** —— " +
          "两种都算 R12 的拒绝：**别把用户要的东西悄悄做丢**。" +
          "（若确实做不了，把那句话从需求里去掉，或者换一代外壳。）",
      };
    return {
      reason: "intent-entity-missing",
      detail: `意图里的 ${m.type}「${m.saidAs}」（\`${m.id}\`）在设计层的 \`${m.bucket}\` 里没有对家 —— ` +
        "用户点名要的东西**不许悄悄做丢**（票 03 §11 防的就是这个）" +
        // ⚠️ **串桶与「没做」是两种结论，而这句话是给人改需求看的**（票 19 的 Q12）：
        //   不说清的话，人会去那个空桶里找一个**就在隔壁**的东西。
        (m.foundIn === undefined
          ? ""
          : `。⚠️ 但它**其实落在 \`${m.foundIn}\` 里** —— 这是**串桶**（同一个 id 换了 \`type\`），` +
            `不是没做：把它的 \`type\` 按意图改回来（意图层说的是 \`${m.type}\`）`),
    };
  });
}

/** 参考图的视角，这一代外壳承载得了吗（票 06 把这条押在了本票上）。 */
function cameraSupported(profile: RuntimeProfile, vws: VisualWorldSpec): Rejection[] {
  const mode = vws.camera.mode;
  const need = CAMERA_MODE_NEEDS[mode];
  const boxed = profile.capabilities.filter((c) => c.startsWith("camera:")).join(" / ");
  if (need !== null && profile.capabilities.includes(need)) return [];
  return [{
    reason: "camera-unsupported",
    detail: `参考图给的相机模式是 \`${mode}\`，而 ${profile.id}/v${profile.version} 承载不了它` +
      `（这一代只有 ${boxed}）—— ⇒ **这个世界的视角做不出来**，换一张参考图，或者等下一代外壳`,
  }];
}

/** 两条差集。⚠️ **今天恒空**（票 05 的自白）—— 写下来是**给第二个成员留的位**。 */
function profileDifferences(design: GameDesignSpec, profile: RuntimeProfile): Rejection[] {
  const out: Rejection[] = [];
  const mechs = new Set<string>(profile.mechanics);
  for (const m of design.mechanics)
    if (!mechs.has(m.mechanic))
      out.push({ reason: "mechanic-unsupported", detail: `设计里填了 \`${m.mechanic}\`，而 ${profile.id}/v${profile.version} 不做这条机制` });
  const caps = new Set<string>(profile.capabilities);
  for (const c of design.runtimeRequirements)
    if (!caps.has(c))
      out.push({ reason: "capability-unsupported", detail: `设计要了能力 \`${c}\`，而 ${profile.id}/v${profile.version} 没有它` });
  return out;
}

/**
 * 注入三个照抄值 → 过契约（gate 在这里响）→ 跑 R12 的拒绝 → 交成品。
 *
 * ⚠️ **顺序是有意的**：契约先过（连契约都不过的文书，谈「做不做得出」没有意义），
 *   然后**一次把所有拒绝都算出来** —— 拒绝是给人改需求用的，一条一条报会让人来回跑。
 */
export function buildDesign(input: BuildDesignInput): BuildDesignOutcome {
  const { fromModel, intent, vws, profile } = input;
  const candidate: GameDesignSpec = {
    ...fromModel,
    game: { ...fromModel.game, ...callerKnownGame(profile, vws) }
  };

  const parsed = GameDesignSpecSchema.safeParse(candidate);
  if (!parsed.success) {
    return {
      ok: false, kind: "schema",
      detail: parsed.error.issues.slice(0, 4).map((i) => `${i.path.join(".")}: ${i.message}`).join("；")
    };
  }

  const design = parsed.data;
  const rejections = [
    ...cameraSupported(profile, vws),
    ...profileDifferences(design, profile),
    ...intentCoverage(design, intent)
  ];
  if (rejections.length > 0)
    return { ok: false, kind: "rejected", rejections, detail: rejections.map((r) => r.detail).join("；") };

  return { ok: true, spec: design };
}
