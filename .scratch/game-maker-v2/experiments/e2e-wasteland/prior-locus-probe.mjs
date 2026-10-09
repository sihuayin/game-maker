// 票 34 的补测：**「先验」究竟挂在 schema 的键名上，还是挂在提示词那张字段表上？**
//
// 起因是一次**意外**：改名后我漏了 rebuild，于是那一次请求是「schema 仍是 `coreLoop`、
// 而提示词那张字段表已经是 `coreLoopSteps`」的混合态 —— 模型**吐了数组**。
// 若这能复现，那「键名」这个说法就得改口：杠杆在**提示词那张表**，不在工具 schema。
// ⚠️ 那一次是 **n=1**（而且第 1 发 `empty-input` 白烧了），不能拿来当结论 —— 本探针把它补成 n=3/臂。
//
// 基线用**真跑**留下的那一发请求（`raw/after-rename/01.request.json`，出厂代码原样生成），
// 只动 `coreLoopSteps` 这一个名字，别的一个字不改。
//
// 跑法：node .scratch/game-maker-v2/experiments/e2e-wasteland/prior-locus-probe.mjs
import fs from "node:fs";
import path from "node:path";

const HERE = import.meta.dirname;
const RAW = path.join(HERE, "raw", "prior-locus");
fs.rmSync(RAW, { recursive: true, force: true });
fs.mkdirSync(RAW, { recursive: true });

const base = JSON.parse(
  fs.readFileSync(path.join(HERE, "raw", "after-rename", "01.request.json"), "utf8"));

const NEW = "coreLoopSteps";
const OLD = "coreLoop";
const N = 3;

/** 只换工具 schema 里的键名；提示词那张字段表**保持 `coreLoopSteps`**。 */
function schemaOnly(body) {
  const b = JSON.parse(JSON.stringify(body));
  b.tools = JSON.parse(JSON.stringify(b.tools).replaceAll(NEW, OLD));
  return b;
}
/** 两处都换回 `coreLoop` —— 改名前的原状。 */
function both(body) {
  return JSON.parse(JSON.stringify(body).replaceAll(NEW, OLD));
}
/** 只换提示词那张表；schema 保持 `coreLoopSteps`。 */
function promptOnly(body) {
  const b = JSON.parse(JSON.stringify(body));
  b.messages = JSON.parse(JSON.stringify(b.messages).replaceAll(NEW, OLD));
  return b;
}

const ARMS = {
  "a-schema仍是coreLoop·提示词表是Steps（意外那一发）": schemaOnly,
  "b-两处都coreLoop（改名前的原状）": both,
  "c-schema是Steps·提示词表是coreLoop": promptOnly,
};

const summary = {};
for (const [arm, patch] of Object.entries(ARMS)) {
  const body = patch(base);
  const counts = { array: 0, string: 0, other: 0 };
  const shapes = [];
  for (let i = 1; i <= N; i++) {
    const res = await fetch(`${process.env["ANTHROPIC_BASE_URL"]}/v1/messages`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": process.env["ANTHROPIC_AUTH_TOKEN"],
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });
    const txt = await res.text();
    fs.writeFileSync(path.join(RAW, `${arm}.${i}.json`), txt);
    const inp = JSON.parse(txt).content?.find((c) => c.type === "tool_use")?.input;
    // 模型必须二选一：要么按 schema 的键回，要么按提示词表的键回。
    const v = inp?.[OLD] ?? inp?.[NEW];
    const kind = Array.isArray(v) ? "array" : typeof v === "string" ? "string" : "other";
    counts[kind] += 1;
    shapes.push(`${OLD in (inp ?? {}) ? OLD : NEW}=${kind}`);
  }
  summary[arm] = counts;
  console.log(`${arm}\n    ${JSON.stringify(counts)}   逐发：${shapes.join(" · ")}`);
}
fs.writeFileSync(path.join(HERE, "raw", "prior-locus-summary.json"), JSON.stringify(summary, null, 1));
