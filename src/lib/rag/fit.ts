import type { DocumentInput, FitReport, FitSignal } from "./types";

/**
 * Skill taxonomy used to score resume-to-role fit.
 *
 * Each entry is one capability area. It carries two term sets:
 *  - `jdTerms`    — if any appear in the *selected job description*, the role
 *                   requires this skill, so it counts toward the denominator.
 *  - `resumeTerms`— if any appear in the *resume*, the candidate covers it.
 *
 * Fit is therefore JD-driven, not hard-coded to one role: change the job and a
 * different subset of the taxonomy becomes "required", so the same resume can
 * score 67% against one posting and 80% against another. The taxonomy is a
 * transparent, auditable rubric — deliberately not a black box — so the score
 * can be explained line by line during the interview.
 *
 * In llm mode this same taxonomy is handed to the model as the rubric; in
 * deterministic mode it is evaluated by term presence.
 */
export type SkillRequirement = {
  label: string;
  jdTerms: string[];
  resumeTerms: string[];
  /** Rationale shown when the resume covers a skill the job requires. */
  evidence: string;
  /** Rationale shown when the job requires a skill the resume does not show. */
  gap: string;
};

export const REQUIREMENTS: SkillRequirement[] = [
  {
    label: "Next.js / React / TypeScript full-stack delivery",
    jdTerms: ["next.js", "react", "typescript", "full-stack", "frontend"],
    resumeTerms: ["next.js", "react", "typescript", "full-stack"],
    evidence: "Strong production overlap with the requested frontend and TypeScript stack.",
    gap: "Role leans on a modern React/TypeScript frontend that the resume does not emphasise.",
  },
  {
    label: "Node/NestJS APIs and microservices",
    jdTerms: ["node", "nestjs", "microservices", "graphql", "rest api", "fastify", "hono", "backend api"],
    resumeTerms: ["node.js", "nestjs", "microservices", "graphql", "rest"],
    evidence: "Direct backend experience in modular APIs and microservice systems.",
    gap: "Role expects backend API / microservice depth not evident in the resume.",
  },
  {
    label: "RAG and LLM integration",
    jdTerms: [
      "retrieval-augmented generation",
      "rag",
      "llm",
      "large language model",
      "openai",
      "anthropic",
      "gpt",
      "gemini",
      "embeddings",
    ],
    resumeTerms: ["retrieval-augmented generation", "rag", "openai", "anthropic", "llm"],
    evidence: "Resume shows client RAG pipelines with OpenAI GPT and Anthropic Claude.",
    gap: "Role asks for RAG/LLM integration not represented in the resume.",
  },
  {
    label: "Cloud, Docker, Kubernetes, CI/CD",
    jdTerms: [
      "aws",
      "azure",
      "gcp",
      "vercel",
      "docker",
      "kubernetes",
      "ci/cd",
      "github actions",
      "jenkins",
      "cloudflare",
      "serverless",
    ],
    resumeTerms: ["aws", "vercel", "docker", "kubernetes", "github actions", "jenkins"],
    evidence: "Deployment and CI/CD experience maps to the production ownership requirement.",
    gap: "Role expects cloud-native deployment and CI/CD ownership the resume does not show.",
  },
  {
    label: "Data layer and performance tuning",
    jdTerms: [
      "postgresql",
      "postgres",
      "mysql",
      "redis",
      "prisma",
      "query optimization",
      "sql",
      "relational database",
      "pgvector",
    ],
    resumeTerms: ["postgresql", "redis", "prisma", "query optimization", "explain analyze"],
    evidence: "Measured 30% database latency reduction and multi-tenant PostgreSQL architecture.",
    gap: "Role expects relational data modelling and query tuning not evident in the resume.",
  },
  {
    label: "Agent frameworks and MCP",
    jdTerms: [
      "langgraph",
      "autogen",
      "claude agent sdk",
      "openai assistants",
      "mcp",
      "fastmcp",
      "agentic",
      "orchestration",
    ],
    resumeTerms: ["langgraph", "autogen", "claude agent sdk", "openai assistants", "mcp", "fastmcp"],
    evidence: "Resume shows hands-on agentic frameworks and MCP-style tool integration.",
    gap: "Role asks for hands-on agentic frameworks and MCP-style tool integration not in the resume.",
  },
  {
    label: "Python / FastAPI production services",
    jdTerms: ["python", "fastapi"],
    resumeTerms: ["python", "fastapi"],
    evidence: "Python appears in AI backend work that maps to the role.",
    gap: "Role expects Python/FastAPI services; resume shows little Python production depth.",
  },
  {
    label: "Evals and observability",
    jdTerms: ["eval", "evaluation", "structured logging", "metrics", "tracing", "observability", "monitoring"],
    resumeTerms: ["eval", "evaluation", "structured logging", "metrics", "tracing", "observability"],
    evidence: "Resume shows eval harnesses, metrics, tracing, and operational visibility.",
    gap: "Role stresses eval harnesses, metrics, tracing, and observability not shown in the resume.",
  },
  {
    label: "Healthcare / life sciences context",
    jdTerms: ["healthcare", "clinical", "life sciences", "digital health", "ehr", "hipaa"],
    resumeTerms: ["healthcare", "clinical", "life sciences", "digital health"],
    evidence: "Resume shows healthcare / life sciences domain exposure.",
    gap: "Role operates in a healthcare / life sciences domain the resume does not cover.",
  },
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Whole-term match: the term must sit on a token boundary, not inside a longer
 * word. Plain substring matching produced false positives — e.g. the term
 * "eval" matched inside "retrieval" — which inflated the score. The lookarounds
 * still allow the term's own punctuation/spaces (e.g. "next.js", "explain analyze").
 */
function mentions(text: string, term: string): boolean {
  return new RegExp(`(?<![a-z0-9])${escapeRegExp(term)}(?![a-z0-9])`, "i").test(text);
}

/**
 * Score the resume against a single job description.
 *
 * @param documents the full corpus (resume + one or more job descriptions)
 * @param jobId      which job to score against; defaults to the first job doc
 *
 * Only skills the selected job actually asks for are counted, so the score is
 * relative to that role. If the corpus has no job document, the whole taxonomy
 * is treated as required (the legacy behaviour).
 */
export function analyzeFit(documents: DocumentInput[], jobId?: string): FitReport {
  const resumeText = documents
    .filter((document) => document.kind === "resume")
    .map((document) => document.text.toLowerCase())
    .join("\n");

  const jobs = documents.filter((document) => document.kind === "job");
  const job = (jobId ? jobs.find((document) => document.id === jobId) : undefined) ?? jobs[0];
  const jobText = job?.text.toLowerCase() ?? "";

  const matched: FitSignal[] = [];
  const gaps: FitSignal[] = [];

  for (const requirement of REQUIREMENTS) {
    // A skill is required when the job asks for it. With no job text we fall
    // back to treating every skill as required.
    const required = job ? requirement.jdTerms.some((term) => mentions(jobText, term)) : true;
    if (!required) {
      continue;
    }

    const present = requirement.resumeTerms.some((term) => mentions(resumeText, term));
    if (present) {
      matched.push({ label: requirement.label, present: true, evidence: requirement.evidence });
    } else {
      gaps.push({ label: requirement.label, present: false, evidence: requirement.gap });
    }
  }

  const required = matched.length + gaps.length;
  const score = required === 0 ? 0 : Math.round((matched.length / required) * 100);

  return {
    score,
    matched,
    gaps,
    jobId: job?.id,
    jobTitle: job?.title,
    cautions: [
      "The score is a transparent rubric heuristic, not a hiring decision.",
      "Skills the role requires but the resume does not show should be addressed directly in the presentation rather than hidden.",
    ],
  };
}
