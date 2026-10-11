# 第七次真跑 · 段 A 的失败现场（2026-10-11）

⚠️ **这份是复制品，为的是「下一次段 A 一跑就没了」** ——
驱动 `run-2026-10-11a.mjs` 开头就 `rmSync(OUT)`，而原现场在
`raw/run-out-2026-10-11a/.failed-2026-10-11T05-13-03-917Z/` **里面**。
同一条坑在本仓库吃过一次（`../../.gitignore:12-19`：[票 37](../../../../issues/37-key-colour-not-delivered.md)
那 9 张图之后才补的规矩 —— 第二次真跑那 10 张就是这么没的）。

**这一份是[票 42](../../../../issues/42-cross-array-id-uniqueness.md) 的实证**：
`game-design.json` 里 `player.id = "scavenger"` 而 `npcs[0].id = "scavenger"` —— **跨数组重名**，
设计层一声没响，一路走到 `character-dna` 才被拒（3 发打满 R16 地板、全 `schema`）。

| 文件 | 是什么 |
|---|---|
| `run-2026-10-11a.json` | 驱动的完整读数（退出码 / 墙钟 / 错误逐字 / `ledger`） |
| `game-design.json` | **证据本体** —— 那份设计，逐桶的 id 都在里面 |
| `game-intent.json` · `visual-world.json` | 前两步的产物（这三步**都过了**） |
| `intent.md` · `style.png` | 输入（`intent.md` 是 §27 逐字节 · `style.png` 是借来的 `halt-dusk.png`） |

⚠️ **原现场没删** —— 它还在 `raw/run-out-2026-10-11a/` 里；这一份只是保险。
