import type { DocumentInput, FitReport, FitSignal } from "./types";

/**
 * Requirement taxonomy for the role. Each requirement maps the JD's expectations
 * to concrete resume signals (terms) plus a human-readable rationale. This is a
 * transparent, auditable scoring rubric — deliberately not a black box — so the
 * fit score can be explained line by line during the interview.
 *
 * In llm mode this same taxonomy is handed to the model as the rubric; in
 * deterministic mode it is evaluated by term presence.
 */
export const REQUIREMENTS: { label: string; terms: string[]; evidence: string }[] = [
  {
    label: "Next.js / React / TypeScript full-stack delivery",
    terms: ["next.js", "react", "typescript", "full-stack"],
    evidence: "Strong production overlap with the requested frontend and TypeScript stack.",
  },
  {
    label: "Node/NestJS APIs and microservices",
    terms: ["node.js", "nestjs", "microservices", "graphql", "rest"],
    evidence: "Direct backend experience in modular APIs and microservice systems.",
  },
  {
    label: "RAG and LLM integration",
    terms: ["retrieval-augmented generation", "rag", "openai", "anthropic", "llm"],
    evidence: "Resume shows client RAG pipelines with OpenAI GPT and Anthropic Claude.",
  },
  {
    label: "Cloud, Docker, Kubernetes, CI/CD",
    terms: ["aws", "vercel", "docker", "kubernetes", "github actions", "jenkins"],
    evidence: "Deployment and CI/CD experience maps to the production ownership requirement.",
  },
  {
    label: "Data layer and performance tuning",
    terms: ["postgresql", "redis", "prisma", "query optimization", "explain analyze"],
    evidence: "Measured 30% database latency reduction and multi-tenant PostgreSQL architecture.",
  },
  {
    label: "Agent frameworks and MCP",
    terms: ["langgraph", "autogen", "claude agent sdk", "openai assistants", "mcp", "fastmcp"],
    evidence: "JD asks for hands-on agentic frameworks and MCP-style tool integration.",
  },
  {
    label: "Python / FastAPI production services",
    terms: ["python", "fastapi"],
    evidence: "Python appears in AI backend work, but FastAPI production depth is not prominent.",
  },
  {
    label: "Evals and observability",
    terms: ["eval", "evaluation", "structured logging", "metrics", "tracing", "observability"],
    evidence: "JD stresses eval harnesses, metrics, tracing, and operational visibility.",
  },
  {
    label: "Healthcare / life sciences context",
    terms: ["healthcare", "clinical", "life sciences", "digital health"],
    evidence: "Newpage operates in digital health; CV does not show deep healthcare domain exposure.",
  },
];

export function analyzeFit(documents: DocumentInput[]): FitReport {
  const resumeText = documents
    .filter((document) => document.kind === "resume")
    .map((document) => document.text.toLowerCase())
    .join("\n");

  const matched: FitSignal[] = [];
  const gaps: FitSignal[] = [];

  for (const requirement of REQUIREMENTS) {
    const present = requirement.terms.some((term) => resumeText.includes(term));
    const signal: FitSignal = { label: requirement.label, present, evidence: requirement.evidence };
    (present ? matched : gaps).push(signal);
  }

  const score = REQUIREMENTS.length === 0 ? 0 : Math.round((matched.length / REQUIREMENTS.length) * 100);

  return {
    score,
    matched,
    gaps,
    cautions: [
      "The score is a transparent rubric heuristic, not a hiring decision.",
      "Agent frameworks, MCP, eval harnesses, and healthcare context should be addressed directly in the presentation if not deeply represented in the resume.",
    ],
  };
}
