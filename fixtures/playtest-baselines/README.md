# 试玩回归基线

每个 `<baselineId>/baseline.json` 是一次**人工显式晋升**的、自足的规范化证据快照（`playtest-baseline/v1`）。
普通试玩 / CI **不得**自动新建或覆盖这里的文件。

晋升：

```bash
game-maker playtest-baseline promote <baselineId> \
  --report <run/vN>/playtest/vK/result.json \
  --second-report <另一次干净运行>/result.json \
  --coverage <coverage.json> \
  --reason "为什么接受这次行为" \
  [--replace]
```

- 两次运行必须同身份（场景/site/pack/config/harness/判定规则）且覆盖字段的规范化投影一致；
- 覆盖字段只由 `coverage.json` 声明（断言 id / 终态字段 / 事件类型），覆盖外字段不参与比较；
- 允许记录非 `SUCCESS` 的**已接受行为**（例如 `GAMEPLAY_FAILURE` 或 `AGENT_LIMITATION`）；它不是自动认可游戏质量；
- 比较是**纯观察**：`changed` 只叫「与基线不同」，不改 `PlaytestOutcome` / `DeliveryCheckStatus` / `DeliveryVerdict`；
- 已存在默认拒绝；重定基线必须显式 `--replace`，并在入库 diff 里审计。
