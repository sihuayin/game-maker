// **事后抽查一个包** —— `game-maker review <run 目录>` 的那一支（
// [票 78](../../../.scratch/game-maker-v2/issues/78-reviewpack-wiring.md)）。
//
// ⚠️⚠️ **它不是流水线的一环。** 人裁（票 78 · 逐字）：
//   「reviewPack 应成为**人主动调用的付费诊断命令**，而不是自动流水线的一环」。
//   ⇒ `reviewRun` **只被 CLI 那一支调**；`createGame` / `runBuild` / `runUnderstanding` **一个都不碰它**。
//   ⇒ 它也**不进** `qa-report.json` 的观察栏（那一条路另有其票，且合成器明写着「只装配、不采集」）。
//
// ⚠️ **它住在 `pipeline` 而不是 `assets` 或 CLI**，三条理由：
//   · `reviewPack` 要 `packDir`，而**包的路径**（`<outRoot>/<gameId>/pack/v<N>`）与
//     **run 的路径**都是这一层的知识；
//   · **记账**要写 `run/v<N>/ledger.json`（`recordRunSpend` 就在这个包里）；
//   · CLI 是**薄壳**（票 30 逐字：「它只做两件事：解析参数、渲染 `CommandResult`。…这里不许有业务判断」）。
import fs from "node:fs";
import path from "node:path";
import { CommandError, reviewPack } from "@game-maker/assets";
import { RUN_ARTIFACT } from "./artifacts.js";
import { recordRunSpend } from "./create-game.js";
import { StyleSpecSchema, type CommandResult, type LedgerCall, type StyleSpec } from "@game-maker/contracts";

const rel = (root: string, p: string): string => path.relative(root, p).split(path.sep).join("/");

/**
 * 某个 `gameId` 下**已有的最新**包目录 —— ⚠️ **不新建**。
 *
 * ⚠️ 为什么是「最新」而不是「这次运行产的那个」：**run 目录里没有记着它产了哪个包版本**
 *   （本票核过：`run/v<N>/game-config.json` 里**没有 pack 引用**，run 级账里也没有版本号）。
 *   ⇒ 能确定的只有「这个 gameId 下现在最新的包是哪一个」，而 `build` **每次都会产一个新的**
 *   ⇒ 那一个就是最近一次 `build` 的产物。⚠️ 所以**回报里必须把包路径印出来**（见下），
 *   免得人以为抽查的是别的一个包。
 */
function latestPackDir(outRoot: string, gameId: string): string | undefined {
  const dir = path.join(outRoot, gameId, "pack");
  if (!fs.existsSync(dir)) return undefined;
  const vs = fs.readdirSync(dir).map((d) => /^v(\d+)$/.exec(d)).filter((m): m is RegExpExecArray => m !== null)
    .map((m) => ({ n: Number(m[1]), dir: path.join(dir, m[0]) }));
  if (vs.length === 0) return undefined;
  return vs.sort((a, b) => b.n - a.n)[0]!.dir;
}

/** `run/v<N>/visual-world.json` 里那枚**原图**的绝对路径（票 78 的 Q5 要喂的那一张）。 */
function referenceOf(runDir: string): string {
  const p = path.join(runDir, RUN_ARTIFACT.visualWorld);
  let doc: { styleReferences?: { path?: string }[] };
  try { doc = JSON.parse(fs.readFileSync(p, "utf8")) as typeof doc; }
  catch (e) { throw new CommandError("invalid", `读不出 ${p}：${(e as Error).message}`); }
  const ref = doc.styleReferences?.[0]?.path;
  if (typeof ref !== "string" || ref === "")
    throw new CommandError("invalid", `${p} 里没有 \`styleReferences[0].path\` —— 抽查要一张**原图**当比对基准（票 78 的 Q5）。`);
  // ⚠️ 契约写着这条路径**相对于 `visual-world.json` 自身**（`artifacts.ts` 的 `writeVisualWorld`）
  return path.resolve(runDir, ref);
}

export type ReviewRunOptions = {
  /** `build` 打出来的那个 run 目录（`<outRoot>/<gameId>/run/v<N>`）。 */
  runDir: string;
  outRoot: string;
  /** 文本/视觉上游 —— 与其余命令同源（CLI 从 `ANTHROPIC_BASE_URL` / `ANTHROPIC_AUTH_TOKEN` 取）。 */
  transport: { baseUrl: string; apiKey: string };
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
};

/**
 * 抽查一次：**包的联系表 ＋ 原图** → 一份「哪里不像」的观察清单，并把这一发**记进 run 级账**。
 *
 * ⚠️ **两张图都喂**（票 78 的 Q5 = (乙)）：人裁逐字「联系表是被检查对象，原图是风格比对基准。
 *   **接线必须能同时取得两者**；不能只把联系表替换成原图」——
 *   而**原图不在包里**（本票量到）⇒ 它从 `run/v<N>/visual-world.json` 的 `styleReferences[0]` 取。
 *
 * ⚠️ **记账与「不阻断」是两件事**（人裁逐字：「不把「不阻断」误读成「可以不记账」」）：
 *   只要**发出了**那一发，无论成没成，都写进 `run/v<N>/ledger.json`；
 *   而**失败仍然以失败退出**（这个命令没有拿到它的产物）—— 「不阻断」说的是**它不挡任何产物**，
 *   不是「它自己不会失败」。
 */
export async function reviewRun(o: ReviewRunOptions): Promise<CommandResult> {
  const runDir = path.resolve(o.runDir);
  const gameId = path.basename(path.dirname(path.dirname(runDir)));
  const packDir = latestPackDir(o.outRoot, gameId);
  if (packDir === undefined)
    throw new CommandError("invalid",
      `\`${gameId}\` 下没有包（找的是 ${rel(o.outRoot, path.join(o.outRoot, gameId, "pack"))}/v<N>/）。\n` +
      "⚠️ 抽查读的是**包** —— 先跑 `game-maker build <run 目录>`（或 `create --yes`）。");

  // ⚠️ **风格规格从包里取**（票 78 量到：`authoring/stylespec.json` 过 `StyleSpecSchema`，
  //   而 `reviewPack` 要的 5 个键一个不缺）⇒ **不必再要一个 `--style`**。
  const sp = path.join(packDir, "authoring", "stylespec.json");
  let style: StyleSpec;
  try {
    const parsed = StyleSpecSchema.safeParse(JSON.parse(fs.readFileSync(sp, "utf8")));
    if (!parsed.success) throw new Error(parsed.error.message);
    style = parsed.data;
  } catch (e) { throw new CommandError("invalid", `包里那份 ${rel(o.outRoot, sp)} 读不出来或用不了：${(e as Error).message}`); }

  const referenceImagePath = referenceOf(runDir);

  const r = await reviewPack({
    packDir, style, referenceImagePath,
    baseUrl: o.transport.baseUrl, apiKey: o.transport.apiKey,
    ...(o.fetchImpl !== undefined ? { fetchImpl: o.fetchImpl } : {}),
    ...(o.timeoutMs !== undefined ? { timeoutMs: o.timeoutMs } : {}),
  });

  // ⚠️ **先记账、再回报** —— 「事后必须记账」是这一支的验收条件，而记账**不许**因为
  //   「结果不好看」而被跳过（人裁逐字：「不把「不阻断」误读成「可以不记账」」）。
  const call: LedgerCall | undefined = r.call;
  if (call !== undefined) recordRunSpend(runDir, [call]);

  const packVersion = path.basename(packDir);
  // ⚠️ `ms` 缺席 = 「**发出去了、还没回来**」（与 `formatSpentCalls` 同一条口径）——
  //   这里**不许**印成 0.0s：那是「没测到」，不是「花了 0 秒」。
  const secs = call?.ms === undefined ? "**还没回来**" : `${(call.ms / 1000).toFixed(1)}s`;
  const ledgerNote = call === undefined
    ? "⚠️ 这一发**没上路**（拼不出联系表 / 原图读不出来）⇒ 账上**没有**这一笔，而那是事实。"
    : `⚠️ 这一发（${secs}）**已经记进** ${rel(o.outRoot, path.join(runDir, RUN_ARTIFACT.ledger))}` +
      "（**run 级**那份 —— 包内那份写不得：它进 `files[]`、被 `verify` 按 checksum 校验）。";

  if (!r.ok) {
    // ⚠️ **退出码要说得清是哪一边的问题**：账上**有**这一发 ⇒ 上游那一侧（3）；
    //   账上**没有** ⇒ 一次都没上路，问题在我们给的输入（4）。
    const kind = call === undefined ? "invalid" : "upstream";
    throw new CommandError(kind, `抽查没成：${r.error}\n${ledgerNote}`,
      call === undefined ? {} : { ledger: [call] });
  }

  return {
    command: "review",
    summary: [
      `抽查：${rel(o.outRoot, packDir)}（${gameId} ${packVersion}）`,
      `原图：${rel(o.outRoot, referenceImagePath)} · 联系表 ${r.contactSheet.width}×${r.contactSheet.height}px`,
      `🔍 **只描述差异，不打分、不判定通过与否、不阻断** —— 观察 ${r.observations.length} 条：`,
      ...r.observations.map((x) => `  · ${x}`),
      ledgerNote,
    ],
    data: {
      status: "reviewed", gameId, packVersion,
      packDir: rel(o.outRoot, packDir), reference: rel(o.outRoot, referenceImagePath),
      observations: r.observations, raw: r.raw,
      ...(call === undefined ? {} : { ledgerMs: call.ms }),
    },
    artifacts: [{ path: rel(o.outRoot, packDir), kind: "asset-pack" }],
  };
}
