import { describe, expect, it } from "vitest";
import { analyzeFit, hasSufficientContext, isGrounded, REQUIREMENTS } from "@/lib/rag";
import type { DocumentInput, RetrievedChunk } from "@/lib/rag";

const resume: DocumentInput = {
  id: "r",
  title: "Resume",
  kind: "resume",
  text: "React Next.js TypeScript full-stack engineer. Node.js NestJS microservices. AWS Docker Kubernetes. PostgreSQL Redis Prisma query optimization.",
};

describe("analyzeFit", () => {
  it("treats the whole taxonomy as required when no job is present", () => {
    const fit = analyzeFit([resume]);
    expect(fit.matched.length + fit.gaps.length).toBe(REQUIREMENTS.length);
    expect(fit.matched.some((m) => m.label.includes("Next.js"))).toBe(true);
    expect(fit.gaps.some((g) => g.label.includes("Healthcare"))).toBe(true);
    expect(fit.score).toBeGreaterThan(0);
    expect(fit.score).toBeLessThanOrEqual(100);
    expect(fit.jobId).toBeUndefined();
  });

  it("only counts skills the selected job asks for, and scores per-job", () => {
    const fintech: DocumentInput = {
      id: "jd-fin",
      title: "Fintech Full-Stack",
      kind: "job",
      text: "Senior Full-Stack Engineer. Next.js React TypeScript frontend, Node.js microservices, REST and GraphQL. PostgreSQL and Redis. Docker on AWS with CI/CD via GitHub Actions.",
    };
    const aiRole: DocumentInput = {
      id: "jd-ai",
      title: "AI-Native Builder",
      kind: "job",
      text: "Build agentic apps with LangGraph and MCP. RAG with embeddings, OpenAI and Anthropic. Python and FastAPI. Eval harnesses, tracing, observability. Healthcare and life sciences domain.",
    };
    const docs = [resume, fintech, aiRole];

    const fitFintech = analyzeFit(docs, "jd-fin");
    expect(fitFintech.jobId).toBe("jd-fin");
    expect(fitFintech.jobTitle).toBe("Fintech Full-Stack");
    // The fintech JD never mentions RAG/agents/healthcare, so they are not counted.
    expect([...fitFintech.matched, ...fitFintech.gaps].some((s) => s.label.includes("Healthcare"))).toBe(false);
    expect(fitFintech.matched.some((m) => m.label.includes("Next.js"))).toBe(true);

    const fitAi = analyzeFit(docs, "jd-ai");
    expect(fitAi.jobId).toBe("jd-ai");
    // This resume lacks agent frameworks, evals, and healthcare → those are gaps.
    expect(fitAi.gaps.some((g) => g.label.includes("Agent frameworks"))).toBe(true);
    expect(fitAi.gaps.some((g) => g.label.includes("Healthcare"))).toBe(true);

    // The resume fits a conventional full-stack role better than the AI-heavy one.
    expect(fitFintech.score).toBeGreaterThan(fitAi.score);
  });

  it("defaults to the first job when no jobId is given", () => {
    const jobA: DocumentInput = { id: "a", title: "A", kind: "job", text: "Next.js React TypeScript." };
    const jobB: DocumentInput = { id: "b", title: "B", kind: "job", text: "Python FastAPI." };
    expect(analyzeFit([resume, jobA, jobB]).jobId).toBe("a");
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
