import { NextResponse } from "next/server";
import { z } from "zod";
import { defaultDocuments } from "@/lib/sample-data";
import { answerQuestion } from "@/lib/rag";
import { logger } from "@/lib/logger";

export const runtime = "nodejs";

const documentSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  kind: z.enum(["resume", "job", "assignment", "notes"]),
  text: z.string().trim().min(1),
});

const requestSchema = z.object({
  message: z.string().trim().min(1).max(1200),
  documents: z.array(documentSchema).optional(),
});

export async function POST(request: Request) {
  const json = await request.json().catch(() => null);
  const parsed = requestSchema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Message is required (1–1200 chars) and documents must be well-formed." },
      { status: 400 },
    );
  }

  const { message, documents } = parsed.data;
  const corpus = documents?.length ? documents : defaultDocuments;

  try {
    const result = await answerQuestion(message, corpus);
    return NextResponse.json(result);
  } catch (error) {
    logger.error("chat request failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ error: "The assistant request failed. Please try again." }, { status: 500 });
  }
}
