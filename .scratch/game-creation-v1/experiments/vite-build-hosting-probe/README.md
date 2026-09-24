# vite-build-hosting-probe

票 [03](../../issues/03-phaser-vite-playwright-chain.md) 的可复跑实验工程。
结论与完整分析见 [`../../research/demo-build-hosting.md`](../../research/demo-build-hosting.md)。

**用途**：一条命令复现「`file://` 打不开 Phaser 产物」这个判断，以及它的两个独立原因。
将来任何人再问「能不能双击打开」，跑这个而不是重查文档。

## 跑

```bash
cd .scratch/game-creation-v1/experiments/vite-build-hosting-probe
npm install --registry=https://registry.npmjs.org     # ⚠️ 见下
node probe.mjs
```

依赖：Node 22、`npx`、Python 3（起 http server）、Google Chrome
（找不到时用 `CHROME_BIN=/path/to/chrome node probe.mjs`）。

> ⚠️ **必须加 `--registry=https://registry.npmjs.org`。**
> 本机 `.npmrc` 指向 `registry.npmmirror.com`，装 Vite 8 时
> `@rolldown/binding-*` 会把**所有平台**的二进制都拉一遍，实测卡死 5 分钟以上；
> 走官方源 42 秒装完。

## 它验证的四件事

| # | 场景 | 预期 |
|---|---|---|
| 1 | `vite build` 计时 + 产物形状 | 亚秒级；`dist/index.html` + `dist/assets/index-<hash>.js` |
| 2 | `file://` 打开**真实 Vite 产物** | **失败** — module script 撞 CORS，游戏连构造函数都没跑 |
| 3 | `python3 -m http.server` 托管 dist | **成功** — atlas 正常装载 |
| 4a | `file://` + **classic script**（绕开 Vite）+ 相对路径 PNG | **游戏起来了但 `frames: []`** — 证明 Phaser 的 loader 自己也会撞 CORS，且**静默失败** |
| 4b | `file://` + base64 data URI（逃生舱） | 成功 |

4a 是最有价值的一条：它证明「把 bundle 改成 IIFE 就没事了」是错的。

## 文件

| 文件 | 说明 |
|---|---|
| `probe.mjs` | 主脚本，跑上面全部四项并打印汇总 |
| `package.json` / `vite.config.js` / `index.html` / `src/main.js` | 最小 Phaser 3 + Vite 工程（`base: './'`） |
| `public/assets/atlas.png` + `.json` | 极小的 2 帧图集（128×64，288 B），按**运行时资源**加载 |
| `mkatlas.mjs` | 重新生成上面那个图集：`node mkatlas.mjs public/assets/atlas.png` |

## 注意

`probe.mjs` 会写 `dist/`、`.filetest/`，都是产物，别提交。
