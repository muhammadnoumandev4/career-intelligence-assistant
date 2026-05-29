import { describe, expect, it } from "vitest";
import { analyzeFit, hasSufficientContext, isGrounded, REQUIREMENTS } from "@/lib/rag";
import type { DocumentInput, RetrievedChunk } from "@/lib/rag";

describe("analyzeFit", () => {
  it("matches requirements present in the resume and reports the rest as gaps", () => {
    const docs: DocumentInput[] = [
      {
        id: "r",
        title: "Resume",
        kind: "resume",
        text: "React Next.js TypeScript full-stack engineer. Node.js NestJS microservices. AWS Docker Kubernetes.",
      },
    ];
    const fit = analyzeFit(docs);
    expect(fit.matched.length + fit.gaps.length).toBe(REQUIREMENTS.length);
    expect(fit.matched.some((m) => m.label.includes("Next.js"))).toBe(true);
    expect(fit.gaps.some((g) => g.label.includes("Healthcare"))).toBe(true);
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.score).toBeLessThanOrEqual(100);
  });

  it("scores zero when there is no resume", () => {
    expect(analyzeFit([]).score).toBe(0);
  });
});

function chunk(score: number, title = "Resume"): RetrievedChunk {
  return { id: "x", documentId: "d", title, kind: "resume", text: "t", index: 0, score };
}

describe("guardrails", () => {
  it("requires at least one chunk above the relevance threshold", () => {
    expect(hasSufficientContext([chunk(0.1)])).toBe(false);
    expect(hasSufficientContext([chunk(2)])).toBe(true);
    expect(hasSufficientContext([])).toBe(false);
  });

  it("treats an answer as grounded only when it references a cited source", () => {
    const cites = [chunk(2, "Newpage JD")];
    expect(isGrounded("According to the Newpage JD you need Kubernetes.", cites)).toBe(true);
    expect(isGrounded("You should learn Kubernetes.", cites)).toBe(false);
    expect(isGrounded("anything", [])).toBe(false);
  });
});
