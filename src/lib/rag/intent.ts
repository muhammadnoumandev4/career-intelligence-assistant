import { tokenize } from "./chunk";
import type { FitReport } from "./types";

/**
 * Intent classification for the deterministic (keyless) pipeline.
 *
 * This is rule-based on purpose: with no model available we cannot *understand*
 * a question, so we classify the *kind* of career question by surface cues and
 * fall back to a general self-referential-and-career heuristic. The trade-off is
 * explicit — an unusual phrasing can mis-route or fall through to an honest
 * refusal rather than a fabricated answer (a deliberate safety bias). The LLM
 * path can also use this module to expand retrieval queries, but the answer is
 * still generated semantically from retrieved context rather than from these
 * templates. Keeping the rules isolated here (rather than inline in the engine)
 * makes the boundary between "general retrieval/grounding/fit" and
 * "rule-based intent routing" legible and unit-testable.
 */
export type AssistantIntent =
  | "gaps"
  | "shortlist"
  | "alignment"
  | "interviewQuestions"
  | "interviewPrep"
  | "production"
  | "architecture"
  | "productionShortlist"
  | "alignmentGaps"
  | "jobComparison"
  | "capability"
  | "candidate"
  | "unknown";

function includesAny(value: string, terms: string[]): boolean {
  return terms.some((term) => value.includes(term));
}

const GAP_CUES = [
  "missing",
  "gap",
  "lacking",
  "lack ",
  "not in my resume",
  "don't have",
  "dont have",
  "fall short",
  "weak",
  "weakness",
  "improve",
  "shortcoming",
  "need to learn",
  "work on",
];

const SHORTLIST_CUES = [
  "shortlist",
  "chance",
  "odds",
  "likelihood",
  "likely",
  "get the job",
  "get hired",
  "get selected",
  "get an interview",
  "get a callback",
  "qualif",
  "stand a chance",
  "competitive",
  "stack up",
  "called for an interview",
  "called for interview",
  "invited for an interview",
  "invited to interview",
];

const CAPABILITY_CUES = [
  "do i have",
  "do i know",
  "do i use",
  "have i worked",
  "my experience with",
  "experience with",
  "background in",
  "skilled in",
  "know microservices",
  "know ",
  "worked with",
  "examples from my resume",
  "prove",
  "evidence of",
  "show my",
];

const CANDIDATE_CUES = [
  "strength",
  "strong",
  "skill",
  "expert",
  "proficien",
  "experience",
  "background",
  "good at",
  "good fit",
  "best fit",
  "right fit",
  "suitable",
  "suited",
  "capable",
  "capability",
  "hire",
  "candidate",
  "his profile",
  "summarize",
  "summarise",
  "summary of",
  "overview of",
  "what can he do",
  "what does he bring",
  "stand out",
  "right for me",
  "right role",
  "profile",
];

// Cues that mark a question as being about the *candidate*, used to keep
// "do I have RAG experience?" out of the system-architecture intent even though
// it contains the word "rag".
const SELF_OR_CANDIDATE_CUES = [
  "do i have",
  "do i",
  "my ",
  "i have",
  "experience",
  "candidate",
  " his ",
  " her ",
];

// Words an off-topic question (homework, dinner, car trouble) will not contain,
// so pairing them with self-reference is a strong signal the question is a real
// career question without enumerating every phrasing.
const CAREER_TOPIC_CUES = [
  "role",
  "job",
  "position",
  "resume",
  "cv",
  "career",
  "apply",
  "application",
  "recruiter",
  "hiring",
  "running",
  "qualified",
  "good enough",
  "read on me",
  "think of me",
  "for this",
  "offer this team",
  "offer the team",
  "bring to the",
  "offer this role",
  "for the team",
];

export function detectIntent(message: string): AssistantIntent {
  const normalized = message.toLowerCase();

  const wantsGaps = includesAny(normalized, GAP_CUES);
  const wantsShortlist = includesAny(normalized, SHORTLIST_CUES);
  const wantsAlignment =
    normalized.includes("align") || normalized.includes("fit") || normalized.includes("match");
  const wantsProduction =
    normalized.includes("production") || normalized.includes("scale") || normalized.includes("deploy");
  const wantsJobComparison =
    includesAny(normalized, ["which job", "which role", "which jd", "which job description", "compare job", "compare role"]) ||
    (normalized.includes("better fit") && includesAny(normalized, ["job", "role", "jd", "description"])) ||
    (normalized.includes("best fit") && includesAny(normalized, ["job", "role", "jd", "description"]));
  const wantsSystemArchitecture =
    includesAny(normalized, [
      "architecture",
      "rag",
      "retrieval",
      "vector",
      "embedding",
      "chunk",
      "guardrail",
      "deterministic",
      "llm",
      "bm25",
      "pgvector",
    ]) && !includesAny(normalized, ["do i have", "do i know", "my experience with", "experience with"]);
  const wantsInterviewPrep = includesAny(normalized, [
    "interview",
    "present",
    "prepare",
    "presentation",
    "demo",
    "pitch",
    "highlight",
    "avoid",
    "say",
    "ask the interviewer",
    "ask interviewer",
    "panel",
    "answer if they ask",
  ]);

  // Compound intents first, so a question that spans two topics gets a blended
  // answer instead of being arbitrarily assigned to whichever check ran first.
  if (wantsJobComparison) return "jobComparison";
  if (wantsProduction && wantsShortlist) return "productionShortlist";
  if (wantsAlignment && wantsGaps) return "alignmentGaps";
  if (wantsGaps) return "gaps";
  if (wantsShortlist) return "shortlist";
  if (wantsAlignment) return "alignment";

  if (includesAny(normalized, CAPABILITY_CUES)) return "capability";

  if ((wantsInterviewPrep || normalized.includes("prepare")) && normalized.includes("question")) {
    return "interviewQuestions";
  }
  if (wantsSystemArchitecture) return "architecture";
  if (wantsInterviewPrep) {
    return "interviewPrep";
  }
  if (wantsProduction) return "production";

  // The architecture intent describes how *this system* is built. A question
  // like "do I have RAG/LLM experience?" mentions "rag" but is about the
  // candidate, so self-referential / experience phrasing is excluded and falls
  // through to the candidate intent below.
  const isAboutCandidate = includesAny(normalized, SELF_OR_CANDIDATE_CUES);
  if (!isAboutCandidate && wantsSystemArchitecture) {
    return "architecture";
  }

  if (includesAny(normalized, CANDIDATE_CUES)) return "candidate";

  // General career-topic catch-all. Rather than enumerate every possible way to
  // ask a fit question, treat anything that is clearly about the candidate and
  // the role as a candidate-overview question. Specific intents above still take
  // precedence; this only catches the long tail ("what's your read on me?").
  // It is intent detection only — groundedness still depends on retrieved
  // evidence, so off-topic questions that happen to contain "me"/"I" are not
  // forced into a false answer.
  const selfReferential =
    /\b(i|i'm|im|me|my|mine|myself)\b/.test(normalized) ||
    normalized.includes("this role") ||
    normalized.includes("this job") ||
    normalized.includes("this position") ||
    normalized.includes("the role") ||
    normalized.includes("for me");
  if (selfReferential && includesAny(normalized, CAREER_TOPIC_CUES)) {
    return "candidate";
  }

  return "unknown";
}

/**
 * For a capability question ("do I know X?"), strip the boilerplate framing and
 * keep the actual topic tokens so retrieval targets the skill, not the question
 * words.
 */
export function extractCapabilityTopic(message: string): string {
  const cleaned = message
    .toLowerCase()
    .replace(/what'?s/g, " ")
    .replace(/\b(do|does|did|i|he|she|they|you|we|my|his|her|their|me|him|candidate|profile)\b/g, " ")
    .replace(/\b(have|has|had|know|knows|use|uses|using|worked|work|with|about|experience|background|skilled|skill|skills)\b/g, " ")
    .replace(/\b(example|examples|evidence|prove|proves|show|shows|demonstrate|demonstrates|resume|cv)\b/g, " ")
    .replace(/\b(in|on|for|this|that|the|a|an|role|job|position|please|tell|show|explain)\b/g, " ");
  const tokens = tokenize(cleaned);
  return tokens.slice(0, 6).join(" ");
}

/**
 * Expand the user's question into a retrieval query enriched with intent-
 * specific terms and the current fit signals, so lexical retrieval surfaces the
 * evidence the answer will cite. The raw message is always included.
 */
export function buildRetrievalQuery(message: string, intent: AssistantIntent, fit: FitReport): string {
  const strengths = fit.matched.map((signal) => signal.label).join(" ");
  const gaps = fit.gaps.map((signal) => signal.label).join(" ");

  switch (intent) {
    case "interviewQuestions":
    case "interviewPrep":
      return [
        message,
        "interview preparation strengths gaps role requirements candidate experience project architecture RAG production AI tools",
        strengths,
        gaps,
      ].join(" ");
    case "gaps":
      return [message, "missing skills gaps role requirements", gaps].join(" ");
    case "shortlist":
      return [message, "shortlist fit strengths gaps role requirements candidate experience", strengths, gaps].join(" ");
    case "productionShortlist":
      return [
        message,
        "production deploy scale cloud docker kubernetes ci cd observability shortlist fit strengths gaps",
        strengths,
        gaps,
      ].join(" ");
    case "alignmentGaps":
      return [message, "fit alignment missing skills gaps role requirements", strengths, gaps].join(" ");
    case "jobComparison":
      return [message, "compare job descriptions best fit role score strengths gaps", strengths, gaps].join(" ");
    case "alignment":
    case "candidate":
      return [message, "fit alignment strengths candidate experience role requirements", strengths].join(" ");
    case "capability":
      return [message, extractCapabilityTopic(message), "resume evidence role requirement experience skill", strengths, gaps].join(" ");
    case "production":
      return [message, "production deploy scale cloud docker kubernetes ci cd observability", strengths, gaps].join(" ");
    case "architecture":
      return [message, "architecture rag retrieval chunking embeddings vector database guardrails evals", strengths, gaps].join(" ");
    case "unknown":
      return message;
  }
}
