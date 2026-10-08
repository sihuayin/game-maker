// 票 18 的落点：**Gameplay QA 的判据那一半**（`docs/v2/03-claude-code.md §22`）。
//
// ⚠️ **本票的射程一句话**：把玩法那两条判据接进 QA —— **引用族**与**可达性**。
//   不跑游戏（Playwright / headless 那一簇本图不做）· 不新增 similarity · 不重算上游判据。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、`§22` 那十项里，**只有一项半是设计的事**（票 18 的 Q3）
//
//   十项 = boot / spawn / input / movement / collision / interaction / pickup / goal / win / lose。
//
//   ⚠️ **input · movement · collision · interaction · win · lose 这六项一条判据都不立** ——
//     它们是**外壳的行为原语**（`vocabulary.ts` 的 `CAPABILITIES`，而 `runtime-profile.ts`
//     已经断言「这一代实现了哪些」）。**每一关都一样**，所以它们不可能是「这一版设计错了」
//     的证据 —— 为它们立判据就是立一条**永远绿**的判据（票 17 删掉那两条的同款病）。
//   ⚠️ **boot** 也不是判据：数据能不能装配成场景由契约解析 + `buildWorld` 的「**绝不抛**」
//     守着（坏数据画占位符、不白屏）。
//   ⇒ 剩下的：**spawn** 归自洽族（`compile-runtime` / `site` 硬失败，**不在本族**）·
//     **pickup / goal** 归下面这两条（引用解得到 + 够得到）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、⚠️ **引用族在链上恒绿 —— 那是一条要写下来的自白，不是删掉它的理由**（票 18 的 Q1）
//
//   链的步序是 `pack → config → qa`，而 `compile-runtime` 在 `auditGameConfig` 的 error 上
//   **抛**（连 config 文件都不落）⇒ **能走到 QA 的那份 config，必然已经全绿**。
//   ⇒ `reference-resolution` 在新链上**响不了**。为什么仍然接线：
//     ① 判据的名字与家是票 06 定的（`qa.ts` 明写「住 `game-config.ts` 的 `auditGameConfig`」）；
//     ② `incomplete` 若成为**恒态**，那个值就失去了信号 —— 它是票 06 专为「没查」留的名字；
//     ③ QA 是**交付态的自述**：它要能在一份任意的「包 + config」上说得出话，
//        `compile-runtime` 只是**其中一个**调用者。
//   ⚠️ 而它**真的会响**：`tests/gameplay.test.ts` 拿一份**故意损坏**的 config 证明了这件事。
//
//   同一条纪律的另一面：**本族只吃引用族**（`auditReferences`），**不吃** `auditGameConfig`
//   的自洽族（东西摆在世界外 · 出生点卡在墙里）—— 那些归 `compile-runtime` / `site` 的硬失败，
//   再报一遍就是把一次拒绝说第二遍（票 14 的 Q5 裁过同款）。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、可达性**不跑游戏**（票 18 的 R2-Q2）
//
//   「跑游戏」那一簇（Runtime Bridge / 语义测试动作 / Playwright）在 `game-creation-v1`
//   就已经推掉，本图**没有把它请回来**。取而代之的是 `contracts` 里一条**纯层的静态可达性**
//   （`auditReachability`）：从出生点出发，用**故意过宽**的移动模型做一次 BFS，
//   **只报够不到**的终点与拾取物。规则与那条「过宽为什么是对的」写在那个文件的头部。
//
// ─────────────────────────────────────────────────────────────────────────────
// 四、⚠️ **一条判据至多一条 finding，`target` 恒 `game-config`**（票 18 的 Q4）
//
//   契约的 `superRefine` ②：「**同一 `(judgement, target)` 不许重复** —— 细节并进 `detail`」。
//   而 `target` 复用**账的词汇**（`recipe` / `game-config` / 资源 id），**不是** `ConfigIssue.where`
//   那种人话。⇒ 这一族的两个 `target` 都只能是 `game-config`（整份配置是同一次调用产出的），
//   逐实体拆会**暗示**一个并不存在的「只重跑这一个实体」的粒度 —— 而修复循环（票 21）
//   重跑的是整份 config 那一发。⚠️ 于是**局部性靠 `detail` 里那行 `where` 前缀**保留下来。
import fs from "node:fs";
import {
  auditReachability, auditReferences, parseAssetPack, parseGameConfig,
  type ConfigIssue, type QaContext, type QaFamilyResult, type QaFamilyRunner, type JudgementResult,
} from "@game-maker/contracts";

/** ⚠️ 坏 JSON 要说得清**是哪一样东西、哪个文件**（`JSON.parse` 的原话里只有后者）。 */
const read = (p: string, what: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new Error(`${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
};

/**
 * **玩法族**的 `QaFamilyRunner` —— 本包的第二份实现（第一份是 `visual.ts`）。
 *
 * ⚠️ 它**只声明自己那两条**（`reference-resolution` / `reachability`），其余四条缺席 = 不归我。
 * ⚠️ 「该跑却跑不了」是**抛**（契约不过 / 文件读不回来就是调用方的输入问题，不是一条判据的失败）
 *   —— 与 `visual.ts` 读不到清单时同款（票 18 的 R3-Q1）。
 */
export const gameplayQaRunner: QaFamilyRunner = async (ctx: QaContext): Promise<QaFamilyResult> => {
  const manifest = parseAssetPack(read(`${ctx.packDir}/manifest.json`, "包清单"));
  if (!manifest.ok) throw new Error(`包清单读不回来或不过契约：${manifest.errors.slice(0, 4).join("；")}`);
  const config = parseGameConfig(read(ctx.configPath, "配置"));
  if (!config.ok) throw new Error(`配置读不回来或不过契约：${config.errors.slice(0, 4).join("；")}`);

  return {
    judgements: {
      "reference-resolution": merged("game-config", auditReferences(config.value, manifest.value)),
      reachability: merged("game-config", auditReachability(config.value, manifest.value))
    },
    // ⚠️ **空着** —— 本族不产观察（`inspect` 归票 20、`review` 归票 22），
    //   而**不许**拿 `unavailable` 表示「不归我」（见 `visual.ts` 文件头五）。
    observations: []
  };
};

/**
 * 一批 `ConfigIssue` → **一条** finding（见文件头四）。
 *
 * ⚠️ **一条都不留 `where` 之外的判断**：严重度逐条照搬（只有 `error` 决定裁决），
 *   而没有问题就是**空数组**（票 06：「成功」不是一个变体，是这个数组空着）。
 * ⚠️ 多行 `detail` 里的每一行都带 `where` 前缀 —— 那是**唯一的局部性**来源
 *   （合成一条 finding 的代价，见文件头四）。
 */
function merged(target: string, issues: readonly ConfigIssue[]): JudgementResult {
  if (issues.length === 0) return { ran: true, findings: [] };
  return {
    ran: true,
    findings: [{
      target,
      // ⚠️ 一条 error 就够让整条判据是 error —— 而 `warning` **不阻断**（票 06 §二）。
      severity: issues.some((i) => i.severity === "error") ? "error" : "warning",
      detail: issues.map((i) => `${i.where}: ${i.message}`).join("\n")
    }]
  };
}
