import type { DocumentKind } from "../src/lib/rag";

/**
 * Golden evaluation set for the assistant.
 *
 * Each case asserts a checkable property of the pipeline rather than an exact
 * answer string (which would be brittle across deterministic/LLM modes):
 *  - expectKind:   at least one cited chunk should come from this document kind
 *  - expectRefuse: the assistant should decline (no confident grounding)
 *  - mustInclude:  case-insensitive substrings the answer should contain
 *
 * Runs against the default seed corpus (resume + job descriptions) with no keys.
 */
export type GoldenCase = {
  id: string;
  question: string;
  expectKind?: DocumentKind;
  expectRefuse?: boolean;
  mustInclude?: string[];
};

export const goldenSet: GoldenCase[] = [
  {
    id: "gaps",
    question: "What skills am I missing for this role?",
    expectKind: "job",
    mustInclude: ["gap"],
  },
  {
    id: "alignment",
    question: "How does my experience align with this role?",
    expectKind: "job",
    mustInclude: ["fit", "%"],
  },
  {
    id: "interview",
    question: "How should I prepare for the interview based on my experience?",
    expectKind: "resume",
    mustInclude: ["STAR"],
  },
  {
    id: "production",
    question: "What is the productionization plan to deploy on AWS and scale?",
    mustInclude: ["Postgres", "Docker"],
  },
  {
    id: "architecture",
    question: "Explain the RAG architecture and retrieval trade-offs.",
    mustInclude: ["chunk", "retriev"],
  },
  {
    id: "rag-experience",
    question: "Do I have RAG and LLM experience?",
    expectKind: "resume",
  },
  {
    id: "kubernetes",
    question: "Is there Kubernetes and cloud deployment experience?",
    expectKind: "resume",
  },
  {
    id: "adversarial-offtopic",
    question: "What is the capital of France and the boiling point of water?",
    expectRefuse: true,
  },
];
