// P0-02a 的落点：**第六条判据 `layer-coverage` 自己的跑法**（2026-10-22）。
//
// 以前它**不跑**：层覆盖由装配期（`pack.ts`）的硬失败保证，而 `packages/qa` 的白名单只有
// `contracts` ⇒ 合成器只写一条 `ran: false`，于是 `checked` 恒 5/6、裁决恒 `incomplete`。
// P0-02a 把「说真话」变成「真去查」：本文件按 `QaContext` 里已经落盘的 config + manifest
// 重跑**同一个** `auditLayerCoverage`。
//
// ─────────────────────────────────────────────────────────────────────────────
// 一、⚠️ **这不是第二份事实源**（P0-02 范围文档点名的那条风险）
//
//   规则（`layerDrawnSize` / `auditLayerCoverage`）与**入参的来路**
//   （`backgroundLayerEntries`）都住 `contracts`；`compile-runtime`（`assets`）与这里
//   调的是**同一个函数**。本文件只做三件事：读两份产物、把视口传进去、把 `ConfigIssue`
//   投影成 finding。
//
// ─────────────────────────────────────────────────────────────────────────────
// 二、⚠️ **它仍不属于任何族**（`CONTEXT.md` 的「族 ≠ 判据」）
//
//   三个族各声明自己那几条，这一条由**合成器**（`assemble.ts`）在汇合处**直接跑** ——
//   那正是 P0-02 范围文档给的「或在 `assemble.ts` 中真正运行」那条路。
//   ⇒ 不要去 `visual.ts` / `gameplay.ts` / `intent.ts` 里给它安一个族籍：
//     它要的是 config + 包清单 + 视口，不是任何一族已经读进来的那一份。
//
// ─────────────────────────────────────────────────────────────────────────────
// 三、链上它**恒绿** —— 而那不是删掉它的理由（与 `gameplay.ts` 的 `reference-resolution` 同款）
//
//   `compile-runtime` 在 `auditLayerCoverage` 的 error 上就**抛**（连 config 都不落），
//   ⇒ 走到 QA 的 config 必然已经全绿。仍然要跑，因为 QA 是**交付态的自述**：
//   它得能在一份任意的「包 + config」上说出话（standalone 调用方、手工改过的包）。
//   而「真跑」与「补一条 `ran:false`」的区别，正在于**坏输入时它会不会响** ——
//   `qa/tests/layers.test.ts` 用一份故意改坏的包证明了它会响。
import fs from "node:fs";
import {
  auditLayerCoverage, backgroundLayerEntries, parseAssetPack, parseGameConfig,
  type ConfigIssue, type JudgementResult, type QAFinding, type QaContext,
} from "@game-maker/contracts";

/** ⚠️ 坏 JSON 要说得清**是哪一样东西、哪个文件**（与三个族同一条 `read`）。 */
const read = (p: string, what: string): unknown => {
  try { return JSON.parse(fs.readFileSync(p, "utf8")); }
  catch (e) { throw new Error(`${what}读不出来或不是 JSON：${p} —— ${(e as Error).message}`); }
};

/**
 * 跑 `layer-coverage`。⚠️ 读不回来 / 不过契约 ⇒ **抛**（与三个族同一条纪律：
 * 「该跑却跑不了」是硬失败，不是一条判据的失败 —— 一份半截报告比没有报告更坏）。
 */
export function layerCoverageJudgement(ctx: QaContext): JudgementResult {
  const manifest = parseAssetPack(read(`${ctx.packDir}/manifest.json`, "包清单"));
  if (!manifest.ok) throw new Error(`包清单读不回来或不过契约：${manifest.errors.slice(0, 4).join("；")}`);
  const config = parseGameConfig(read(ctx.configPath, "配置"));
  if (!config.ok) throw new Error(`配置读不回来或不过契约：${config.errors.slice(0, 4).join("；")}`);

  const entries = backgroundLayerEntries(
    config.value.scene.background.asset, config.value.world.size, manifest.value.assets);
  // ⚠️ **解不到那件背景 ⇒ entries 空 ⇒ 一条都不报**：那件事已经由引用族报过，
  //   再报一遍就是把一次拒绝说第二遍（见 `contracts/layer-coverage.ts` 的 helper 尾注）。
  const issues = auditLayerCoverage(ctx.viewport, config.value.world.size, entries);
  return { ran: true, findings: findingsOf(issues, entries) };
}

/**
 * 一条坏层 = 一条 finding。
 *
 * ⚠️ `target` 用**账的词汇**里那一格「资源 id（`<id>.<动画|层名>`）」—— 坏层的名字
 *   （`backgroundLayerEntries` 拼的 `${资源 id}.${层名}`）正好就是这个形状。
 *   ⇒ 修复循环读到它就知道**是哪一层**；而这一层由 config（世界尺寸、引用）与包
 *   （parallax / tileable / 标称尺寸）共同决定，所以两段都可能要重跑。
 * ⚠️ 一条 `(judgement, target)` 只报一次（契约 `superRefine` ②）—— `where` 逐层唯一，
 *   于是这里逐条投影不会撞键。
 * ⚠️ 严重度**逐条照搬**（只有 `error` 决定裁决）。
 */
function findingsOf(
  issues: readonly ConfigIssue[], entries: readonly { where: string; name: string }[],
): QAFinding[] {
  return issues.map((i) => ({
    target: entries.find((e) => e.where === i.where)?.name ?? "scene.background",
    detail: i.message,
    severity: i.severity,
  }));
}
