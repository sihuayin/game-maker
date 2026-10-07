// **一次运行的生命周期**（票 15 的 Q10 / Q16 / Q17）。
//
// ⚠️ 这一份钉的是那三段状态转移与它们的**边界**：定稿之前没有身份（`gameId` 迟到）、
//   定稿是**一次原子的改名**、失败**改名留现场**、而**失败不消耗版本号**。
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterAll, describe, expect, it, vi } from "vitest";
import { abandonRun, commitRun, nextRunVersion, openRun, parseRunVersion } from "../src/index.js";

const dirs: string[] = [];
const tmp = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), "gm-run-")); dirs.push(d); return d; };
afterAll(() => { for (const d of dirs) fs.rmSync(d, { recursive: true, force: true }); });

describe("§开 → 定稿", () => {
  it("⚠️ `openRun` 只开临时目录、**不分配版本号** —— 那时 `gameId` 还不知道", () => {
    const out = tmp();
    const run = openRun(out);
    expect(run.identity).toBeUndefined();
    expect(fs.existsSync(run.tmpDir)).toBe(true);
    expect(path.basename(run.tmpDir).startsWith(".building-")).toBe(true);
  });

  it("`commitRun` 一次改名到 `run/v<N>`：第一次 v1、第二次 v2（**按 gameId 数**）", () => {
    const out = tmp();
    const a = commitRun(openRun(out), "game-a");
    expect(a).toMatchObject({ gameId: "game-a", version: 1 });
    expect(a.dir.endsWith(path.join("game-a", "run", "v1"))).toBe(true);
    const b = commitRun(openRun(out), "game-a");
    expect(b.version).toBe(2);
    // ⚠️ 换一个 gameId ⇒ 那是**另一棵树**，从头数
    expect(commitRun(openRun(out), "game-b").version).toBe(1);
  });

  it("⚠️ **撞名 ⇒ 原子抢**：v1 被占住时，定稿落到 v2（不覆盖、也不报错）", () => {
    const out = tmp();
    fs.mkdirSync(path.join(out, "game-a", "run", "v1"), { recursive: true });
    fs.writeFileSync(path.join(out, "game-a", "run", "v1", "占位.txt"), "x");
    expect(nextRunVersion(out, "game-a")).toBe(2);          // 扫得到 ⇒ 下一个就是 2
    expect(commitRun(openRun(out), "game-a").version).toBe(2);
  });

  it("⚠️ **被抢了要重试**：第一次 `renameSync` 撞上 ENOTEMPTY ⇒ 取下一个 N（那正是「原子抢」那半句）", () => {
    const out = tmp();
    const spy = vi.spyOn(fs, "renameSync");
    spy.mockImplementationOnce((_from, to) => {
      // ⚠️ 模拟「另一个进程刚好在这一瞬间把 v1 占住了」：**既**失败**又**把目标建出来
      fs.mkdirSync(String(to), { recursive: true });
      fs.writeFileSync(path.join(String(to), "占位.txt"), "x");
      const e = new Error("被抢了") as NodeJS.ErrnoException; e.code = "ENOTEMPTY"; throw e;
    });
    const id = commitRun(openRun(out), "game-a");
    spy.mockRestore();
    expect(id.version).toBe(2);       // 第一次抢 v1 失败 ⇒ 落到 v2，而且没有把异常漏出去
    expect(fs.existsSync(id.dir)).toBe(true);
  });

  it("定稿之后句柄记得自己是谁（再定稿一次 ⇒ 直接说清「已经定稿了」）", () => {
    const run = openRun(tmp());
    commitRun(run, "game-a");
    expect(run.identity?.gameId).toBe("game-a");
    expect(() => commitRun(run, "game-a")).toThrowError(/已经定稿/);
  });
});

describe("§放弃：**改名留现场、不删**，而且不消耗版本号", () => {
  it("⚠️ 还没定出 id 就挂 ⇒ 现场在 `out/.failed-<ts>/`（**带点**，不然它长得像个 gameId）", () => {
    const out = tmp();
    const run = openRun(out);
    fs.writeFileSync(path.join(run.tmpDir, "intent.md"), "需求原文");
    const site = abandonRun(run, { why: "第三步挂了" })!;
    expect(path.basename(site).startsWith(".failed-")).toBe(true);
    expect(fs.readFileSync(path.join(site, "intent.md"), "utf8")).toBe("需求原文");   // 跑完的那几步在
    expect(fs.existsSync(run.tmpDir)).toBe(false);                                  // 临时目录搬走了
  });

  it("定出 id 之后挂 ⇒ 现场在 `<gameId>/run/failed-<ts>/`", () => {
    const out = tmp();
    const run = openRun(out);
    const site = abandonRun(run, { why: "清单那一步挂了", gameId: "game-a" })!;
    expect(site).toContain(path.join("game-a", "run"));
  });

  it("⚠️ **失败不消耗版本号**：放弃了三次，第一次成功仍然是 v1", () => {
    const out = tmp();
    for (let i = 0; i < 3; i++) abandonRun(openRun(out), { why: "挂" });
    expect(commitRun(openRun(out), "game-a").version).toBe(1);
  });

  it("⚠️ 已定稿的运行再 `abandonRun` ⇒ 什么都不动（现场在**构建那一侧**）", () => {
    const run = openRun(tmp());
    const id = commitRun(run, "game-a");
    expect(abandonRun(run, { why: "构建段挂了" })).toBe(id.dir);
    expect(fs.existsSync(id.dir)).toBe(true);
  });
});

describe("§`parseRunVersion` 只认 `v<N>`", () => {
  it("从目录名读回 N；别的形状 ⇒ 说得出「这不是一次运行的目录」", () => {
    expect(parseRunVersion("/x/game-a/run/v7")).toBe(7);
    expect(() => parseRunVersion("/x/game-a/run/failed-2026")).toThrowError(/不是一次运行的目录/);
  });
});
