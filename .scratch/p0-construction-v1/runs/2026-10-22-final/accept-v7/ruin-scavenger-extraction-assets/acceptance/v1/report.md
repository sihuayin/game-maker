# 动画验收报告 · ruin-scavenger-extraction-assets v7

- 生成时间：2026-10-22T07:45:55.197Z
- 工具版本：0.0.0
- manifest checksum：sha256:e620cd7eed22dda5b2316a70db006b0a84a1b6d58853f4733f1abaeeffd38326
- baseline：无（metrics / verdict 为 null）
- 结论：无 error findings（warning / info 不阻断）

## 图集

| 图集 | image checksum | meta checksum |
|---|---|---|
| animations | sha256:a3ecf5294d850678fdcb71295880e0eda4d682d29bca4bc8f3032f1711836735 | sha256:aa7533cc58f2cc5ca4f33200f6a18912f778d760218ba91447106142304e78a3 |
| backgrounds | sha256:47af93c9af4bf386c85631186a89579040554d876f0487dedd8774ec52720454 | sha256:83841dd9d54a36b2dad52029cc4fcc893adb34e06db94288a82d1efac9edeafe |
| sprites | sha256:3dff488df20ce4d835691dc95bdb6fbaea29f2c1a9f18cb961b799f52d98c5cc | sha256:b53a4f4a2bfdacf328533e8700a003af6cd69ea3994518e3cff674b8729d250d |
| ui | sha256:8414453f2bbfa2c13b837211cee573135bfb3c9a31fccfa68b0d25de7e6f5aa3 | sha256:5bb9ec95259fe865283b1ae6f24ce7b0b97ff85a361eca690a71aaee3ecba1fb |

## Findings

无。

## 动画

| 资源.动画 | 帧 | fps | loop | verdict | 指标 |
|---|---|---|---|---|---|
| scavenger-actor.idle | 4 | 6 | true | — | — |
| scavenger-actor.run | 8 | 12 | true | — | — |
| scavenger-actor.jump | 4 | 10 | false | — | — |
| wasteland-enemy.patrol | 6 | 8 | true | — | — |
| wasteland-enemy.charge | 6 | 14 | true | — | — |
| wasteland-enemy.halt | 3 | 8 | false | — | — |
| ceiling-lurker.hang | 4 | 6 | true | — | — |
| ceiling-lurker.lunge | 5 | 14 | false | — | — |
| ceiling-lurker.retreat | 4 | 10 | false | — | — |
| scrap-resource.idle | 4 | 6 | true | — | — |
| clean-water.idle | 4 | 6 | true | — | — |
| extraction-point.standby | 3 | 4 | true | — | — |
| extraction-point.active | 6 | 10 | true | — | — |

## 人裁 / 运行时

- 人裁：pending（7 项）
- 运行时：unverified
