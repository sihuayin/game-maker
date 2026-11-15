# I03-10 独立审查输入包

> **用途**：提交给 I03-10 独立复核人的输入清单与核对项。
> **本文件不含作者结论**；复核人必须自行重跑、重算、逐项判断，不得以本文件或作者摘要作为 PASS 依据。
> 本文件不授权任何实施、不改变 `PUBLIC_NB` / `PUBLIC_PU` 的 `BLOCKED` 状态。

## 1. 审查对象

| 项 | 路径 | 说明 |
| --- | --- | --- |
| I-03 授权包 | `docs/v7.8/移动-I03.md` | I03-09 组装；ASSEMBLED / UNSIGNED |
| 上游授权包 | `docs/v7.8/移动-I02.md` | 已签署；只读核对，不应被修改 |
| 规划地图 | `.scratch/level-playability-v1.1-i03/map.md` | Destination / Notes / Decisions / Out of scope |
| 决策票 | `.scratch/level-playability-v1.1-i03/issues/` | I03-00～I03-08、I03-03A/B/B2/B2a/C、I03-PU-Air-Control-Closure |
| 组装证据 | `.scratch/level-playability-v1.1-i03/evidence/09-package.md` | 命令、hash、审计结果 |

## 2. 复核人必须独立完成的检查

### 2.1 范围与边界

1. 六条冻结边界逐条存在且未被削弱（包 §1.1）。
2. 前沿裁定 Q1=A / Q2=分阶段 / Q3=最小面 / Q4=A 在包 §0.3 / §1 / §7 中得到体现。
3. `PUBLIC_NB` / `PUBLIC_PU` 均仍为 `BLOCKED`；I-03 实施为 `NOT_AUTHORIZED`（包 §12）。
4. 包中不出现“已实施”“已开放”“已授权 U1–U5”等越权表述。

### 2.2 NB / PU 准入

5. NB 三阶段 WIRED / ADMITTED / OPEN 与 §8.2 十项准入条件完整。
6. PU 六条件逐项状态与“任一非 PASS 不得 ADMITTED”完整；条件 2 / 5 当前硬阻断。
7. 条件 5 由 I03-PU-Air-Control-Closure 独立闭合；包未用 U4 图割 / `midAirHits=0` / NB 结果替代。
8. 假 NB / 假 PU 的全局关闭、证据基线失效、关闭优先级、不可逆向推导均在包中。

### 2.3 几何与证据

9. 几何四状态、`coverage.geometry` 汇总规则、两层证据缺一不可。
10. 正例行 14（hazard 2 / player 8 帧 + body 1 / graph 3）、负例 11（10 个 geometry-mismatch + 1 个 missing-evidence；含 `body-bounds-mismatch`）、失败码闭集与 class 映射。
11. 玩家坐标约定（`at` = anchor；`playerBox=(24,204.4,32,48)`；零容差；整数 lattice + 常量 foot 偏移）。
12. I03-03C 独立复核标准（12 项、分项 PASS、环境不匹配 / 非确定性处理、复核权限边界）。

### 2.4 发布门与验收

13. 第一阶段拒稿输入闭集三项；无新增 throw；时序证据不产 `CommandError`。
14. `PublishGateResult.temporal` 为诊断字段；不落盘、不进 CLI/MCP、不升契约；缺省 ≠ 不适用。
15. G1–G11 与变异测试完整。
16. AC 21 条 / required 19；AC-11、AC-15 预先非 required 且 phase-1 `NOT_RUN`。
17. 负向 N1–N18、回归命令、E1/E2/E3、报告路径、退出码 0/1/2 与 `INCOMPLETE` 语义。
18. L1–L8 完整披露。

### 2.5 实施边界

19. 单元 U1 → U2 → U4 → U5 → U3；依赖与“上一单元签署后才开始下一单元”。
20. 逐文件白名单：精确路径、操作类型、限定目的；`api.ts` 跨 U1/U2 非一次性授权；`wide-patrol` 仅该行。
21. STOP 12 条原文；Q7-11 的 abort-only 墙钟措辞。
22. 五道复核门、U4/U5/U3 回滚演练、逆序正式回滚、关闭条件与“关闭 ≠ 开放”。
23. Ledger 为空白表；无预填 SHA / 批准人 / 日期。

## 3. 可复跑命令

```bash
pnpm test
pnpm build
pnpm check:deps
pnpm check:links
pnpm build && node .scratch/level-playability-v1-p1/acceptance-corpus.mjs
pnpm build && node .scratch/level-playability-v1-p1/acceptance-matrix.mjs
```

## 4. 只读核对

```bash
shasum -a 256 docs/v7.8/移动-I02.md
git diff --stat 2b57f2a -- packages fixtures
grep -n "⏳\|待 I03\|TODO" docs/v7.8/移动-I03.md
grep -c '^| AC-[0-9]' docs/v7.8/移动-I03.md
grep -cE '^\| N[0-9]+ \|' docs/v7.8/移动-I03.md
```

## 5. 明确不在本审查范围

- 不审查 U1–U5 的实施代码（尚未实施）。
- 不审查 probe 实现（尚未实现）。
- 不判定 `PUBLIC_NB` / `PUBLIC_PU` 是否可开放。
- 不以本输入包替代复核人自己的命令与 hash 记录。

## 6. 复核输出要求

复核报告需包含：复核人、日期、环境；逐项 `PASS / FAIL / NOT_RUN`；使用的命令与退出码；输入 / 输出 hash；未覆盖项；独立签署。复核 PASS 只表示授权包可供用户签署，不构成实施授权或能力开放。
