// 票 48 给「异常上带着的东西」立的三条边界。
//
//   **§挂得上去、读得回来** —— 这是本票的正题：账与失败现场**可以**挂在**任何**异常上
//     （不重包成 `CommandError` ⇒ 栈 / 错误类 / `cause` 链一样不丢）。没有这一条，
//     `pack` 段那 11 处判断抛的普通 `Error` 会继续**报「没花钱」**。
//
//   **§挂不上时不吞原异常** —— 冻过的异常 `Object.assign` 会抛 `TypeError`。
//     那一下**必须**被吞掉（挂不上就挂不上，磁盘上的失败现场那份还在），
//     但**绝不许**因此替换、包装或吞掉**原异常** —— 那是本末倒置。
//
//   **§没东西可带就什么都不做** —— 一分钱没花的真·代码 bug 必须**原样**抛出：
//     不凭空附加账、不改错误类、不改退出码。票 46 §5 那条二分的第二格靠这一条保住。
//
//   ⚠️ 读的那一侧**按能力、不按类**：`ledgerOfError` / `failureDirOfError` 认的是
//     **身上有没有这个字段**，不是 `instanceof CommandError` —— 因为 `carryOnError`
//     挂上去的异常**不是** `CommandError`，用 `instanceof` 读就等于对它们集体失明。
import { describe, expect, it } from "vitest";
import { carryOnError, CommandError, designAttemptsOfError, EXIT, exitCodeOfError, failureDirOfError, ledgerOfError, visualWorldAttemptsOfError } from "../src/command.js";
import type { LedgerCall } from "../src/ledger.js";

const call = (target: string): LedgerCall => ({ step: "image", target, attempts: 1 });

describe("§挂得上去、读得回来 —— 裸 Error 也带得动账与失败现场", () => {
  it("普通 Error：账与现场挂上去了，读得回来，而它**仍然**不是 CommandError（栈与类都不动）", () => {
    const e = new Error("判据说这批图不行");
    const stackBefore = e.stack;
    carryOnError(e, { ledger: [call("hero"), call("wall")], failureDir: "pack/v3/failed-1700000000000" });

    expect(ledgerOfError(e)?.map((c) => c.target)).toEqual(["hero", "wall"]);
    expect(failureDirOfError(e)).toBe("pack/v3/failed-1700000000000");
    // ⚠️ 这三条是同一件事：**不重包**。重包一次就全丢。
    expect(e).not.toBeInstanceOf(CommandError);
    expect(e.name).toBe("Error");
    expect(e.stack).toBe(stackBefore);
    expect(exitCodeOfError(e)).toBe(EXIT.failure);
  });

  it("两项**各自独立**：只有账时不去发明现场，只有现场时不去发明账（票 48 的约束 2）", () => {
    const onlyLedger = new Error("x");
    carryOnError(onlyLedger, { ledger: [call("hero")] });
    expect(ledgerOfError(onlyLedger)).toHaveLength(1);
    expect(failureDirOfError(onlyLedger)).toBeUndefined();
    expect("failureDir" in onlyLedger).toBe(false);

    const onlySite = new Error("y");
    carryOnError(onlySite, { failureDir: "pack/v3/failed-1" });
    expect(failureDirOfError(onlySite)).toBe("pack/v3/failed-1");
    expect(ledgerOfError(onlySite)).toBeUndefined();
    expect("ledger" in onlySite).toBe(false);
  });

  it("`CommandError` 也一样读得动 —— 两个读者的判据是**身上有没有**，不是 `instanceof`", () => {
    const e = new CommandError("upstream", "上游 500", { ledger: [call("hero")] });
    expect(ledgerOfError(e)).toHaveLength(1);
    expect(exitCodeOfError(e)).toBe(EXIT.upstream);
  });
});

describe("§挂不上时不吞原异常 —— 冻过的异常", () => {
  it("`Object.freeze` 过的异常：`carryOnError` **不抛**，原异常**原样**抛出、类与栈都不动", () => {
    const e = Object.freeze(new Error("冻过的"));
    const stackBefore = e.stack;
    expect(() => carryOnError(e, { ledger: [call("hero")], failureDir: "pack/v3/failed-1" })).not.toThrow();
    // ⚠️ 「挂不上」是可接受的结局（现场在磁盘上另有一份，票 36）；**被换掉**不是。
    expect(ledgerOfError(e)).toBeUndefined();
    expect(e.name).toBe("Error");
    expect(e.stack).toBe(stackBefore);
  });

  it("抛出来的**不是对象**（`throw \"boom\"` / `throw null`）⇒ 也是挂不上，同样不抛", () => {
    expect(() => carryOnError("boom", { ledger: [call("hero")] })).not.toThrow();
    expect(() => carryOnError(null, { failureDir: "pack/v3/failed-1" })).not.toThrow();
    expect(() => carryOnError(undefined, { ledger: [call("hero")] })).not.toThrow();
    // 读者面对它们也只是「没读到」，不是炸。
    expect(ledgerOfError(null)).toBeUndefined();
    expect(failureDirOfError("boom")).toBeUndefined();
  });
});

describe("§没东西可带就什么都不做 —— 一分钱没花的代码 bug 原样抛出", () => {
  it("空 `carried` ⇒ **一个键都不加**（`carried` 是 `{}` 与「没有账」是同一件事）", () => {
    const e = new Error("真·代码 bug");
    carryOnError(e, {});
    expect(Object.keys(e)).toEqual([]);
    expect(ledgerOfError(e)).toBeUndefined();
    expect(e).not.toBeInstanceOf(CommandError);
    expect(exitCodeOfError(e)).toBe(EXIT.failure);
  });

  it("空数组的账**算没有** —— 「有花费」才是判据，不是「有个数组」", () => {
    const e = new Error("空账");
    carryOnError(e, { ledger: [] });
    expect(ledgerOfError(e)).toBeUndefined();   // 调用方若按 `!== undefined` 渲染，就不会印出一个空标题
  });
});

describe("§只加不改 —— 下层挂的更接近现场", () => {
  it("异常上**已有**的 `failureDir` 不被上层覆盖（下层那份比上层更准）", () => {
    const e = new Error("x");
    carryOnError(e, { failureDir: "pack/v3/failed-真现场" });
    carryOnError(e, { failureDir: "run/v5/failed-粗一层的现场", ledger: [call("hero")] });
    expect(failureDirOfError(e)).toBe("pack/v3/failed-真现场");
    // ⚠️ 「只加不改」是**逐键**的：被让位的那一项不许连累**另一项**一起丢。
    expect(ledgerOfError(e)).toHaveLength(1);
  });
});

// ── 票 55 加进来的**第三项** ────────────────────────────────────────────────
describe("§第三个读者：被拒的设计那几发原始入参（票 55）", () => {
  const attempts = {
    format: "run-design-attempts/v1" as const,
    attempts: [{ attempt: 1, outcome: "rejected" as const, detail: "做不出来", raw: { format: "game-design/v1" } }],
  };

  it("挂得上去、读得回来 —— 而它**与另两项各自独立**（只有它时不发明账、也不发明现场）", () => {
    const e = new Error("这份设计做不出来（R12）");
    carryOnError(e, { designAttempts: attempts });
    expect(designAttemptsOfError(e)?.attempts[0]!.outcome).toBe("rejected");
    expect(ledgerOfError(e)).toBeUndefined();
    expect("ledger" in e).toBe(false);
    expect(failureDirOfError(e)).toBeUndefined();
    expect("failureDir" in e).toBe(false);
  });

  it("读的那一侧**按能力、不按类**：不是 `CommandError` 也读得动（挂上去的本来就不是它）", () => {
    const e = new Error("裸的");
    carryOnError(e, { designAttempts: attempts });
    expect(e).not.toBeInstanceOf(CommandError);
    expect(designAttemptsOfError(e)).toBeDefined();
    // ⚠️ 挂在 `CommandError` 上的也读得动 —— 判据是**身上有没有**那一格，不是它的类
    const cmd = new CommandError("invalid", "被拒");
    carryOnError(cmd, { designAttempts: attempts });
    expect(designAttemptsOfError(cmd)).toBeDefined();
    expect(exitCodeOfError(cmd)).toBe(EXIT.invalid);
  });

  it("只做**类型闸**：形状不对的（不是对象 / 没有数组 `attempts`）当作「没读到」，而不是把垃圾带出去", () => {
    const junk: unknown[] = ["不是对象", null, 42, {}, { attempts: "不是数组" }];
    for (const v of junk) {
      const e = new Error("x");
      carryOnError(e, { designAttempts: v as never });
      expect(designAttemptsOfError(e), JSON.stringify(v)).toBeUndefined();
    }
    expect(designAttemptsOfError(undefined)).toBeUndefined();
  });
});

// ── 票 60 加进来的**第四项** ────────────────────────────────────────────────
describe("§第四个读者：理解层第一步那几发原始入参（票 60）", () => {
  const attempts = {
    format: "run-visual-world-attempts/v1" as const,
    attempts: [{
      attempt: 1, outcome: "schema" as const, detail: "工具入参不过契约：palette: expected object, received array",
      raw: { format: "visual-world/v1", palette: ["#2e3b4e"] },
      response: { stopReason: "tool_use", usage: { outputTokens: 2100 } },
    }],
  };

  it("挂得上去、读得回来 —— 而它**与另三项各自独立**（只有它时不发明账、不发明现场、也不发明设计入参）", () => {
    const e = new Error("重采样 3 次都没有拿到一份过契约的 VisualWorldSpec");
    carryOnError(e, { visualWorldAttempts: attempts });
    expect(visualWorldAttemptsOfError(e)?.attempts[0]!.outcome).toBe("schema");
    expect(ledgerOfError(e)).toBeUndefined();
    expect("ledger" in e).toBe(false);
    expect(failureDirOfError(e)).toBeUndefined();
    expect("failureDir" in e).toBe(false);
    expect(designAttemptsOfError(e)).toBeUndefined();
    expect("designAttempts" in e).toBe(false);
  });

  it("⚠️ 读的那一侧**按能力、不按类** —— 第十跑死的是 `AnalyzeReferenceError`，按类读会在那一档恰好失明", () => {
    const e = new Error("裸的");
    carryOnError(e, { visualWorldAttempts: attempts });
    expect(e).not.toBeInstanceOf(CommandError);
    expect(visualWorldAttemptsOfError(e)).toBeDefined();
    // 挂在 `CommandError` 上的也读得动 —— 判据是**身上有没有**那一格，不是它的类
    const cmd = new CommandError("upstream", "上游 500");
    carryOnError(cmd, { visualWorldAttempts: attempts });
    expect(visualWorldAttemptsOfError(cmd)).toBeDefined();
    expect(exitCodeOfError(cmd)).toBe(EXIT.upstream);
  });

  it("只做**类型闸**：形状不对的当作「没读到」，而不是把垃圾带出去（也不在这里重验 schema）", () => {
    const junk: unknown[] = ["不是对象", null, 42, {}, { attempts: "不是数组" }];
    for (const v of junk) {
      const e = new Error("x");
      carryOnError(e, { visualWorldAttempts: v as never });
      expect(visualWorldAttemptsOfError(e), JSON.stringify(v)).toBeUndefined();
    }
    expect(visualWorldAttemptsOfError(undefined)).toBeUndefined();
  });
});
