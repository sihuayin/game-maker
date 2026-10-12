// [票 49「`compileTdGame` 把代码错误报成「上游不可达」」](../../../.scratch/game-maker-v2/issues/49-compiletdgame-mislabels-errors.md)
// 的见证：那一处 catch（`ops.ts` 的 `compileTdGame`）抓到的是**我们的代码坏了**，
// 不是「上游死活」—— 它必须**原样抛出**（类别 / 退出码 / 原始栈一样不丢），而**账照带**。
//
// ⚠️ **为什么要单独一个文件**：`vi.mock` 是**文件级**的（工厂被提到 import 之前），
//   而这里的注入把 `tdResolveConfig` 换成了**必抛**的那一个 —— 放进 `compile-td-game.test.ts`
//   会把那个文件里所有「编译成功」的用例一起打红。⇒ 注入只住这一份。
//
// ⚠️ **注入面是契约模块，不是源码**：真链路一个字没改（真的重采样循环、真的 `spentCall`、
//   真的那个 catch），只把一个**纯函数**换成会抛的实现 —— 那是这条路上唯一不需要改源码的注入口。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { tdDerivePath, type TdConfig } from "@game-maker/contracts";

/** 一句只属于这一条测试的话 —— 用来确认**响的就是它**，而不是别处一个长得差不多的失败。 */
const BOOM = "模拟：纯函数里的一处代码 bug（票 49 的见证）";
const mockPureFunctionBug = (): never => {
  throw new TypeError(BOOM);
};

vi.mock("@game-maker/contracts", async (importOriginal) => {
  const real = await importOriginal<typeof import("@game-maker/contracts")>();
  return { ...real, tdResolveConfig: () => mockPureFunctionBug() };
});

const { CommandError, EXIT, compileTdGame, exitCodeOfError, ledgerOfError } = await import("../src/index.js");

const ROOT = path.resolve(fileURLToPath(new URL("../../..", import.meta.url)));
const PACK = path.join(ROOT, "fixtures/packs/counter-siege/v4");
const GOOD = JSON.parse(fs.readFileSync(path.join(ROOT, "fixtures/td-configs/counter-siege.json"), "utf8"));

/** 上游给一份**本来就能编译成功**的回应 ⇒ 让唯一可能失败的那一步就是被注入的那个纯函数。 */
const upstream = (payload: unknown): typeof fetch =>
  (async () => new Response(
    JSON.stringify({ content: [{ type: "text", text: JSON.stringify(payload) }] }),
    { status: 200, headers: { "content-type": "application/json" } },
  )) as typeof fetch;

describe("票 49：compileTdGame 的 catch 抓到的是「我们的 bug」，不是「上游死活」", () => {
  it("裸 `TypeError` · 退出码 1 · 原始栈还在 · 账仍是一笔真的", async () => {
    // 先钉住注入真的接上了：`tdResolveConfig` 换成会抛的那一个之后，**纯函数之外一个字没动**。
    expect(tdDerivePath(GOOD as TdConfig).ok).toBe(true);

    const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-compile-td-49-"));
    fs.writeFileSync(path.join(d, "requirement.md"), "做一个守着柜台的塔防小关卡，五波，敌人从卷帘门进来。");
    const err: unknown = await compileTdGame({
      requirementPath: path.join(d, "requirement.md"), packDir: PACK, outRoot: path.join(d, "out"),
      transport: { baseUrl: "http://x", apiKey: "k" }, fetchImpl: upstream(GOOD),
    }).then(() => null, (e: unknown) => e);

    // 护栏（**不是判据**）：响的必须是注入的那一处，免得这条测试安静地测了另一个失败。
    expect(err).not.toBeNull();
    expect((err as Error).message).toContain(BOOM);

    // ① **类别**：裸异常原样出来，**不是** `CommandError` —— 「我们的 bug」不许被报成「上游的锅」。
    expect(err).toBeInstanceOf(TypeError);
    expect(err).not.toBeInstanceOf(CommandError);
    expect((err as Error).name).toBe("TypeError");

    // ② **退出码**：1（`EXIT.failure`，`Error` 的落点），不是 3（上游死活）。
    expect(exitCodeOfError(err)).toBe(EXIT.failure);
    expect(exitCodeOfError(err)).not.toBe(EXIT.upstream);

    // ③ **原始栈**：栈顶那一帧必须还是**原抛点**。重包成 `CommandError` 之后，栈顶会是
    //    catch 自己那一行（`ops.ts:99x`）—— 而「哪一行判的」正是只有栈说得清的那件事。
    const stack = String((err as Error).stack);
    const topFrame = stack.split("\n")[1] ?? "";
    expect(topFrame, `栈顶那一帧应当还是原抛点；实际前三帧：${stack.split("\n").slice(0, 3).join(" / ")}`)
      .toContain("compile-td-game-error-class.test.ts");
    // ⚠️ 而**原抛点那个函数名**也还在（重包之后整个 `stack` 是新的，一个字都不会剩）——
    //   这一条与上面那条分别钉住「栈顶是原抛点」与「原栈整条链还在」。
    expect(stack, "重包之后原抛点的帧一个都不会剩").toContain("mockPureFunctionBug");

    // ④ **账**：这一趟**真发出去过**（上游回了一份合法关卡），所以那一笔必须跟着异常走 ——
    //    而它得是**真的那一笔**（有 `target`、有 `ms`、`attempts` 是 1），不是一个占位的空壳。
    const spent = ledgerOfError(err);
    expect(spent, "钱花了、账必须有人报回来").toBeDefined();
    expect(spent).toHaveLength(1);
    expect(spent![0]!.step).toBe("compile-td-game");
    expect(spent![0]!.target).toBe("td-config");
    expect(spent![0]!.attempts).toBe(1);
    expect(typeof spent![0]!.ms).toBe("number");
  });
});

// ⚠️ 这条测试**没有**断言「落盘了 v1.json」。抛在落盘之前是**对的**：坏的是我们自己的派生/校验
//   那一步，而那一份关卡过不了它 ⇒ 没有任何一份可落。⚠️ 别把它与票 06/09 那条「不过校验也照常
//   落盘」混起来 —— 那条覆盖的是 `resolved.ok === false`（模型画的图派生不出路径），不在这一处。
