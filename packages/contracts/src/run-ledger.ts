// `run-ledger/v1` —— **一次运行**的账（票 15 的 Q4/Q14）。
//
// ⚠️ **它和 `assetpack-ledger/v1`（票 45）不是同一个东西** —— 别把两者当「同一份账的两种缩略」：
//   · `pack/v<N>/ledger.json` 是**包的收据**：跟着包走（进 `files[]`、被 `verify` 校验 checksum），
//     只含**这一次构建**花掉的调用（生图 + 创作态母版 + drawlist 那几发文本）；
//   · `run/v<N>/ledger.json`（本文件）是**链级的**：整条理解链那几发文本调用 **∪** 包那一份。
//   ⇒ 两个文件回答的是两个问题：「这个包花了什么」看包里那份；「这一次运行总共花了什么」看 run 里那份。
//
// ⚠️ **它用 `zod`（v3），不是 `zod/v4`**。票 28 的边界是「V2 新契约 v4、旧契约 v3，两边不许互相嵌套」，
//   而 v4 那条路**唯一**的理由是 `toolInputSchema`（给模型看的线形状）—— 这一份**永远不是工具路**
//   （没有任何模型产出它）⇒ 它没有 v4 的必要；而它**必须**复用 `LedgerCall` / `LedgerStep`（v3 的），
//   硬套 v4 就得再镜像一份，而那正是「两份定义会漂」。
import { z } from "zod";
import { CallCount, LedgerCall, LedgerStep } from "./ledger.js";

export const RUN_LEDGER_FORMAT = "run-ledger/v1" as const;

/** `run/v<N>/ledger.json` 的形状。⚠️ 与包那份**同口径、不同射程**（见文件头）。 */
export const RunLedger = z.object({
  format: z.literal(RUN_LEDGER_FORMAT),
  /** 这次运行的**身份**（目录名就是它 —— 票 15 的 invariant 1）。 */
  gameId: z.string().min(1),
  /** 这一次运行的版本号（`run/v<N>` 的 N）。 */
  runVersion: z.number().int().positive(),
  createdAt: z.string().datetime({ offset: true }),
  run: z.object({
    /** ⚠️ **人等了多久** —— 与 `calls[].ms` 之和是两个不相加的量（并行之后差就是收益）。 */
    wallClockMs: z.number().int().nonnegative(),
    /** ⚠️ **只记发生过的步**（与包那份一条心：零调用的步不写出来）。 */
    byStep: z.record(LedgerStep, CallCount),
  }).strict(),
  /** 入账序。⚠️ **顺序不是契约**（并发下那是「开始的先后」，要按步找就按 `step` 找）。 */
  calls: z.array(LedgerCall),
}).strict();

export type RunLedger = z.infer<typeof RunLedger>;
