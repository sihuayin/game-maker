# 证据完整性验收报告

- 结论：**fail**（退出码 1）
- 生成时间：2026-10-30T04:39:58.568Z
- 清单：`.scratch/p0-02-second-demo-v2/manifest/stage-a-manifest.json`
  sha256：`sha256:cb1202642d2470778818454d0a95f550f547633e58619e0e014c7dd29f51c9b1`
- subject：wasteland-scavenger-recipe v1 · site v1 · shell 2
- 范围：126 文件（required 125 / optional 1）· 5 条记录

## 声明 vs 重算

| 检查 | 声明 | 重算 | 一致 |
|---|---|---|---|
| asset-pack | pass | pass | ✓ |
| config | pass | pass | ✓ |
| qa | pass | pass | ✓ |
| site | pass | pass | ✓ |
| playable-smoke | pass | pass | ✓ |
| visual-review | pass | pass | ✓ |

- 声明 verdict：pass
- 重算 verdict：pass

## 文件（0 项非 verified）

- 全部文件 verified

## 身份（5）

- [verified] `out:wasteland-scavenger-recipe/run/v1/qa-report.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/playtest/v2/result.json`
- [verified] `out:wasteland-scavenger-recipe/run/v1/mechanic-coverage.json`
- [verified] `fa04:review-record.json`
- [verified] `fa04:capture.json`

## 一致性（44）

- [fail] visual.materials.collection：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/reference.png 不在 materials.json 里
- [fail] visual.materials.collection：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/style.png 不在 materials.json 里
- [fail] visual.materials.collection：assets/character-frames.png 不在 materials.json 里
- [fail] visual.materials.collection：assets/patroller-frames.png 不在 materials.json 里
- [fail] visual.materials.collection：assets/objects-frames.png 不在 materials.json 里
- [fail] visual.materials.collection：assets/background-frames.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/01-startup.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/02-movement.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/03-jump.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/04-pickup.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/05-chest-open.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/06-hazard-wait.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/07-hazard-cross.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/08-goal.png 不在 materials.json 里
- [fail] visual.materials.collection：shots/09-final.png 不在 materials.json 里

## 诊断（15）

- [fail] visual.materials.collection：审核材料不在 materials.json 里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/reference.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：.scratch/fpvs-v1-final/work/wasteland-scavenger-recipe/run/v1/style.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：assets/character-frames.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：assets/patroller-frames.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：assets/objects-frames.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：assets/background-frames.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/01-startup.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/02-movement.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/03-jump.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/04-pickup.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/05-chest-open.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/06-hazard-wait.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/07-hazard-cross.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/08-goal.png
- [fail] visual.materials.collection：审核材料不在 materials.json 里：shots/09-final.png

## 信任边界

能发现相对清单的改动；发现不了清单与被验证据一起被改并提交 —— 后者由 git 提交历史与人工审查负责。三方哈希核对只增加内部矛盾检测，不增加防篡改强度。

## 已知限制

- 本报告由已有证据重导出，不重新构建游戏、不重新执行 QA、不重新启动浏览器试玩。
- visual-review 只校验记录完整性与一致性，不重判人工视觉结论。
- 信任边界：能发现相对清单的改动；发现不了清单与被验证据一起被改并提交。
- 本版不做：五态真实 E2E、第二个 Demo 的泛化、MCP 镜像。
