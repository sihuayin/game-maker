# ⚠️ 这一份是**副本**，别删

**它是第十一次真跑（段 A）走到检查点时的那份 `run/v1/`** —— 十跑里头**第一次**有链走到检查点。

**为什么另存一份：** 驱动脚本 `run-2026-10-13d.mjs` 第一行就是
`fs.rmSync(OUT, { recursive: true, force: true })` —— 只要再跑一次那个脚本，
`raw/run-out-2026-10-13d/` 就被抹掉。而这一份是**段 B 的入口**
（`build ruined-city-scavenger/run/v1`），抹掉它 = 要再花一次钱的段 A 才能重建一模一样的输入。
⚠️ 本仓吃过这个亏：**第二次真跑那 10 张图就是这么没的**（票 37 的教训）。

**这一份里有什么（10 份文件，64K，全是文本 + 两张 fixture 图）：**
`intent.md` · `game-intent.json` · `game-design.json` · `character-dna.json` ·
`asset-recipe.json` · `visual-world.json` · `stylespec.json` · `ledger.json` ·
`style.png`（借 halt-dusk.png，有意错配）· `reference.png`

**读它的时候记住三条：**
1. **没有 `visual-world-attempts.json`** —— 不是异常：那个容器**只在 `analyze-reference` 抛出时才写**，
   而这一跑没抛（成功路径结构性不写）。⇒ **这一跑没有产生 H4 / H2 的证据**。
2. ⚠️ **但账上记着那一步重采样过**：`ledger.json` 里 `analyze-reference` 是
   `attempts: 3, failures: ["schema","schema"]` —— 第十跑那个病**第二次独立复现**（两发 `schema`，
   第三发才过），**而字节又一次没留下**（没抛 ⇒ 没有写入点）。**这是有意的取舍，不是 bug。**
3. 只读。**不要往这一份里写任何东西** —— 它是量出来的证据。
