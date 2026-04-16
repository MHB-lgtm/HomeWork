import { z } from 'zod';

export const LegacyExamRecordSchema = z.object({
  examId: z.string().min(1),
  title: z.string().min(1),
  createdAt: z.string(),
  updatedAt: z.string(),
  examFilePath: z.string().min(1),
});

export type LegacyExamRecord = z.infer<typeof LegacyExamRecordSchema>;
