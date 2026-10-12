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
 *
 * ⚠️⚠️ **2026-10-12（[票 49](../../../.scratch/game-maker-v2/issues/49-compiletdgame-mislabels-errors.md)）：3 只留给「上游死活」——「我们的代码坏了」一律落 1**。
 *   判据是**抛点**，不是错误的**类**：一个 `try` 里若已经把上游失败**显式**抛成了
 *   `CommandError("upstream")`，那么同一个 `try` 里剩下的抛点（纯函数、审计、派生）
 *   **只可能是我们的 bug** ⇒ 它们必须**原样抛出**（1 + 原始栈），**不许**被兜底重包成 3 ——
 *   否则调用方会按「上游的锅」去重试、去查网络，而重试一万次都一样。
 *   ⚠️ 它与「失败时带不带账」**是两把尺子、各答一问**：那把看**花费**（票 46/48），
 *   这把看**抛点**（票 49）—— **不许合并**（合并之后「花钱之后才发现我们代码坏了」会被报成
 *   「没花钱」）。先例：`ops.ts` 的 `compileTdGame`。
 */
export const EXIT = { ok: 0, failure: 1, usage: 2, upstream: 3, invalid: 4 } as const;

/**
 * 失败**不**放进 `CommandResult.outcome` —— 它抛。这样「成功」这个类型里没有假货。
 *
 * ⚠️ **`ledger`（票 46）**：失败时**已经花掉的那几笔**跟着异常一起走。
 *   理由很直白 —— 失败时没有**包**，所以没有包内 `ledger.json` 可读；
 *   ⚠️ **2026-10-12（[票 36](../../../.scratch/game-maker-v2/issues/36-failure-ledger.md)）**：
 *   抛点之后的**失败现场**里现在另有一份 `ledger.json`，但那一份要**先知道现场在哪**才读得到
 *   —— 跟着异常走的这一份是给人**当场**看见的，两者不互相顶替。
 *   而**花了钱是事实，失败不改变这个事实**（与 R3「诚实是结构性的」同一条纪律）。
 *
 * ⚠️ 它**不是 outcome**：`CommandResult` 那条「成功这个类型里没有假货」的纪律照旧。
 *   **不要为了让账有地方放，就把失败塞回 `CommandResult`** —— 那是用「成功类型里掺假」
 *   换一处方便，正好换掉了当初立这条规矩要防的东西。
 *
 * ⚠️⚠️ **2026-10-12（[票 48](../../../.scratch/game-maker-v2/issues/48-error-carries-ledger.md)）：这个字段不再是唯一的载体**。
 *   两个壳**一律按能力读**（`ledgerOfError` / `failureDirOfError`），
 *   因为它们带的那一份**可以挂在任何异常上**（`carryOnError`）—— 见下面 `Carried` 那段。
 *   ⇒ **`instanceof CommandError` 不再是一种可用的读法**（用它 = 对裸 `Error` 报「没花钱」）。
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

/**
 * 异常上**带出来的东西** —— 两个壳按**能力**读，**不按类读**（2026-10-12 · 票 48）。
 *
 * ⚠️⚠️ **为什么是能力读、不是 `instanceof CommandError`**：
 *   票 46 §5 立过一条二分（「上游失败」/「代码 bug」），而实测第三类**漏了** ——
 *   「判据说这批图不行，**钱已经花完了**」（`pack` 段的判断，11 处）。
 *   票 48 的裁定：**该带账的判据是「失败时有没有已经发生的花费」**（`ledger.length > 0`），
 *   **不是**「抛的是哪个类」—— 因为**同一个抛点**在不同包形状下**有时免费、有时在花钱之后**
 *   （全 `import` / 全 drawlist 的包一分钱没花），按行号贴类标签会在那些行上**说谎**。
 *   ⇒ 于是**不重包成 `CommandError`**（那会**丢栈**，而丢栈正是票 46 §5 唯一的反对理由），
 *   改成**挂在原异常上、原样抛出** ⇒ 栈、错误类、`cause` 链**一样不丢**。
 */
export type Carried = { ledger?: LedgerCall[]; failureDir?: string };

/**
 * **把 `carried` 挂到异常上**（票 48 的 Q2 = A）。
 *
 * ⚠️ 三条边界，缺一条就是「错得安静」：
 *   · **没东西可带就什么都不做** —— 一分钱没花的真·代码 bug **原样抛出**，
 *     不包装、不凭空附加账（票 46 §5 那个二分要保住的第二格）。
 *   · **只能挂在可扩展的对象上**：冻过的异常对象 `Object.assign` 会抛 ⇒ 吞掉那个 `TypeError`，
 *     但**绝不**因此替换或吞掉**原异常**（那是本末倒置）。挂不上时这一份就只剩**失败现场**里那份
 *     （票 36 已经保证它在磁盘上）。
 *   · **只加不改**：不覆盖异常上**已有**的同名键 —— 下层挂上去的那一份比这一层更接近现场，
 *     覆盖它等于把更准的信息换成更糙的。
 */
export const carryOnError = (e: unknown, carried: Carried): void => {
  if (Object.keys(carried).length === 0) return;
  if (e === null || (typeof e !== "object" && typeof e !== "function")) return;
  try {
    for (const [k, v] of Object.entries(carried)) if (!(k in e)) (e as Record<string, unknown>)[k] = v;
  } catch { /* 冻过的异常：挂不上就挂不上，原异常照抛（见上） */ }
};

/** 异常上带的账（**空数组算没有** —— 「有花费」才是判据）。 */
export const ledgerOfError = (e: unknown): LedgerCall[] | undefined => {
  const v = (e as Carried | null | undefined)?.ledger;
  return Array.isArray(v) && v.length > 0 ? v : undefined;
};

/** 异常上带的失败现场路径。⚠️ 它与账**是两项独立信息** —— 缺一项**不许**连另一项一起丢（票 48）。 */
export const failureDirOfError = (e: unknown): string | undefined => {
  const v = (e as Carried | null | undefined)?.failureDir;
  return typeof v === "string" ? v : undefined;
};
