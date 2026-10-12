#!/usr/bin/env python3
"""票 51 的四发变异：每一发都必须让 `packages/assets/tests/not-sent-bucket.test.ts` 变红。

用法（**在仓库根**）：python3 .scratch/game-maker-v2/experiments/not-sent-probe/run-mutations.py

⚠️⚠️ **它会就地改真源码 `packages/assets/src/ops.ts`，跑完再还原**（`finally` + 内容校验）——
   所以**只在没人和你并跑这个文件时**跑它。还原不了的话，快照在
   `ops.ts.orig.snapshot`（它是**那一次跑之前**的原文，不是「现在的源码」）。

⚠️ 每一发都先**在场断言**补丁点还在（源码动过就跳过并喊出来），与 `make-copies.mjs` 同一条纪律：
   宁可当场炸，也不要悄悄跑一发什么都没改的「变异」。
"""
import hashlib
import os
import pathlib
import re
import subprocess

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parents[3]                       # …/.scratch/game-maker-v2/experiments/not-sent-probe → 仓库根
OPS = ROOT / "packages/assets/src/ops.ts"
BAK = HERE / "ops.ts.orig.snapshot"
TEST = "packages/assets/tests/not-sent-bucket.test.ts"

# ── 每一发：改之前的那一段 / 改之后的那一段（都逐字取自票 51 落地时的源码） ──────────
M = {}

M["① 撤掉 callText 的非 JSON 设防（res.json 裸回去）"] = (
    """  let body: unknown;
  try { body = await res.json(); }
  catch (e) { throw new UpstreamCallError("http", `上游回的不是 JSON：${(e as Error).message}`); }""",
    """  const body: unknown = await res.json();""",
)

M["②a 撤掉 callText 的形状设防（null 一路炸回 TypeError）"] = (
    """  if (!isResponseObject(body))
    throw new UpstreamCallError("http", `上游回的不是一个 messages 应答（拿到 ${describeShape(body)}）`);""",
    """""",
)

M["②b 把 onceThrough 的判据退回「兜底 = not-sent」"] = (
    """    return e instanceof NotSentError
      ? { kind: "not-sent", error: err }
      : { kind: "upstream", failure: e instanceof UpstreamCallError ? e.failure : "http", error: err };""",
    """    return e instanceof UpstreamCallError
      ? { kind: "upstream", failure: e.failure, error: err }
      : { kind: "not-sent", error: err };""",
)

# ⚠️ ③a 是**故意留着的一发**：它**不该**红 —— 见 README 的「没红的那些变异」。
M["③a not-sent 再次 trip（只加回 trip，不动抛点）"] = (
    """      if (once.kind !== "not-sent")
        call.trip(once.kind === "ok" ? { spent: once.spent }
          : once.kind === "upstream" ? { failure: once.failure }
          : { failure: once.failure, spent: once.spent });""",
    """      call.trip(once.kind === "ok" ? { spent: once.spent }
        : once.kind === "not-sent" ? {}
        : once.kind === "upstream" ? { failure: once.failure }
        : { failure: once.failure, spent: once.spent });""",
)

M["③b not-sent trip 且照抄 upstream 档把账挂上去（病二的陷阱本身）"] = (
    """      if (once.kind !== "not-sent")
        call.trip(once.kind === "ok" ? { spent: once.spent }
          : once.kind === "upstream" ? { failure: once.failure }
          : { failure: once.failure, spent: once.spent });
      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message);""",
    """      call.trip(once.kind === "ok" ? { spent: once.spent }
        : once.kind === "not-sent" ? {}
        : once.kind === "upstream" ? { failure: once.failure }
        : { failure: once.failure, spent: once.spent });
      if (once.kind === "not-sent") throw new CommandError("upstream", once.error.message, ledgerCarrying(call.record()));""",
)

M["④ 撤掉工具链的「body 不是对象」前置检查"] = (
    """  if (!isResponseObject(body))
    return { kind: "upstream", failure: "http",
      error: new UpstreamCallError("http", `上游回的不是一个 messages 应答（拿到 ${describeShape(body)}）`) };""",
    """""",
)


def run():
    p = subprocess.run(["npx", "vitest", "run", TEST], cwd=ROOT, capture_output=True, text=True, timeout=900)
    out = re.sub(r"\x1b\[[0-9;]*m", "", p.stdout + p.stderr)
    failed = sorted({l.strip() for l in out.splitlines() if re.match(r"^\s*×\s+\S", l)})
    summary = next((l.strip() for l in out.splitlines() if re.match(r"\s*Tests\s", l)), "（读不出汇总）")
    return failed, summary, p.returncode


origin = OPS.read_text()
orig_sha = hashlib.sha256(origin.encode()).hexdigest()
BAK.write_text(origin)
print(f"原文 sha256 = {orig_sha}\n快照 → {BAK}\n")
try:
    for name, (before, after) in M.items():
        if before not in OPS.read_text():
            print(f"⚠️ {name}：补丁点找不到了 —— 源码动过，这一发**没跑**\n")
            continue
        OPS.write_text(OPS.read_text().replace(before, after, 1))
        failed, summary, code = run()
        print(f"{name}\n  → {'🔴 红了' if code != 0 else '⚪ **没红**'} · {summary}")
        for f in failed:
            print(f"     · {f}")
        print()
        OPS.write_text(origin)
finally:
    OPS.write_text(origin)
    back = hashlib.sha256(OPS.read_text().encode()).hexdigest()
    print(f"还原完成 · sha256 {'✅ 一致' if back == orig_sha else '❌ 不一致 —— 用 ' + str(BAK) + ' 恢复'}")
