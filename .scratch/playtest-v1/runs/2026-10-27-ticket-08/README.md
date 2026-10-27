# 票 08 真实产物端到端（沙箱）

历史产物只读；沙箱在 `e2e/out/`，`pack/v1` 与 `site/v1` 是指向
`.scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/{pack,site}/v1` 的相对 symlink。

构造命令：

```bash
SB=.scratch/playtest-v1/runs/2026-10-27-ticket-08/e2e
mkdir -p "$SB/out/wasteland-scavenger-recipe/run/v1"
cp .scratch/fpvs-v1-p1/runs/2026-10-27-stage-c/qa-report.json "$SB/out/wasteland-scavenger-recipe/run/v1/qa-report.json"
cp .scratch/fpvs-v1-p0/runs/2026-10-26-e2e-r4/wasteland-scavenger-recipe/run/v1/game-config.json "$SB/out/wasteland-scavenger-recipe/run/v1/game-config.json"
# pack/site 用相对 symlink（见上面路径）
```

运行：

```bash
node packages/cli/dist/cli.mjs playtest \
  "$SB/out/wasteland-scavenger-recipe/run/v1" \
  --out "$SB/out" --json
```

真实结果（2026-10-27）：`SUCCESS` 不是自动玩家在真实站点上能达成的结论；归因是
`AGENT_LIMITATION`（环境健康、无 runtime-error、动作超时 + stuck/探索耗尽），交付检查项
`playable-smoke=incomplete`、verdict `incomplete`，CLI 退出码 `1`。这不是游戏失败，也不是通过。
