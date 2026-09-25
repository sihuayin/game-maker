// drawlist 生成器：`AssetSpec` + `StyleSpec` → `DrawList[]`（票 22）。
//
// 它是[票 38](../../…/issues/38-asset-pack-assembly.md) 的 `DrawListGenerator` 端口的**实现**，
// 也是产物 A 在创作态那一侧的**唯一自动生成路径**（R10：管线永不调生图 API，但文本路径是主力）。
//
// 端口类型 `DrawListGenerator` 定义在 `pack.ts`（票 38）—— 这里是它的**实现**，不是定义。
//
// 三条从实测里来的规矩，全部写死在实现里：
//   ① **一个 asset 的全部帧必须在一次调用里生成** —— 分批调用会把同一个角色画成几个不同的东西
//      （票 22 自己的实测：分批时 idle 是 11×29 的瘦长人形、jump 是 15×24 的宽块）。
//   ② **纯文本 JSON，不用 `tool_choice`** —— 票 01 实测强制 JSON 只有 1/3 通过。
//      ⚠️ **端点已改**：票 01 的配方是 `/v1/chat/completions`，但 2026-09-24 实测那条路走
//      Codex 端点、落到一个余额为零的 provider（`INSUFFICIENT_BALANCE`），而 `/v1/messages`
//      仍然可用（0.7s、干净 JSON）。代理的上游配置一直在变，所以端点是**参数**不是常量。
//   ③ **关 thinking** —— 开着会吃光输出预算（实测 max_tokens=8000 时 reasoning=8000），
//      关掉快 18 倍、且真的产出内容；代价是会加 markdown 围栏，所以要剥。
import { DrawListSchema, type AssetSpec, type DrawList, type StyleSpec } from "@game-maker/contracts";
import { assetTask, drawListFewShot, drawListOpsSpec, framePlan, paletteLine, styleBrief } from "./prompt.js";
import type { DrawListGenerator } from "./pack.js";

export type GenerateOptions = {
  baseUrl: string;
  apiKey: string;
  /** 走哪个协议。默认 `messages` —— 见文件头那条实测。 */
  endpoint?: "messages" | "chat-completions";
  model?: string;
  /**
   * 输出预算。默认 **32000**。
   * ⚠️ 实测：一个 14 帧的角色要 ~14000 输出 token，8192 会被**截断**，
   * 而截断的表现是「JSON 不合法」—— 很容易误判成模型吐坏数据。
   */
  maxTokens?: number;
  timeoutMs?: number;
  /** 注入 fetch，便于离线测试。默认用全局 fetch。 */
  fetchImpl?: typeof fetch;
  /** 每次调用前把完整 prompt 交出来（存证 / 复现 / 人看）。 */
  onPrompt?: (prompt: string, spec: AssetSpec) => void;
  /**
   * 最多试几次。默认 **2**。
   *
   * 实测：同一份 prompt 三次里有一次返回**不合法 JSON**（票 01 记的是「9/9 通过」，
   * 但那是 9 次）。一次偶发失败不该让整包构建挂掉。
   *
   * ⚠️ 这**不是**修复循环（R2 砍掉的那个）：重试只是**重采样**，不把错误喂回去，
   * 模型不会被引导去改上一次的结果。
   */
  attempts?: number;
};

export class GenerationError extends Error {
  constructor(readonly assetId: string, message: string) {
    super(`资源 "${assetId}" 生成失败：${message}`);
    this.name = "GenerationError";
  }
}

/** 剥围栏 —— 关掉 thinking 之后模型会加，这是票 01 记录在案的副作用。 */
export function stripFences(text: string): string {
  const m = /```(?:json)?\s*([\s\S]*?)```/.exec(text);
  return (m?.[1] ?? text).trim();
}

export function renderPrompt(spec: AssetSpec, style: StyleSpec): string {
  return `你是像素游戏的美术。请为下面这一个资源产出它的绘制指令。

${styleBrief(style)}

色板（fill / stroke / colors 只能写 palette:下标）：
${paletteLine(style.palette)}

${drawListOpsSpec()}

${drawListFewShot()}

# 任务
${assetTask(spec, style)}

只输出 JSON 本体（形如 {"frames":[{"name":"...","ops":[...]}]}），不要 markdown 围栏，不要解释。`;
}

export function createDrawListGenerator(opts: GenerateOptions): DrawListGenerator {
  const model = opts.model ?? "deepseek-v4-pro";
  const endpoint = opts.endpoint ?? "messages";
  const doFetch = opts.fetchImpl ?? fetch;

  const attempts = Math.max(1, opts.attempts ?? 2);

  const once = async (spec: AssetSpec, style: StyleSpec): Promise<DrawList[]> => {
    const plan = framePlan(spec);
    const prompt = renderPrompt(spec, style);
    opts.onPrompt?.(prompt, spec);

    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 180_000);
    let raw: string;
    try {
      const res = await doFetch(`${opts.baseUrl}${endpoint === "messages" ? "/v1/messages" : "/v1/chat/completions"}`, {
        method: "POST", signal: ctl.signal,
        headers: endpoint === "messages"
          ? { "content-type": "application/json", "x-api-key": opts.apiKey, "anthropic-version": "2023-06-01" }
          : { "content-type": "application/json", authorization: `Bearer ${opts.apiKey}` },
        body: JSON.stringify({
          model, max_tokens: opts.maxTokens ?? 32_000,
          thinking: { type: "disabled" },          // ⚠️ 删掉它推理 token 会吃光输出预算
          messages: [{ role: "user", content: prompt }],
        }),
      });
      if (!res.ok) throw new GenerationError(spec.id, `上游返回 HTTP ${res.status}：${(await res.text()).slice(0, 200)}`);
      const body = (await res.json()) as {
        choices?: { message?: { content?: string }; finish_reason?: string }[];
        content?: { type: string; text?: string }[];
        stop_reason?: string;
      };
      // ⚠️ 截断与「模型吐坏 JSON」是**两回事**，但表现一样（JSON 不合法）。
      //   分开报，否则调的人会往错的方向找。
      const stop = body.stop_reason ?? body.choices?.[0]?.finish_reason;
      if (stop === "max_tokens") throw new GenerationError(spec.id, `输出撞上了 max_tokens（${opts.maxTokens ?? 32_000}）被截断 —— 帧数太多或每帧 op 太多，调大预算`);
      raw = endpoint === "messages"
        ? (body.content ?? []).filter((c) => c.type === "text").map((c) => c.text ?? "").join("")
        : body.choices?.[0]?.message?.content ?? "";
    } catch (e) {
      if (e instanceof GenerationError) throw e;
      throw new GenerationError(spec.id, `请求失败：${(e as Error).message}`);
    } finally { clearTimeout(timer); }

    let parsed: unknown;
    try { parsed = JSON.parse(stripFences(raw)); }
    catch (e) { throw new GenerationError(spec.id, `返回的不是合法 JSON（${(e as Error).message}）；前 200 字：${raw.slice(0, 200)}`); }

    const frames = (parsed as { frames?: unknown }).frames;
    if (!Array.isArray(frames)) throw new GenerationError(spec.id, `返回里没有 frames 数组（顶层键：${Object.keys(parsed as object).join(", ")}）`);
    if (frames.length !== plan.length) throw new GenerationError(spec.id, `清单要 ${plan.length} 帧，模型给了 ${frames.length} 帧`);

    const [vw, vh] = [spec.size.w, spec.size.h];
    return frames.map((f, i) => {
      const ops = (f as { ops?: unknown }).ops;
      const candidate = { format: "drawlist+curve/v1", id: spec.id, frame: `${plan[i]!.anim ?? spec.id}${plan[i]!.total > 1 ? plan[i]!.index + 1 : ""}`, viewBox: [0, 0, vw, vh], expectedSize: [vw, vh], ops };
      const r = DrawListSchema.safeParse(candidate);
      if (!r.success) {
        const first = r.error.issues[0]!;
        throw new GenerationError(spec.id, `第 ${i + 1} 帧不过 schema：${first.path.join(".")}: ${first.message}`);
      }
      return r.data;
    });
  };

  return async (spec, style) => {
    let last: unknown;
    for (let i = 0; i < attempts; i++) {
      try { return await once(spec, style); }
      catch (e) { last = e; }
    }
    throw last instanceof GenerationError
      ? new GenerationError(spec.id, `${attempts} 次都没成功；最后一次：${last.message.replace(`资源 "${spec.id}" 生成失败：`, "")}`)
      : last;
  };
}
