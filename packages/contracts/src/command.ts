// 一次操作的**对外回报形状** —— 两个壳（CLI / MCP）与所有 core 操作共用的那一份。
//
// ⚠️ **2026-09-29 从 `packages/assets` 搬到这里**（票 33）。理由：`site` 装配住在
//   `@game-maker/demo`，而依赖图里 **demo 只能依赖 contracts**（R6：A 与 B 可独立交付）——
//   拿不到这一份，demo 就只能自己再写一个「长得差不多」的回报形状，
//   而那正是本仓库反复吃的那个亏（两边各写一份必然漂移）。
//   `assets` 仍然**原样再导出**，所以两个壳与既有调用方一行都不用改。
//
// ⚠️ 它是**纯形状 + 两个小工具**，不含任何业务：退出码语义、失败的载体。
import type { LedgerCall } from "./ledger.js";
export type CommandResult = {
  command: string;
  /** 人类可读的几行。CLI 直接打印，MCP 放进 content。 */
  summary: string[];
  /** 机器可读的载荷。**路径一律相对 `outRoot`**（票 30：绝对路径会把「产物在哪儿」与「这台机器上的哪里」绑死）。 */
  data: Record<string, unknown>;
  /** 产物（相对 `outRoot` 的路径 + 种类）。 */
  artifacts: { path: string; kind: string }[];
};

/**
 * 退出码语义。
 * ⚠️ **2026-09-25 起 `upstream`(3) 变得可达了** —— 降级链拆掉之后，上游死活不再被兜底吸收，
 * 生成失败就是失败。此前 `pack` 永远不会返回 3（死活都出包，只是产物难看）。
 */
export const EXIT = { ok: 0, failure: 1, usage: 2, upstream: 3, invalid: 4 } as const;

/**
 * 失败**不**放进 `CommandResult.outcome` —— 它抛。这样「成功」这个类型里没有假货。
 *
 * ⚠️ **`ledger`（票 46）**：失败时**已经花掉的那几笔**跟着异常一起走。
 *   理由很直白 —— 包没产出来，所以没有 `ledger.json` 可写；
 *   而**花了钱是事实，失败不改变这个事实**（与 R3「诚实是结构性的」同一条纪律）。
 *
 * ⚠️ 它**不是 outcome**：`CommandResult` 那条「成功这个类型里没有假货」的纪律照旧。
 *   **不要为了让账有地方放，就把失败塞回 `CommandResult`** —— 那是用「成功类型里掺假」
 *   换一处方便，正好换掉了当初立这条规矩要防的东西。
 */
export class CommandError extends Error {
  readonly ledger?: LedgerCall[];
  /**
   * **失败现场留在哪**（2026-09-30 · 票 01）。
   *
   * ⚠️ 只有 `pack` 会带它：生图那条路一次失败就是几笔**已经付过钱**的调用，
   *   而原图与逐字提示词在失败那一刻**就在磁盘上**（一张一落）。以前那是一次 `rmSync` 删掉的，
   *   现在改名留下 —— 这个字段把它说给调用方，`--json` 也带得出来。
   * ⚠️ 它是**失败现场**，不是包：不占版本号、`verify` / `inspect` 都不认它。
   */
  readonly failureDir?: string;
  constructor(
    readonly kind: keyof typeof EXIT, message: string,
    opts: { ledger?: LedgerCall[]; failureDir?: string } = {},
  ) {
    super(message);
    this.name = "CommandError";
    this.ledger = opts.ledger;
    this.failureDir = opts.failureDir;
  }
}
export const exitCodeOfError = (e: unknown): number => (e instanceof CommandError ? EXIT[e.kind] : EXIT.failure);
