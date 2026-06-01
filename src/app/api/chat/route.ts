import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultDocuments } from "@/lib/sample-data";
import { answerQuestion } from "@/lib/rag";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

// Input bounds. Retrieval cost scales with corpus size (chunking, TF-IDF, and —
// in LLM mode — one embedding call per chunk), so we cap document count, each
// document's length, and the total corpus size. This protects latency and
// provider cost from oversized pastes without changing behaviour for real
// resume/JD inputs, which sit far under these limits.
const MAX_DOCUMENTS = 12;
const MAX_DOCUMENT_CHARS = 50_000;
const MAX_CORPUS_CHARS = 200_000;

const documentSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  kind: z.enum(["resume", "job", "assignment", "notes"]),
  text: z.string().trim().min(1).max(MAX_DOCUMENT_CHARS),
});

const requestSchema = z
  .object({
    message: z.string().trim().min(1).max(1200),
    documents: z.array(documentSchema).max(MAX_DOCUMENTS).optional(),
    activeJobId: z.string().trim().min(1).optional(),
  })
  .superRefine((value, ctx) => {
    const totalChars = (value.documents ?? []).reduce((sum, doc) => sum + doc.text.length, 0);
    if (totalChars > MAX_CORPUS_CHARS) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documents"],
        message: `Total document size exceeds ${MAX_CORPUS_CHARS} characters.`,
      });
    }
  });

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          `Message is required (1–1200 chars). Documents must be well-formed, at most ${MAX_DOCUMENTS}, ` +
          `each under ${MAX_DOCUMENT_CHARS} chars, and ${MAX_CORPUS_CHARS} chars total.`,
      },
      { status: 400 },
    );
  }

  const { message, documents, activeJobId } = parsed.data;
  const corpus = documents?.length ? documents : defaultDocuments;

  try {
    const result = await answerQuestion(message, corpus, undefined, activeJobId);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("chat request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "The assistant request failed. Please try again." }, { status: 500 });
  }
}
