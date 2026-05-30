import { describe, expect, it } from "vitest";
import { answerQuestion } from "@/lib/rag";
import { defaultDocuments } from "@/lib/sample-data";

describe("answerQuestion (deterministic)", () => {
  it("answers an aligned intent question with a grounded, cited result", async () => {
    const result = await answerQuestion("How does my experience align with this role?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.trace.grounded).toBe(true);
    expect(result.citations.length).toBeGreaterThan(0);
    expect(result.answer).toMatch(/fit/i);
  });

  it("answers a shortlist-likelihood question from the fit report instead of refusing", async () => {
    // "chances of getting shortlisted" shares almost no vocabulary with the
    // documents, so it must be routed by hiring intent and answered from the fit
    // report — not dropped to the refusal.
    const result = await answerQuestion("What are my chances of getting shortlisted for this role?", defaultDocuments);
    expect(result.mode).toBe("deterministic");
    expect(result.answer).toMatch(/shortlist/i);
    expect(result.answer).toMatch(/%/);
  });

  it("answers free-form candidate questions from the fit report instead of refusing", async () => {
    const refusalStart = "I could not find strong evidence";
    for (const question of [
      "What are his strongest skills?",
      "Does he have Kubernetes and AWS experience?",
      "Why should we hire him?",
      "Summarize the candidate for this role.",
    ]) {
      const result = await answerQuestion(question, defaultDocuments);
      expect(result.answer.startsWith(refusalStart), `should not refuse: ${question}`).toBe(false);
      expect(result.answer).toMatch(/%/);
    }
  });

  it("still refuses a clearly off-topic question even after broadening intents", async () => {
    const result = await answerQuestion("What is the boiling point of water?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.answer).not.toMatch(/%/);
  });

  it("does not present an off-topic question as grounded, even when a term matches incidentally", async () => {
    // "Milan" appears in the resume, so this clears the lexical relevance gate —
    // but the question is not about the corpus. It must not be reported as
    // grounded, and it must not fabricate a weather answer.
    const result = await answerQuestion("What is the weather in Milan tomorrow?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.answer).not.toMatch(/sunny|rain|forecast|degrees|°/i);
  });

  it("refuses cleanly when nothing in the corpus is relevant", async () => {
    const result = await answerQuestion("What is the capital of France?", defaultDocuments);
    expect(result.trace.grounded).toBe(false);
    expect(result.citations.length).toBe(0);
  });
});
