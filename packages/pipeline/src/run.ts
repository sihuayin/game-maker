// **一次创建运行**的生命周期（票 15 的 Q10 / Q16 / Q17）。
//
// ⚠️ 这一层的存在理由**不是**「把几个函数串起来」—— 是「**单游戏一次创建运行**」这条边界要有名字：
//   一次运行**从「还没有身份」开始**（`gameId` 由 plan 那一步的模型给出），到「定稿」或「留下现场」结束。
//   三段状态转移写在这里，别的模块只认这个句柄。
//
// ⚠️ **正式规则**（人类原话，2026-10-07，实现照抄）：
//   「同一 Run 可以有多次 construction attempt；首次 attempt 默认与 Run version 对齐。
//     之后每次新的 construction attempt 使用由父 Run 显式分配的新子树版本。
//     所有子步骤只接受调用方传入的 version，禁止自行计算。失败 attempt 不消耗已提交版本。」
//   ⇒ 落在本文件：`openRun` 开一个**没有版本号**的临时目录（那时 gameId 还不知道），
//     `commitRun` 才分配 `run/v<N>`（**父**分配）；而「子步骤禁止自行计算」那条口子开在
//     `packAssets` / `assembleFromConfig` 那一侧（它们收调用方给的 version）。
import fs from "node:fs";
import path from "node:path";

const V_DIR = /^v(\d+)$/;

/** 一次创建运行的句柄。⚠️ `identity` 在 `commitRun` 之前是缺席的（那时**还没有身份**）。 */
export type RunHandle = {
  outRoot: string;
  /** 临时工作目录 —— **定稿之前的一切都写这里**（与 `pack` 的 `.building-*` 同一条规矩）。 */
  tmpDir: string;
  identity?: RunIdentity;
};

/** 定稿之后的身份。⚠️ 目录名里的 `gameId` 与版本号就是这一份。 */
export type RunIdentity = { gameId: string; version: number; dir: string };

/**
 * 这个 `gameId` 下**下一个** run 版本号。⚠️ 与 `nextPackVersion` 同一条规矩（扫目录、取 max + 1）。
 *
 * ⚠️ **它由父（运行）算、不由子步骤算** —— 那正是正式规则里「子步骤禁止自行计算」的反面。
 * ⚠️ 与 `nextPackVersion` 一样**没有锁**：两个进程同时开同一次运行会撞名，
 *   而 `commitRun` 用 `renameSync` 到**非空目录**会失败这一点当**原子抢**（见下）。
 */
export function nextRunVersion(outRoot: string, gameId: string): number {
  const dir = path.join(outRoot, gameId, "run");
  if (!fs.existsSync(dir)) return 1;
  const versions = fs
    .readdirSync(dir)
    .map((d) => V_DIR.exec(d))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]));
  return versions.length === 0 ? 1 : Math.max(...versions) + 1;
}

/** 从一个运行目录的**名字**里读回版本号（`runBuild` 用它认「这是第几次运行」）。 */
export function parseRunVersion(dir: string): number {
  const m = V_DIR.exec(path.basename(dir));
  if (m === null) throw new Error(`这不是一次运行的目录（要 \`v<N>\` 的形状）：${dir}`);
  return Number(m[1]);
}

/**
 * 开一次运行：分配一个临时目录。
 * ⚠️ **这一步不分配版本号** —— `run/v<N>` 的 N 只能在 `commitRun` 那一刻定
 *   （那时 `gameId` 才知道，而「这棵树里的第几次运行」是**按 gameId 数**的）。
 */
export function openRun(outRoot: string): RunHandle {
  const tmpDir = path.join(outRoot, `.building-${process.pid}-${Date.now().toString(36)}`);
  fs.rmSync(tmpDir, { recursive: true, force: true });
  fs.mkdirSync(tmpDir, { recursive: true });
  return { outRoot, tmpDir };
}

/**
 * 定稿：`<outRoot>/<gameId>/run/v<N>` ← 临时目录（**一次 rename**）。
 *
 * ⚠️ **原子抢**：`renameSync` 到**非空**目标目录会失败（`ENOTEMPTY`/`EEXIST`）——
 *   那就是「这个 N 被别人拿走了」，取下一个再来。不加锁（全仓没有一个锁），而这一条
 *   让「同一次运行的两次并发定稿」里**只有一个成功**，不比 `nextPackVersion` 差，也不比它复杂。
 * ⚠️ **失败不消耗版本号**：走到这一行之前挂掉，那个 N **没被用掉**（临时目录改名成 `failed-*`）。
 */
export function commitRun(run: RunHandle, gameId: string): RunIdentity {
  if (run.identity !== undefined) throw new Error(`这次运行已经定稿了：${run.identity.dir}`);
  const parent = path.join(run.outRoot, gameId, "run");
  fs.mkdirSync(parent, { recursive: true });
  for (let i = 0; i < 64; i++) {
    const version = nextRunVersion(run.outRoot, gameId);
    const dir = path.join(parent, `v${version}`);
    try {
      fs.renameSync(run.tmpDir, dir);
    } catch (e) {
      const code = (e as NodeJS.ErrnoException).code;
      if (code === "ENOTEMPTY" || code === "EEXIST") continue;   // 被抢了 ⇒ 取下一个 N
      throw e;
    }
    const identity: RunIdentity = { gameId, version, dir };
    run.identity = identity;
    return identity;
  }
  throw new Error(`连续 64 次都没抢到一个 run 版本号（${gameId}）—— 这不像并发，像是目录里有什么东西在生成 v<N>`);
}

/**
 * 放弃：把临时目录**改名**成失败现场（**只改名、不删** —— `image-route-v1` 的 ①）。
 *
 * ⚠️ 现场放在哪由「**定出 id 了没有**」决定：
 *   · 定出来了 ⇒ `<outRoot>/<gameId>/run/failed-<ts>/`（与历次运行的目录并列）；
 *   · 还没定出来（`gameId` 在 plan 那一步之后才知道）⇒ `<outRoot>/.failed-<ts>/`
 *     —— ⚠️ **带点前缀**，否则它会长得像一个 gameId 的目录。
 * ⚠️ 现场里是**已经跑完的那几步的产物**（谁也没删谁）—— 那正是它该有的样子：
 *   看一眼就知道这一趟断在哪一步（票 15 的 invariant 5）。
 * ⚠️ **已定稿的运行没有临时目录可搬**（它已经改名过去了）⇒ 这里什么都不做：
 *   构建段失败时，现场在**包那一侧**（`pack/v<N>/failed-<ts>/`，pack 自己留的）。
 */
export function abandonRun(run: RunHandle, opts: { why: string; gameId?: string }): string | undefined {
  if (run.identity !== undefined) return run.identity.dir;
  if (!fs.existsSync(run.tmpDir)) return undefined;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const parent = opts.gameId === undefined ? run.outRoot : path.join(run.outRoot, opts.gameId, "run");
  fs.mkdirSync(parent, { recursive: true });
  const site = path.join(parent, opts.gameId === undefined ? `.failed-${stamp}` : `failed-${stamp}`);
  fs.renameSync(run.tmpDir, site);
  return site;
}
