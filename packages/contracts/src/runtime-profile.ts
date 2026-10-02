// `RuntimeProfile` —— **外壳能力的**事实投影**，不是一份许愿单（R12 · 票 05）。
//
// ─────────────────────────────────────────────────────────────────────────────
// ⚠️ **本文件是 V2 契约 ⇒ 用 `zod/v4`**，封口一律 `z.strictObject`（票 28 定的边界，
//   理由与代价见 `structured-call.ts` 里 `toolInputSchema` 那一段）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、它是什么，以及**凭什么**叫事实（票 05 Q1 / Q10 / Q12）
//
//   它是「**这一代外壳能做什么**」的断言。被 `GameDesignSpec.game.runtimeProfile`
//   **引用**（`{id, version}`，票 03 Q5），由 Runtime Compiler（票 14）拿它**拒绝**
//   填不出来的设计（R12）。
//
//   ⚠️ **「事实性」由测试保证，不由类型保证。** 三件事要说清：
//
//     ① **真正机器派生的只有一条**：`EntityKind → MECHANICS`（`vocabulary.test.ts` 的
//        `ENTITY_KIND_FATE`）。其余是**带行号的转录** —— `CAPABILITIES` / `MECHANICS`
//        的每一条注释里都写着它投影的那一行外壳代码（`shell/scene.ts:109` 那种）。
//     ② 转录的代价由**见证判据**付掉：`packages/demo/tests/shell-capability-witness.test.ts`
//        逐条读外壳源码、断言那条**行为串**还在（票 05 Q11）。把 `scene.ts` 的
//        `setScrollFactor(l.parallax)` 删掉 ⇒ 能力表当场响。
//     ③ **外壳不 import 本文件**（票 05 Q10）。曾经想让「外壳 import 它 + 穷尽分派 ⇒
//        漂移是编译错误」，量下来立不住：外壳对**实体种类**的穷尽性**已经**由
//        `scene.ts:140-161` 那个 switch 对 `EntityKind` 自动取得（v3 的 `z.infer` 就是
//        判别联合），而 `capabilities` / `mechanics` 是**不可分派的字符串**
//        （`"hud:screen-space"` 不是一个 `case`）—— import 进来也无处可 switch。
//        ⇒ 本契约是**读侧**的（票 10 / 票 14 读它），**不是外壳的依赖**。
//          让外壳 import 一份它不消费的常量，是「零消费者的引用」——
//          `CONTEXT.md:64-69` 的 `GameSpec` 病。
//
//   ⇒ R12「与 `shell.js` **同源同算**」的落地含义（Q12）=
//     **同源**（都从 `game-config.ts` 的四条构造出发）＋ **转录** ＋ **见证判据**。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、两个数组**今天恰好等于词表全集** —— 这是**故意的**，不是把关（票 05 Q2 / Q6）
//
//   `PLATFORMER_V1.mechanics` ⟺ `MECHANICS`、`.capabilities` ⟺ `CAPABILITIES`。
//   ⇒ `game-design.ts` 那两条求差（`mechanics − profile.mechanics`、
//     `runtimeRequirements − profile.capabilities`）在 `platformer/v1` 上**恒为空**。
//
//   ⚠️ **这不是「一条写坏了的判据」，是给第二个成员留的位。** 今天真正在拒绝的是
//     **封闭枚举本身**（想填 `double-jump` 就填不出来，票 10 §3③）—— 免费、且在生图之前。
//   ⚠️ **词表不是外壳的全集**：`vocabulary.ts` 是从 `game-config/v1` 反推的，所以它是
//     **横版**的全集。塔防那个成员（纯鼠标输入、无相机跟随、无视差）**不在表里**。
//     分工是：**`vocabulary.ts` 是名字的家**（三份契约的公共依赖，谁也不拥有它），
//     **`RuntimeProfile` 是「这一代实现了其中哪些」的断言语** ——
//     第二个成员落地那天，这张断言**才开始说话**。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、身份：`id` + `version`，显示成 `<id>/<version>`（票 05 Q3 / Q8）
//
//   ⚠️ `platformer/v1` 是**拼出来的**（`runtimeProfileRef`），不以字面量存在 ——
//     存两种拼法就是两个事实源。
//   ⚠️ `version` 是 `"1"` **不是** `"v1"`：那个拼法一度散在测试 fixture 里，已清。
//   ⚠️ **不加 `format: z.literal(...)` 判别式**：判别式的用途是「落盘之后证明这是哪一族」
//     （票 02 的原话），而本契约**不落盘**（Q5）—— `01 §13` 的 `run/v<N>/` 九项里没有它。
//     它是**外壳的事实**，不是这一次运行的产物；设计层存的是 `{id, version}` **引用**。
//   ⚠️ `id` / `version` **不许含 `/`** —— 否则 `<id>/<version>` 不是单射，拼回去就散架。
//   ⚠️ 身份是**自己一根计数器**（Q3(b)）：`SHELL_VERSION`（`draw.ts`）是**外壳级**的
//     （一份 bundle 带两种玩法），profile 是**代级**的，两者正交。
//     不把 `SHELL_VERSION` 抄进来 —— 那注定是一份会分叉的副本。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、**只有四个字段**（R7 的门：说不出具名消费者的不进契约）（票 05 Q4 / Q7）
//
//   砍掉的六个，连同死因：
//     `inputModel`      —— 零消费者。
//     `entityTypes[]`   —— 零消费者。`EntityKind` 是**渲染桶**，设计层四个桶是**角色**，
//                          两轴不同；而「外壳实现了哪些 kind」`ENTITY_KIND_FATE` 已经断言过。
//     `winConditions[]` —— 设计层同名字段是**自由文本**（`game-design.ts`），
//     `loseConditions[]`   封闭表减自由文本**是噪声不是判据**。
//     `cameraModel`     —— **可派生的副本**，不是零消费者（更糟）：取值域就是
//     `genre`             `capabilities` 里的 `camera:*`，而 `genre` 的值就是 `id`。
//                         同票 04 砍 `bodyProportions`（`headCount` 的可派生副本）的理由。
//   ⇒ `compile-design`（票 10）要相机 / 题材的取值，**现从 `id` 与 `capabilities[]` 取**，
//     不要为它另立字段。

import { z } from "zod/v4";
import { CAPABILITIES, CapabilitySchema, MECHANICS, MechanicSchema } from "./vocabulary.js";

/** 身份。⚠️ 两段都不许含 `/` —— `<id>/<version>` 必须是单射（见文件头 §三）。
 *  它是 `GameDesignSpec.game.runtimeProfile` 的**同一份形状**（票 03 Q5），
 *  所以那一处引本 schema，不另写一个内联的。 */
export const RuntimeProfileRefSchema = z.strictObject({
  id: z.string().min(1).regex(/^[^/]+$/, "`/` 是 <id>/<version> 的分隔符，两段都不许含它"),
  version: z.string().min(1).regex(/^[^/]+$/, "`/` 是 <id>/<version> 的分隔符，两段都不许含它")
});
export type RuntimeProfileRef = z.infer<typeof RuntimeProfileRefSchema>;

/** 断言语本体。⚠️ 两个数组**封闭在词表上**（`vocabulary.ts`）—— 不许在别处再立第二张表。 */
export const RuntimeProfileSchema = RuntimeProfileRefSchema.extend({
  mechanics: z.array(MechanicSchema),
  capabilities: z.array(CapabilitySchema)
});
export type RuntimeProfile = z.infer<typeof RuntimeProfileSchema>;

/** `platformer/v1` —— **渲染形式**，不是存储形式（票 05 Q8）。
 *
 *  ⚠️ **`v` 是显示用的前缀，不存进 `version`**（semver 的惯例：存 `1.2.3`、显示 `v1.2.3`）。
 *    落地时量到过一处打架：Q8 同时冻结了「`version: "1"`」与「渲染形式是 `platformer/v1`」，
 *    而纯拼接给的是 `platformer/1` —— 与 `01 §8` · `03 §11` · 地图 R4 全篇的 `platformer/v1` 对不上。
 *    两种收口办法，选了改这一行而不是改全仓库：
 *      ① 渲染时补 `v`（**本文件**）—— 对外的名字一个字不动。
 *      ② 正名为 `platformer/1` —— 要改 `01 §8` · `03 §11/§20` · 票 14/15/31，
 *         并且**重开 R4**（R17：改 R 表必须重新开票）。
 *    ⚠️ 代价：`version` 若真写成 `"v1"` 会渲染成 `vv1` —— 不设判据拦它，
 *      因为那会把「未来可能出现的 `v2-beta` 那种版本名」一起拦掉，而它没做错什么。 */
export const runtimeProfileRef = (ref: RuntimeProfileRef): string => `${ref.id}/v${ref.version}`;

/** 第一阶段（R4）**唯一**的成员。
 *  ⚠️ 两个数组**故意**等于词表全集 —— 见文件头 §二，那不是把关，是给第二个成员留的位。
 *  ⚠️ 用展开而不是直接赋值：词表是 `as const` 的只读数组，而这里不该让读者
 *     以为自己拿到的是同一块内存。 */
export const PLATFORMER_V1: RuntimeProfile = {
  id: "platformer",
  version: "1",
  mechanics: [...MECHANICS],
  capabilities: [...CAPABILITIES]
};

/** 族的注册表（R4：`RuntimeProfile` **成族**）。今天一个成员 —— 塔防**不进新链**（R4），
 *  它的成员等真有人要时再加（见地图的「Not yet specified」）。 */
export const RUNTIME_PROFILES: readonly RuntimeProfile[] = [PLATFORMER_V1];

/** 把 `{id, version}` **引用解析**成真的 profile。
 *  ⚠️ 查不到返回 `undefined` —— **那就是拒绝的素材**（票 03 Q5：「单一个名字对不上版本，
 *     拒绝时说不出是哪一代的能力」）。谁来拒绝、在哪一刻拒绝，是票 10 / 票 14 的事。 */
export function resolveRuntimeProfile(ref: RuntimeProfileRef): RuntimeProfile | undefined {
  return RUNTIME_PROFILES.find((p) => p.id === ref.id && p.version === ref.version);
}
