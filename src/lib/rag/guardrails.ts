import type { RetrievedChunk } from "./types";

/** Minimum retrieval score below which we treat the corpus as not containing
 *  a confident answer and refuse rather than hallucinate. Tuned for the TF-IDF
 *  scale used by lexical retrieval. */
export const MIN_RELEVANCE_SCORE = 0.5;

export const REFUSAL_MESSAGE =
  "I could not find strong evidence for that in the current resume and job descriptions. Try asking about fit, missing skills, shortlist chances, experience alignment, interview preparation, the RAG architecture, or productionization — or add a document that covers it.";

/**
 * Decide whether retrieved context is strong enough to answer. This is the
 * pre-generation guardrail: it stops the pipeline from fabricating an answer
 * when nothing relevant was retrieved.
 */
export function hasSufficientContext(citations: RetrievedChunk[]): boolean {
  return citations.some((chunk) => chunk.score >= MIN_RELEVANCE_SCORE);
}

/**
 * Post-generation grounding check. A grounded answer should reference at least
 * one cited source by its [title] tag. Returns false when the model produced
 * prose with no citation, which we surface in the trace as `grounded: false`.
 */
export function isGrounded(answer: string, citations: RetrievedChunk[]): boolean {
  if (citations.length === 0) return false;
  const titles = new Set(citations.map((chunk) => chunk.title.toLowerCase()));
  const lower = answer.toLowerCase();
  for (const title of titles) {
    if (lower.includes(title) || lower.includes(`[${title}]`)) return true;
  }
  return false;
}
