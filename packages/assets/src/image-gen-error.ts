// 生图错误单独一个文件 —— `image-gen.ts` 与 `image-config.ts` 都要引它，
// 放在任一边都会让另一边为了一个类去引整个模块（也就把 fetch 之类拖进依赖图）。
export type ImageProtocol = "openai" | "minimax" | "dashscope-mcp" | "gemini";

/** 生图失败。调用方据此判「上游不可达」（退出码 3），而不是笼统的「失败」（1）。 */
export class ImageGenerationError extends Error {
  constructor(message: string) { super(message); this.name = "ImageGenerationError"; }
}
