// ⚠️ **这一份文件装两条见证 —— 它们是同一次失败现场的两个读法**（共用同一套 stdio 夹具：bundle + 桩 + spawn）：
//   ① **票 66**：凭据有没有一路递到上游（**桩被打了没有**）。
//   ② **票 50 的 MCP 那半边**：壳有没有把那次调用留下的**账**与**失败现场指针**读出来、印给两个面看。
//   ⚠️ 合成一个文件是**有意的**：两条判据要的是**同一个**判断失败现场（上游活着 · 图合法 ·
//     是 `pack` 判「这张图一个不透明像素都没有」），而票 50 的边界写着「把 stub **收在测试文件里**、
//     **不进化成一套测试框架**」—— 抽一个共享夹具模块正是那句话要拦的东西 ⇒ 宁可一个文件装两条。
//
// ⚠️ **从外面**驱动 MCP 服务（真 stdio），而不是像 `server.test.ts` 那样在进程内 `drive()`：
//   那组断言的是「`handle` 收到什么消息、回了什么」—— 它**看不见**请求有没有真的发出去。
//   而票 66 那一档病的读数**恰恰是**「**桩被打了 0 发**」（退 2 · 凭据明明设了 · 请求压根没发）。
//   ⇒ 这一档只能站在**服务外面**看：起一个活着的上游，数它被打了没有。
//   ⚠️ 而票 50 那半边**顺带**因此更硬：它读的是**真协议回执**（`content` 与 `structuredContent`），
//     不是进程内那个收集器数组。
//
// ⚠️ **为什么在测试里现 bundle，而不是 spawn `dist/server.mjs`**：
//   根 `package.json` 的 `test` 是 `vitest run`，**不 build** ⇒ 直接跑 `dist/server.mjs` 是在**赌**
//   那份 dist 是新的。而本仓那个陷阱记过三次（票 09 / 55 / 61）：**改完 `src` 不重建，
//   判据读的就不是你改的那份代码** —— 而且它还会**绿**（跑的是旧产物、谁也不会喊）。
//   现 bundle 当前 `src` ⇒ 这条判据在**结构上**钉在这次改的那行代码上，不靠人记得先 build。
//   ⚠️ 旗子与 `packages/mcp/package.json` 那条 `bundle` 脚本**逐字同形**（同一个二进制、同一组参数）。
//   ⚠️ 落点**必须**叫 `server.mjs`：服务入口的守卫是 `process.argv[1]?.endsWith("server.mjs")`
//     （`server.ts:364`）—— 名字不对它一声不响地什么都不做，判据会以「超时」而不是「红在该红的地方」收场。
//
// ⚠️ **零付费**：上游是**本地桩**（`node:http`），一笔真调用都没有；文字上游被指到死端口。
import { spawn } from "node:child_process";
import { copyFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { encodePNG } from "@game-maker/assets";

const ROOT = fileURLToPath(new URL("../../../", import.meta.url));

// ⚠️ esbuild 是**根**的 devDependency（hoist 到仓根 `node_modules`）⇒ 从 `packages/mcp` 里
//   `import "esbuild"` 解析不到，得拿**仓根**的 require 去解。⚠️ 这不是绕路：`packages/mcp` 那条
//   `bundle` 脚本用的**就是**这个二进制（它同样只因为 hoist 才跑得动）。
// ⚠️ **刻意不写成 `skipIf(解不到)`**：这条判据是票 66 唯一的见证，解不到就该**红**，
//   不该变成一条永远不跑的绿（那种「假牙」正是本票 §3 记的病）。
const { build } = await import(pathToFileURL(createRequire(path.join(ROOT, "package.json")).resolve("esbuild")).href);

const D = mkdtempSync(path.join(tmpdir(), "gm-mcp-66-"));
const BUNDLE = path.join(D, "server.mjs");   // ⚠️ 名字不能改（见文件头）
const RECIPE = path.join(D, "recipe.json");

/** 桩收到的每一发请求 —— 票 66 的读数就落在这里。 */
const seen: { method?: string; url?: string; auth?: string; body: string }[] = [];

let server: ReturnType<typeof createServer>;
let port = 0;

beforeAll(async () => {
  await build({
    entryPoints: [path.join(ROOT, "packages/mcp/src/server.ts")],
    bundle: true, platform: "node", format: "esm", target: "node22",
    outfile: BUNDLE, external: ["vite", "phaser"], logLevel: "warning",
  });

  // 风格文件与清单**住同一个目录**（`styleRef` 就是普通文件名 · `ops.ts:1370` 相对配方文件解析）
  copyFileSync(ROOT + "fixtures/packs/counter-siege/v4/authoring/stylespec.json", path.join(D, "stylespec.json"));
  writeFileSync(RECIPE, JSON.stringify({
    format: "asset-recipe/v1", id: "mcp-66", styleRef: "stylespec.json",
    assets: [{
      // ⚠️ 字段逐个照 `AuthoringAsset`（`contracts/src/recipe.ts` · `.strict()`：多一个键就拒）
      spec: {
        kind: "sprite", id: "crate", role: "箱子", description: "一个木箱。",
        styleId: "style-ref", anchor: { x: 0.5, y: 1 }, size: { w: 16, h: 16 }, required: true,
      },
      source: { kind: "image" },   // ⚠️ **就是这个 kind 让 `imageTransport` 变成必需品**
    }],
  }), "utf8");

  // 桩：HTTP 200 + 一张**完全合法**的 16×16 全透明 PNG（人裁边界 2 逐字）。
  // ⚠️ 它**故意是全透明的** —— 那正是让这次调用落在「**判断失败**」（退 1）而不是别的档上的东西：
  //   上游没坏、图片合法、凭据也对，是 `pack` 判「一个不透明像素都没有」。
  const png = encodePNG({ width: 16, height: 16, data: Buffer.alloc(16 * 16 * 4) }).toString("base64");
  server = createServer((q, res) => {
    let body = "";
    q.on("data", (c) => (body += c));
    q.on("end", () => {
      seen.push({ method: q.method, url: q.url, auth: q.headers.authorization, body });
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ data: [{ b64_json: png }] }));
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", () => r()));
  port = (server.address() as { port: number }).port;
}, 60_000);

afterAll(async () => {
  await new Promise<void>((r) => server.close(() => r()));
  rmSync(D, { recursive: true, force: true });
});

/** 起一个真 stdio 服务，喂几行，等 `wantId` 那一条回执。⚠️ 无论成败都 `kill`。 */
const askStdio = async (lines: object[], wantId: number, timeoutMs = 60_000) => {
  const child = spawn(process.execPath, [BUNDLE], {
    stdio: ["pipe", "pipe", "pipe"],
    // ⚠️ 人裁边界 3：**注入的是子进程的环境** —— 父进程的 `process.env` **一个字节都不动**
    //   ⇒ 「即使断言失败也要恢复环境」在**结构上**就成立（没有可恢复的东西），
    //   也不会污染同一次 `vitest run` 里的别的文件。
    // ⚠️ `cwd` 指到临时目录：让仓根那份 `game-maker.local.json`（若存在）**不可见**
    //   —— 判据只认我们注入的这几样，不吃本机状态。
    cwd: D,
    env: {
      ...process.env,
      GAME_MAKER_IMAGE_PROTOCOL: "openai",
      GAME_MAKER_IMAGE_BASE_URL: `http://127.0.0.1:${port}/v1`,
      GAME_MAKER_IMAGE_API_KEY: "k",
      GAME_MAKER_IMAGE_MODEL: "m",
      // ⚠️ 文字上游**指死端口**：这条链一处文字调用都不该有 —— 真有的话这一组会以 **3** 而不是 1 红，
      //   而那一红正是**要看见的**（让「撞的是判断失败」这条主张自己拆穿自己）。
      ANTHROPIC_BASE_URL: "http://127.0.0.1:9",
      ANTHROPIC_AUTH_TOKEN: "x",
    },
  });
  const replies: unknown[] = [];
  let buf = "";
  let stderr = "";
  child.stderr.on("data", (c) => (stderr += c));
  const wantArrived = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`等 id=${wantId} 超时（${timeoutMs}ms）· 已收到 ${JSON.stringify(replies)} · stderr=${stderr}`)),
      timeoutMs,
    );
    child.stdout.on("data", (c) => {
      buf += c;
      let i: number;
      while ((i = buf.indexOf("\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 1);
        if (!line.trim()) continue;
        try {
          const m = JSON.parse(line) as { id?: number };
          replies.push(m);
          if (m.id === wantId) { clearTimeout(timer); resolve(); }
        } catch { /* 不是 JSON 的那几行不算回执 */ }
      }
    });
    child.on("exit", () => { clearTimeout(timer); reject(new Error(`服务提前退了 · 已收到 ${JSON.stringify(replies)} · stderr=${stderr}`)); });
  });
  for (const l of lines) child.stdin.write(JSON.stringify(l) + "\n");
  try { await wantArrived; } finally { child.kill(); }
  return replies.find((m) => (m as { id?: number }).id === wantId) as any;
};

describe("⚠️ 票 66：`build_asset_pack` 走**真 stdio 服务**时拿得到生图凭据", () => {
  it("凭据一路递到了上游 —— 桩被打了 **1** 发（修之前是 **0** 发），且不再退 usage/2", async () => {
    const before = seen.length;
    const reply = await askStdio([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "witness", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "build_asset_pack", arguments: { recipePath: RECIPE, outDir: path.join(D, "out") } } },
    ], 2);

    // ① ⚠️ **这条是判据的脊梁**（人裁边界 2：「不能把『没有出现原来的错误文案』单独当作通过」）。
    //    桩的**命中数**是这里唯一不可伪造的读数：修之前它是 **0**（请求根本没发出去），
    //    而现在它是 1。⚠️ 断言**恰好 1**（不是 ≥1）还有第二层意思：这条链上**没有**藏着重试
    //    （R13 明令禁止）—— 真加了的话，「打了个透明图就重发」会当场把这一条打红。
    const sent = seen.slice(before);
    expect(sent.length, "桩被打的**命中数**").toBe(1);
    const req = sent[0]!;   // ⚠️ 上一行已经钉住它恰好是 1 ⇒ 这一个 `!` 不是「我觉得它在」，是判据说的
    // 打出去的那一发带着**我们注入的那份凭据**与**我们这份配方** —— 证明子进程真的把 env 读进去用了。
    expect([req.method, req.url]).toEqual(["POST", "/v1/images/generations"]);
    expect(req.auth).toBe("Bearer k");
    const payload = JSON.parse(req.body) as { model: string; prompt: string };
    expect(payload.model).toBe("m");
    expect(payload.prompt).toContain("一个木箱");

    // ② 不再退 **usage/2**（票 66 的症状就是这一档），而是**判断失败 1**
    //    —— 上游没坏、图合法、凭据也对，是 `pack` 判「这张图一个不透明像素都没有」。
    //    ⚠️ 钉 **1 而不是「不是 2」**：后者会让上游失败（3）与契约失败（4）也蒙混过关。
    expect(reply.result.isError).toBe(true);
    expect(reply.result._exitCode).toBe(1);
    expect(reply.result.content[0].text).toMatch(/一个不透明像素都没有/);
    // ⚠️ 顺带钉死**不是**上一版那句误报的文案（它说「没配生图凭据」，而我们明明配了、也递到了）
    expect(reply.result.content[0].text).not.toMatch(/没配生图凭据/);

    expect(existsSync(path.join(D, "out", "mcp-66"))).toBe(true);
  });
});

describe("⚠️ 票 50 · MCP 这半边：壳也把**账**与**失败现场指针**读出来印给两个面看", () => {
  /** 一次**判断失败**（上游活着 · 图合法 16×16 全透明）—— 与票 66 那条用的是**同一个**现场。 */
  const judgementFailure = () =>
    askStdio([
      { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "witness", version: "1" } } },
      { jsonrpc: "2.0", method: "notifications/initialized" },
      { jsonrpc: "2.0", id: 2, method: "tools/call", params: { name: "build_asset_pack", arguments: { recipePath: RECIPE, outDir: path.join(D, "out") } } },
    ], 2);

  // ⚠️ **这一组盯的是 `server.ts:340-356` 那个 catch**：票 48 让两个壳改成**按能力读**
  //   （`ledgerOfError` / `failureDirOfError`，不按类读）—— 改完之后**没有任何东西看着它**（票 50 的立案理由）。
  //   ⚠️ 而这里撞的**正是**那一档：账单是**挂在裸 `Error` 上**的（`pack.ts` 那条透明度判断），
  //   不是 `CommandError` 带的（票 01 那两条判据喂的是死端口 ⇒ 撞的是**上游**那条路）。
  //   ⚠️ 谁把 `server.ts:340` 那两行改回 `e instanceof CommandError ? … : undefined`，**这一组会红** —— 那就是要看见的。

  it("人看的那一份（`content`）：账那一行与现场那一行**都印出来了**，且那个现场**真在盘上**", async () => {
    const reply = await judgementFailure();
    const text = reply.result.content[0].text as string;

    // ⚠️ 先钉死「**失败不是上游的锅**」：退 1（判断失败）而不是 3（上游）——
    //   否则这一组可能只是「换了个错」而不是「这条路上真的带着账与现场」。
    expect(reply.result._exitCode).toBe(1);
    expect(text).toMatch(/一个不透明像素都没有/);              // 撞的是那条判断
    expect(text).toMatch(/已经花掉的（1 次调用 · 1 次往返）/);    // ← 账（票 46）
    expect(text).toMatch(/· image crate ·/);                   // 账里**那一笔**，不是「有一行字」
    expect(text).toMatch(/已经付过钱的那几张原图留着/);          // ← 现场（票 48 的 Q5）
    // ⚠️ 先把 `**` 剥掉再抓（与 `cli.test.ts` 同一手）—— 标记会插在「留着」与「（」之间，直接匹配抓不到。
    const dir = /原图留着（[^）]*）：(\S+)/.exec(text.replace(/\*\*/g, ""))?.[1];
    expect(dir, "现场路径").toBeTruthy();
    expect(existsSync(dir!), "印出来的那个指针指过去得真有个地方").toBe(true);
  });

  it("机器看的那一份（`structuredContent`）：`ledger` 钉到**那一笔的内容**、`failureDir` 指得到地方", async () => {
    const reply = await judgementFailure();
    const sc = reply.result.structuredContent as {
      ledger?: { step: string; target: string; attempts: number; ms?: number }[];
      failureDir?: string;
    } | undefined;

    expect(sc, "失败时也要有这一格（票 48：机器可读的那一份与 CLI --json **同源**）").toBeDefined();
    // ⚠️ 钉的是**那一笔的内容**，不是「有个 `ledger` 键」—— 空数组、`{}` 那种**假牙**过不了这一条。
    expect(sc!.ledger?.map((c) => [c.step, c.target]), "账里那一笔是哪一件资源").toEqual([["image", "crate"]]);
    expect(sc!.ledger?.[0]?.ms, "那一笔的时长是这次真跑出来的").toBeTypeOf("number");
    expect(sc!.ledger?.[0]?.attempts).toBe(1);
    expect(sc!.failureDir, "现场指针").toMatch(/failed-/);
    expect(existsSync(sc!.failureDir!), "指针指过去得真有个地方").toBe(true);
  });
});
