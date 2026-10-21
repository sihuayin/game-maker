# F · 游戏运行时与集成验证路径（票 06）

> 基线：`main` · `f0dac01`（2026-10-21）。只读取证 + 真实运行；未改业务代码 / 测试 / 契约 / 资源 / 配置 / 锁文件。
> 未运行 `pnpm check` / `pnpm build`，未写 `out/`，未重装站点，未改 `game-maker.local.json`，零付费、零上游调用。
> 运行证据目录：[`../runs/2026-10-21-runtime/`](../runs/2026-10-21-runtime/)。
> W2 / W6 只作线索；本报告每条结论均在 `f0dac01` 上重新读源码或重新运行过，行号是 HEAD 当前行号。

## 0. 结论先行

1. **最小运行时路径真的跑起来了**：现有 `site/v3` 以 `pack/` 与 `site/` 的父目录为 HTTP 根加载，`scavenger-actor` 的 4 帧 `idle` 在屏幕上按 ~168ms（6fps）连续循环；截图 + 采样 + Canvas `drawImage` 轨迹三路互证（`runtime-summary.json`、`samples-idle.json`、`draw-trace.json`、`10-idle-full.png`、`11-idle-player-00..09.png`）。状态：`implemented`（播放本身）。
2. **关键断链已复验：manifest 的 `fps` / `loop` 从未被运行时读取**。实体动画硬编码 `frameRate: 8, repeat: -1`（`packages/demo/src/shell/scene.ts:140`），玩家动画硬编码 `run ? 10 : 6, repeat: -1`（`scene.ts:193`）。运行时实测：`ceiling-lurker.lunge`（manifest `fps:14, loop:false`）以 ~127ms（8fps）**无限循环**；`jump`（`fps:10, loop:false`）以 ~168ms（6fps）在第 4 帧后**回到第 1 帧**再落地。W2 的 G04 在 HEAD 成立。状态：`missing`（播放参数消费）。
3. **没有固定动画测试场景**：站点只有一个 `shell` 场景（`scene.ts:31`），播什么由 `game-config.json` 决定；没有按 URL / 查询参数 / fixture 选择动画或帧的入口。现有 `site/v3` 只能算“恰好包含 idle 与几只实体动画的临时场景”。状态：`missing`。
4. **程序触发是 `partial`**：CDP 合成键盘能稳定触发 `run` / `jump`（`samples-run.json`、`samples-jump.json`、`20-run-full.png`、`22-jump-full.png`）；但外壳没有公开的动画 API / 全局游戏句柄（`entry.ts:75` 的 `new Phaser.Game(...)` 未赋给任何变量；`Phaser.GAMES` 在 v3.90 不存在）。本轮的“直接 API”证据靠注入 `Phaser.Game.prototype.boot` 捕获实例后才成立（`drive-anim.mjs`）。
5. **能确认“真的在播”，但证据链是外挂的**：仓库没有截图 / 录屏 / 运行时错误落盘能力；本轮用 CDP（`Page.captureScreenshot`、`Runtime.consoleAPICalled`、`Network.*`）补齐。仓库无 `playwright` / `puppeteer` 依赖，无 CI workflow。状态：`partial`。
6. **运行验证不覆盖、不修改已有产物**：静态服务器只读；`find site/ pack/ -newermt "2026-10-21 00:00:00"` 为空，`site/v3/*` 与 `pack/v7/manifest.json` mtime 仍是 `2026-10-20 14:53:15`，哈希见 `run-log.txt`。状态：`implemented`。
7. **对 Phase 1 的判断：能承载“人工/CDP smoke”，不能直接当回归门禁**（`partial`）。必须补三件事：运行时消费 `fps`/`loop`；仓库内可重复的浏览器探针 + 固定场景；证据与 `site.json` / manifest 版本、哈希绑定。详见 §7。

## 1. 最小运行时验证路径（任务书 §4.6 输出要求）

| 步骤 | 现状 | 状态 | 证据 |
|---|---|---|---|
| 资源版本 | 站点 `site/v3/site.json` 写 `{"shell":"2","pack":"v7","config":"game-config.json"}`；包 manifest 自带 `id` / `version` / 图集 checksum | implemented（静态可追溯；**运行时横幅不打印包版本**，证据必须自带 site.json） | `site/v3/site.json`；`pack/v7/manifest.json`（`version:7`）；`layout.ts:114-116` |
| 游戏配置 | `game-config.json` 由装配器写入站点，外壳按 `site.json.config` 读取（不猜文件名） | implemented | `layout.ts:100`；`entry.ts:58-61`；`site/v3/game-config.json` |
| 启动命令 | `python3 -m http.server <父目录>` + 打开 `/site/v3/index.html`；README 明确根必须是 `pack/` 与 `site/` 的父目录 | implemented（手动两步，无单一 npm script） | `README.md:77-84`；`run-log.txt` 第 1 节；HTTP 200 |
| 资源加载 | `site.json` → `../../pack/v7/manifest.json` → `atlasList` → Phaser `load.atlas`；4 张图集全部 200 | implemented（已验证） | `entry.ts:54-56`；`draw.ts:173-177`；`scene.ts:33-36`；`network.json` 中 `pack/v7/delivery/atlas.*.{png,json}` 全 200 |
| 动画播放（帧推进） | 玩家 idle 4 帧循环、run 8 帧、jump 4 帧；多帧实体各自建 Phaser 动画并 `play` | implemented（已验证） | `scene.ts:137-141,190-195`；`samples-*.json`；`analysis.json`；`10/11/20/22` 截图 |
| 动画播放参数（fps / loop） | manifest 有 `fps`/`loop`，`world.ts` 只把帧名带过来，`scene.ts` 硬编码帧率与 `repeat:-1` | **missing** | `assetpack.ts:157-162`；`world.ts:138-142,150-153`；`scene.ts:140,193`；§3 实测 |
| 验证证据（截图 / 日志） | 站点自身不产出；本轮 CDP 采集截图、console、异常、网络失败并落盘 | partial（外挂能力，非仓库基础设施） | `drive-*.mjs`；`console-events.json`；`network.json`；PNG 截图 |

## 2. §4.6 十问

### 2.1 如何启动一个最小可玩游戏？——`implemented`

- 先有站点：`game-maker site <packDir> --config <game-config> [--out <dir>]`（`packages/cli/src/cli.ts:575-590`），装配器做 schema + 引用族 + 几何 + HUD 屏幕空间硬失败后才摆目录（`packages/demo/src/site.ts:167-220`）。`create --yes` / `build` 会串起 pack → config → QA → site（`cli.ts:224-248,490-505`）。
- 再起服务：**HTTP 根必须是 `pack/` 与 `site/` 的父目录**，否则 Phaser loader 静默失败（`README.md:80-84`；`site.ts:240-242` 的 `serveRoot`）。
- 本轮命令与退出码见 `run-log.txt`：`curl .../site/v3/index.html` → **200**；Chrome/155 加载后 `index.html`、`shell.js`、`site.json`、`game-config.json`、`manifest.json`、4 张图集全部 **200**（`network.json`）。

### 2.2 资源包如何被游戏加载？——`implemented`

1. 外壳读 `site.json`，用 `pack` 字段拼 `../../pack/<v>/`（`entry.ts:54`），读 `manifest.json`（`entry.ts:55`）。
2. `buildWorld(manifest, config, { packBase })` → `atlasList(pack, packBase)` 是**唯一**路径拼接处（`draw.ts:173-177`）；`packBase` 少一个 `../` 就是 404（`draw.ts:166-172` 注释记录了票 03 的静默失败）。
3. `preload()` 对每个图集 `this.load.atlas(key, image, json)`（`scene.ts:33-36`），`key` 就是图片路径（`draw.ts:54-55,175`）。
4. 运行时网络证据：`/pack/v7/manifest.json`、`game-config.json`、四对 `atlas.*.json/png` 全 200；唯一 404 是 `/favicon.ico`（`network.json`）。
5. 装载结果在控制台可见：`[shell] v2 · 视口 480×270 · 世界 640×270 · 4 张图集`（`console-events.json`；对应 `scene.ts:41`）。

### 2.3 是否有可以独立测试动画的固定场景？——`missing`

- 只有 `class ShellScene extends Phaser.Scene`（`scene.ts:19,31`），没有第二个 Scene、没有 debug/test 参数、没有 fixture 选择入口。
- `site/v3` 的 `game-config.json` 恰好把玩家三路动画与 `ceiling-lurker` 的 `hang/lunge/retreat` 摆进场景，可作为**临时**观测场，但它不是“固定动画测试场景”：换一份 config 就变，且无法只播指定 clip。
- 纯层测试只验证帧名映射与数量（`packages/demo/tests/world.test.ts:109-115`）；`shell-scene-wiring.test.ts` 只做源码见证（玩家先于实体、hazard 按锚点），不断言播放。

### 2.4 能否通过程序触发指定动画？——`partial`

- **能（间接）**：CDP `Input.dispatchKeyEvent` 合成 `ArrowRight` / `Space`，玩家状态机 `update()` 按输入选择 `run` / `jump` / `idle`（`scene.ts:89-92`）；实测 `samples-run.json` 出现 `run1..run8` 循环，`samples-jump.json` 出现 `jump1..jump4`，截图 `20-run-full.png` / `22-jump-full.png`。
- **不能（直接、公开）**：`entry.ts:75` 的 `new Phaser.Game({...})` 没有赋给变量，也没有 `window.game` 之类调试口；`Phaser` 本身在页面上是全局对象，但 `Phaser.GAMES` 为 `null`（`drive-runtime.mjs` 第一次 probe；`scene-probe.json` 里 `Phaser.GAMES[0]` 抛 TypeError）。
- 本轮为了拿到 `scene.player.anims.currentFrame`，在页面加载前注入钩子包住 `Phaser.Game.prototype.boot` 捕获实例；随后 `scene.player.play('run', true)` 立即生效（`direct-play` 返回 `{key:"run", idx:1, playing:true}`），但下一帧 `update()` 又按输入切回 `idle`（120ms 后读回 `idle`）。这证明 API 本身可用，但**不是产品暴露的稳定入口**。
- 结论：Phase 1 若要“指定动画”的确定性测试，需要外壳提供正式钩子（query 参数或 test scene），不能依赖 CDP 键盘 + 注入。

### 2.5 能否确认动画确实播放，而不仅是资源成功加载？——`partial`（有能力，但不是产品能力）

本轮用三条互相独立的证据确认：

1. **Phaser 状态采样**（`samples-idle.json`，124 个样本 / 2.59s）：玩家 `currentFrame.textureFrame` 在 `scavenger-actor.idle1 → idle4` 间循环，17 次切换，中位间隔 **168.2ms**；`playing:true`。同场 `ceiling-lurker.lunge` 5 帧以 **126.7ms** 循环 22 次切换（`runtime-summary.json`）。
2. **Canvas `drawImage` 轨迹**（`draw-trace.json`，4501 次调用，全部映射回图集帧名）：玩家源矩形按 `idle1→idle2→idle3→idle4` 每 ~167ms 换一帧（`84, 267, 434, 600, 767, ...` ms），与采样吻合。
3. **截图**：`11-idle-player-00..09.png` 是连续截取的玩家局部，去重后 **4 个不同图像**，两两差异 680 / 880 像素（`analysis.json`）；`10-idle-full.png` 与 `20-run-full.png` 差异 432,428 像素，`20-run-full.png` 与 `22-jump-full.png` 差异 15,532 像素。

但这些证据都来自临时 CDP 驱动，**站点本身不产出任何“正在播放”的可验证信号**（无 fps 计数、无 `getAnimations` 调试口、无 trace）。状态定为 `partial` 而不是 `implemented`。

### 2.6 是否有自动截图或录屏能力？——`partial`（截图外挂，录屏 `missing`）

- 仓库无 `playwright` / `puppeteer` 依赖（根 `package.json` 只有 typescript/vitest/esbuild），无 CI workflow（`.github/workflows` 不存在）。
- 现有可复用的是 `.scratch/` 里的 CDP 脚本（`asset-integration-v1/runs/2026-10-20e-site/drive-cdp.mjs`、`p0-00-audit/runs/2026-10-20a-head-replay/drive.mjs`）；本轮把驱动副本放在 `runs/2026-10-21-runtime/drive-*.mjs`。
- 截图：`Page.captureScreenshot` 可用且已产出 20+ 张 PNG。录屏：未实现，也没有 `Page.startScreencast` 调用；按“已调查、无实现”记 `missing`（不代表做不到，代表仓库没有）。

### 2.7 能否保存运行时错误日志？——`partial`

- 游戏内只有 `console.warn` / `console.error`（`entry.ts:37,49-56`；`scene.ts:40,216`），**没有** `window.onerror` / `unhandledrejection` 监听，也**不落盘**。
- `getJson` 对 404 / 网络错误一律返回 `undefined`（`entry.ts:22-30`），只在调用方打一条 warning；Phaser loader 本身静默（`draw.ts:169-171`、`entry.ts:55-56` 的注释都记录了这一点）。
- 本轮用 CDP `Runtime.consoleAPICalled` / `Runtime.exceptionThrown` / `Log.entryAdded` / `Network.loadingFailed` 采集并落盘为 `console-events.json`、`network.json`：没有异常、没有失败请求（仅 favicon 404）；有一条预期 warning（Canvas 下 `hud.panel` 不支持九宫格，`scene.ts:214-216`）。
- 结论：**可采集**，但依赖外部 harness，且默认没有任何持久化。

### 2.8 运行时测试是否会覆盖或修改已有产物？——`implemented`（不会）

- 站点与包只被静态服务器读取；本轮所有写入都在 `runs/2026-10-21-runtime/`。
- 证据：`find <site-root> -type f -newermt "2026-10-21 00:00:00"` 输出为空；`site/v3/{index.html,site.json,shell.js,game-config.json}` 与 `pack/v7/manifest.json` 的 mtime 均 `2026-10-20 14:53:15`；`site/v3/shell.js` 与 `packages/demo/dist/shell.js` sha256 同为 `620adfa5...6860`（`run-log.txt`）。
- 装配侧本身也守“绝不覆盖”：`nextSiteVersion` 取 max+1，显式版本撞名抛错（`layout.ts:59-67,91-96`）；包已存在则复用（`layout.ts:78-83`）。

### 2.9 测试是否依赖人工操作？——`partial`

- 本轮链路需要人工/脚本依次起 HTTP server、起 headless Chrome、跑 CDP 驱动；仓库里没有 `pnpm` script、没有 CI、没有测试框架内的浏览器环境。
- 一旦这三步起好，后续驱动全自动（键盘、等待、截图、日志、断言都可脚本化）。CDP 驱动本身是可复用的（两份既有脚本 + 本轮的加强版）。
- 所以是“**脚本化但未产品化**”：不是纯人工点浏览器，也不是 `pnpm test` 一条命令。

### 2.10 现有基础设施是否足以承载 Phase 1 集成验证？——`partial`

**够用的部分**：站点装配、`site.json` 版本说明、静态服务、Phaser 真实渲染、CDP 截图/日志、纯层 `buildWorld` 可做无浏览器断言；本轮已证明最小闭环能跑通且非破坏。

**不够的部分（按重要性）**：

1. `fps` / `loop` 断链（§3）：不修就不是“按资源声明播放”，集成验证会验证一个假语义。
2. 无固定动画场景 / 无公开触发入口：无法稳定地“只验某一 clip”，也难以在 CI 里断言帧序列。
3. 无仓库内 harness / CI：截图、日志、帧序列断言都是 `.scratch/` 里的一次性脚本。
4. 运行时横幅不打印包版本；证据需要额外带 `site.json` + manifest/图集哈希，否则无法追溯到具体资源版本。
5. headless 与真实浏览器渲染器可能不同（本轮 Chrome 155 headless 是 **Canvas**；`hud.panel` 九宫格在 Canvas 下退回普通拉伸，`scene.ts:206-225`）。视觉验收必须声明渲染器。

结论：Phase 1 应把“**运行时探针**”当作一个要新建的最小能力，而不是假设现有测试能接住；但**站点装配与真实播放这条骨架可以复用**，不需要重写。

## 3. 关键断链：`fps` / `loop` 在 manifest→runtime 之间丢失

### 3.1 静态链路

| 层 | 做了什么 | 证据 |
|---|---|---|
| 生产 | `pack` 把 `spec.animations[].fps` / `loop` 写进 manifest | `packages/assets/src/pack.ts:1050-1057` |
| 契约 | `Animation{name, frames, fps?, loop=true}` 是 manifest 的正式字段 | `packages/contracts/src/assetpack.ts:157-162` |
| 解析 | `resolvePackRef` 会返回 `animation` 对象（含 fps/loop） | `assetpack.ts:366-390` |
| 纯层 | `buildWorld` 只取 `res.frames` 的**名字**：实体 `frames`（`world.ts:138-142`）、玩家 `anims[action]`（`world.ts:150-153`）；`WorldDescription` 没有 fps/loop 字段 | `world.ts:33-52,133-166` |
| 渲染 | 实体动画：`frameRate: 8, repeat: -1`；玩家动画：`frameRate: action === "run" ? 10 : 6, repeat: -1` | `scene.ts:140,193` |
| 配置 | `compile-runtime` 只产出动画**名字**（`player.anims` 是 `{idle,run,jump} → 名称`），提示词也不要求 fps/loop | `packages/contracts/src/game-config.ts:153`；`packages/assets/src/ops.ts:882,936-960,1063-1067` |

### 3.2 运行时实测（`runtime-summary.json`）

场景里的 Phaser 动画键与参数（探针直接读 `s.anims.anims.entries`）：

```
idle:6/-1, run:10/-1, jump:6/-1,
lurker-hang#play:8/-1, lurker-lunge#play:8/-1, lurker-retreat#play:8/-1,
enemy-patrol#play:8/-1, scrap-1#play:8/-1, water-1#play:8/-1, scrap-2#play:8/-1,
extraction#play:8/-1
```

（格式 `frameRate/repeat`；`-1` 即无限循环。）

| 动画 | manifest | 运行时实际 | 实测中位换帧间隔 | 结论 |
|---|---|---|---|---|
| `scavenger-actor.idle` | fps 6 · loop true | 6 · repeat -1 | 168.2ms | 巧合一致（硬编码 6） |
| `scavenger-actor.run` | fps 12 · loop true | 10 · repeat -1 | 101.7ms | **fps 不符**（10≠12） |
| `scavenger-actor.jump` | fps 10 · **loop false** | 6 · repeat -1 | 167.5ms；第 4 帧后（710.9ms）**回到 jump1** | **fps 不符且反向循环** |
| `ceiling-lurker.lunge` | fps 14 · **loop false** | 8 · repeat -1 | 126.7ms；2.6s 内 22 次切换、5→1 反复 | **fps 不符且无限循环** |
| `ceiling-lurker.hang` | fps 6 · loop true | 8 · repeat -1 | 126.7ms | **fps 不符**（8≠6） |
| `extraction-point.active` | fps 10 · loop true | 8 · repeat -1 | 126.7ms | **fps 不符** |
| `scrap-resource.idle` | fps 6 · loop true | 8 · repeat -1 | 126.7ms | **fps 不符** |

W2（`.scratch/p0-00-audit/research/w2-field-consumption.md:37-38,258`）的 G04 在 HEAD **逐字成立**；本轮补上了它当时缺的运行时证据（W2 自己标注为“播放中但未验证速率/循环”）。

## 4. 错误处理与日志

| 场景 | 当前行为 | 证据 | 状态 |
|---|---|---|---|
| `site.json` / manifest / config 404 | `getJson` 静默返回 `undefined`，控制台一条 warning，继续用占位符启动 | `entry.ts:22-30,45-61` | partial（能显形，但不落盘、无错误码） |
| 格式认不出 | `ErrorScene` 画面 + `console.error` | `entry.ts:32-42,65-73` | implemented（不会白屏） |
| 坏资源引用 / 几何问题 | `buildWorld` 不抛，记 issue；`scene.ts:40` 全量 `console.warn`，原位画品红/黑棋盘 | `world.ts:84-93`；`scene.ts:39-41,116-123` | implemented（可见、可继续） |
| 图集 404/解码失败 | Phaser loader 静默；站点会继续启动 | `draw.ts:9-10,166-171`；`entry.ts:55-56` | partial（无主动检测） |
| 未捕获异常 / Promise rejection | 无监听器 | `entry.ts`、`scene.ts` 全文无 `onerror` / `unhandledrejection` | missing |
| 运行时日志持久化 | 无；本轮靠 CDP 采集 | `console-events.json`；`network.json` | partial |

## 5. 自动化、人工依赖与产物安全

- **无浏览器测试框架**：根依赖只有 typescript / vitest / esbuild（根 `package.json`），demo 测试是纯 Node（`packages/demo/tests/*.test.ts`）。本轮跑 `pnpm exec vitest run packages/demo/tests/world.test.ts packages/demo/tests/shell-scene-wiring.test.ts` → **exit 0，25 passed**（`vitest-demo.txt`）。
- **无 CI**：`.github/workflows` 不存在。
- **可复用的现成资产**：两份 `.scratch` CDP 驱动（见 §2.6）；本轮的三个驱动增加了：
  - `drive-anim.mjs`：在文档加载前注入 `Phaser.Game.prototype.boot` 捕获实例 + Canvas `drawImage` 轨迹；按 20ms 采样所有动画的 `currentAnim/frameRate/repeat/currentFrame`。
  - `drive-input.mjs`：合成键盘并并行采样，解决 `Runtime.awaitPromise` 在长采样上的兼容问题。
  - `drive-runtime.mjs`：最朴素的“截图 + 控制台 + 网络”驱动（不带内部注入），用于对照。
- **录屏未做**：没有 `Page.startScreencast`，也没有视频文件；如需 Phase 1 录屏，这是新增项。
- **人工步骤**：起 server、起 Chrome（带 `--remote-debugging-port`）、跑驱动。三步可被一个脚本包起来，但目前没有。

## 6. W6 线索的复验

W6（`.scratch/p0-00-audit/research/w6-e2e-evidence.md`）的路线是“CDP 驱动真实站点 + 截图证明交互”；本轮在 HEAD 上复现了同一路线，并加了两项它没有的判据：

1. **渲染器**：Chrome/155 headless → Phaser v3.90.0 **Canvas**（`console-events.json` 首条；与 `asset-integration-v1/runs/2026-10-20e-site/site-report.md:73` 的记录一致）。
2. **播放参数**：W6 只证明“动画在跑”；本轮用帧索引与时间戳证明“跑的不是 manifest 声明的参数”（§3）。

因此 W6 的“CDP 能证明真实播放”结论成立，但**不能继承为“fps/loop 已验证”**。

## 7. 对 Phase 1 的最小建议（不实施，只记录）

1. `scene.ts` 建动画时从 `WorldDescription` 取 `fps` / `loop`（`world.ts` 需把 `resolvePackRef` 返回的 `animation` 参数带到描述里），并把 `repeat` 设为 `loop ? -1 : 0`；补一条运行时/源码见证测试，至少断言 `jump.loop=false` 不循环、`lunge` 5 帧后停住。
2. 给外壳一个**正式的测试入口**：例如 `?scene=anim&clip=scavenger-actor/idle&fps=...` 或 `window.__gm` 只读句柄；让 CDP/Playwright 不必注入 `Phaser.Game.prototype`。
3. 把 `runs/.../drive-anim.mjs` 的能力收进仓库脚本（建议 `packages/demo/probe/` 或 `scripts/`），参数化 `--serve-root / --entry / --out`，默认只写 run 目录；CI 可选。
4. 证据 manifest 至少记录：`site.json`、manifest `id/version`、`shell.js` 与图集哈希、浏览器/渲染器、采样区间、截图列表、console/异常计数。当前 `site.json` 已给出 pack 版本，但运行时横幅不打印，需外部补。
5. 固定场景建议用**独立的最小 config**（只放玩家 + 一个动画实体），以 `site` 装配到 `runs/` 下，而不是复用游戏关卡；这样动画验收不受关卡布局变化影响。

## 8. 证据清单

运行目录：[`../runs/2026-10-21-runtime/`](../runs/2026-10-21-runtime/)

| 文件 | 内容 |
|---|---|
| `run-log.txt` | 全部命令、退出码、端口关闭、非破坏性检查 |
| `http-server.log` / `chrome.log` | 静态服务器与 Chrome 日志 |
| `drive-runtime.mjs` / `drive-anim.mjs` / `drive-input.mjs` | CDP 驱动副本 |
| `10-idle-full.png` | 无输入、标称 idle 的全屏截图 |
| `11-idle-player-00..09.png` | 玩家局部连拍；去重 4 帧（`analysis.json`） |
| `20-run-full.png` / `22-jump-full.png` | 合成键盘触发的 run / jump 全屏截图 |
| `samples-idle.json` | 124 个 20ms 采样：所有动画的 key / frame / frameRate / repeat |
| `samples-run.json` / `samples-jump.json` | 键盘驱动下的 66 / 90 个采样 |
| `runtime-summary.json` | manifest 声明 vs 运行时实际 vs 实测间隔的汇总 |
| `draw-trace.json` | 4501 次 Canvas `drawImage`（源矩形 → 帧名全映射） |
| `analysis.json` | 局部截图去重与像素差、玩家 drawImage 换帧序列 |
| `console-events.json` | Phaser banner、`[shell] v2 ...`、九宫格 warning；无异常 |
| `network.json` | 所有站点/包资源 200；唯一 404 = `/favicon.ico` |
| `vitest-demo.txt` | 25 个纯层/源码见证测试通过 |

## 9. 边界遵守

- 只用现有 `site/v3`；未重装、未写 `out/`、未重建/覆盖任何产物。
- 未修改 `game-maker.local.json`；零付费；未发起任何生图/文本上游。
- 未运行 `pnpm check` / `pnpm build`；只跑了 `pnpm exec vitest run` 的两个 demo 测试文件（允许档）。
- 未编辑 `map.md`；未提交；所有新文件仅落在本票 `research/` 与 `runs/2026-10-21-runtime/`。
- server / Chrome 已关闭：8791 与 9333 均无监听进程（`run-log.txt` 第 6 节）。
