import { z } from 'zod';

/**
 * Schema for a single question entry in ExamIndex
 */
export const QuestionEntrySchema = z.object({
  id: z.string().regex(/^q[1-9]\d*$/, 'id must match pattern q1, q2, q3, ...'), // internal stable id: "q1", "q2", ...
  order: z.number().int().positive(), // 1..N
  displayLabel: z.string().min(1).trim(), // what the lecturer sees ("Question 1", "Problem 2", etc.)
  aliases: z.array(z.string().min(1).trim()).default([]), // may be empty but recommended; dedupe + trim
  promptText: z.string().min(1).trim().max(800), // question statement/instructions (required, concise, <= 800 chars)
});

/**
 * Schema for ExamIndex (v1)
 */
export const ExamIndexSchema = z.object({
  version: z.literal('1.0.0'),
  examId: z.string().min(1),
  generatedAt: z.string(), // ISO string
  updatedAt: z.string(), // ISO string
  status: z.enum(['proposed', 'confirmed']),
  questions: z.array(QuestionEntrySchema).min(1), // min 1
}).refine(
  (data) => {
    // Ensure question ids are unique
    const ids = data.questions.map((q) => q.id);
    if (new Set(ids).size !== ids.length) {
      return false;
    }
    // Ensure order values are unique
    const orders = data.questions.map((q) => q.order);
    if (new Set(orders).size !== orders.length) {
      return false;
    }
    // Ensure order starts at 1 and is contiguous (1..N)
    const sortedOrders = [...orders].sort((a, b) => a - b);
    for (let i = 0; i < sortedOrders.length; i++) {
      if (sortedOrders[i] !== i + 1) {
        return false;
      }
    }
    return true;
  },
  {
    message: 'questions must have unique ids, unique order values, and order must be contiguous starting from 1',
  }
);

/**
 * TypeScript type inferred from ExamIndexSchema
 */
export type ExamIndex = z.infer<typeof ExamIndexSchema>;

/**
 * TypeScript type inferred from QuestionEntrySchema
 */
export type QuestionEntry = z.infer<typeof QuestionEntrySchema>;
