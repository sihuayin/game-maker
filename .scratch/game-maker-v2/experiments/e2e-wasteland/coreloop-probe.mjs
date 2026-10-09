// 票 23 的探针 ②：**意图那一步的 `coreLoop` 为什么老是一串字符串**。
//
// 事实（见 raw/intent-raw/）：工具入参里 `coreLoop` 三发三中全是 **string**，
// 而 `player.goals` / `mechanics` / `entities` / `winConditions` **同期都是数组** ——
// 也就是说**不是模型不会用数组**，是它把 `coreLoop` 这一个键读错了。
//
// 而工具 schema 里 `coreLoop` 写得好好的（`{"type":"array","items":{"type":"string"}}`，
// 且在 `required` 里）⇒ 嫌疑落在**提示词的骨架**那句：
//     `coreLoop` —— 核心循环，**一条一句**，**至少一条**
// `winConditions` 的骨架写的是「…**一条一句**；「没有终点」就留空**数组**」—— 它**提了「数组」二字**，
// 而 `coreLoop` 那句**一个字都没提**。⇒ 本探针把**同一份请求**里的这一句换掉再发，n=3/臂。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/coreloop-probe.mjs
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const ROOT = path.resolve(HERE, "../../../..");
const RAW = path.join(HERE, "raw", "coreloop");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const base = JSON.parse(fs.readFileSync(path.join(HERE, "raw", "intent-raw", "01.request.json"), "utf8"));
const BASE_HINT = "- `coreLoop` —— 核心循环，**一条一句**，**至少一条**";

const ARMS = {
  "a-现状": (m) => m, // 原样重发：证明它可复现，不是那一发的偶然
  "b-点名数组": (m) => m.replace(BASE_HINT, "- `coreLoop` —— 核心循环，**一个字符串数组**，每个元素一句话，**至少一条**"),
  "c-只加两个字": (m) => m.replace(BASE_HINT, "- `coreLoop` —— 核心循环，**一条一句**，**至少一条**（这是一个**数组**）"),
};

const N = 3;
const out = {};
for (const [arm, patch] of Object.entries(ARMS)) {
  const counts = { array: 0, string: 0, other: 0 };
  for (let i = 1; i <= N; i++) {
    const body = JSON.parse(JSON.stringify(base));
    body.messages[0].content[0].text = patch(body.messages[0].content[0].text);
    const res = await fetch(`${process.env["ANTHROPIC_BASE_URL"]}/v1/messages`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-api-key": process.env["ANTHROPIC_AUTH_TOKEN"], "anthropic-version": "2023-06-01" },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    fs.writeFileSync(path.join(RAW, `${arm}.${i}.json`), txt);
    const doc = JSON.parse(txt);
    const input = doc.content?.find((c) => c.type === "tool_use")?.input;
    const v = input?.coreLoop;
    const kind = Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "other";
    counts[kind] += 1;
    if (kind !== "array") console.log(`   ${arm} #${i}: coreLoop=${JSON.stringify(v)?.slice(0, 60) ?? "(没有 tool_use)"}`);
  }
  out[arm] = counts;
  console.log(`${arm.padEnd(14)} ${JSON.stringify(counts)}`);
}
fs.writeFileSync(path.join(HERE, "raw", "coreloop-summary.json"), JSON.stringify(out, null, 1));
console.log(`\n原始落在 ${path.relative(ROOT, RAW)}/`);
