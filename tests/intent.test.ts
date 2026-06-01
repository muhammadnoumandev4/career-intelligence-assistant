import { describe, expect, it } from "vitest";
import { detectIntent } from "@/lib/rag/intent";

describe("detectIntent (rule-based, keyless mode)", () => {
  it("classifies the core career intents", () => {
    expect(detectIntent("How does my experience align with this role?")).toBe("alignment");
    expect(detectIntent("What skills am I missing for this role?")).toBe("gaps");
    expect(detectIntent("What are my chances of getting shortlisted?")).toBe("shortlist");
    expect(detectIntent("What interview questions should I prepare for?")).toBe("interviewQuestions");
    expect(detectIntent("What is the productionization plan?")).toBe("production");
  });

  it("keeps 'do I have RAG experience?' on the candidate side, not architecture", () => {
    // contains "rag" but is about the candidate — must not become an
    // architecture (how-the-system-works) answer.
    expect(detectIntent("Do I have RAG and LLM experience?")).toBe("capability");
    // genuinely about the system:
    expect(detectIntent("Explain the RAG architecture and trade-offs.")).toBe("architecture");
  });

  it("routes technical-defense questions to architecture, but interview-framing to prep", () => {
    // "defend not using LangGraph" is about the system's design choices.
    expect(detectIntent("How do I defend not using LangGraph?")).toBe("architecture");
    expect(detectIntent("Why did I not use a vector database in the default version?")).toBe("architecture");
    // But "how should I answer if they ask about X" is interview prep, not a
    // system description — even though it names a technical term.
    expect(detectIntent("How should I answer if they ask about LangGraph?")).toBe("interviewPrep");
  });

  it("routes compound questions to a blended intent", () => {
    expect(detectIntent("Does my experience match, or am I missing key skills?")).toBe("alignmentGaps");
    expect(detectIntent("How do I deploy this and what are my chances?")).toBe("productionShortlist");
  });

  it("catches long-tail career phrasings via the general fallback", () => {
    for (const q of [
      "What's your read on me for this role?",
      "Realistically am I in the running?",
      "What would a recruiter think of me?",
    ]) {
      expect(detectIntent(q), q).not.toBe("unknown");
    }
  });

  it("returns 'unknown' for off-topic questions, even with 'I'/'me'", () => {
    // No career topic → unknown → the engine's grounding gate refuses.
    for (const q of ["Can you tell me a joke?", "What should I cook for dinner?", "Help me with my homework"]) {
      expect(detectIntent(q), q).toBe("unknown");
    }
  });
});
