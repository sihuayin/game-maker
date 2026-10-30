// **视觉人工审核记录 v1**（P0-02 v2 票 04）—— `review-verdict` 的唯一权威输入。
//
// ⚠️ 记录是这次人工结论的**签名载体**：`delivery.visualReview` 的 reviewer/reviewedAt/note
//   直接取自记录；CLI 不再接受 `--reviewer` / `--note`，避免同一事实有两个来源。
// ⚠️ `subject` 与正式证据清单同形（六字段）；写回前必须与实际 pack/config 字节及
//   `qa-report.delivery` 的 pack/site/shell 一致。
import { z } from "zod/v4";

export const VISUAL_REVIEW_RECORD_FORMAT = "visual-review-record/v1" as const;

const Sha256 = z.string().regex(/^sha256:[0-9a-f]{64}$/, "形如 sha256:<64 位小写十六进制>");

export const VisualReviewSubjectSchema = z.strictObject({
  packId: z.string().min(1),
  packVersion: z.number().int().positive(),
  siteVersion: z.number().int().positive(),
  shellVersion: z.string().min(1),
  manifestChecksum: Sha256,
  configChecksum: Sha256,
});
export type VisualReviewSubject = z.infer<typeof VisualReviewSubjectSchema>;

export const VisualReviewRecordSchema = z.strictObject({
  format: z.literal(VISUAL_REVIEW_RECORD_FORMAT),
  reviewedAt: z.string().min(1),
  reviewer: z.string().min(1),
  /** 人工总评；必须与 `review-verdict --verdict` 一致。 */
  overall: z.enum(["pass", "fail"]),
  subject: VisualReviewSubjectSchema,
  note: z.string().min(1).optional(),
});
export type VisualReviewRecord = z.infer<typeof VisualReviewRecordSchema>;
