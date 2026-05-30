import { getConfig, type AppConfig } from "../config";
import { logger } from "../logger";
import { chunkDocuments } from "./chunk";
import { analyzeFit } from "./fit";
import { hasSufficientContext, isGrounded, REFUSAL_MESSAGE } from "./guardrails";
import { embedTexts, generateGroundedAnswer, hasEmbeddings } from "./providers";
import { lexicalRetrieve, reciprocalRankFusion, vectorRetrieve } from "./retrieval";
import type { ChatResult, DocumentInput, FitReport, RetrievedChunk } from "./types";

const RETRIEVAL_LIMIT = 5;

/**
 * Single entry point for the assistant. Selects the deterministic or LLM
 * pipeline based on configuration, applies guardrails, and returns the answer
 * plus a trace for observability. Designed so the LLM path degrades to the
 * deterministic path on any provider error — the demo never hard-fails.
 */
export async function answerQuestion(
  message: string,
  documents: DocumentInput[],
  config: AppConfig = getConfig(),
  activeJobId?: string,
): Promise<ChatResult> {
  const fit = analyzeFit(documents, activeJobId);

  if (config.mode === "llm") {
    try {
      return await answerWithLlm(message, documents, fit, config);
    } catch (error) {
      logger.error("llm pipeline failed, falling back to deterministic", {
        error: error instanceof Error ? error.message : String(error),
      });
      return answerDeterministic(message, documents, fit);
    }
  }

  return answerDeterministic(message, documents, fit);
}

// ---------------------------------------------------------------------------
// Deterministic pipeline (default, zero-secret)
// ---------------------------------------------------------------------------

function answerDeterministic(message: string, documents: DocumentInput[], fit: FitReport): ChatResult {
  const startRetrieval = performance.now();
  const chunks = chunkDocuments(documents);
  const citations = lexicalRetrieve(message, chunks, RETRIEVAL_LIMIT);
  const retrievalMs = performance.now() - startRetrieval;

  const startAnswer = performance.now();
  const { answer, answersDirectly } = composeDeterministicAnswer(message, citations, fit);
  const answerMs = performance.now() - startAnswer;

  // Grounded only when we gave a direct, intent-matched answer that is backed by
  // retrieved evidence. The transparent "closest evidence" fallback and refusals
  // are never grounded — so an off-topic question that only incidentally matched
  // a term is never presented as a confident answer.
  const grounded = answersDirectly && citations.length > 0;
  logger.info("answer", {
    mode: "deterministic",
    question: message.slice(0, 120),
    chunksCited: citations.length,
    grounded,
    retrievalMs: Math.round(retrievalMs),
  });

  return {
    answer,
    citations,
    fit,
    mode: "deterministic",
    trace: {
      mode: "deterministic",
      retrievalMs: Math.round(retrievalMs),
      answerMs: Math.round(answerMs),
      chunksConsidered: chunks.length,
      chunksCited: citations.length,
      grounded,
    },
  };
}

type DeterministicAnswer = { answer: string; answersDirectly: boolean };

function composeDeterministicAnswer(
  message: string,
  citations: RetrievedChunk[],
  fit: FitReport,
): DeterministicAnswer {
  const normalized = message.toLowerCase();

  const role = fit.jobTitle ? `the ${fit.jobTitle} role` : "this role";

  if (normalized.includes("missing") || normalized.includes("gap")) {
    const gapLabels = fit.gaps.length
      ? fit.gaps.slice(0, 4).map((gap) => gap.label).join(", ")
      : "none — the resume covers every skill this role asks for";
    return {
      answersDirectly: true,
      answer: [
        `Against ${role}, the main gaps to address are: ${gapLabels}.`,
        "The strongest mitigation is to present this prototype as evidence of disciplined RAG delivery, then explicitly explain how the gaps above would be closed in production — for example with agent orchestration, MCP tool connectors, eval datasets, tracing, and domain-specific validation.",
      ].join("\n\n"),
    };
  }
  if (normalized.includes("align") || normalized.includes("fit") || normalized.includes("match")) {
    const strengths = fit.matched.slice(0, 5).map((signal) => signal.label).join(", ");
    return {
      answersDirectly: true,
      answer: [
        `Overall fit for ${role} is ${fit.score}%. The strongest alignment is: ${strengths || "limited overlap with the role's stated requirements"}.`,
        "Position the story around forward-deployed ownership: ambiguous requirement intake, fast prototype, measurable engineering decisions, and production-minded trade-offs.",
      ].join("\n\n"),
    };
  }
  if (normalized.includes("interview") || normalized.includes("present")) {
    return {
      answersDirectly: true,
      answer: [
        "Use the 10 minutes like this: 90 seconds for problem framing, 2 minutes for architecture and retrieval choices, 3 minutes for the live demo, 2 minutes for quality/guardrails/observability, and 90 seconds for productionization and what you would improve next.",
        "Emphasize that the app runs deterministically without secrets for the assignment, while the LLM path adds embeddings plus grounded generation behind a single environment variable.",
      ].join("\n\n"),
    };
  }
  if (normalized.includes("production") || normalized.includes("scale") || normalized.includes("deploy")) {
    return {
      answersDirectly: true,
      answer: [
        "Production path: move ingestion to background jobs, store parsed documents in object storage, persist chunks and metadata in Postgres with pgvector, add hybrid BM25/vector retrieval, stream LLM responses, and deploy with Docker on AWS ECS/Fargate, Cloud Run, Azure Container Apps, or Vercel plus managed Postgres.",
        "Operational controls should include secrets management, auth, tenant isolation, request tracing, structured logs, retrieval quality evals, prompt/version tracking, rate limits, and human-readable citations.",
      ].join("\n\n"),
    };
  }
  if (normalized.includes("architecture") || normalized.includes("rag") || normalized.includes("retrieval")) {
    return {
      answersDirectly: true,
      answer: [
        "The pipeline has clean seams: parser -> chunker -> retriever -> answer composer -> guardrails -> trace. The default mode uses paragraph-aware chunking, TF-IDF lexical retrieval, and grounded templated answers so the demo runs with zero secrets.",
        "With provider keys set, the same seams switch to OpenAI embeddings, hybrid vector + lexical retrieval fused with reciprocal rank fusion, and Claude for grounded generation — without changing the UI or API contract.",
      ].join("\n\n"),
    };
  }

  // No templated intent matched. Deterministic mode does not synthesize a
  // free-form answer (that is the LLM path's job), so we transparently surface
  // the closest evidence and steer toward the supported questions — marked
  // ungrounded. This is deliberate: a single high-IDF term can clear the
  // relevance gate (e.g. a city name in the resume contact line matching an
  // off-topic "weather in <city>" question), and lexical scores alone cannot
  // tell an incidental match from a real one. Refusing to *claim* groundedness
  // here is the honest behavior — the semantic separation only exists on the
  // embeddings path.
  if (hasSufficientContext(citations)) {
    const evidence = citations
      .slice(0, 3)
      .map((chunk, index) => `${index + 1}. [${chunk.title}] ${chunk.text.replace(/\s+/g, " ").slice(0, 240)}...`)
      .join("\n");
    return {
      answersDirectly: false,
      answer:
        `I don't have a direct, structured answer to that, so here is the closest evidence I found in the documents:\n\n${evidence}\n\n` +
        "For a grounded answer, ask about fit, missing skills, experience alignment, interview preparation, the RAG architecture, or productionization.",
    };
  }

  return { answer: REFUSAL_MESSAGE, answersDirectly: false };
}

// ---------------------------------------------------------------------------
// LLM pipeline (activated when an Anthropic key is present)
// ---------------------------------------------------------------------------

async function answerWithLlm(
  message: string,
  documents: DocumentInput[],
  fit: FitReport,
  config: AppConfig,
): Promise<ChatResult> {
  const startRetrieval = performance.now();
  const chunks = chunkDocuments(documents);

  // Always compute the lexical ranking. It drives the relevance gate below —
  // MIN_RELEVANCE_SCORE is tuned for the TF-IDF score scale — even when we fuse
  // it with dense results to produce the final citation order.
  const lexical = lexicalRetrieve(message, chunks, RETRIEVAL_LIMIT);

  let citations: RetrievedChunk[];
  if (hasEmbeddings(config)) {
    const [queryEmbedding] = await embedTexts([message], config);
    const chunkEmbeddings = await embedTexts(chunks.map((c) => c.text), config);
    const dense = vectorRetrieve(queryEmbedding, chunks, chunkEmbeddings, RETRIEVAL_LIMIT);
    citations = reciprocalRankFusion([dense, lexical], RETRIEVAL_LIMIT);
  } else {
    citations = lexical;
  }
  const retrievalMs = performance.now() - startRetrieval;

  // Gate on the lexical signal, not the fused score: RRF scores live on a
  // rank-based scale (~1/k) unrelated to the TF-IDF relevance threshold, so
  // checking the fused score here would refuse every answer in embeddings mode.
  if (!hasSufficientContext(lexical)) {
    return {
      answer: REFUSAL_MESSAGE,
      citations,
      fit,
      mode: "llm",
      trace: {
        mode: "llm",
        retrievalMs: Math.round(retrievalMs),
        answerMs: 0,
        chunksConsidered: chunks.length,
        chunksCited: citations.length,
        grounded: false,
      },
    };
  }

  const startAnswer = performance.now();
  const generated = await generateGroundedAnswer(message, citations, config);
  const answerMs = performance.now() - startAnswer;
  const grounded = isGrounded(generated.text, citations);

  logger.info("answer", {
    mode: "llm",
    model: generated.model,
    question: message.slice(0, 120),
    chunksCited: citations.length,
    grounded,
    retrievalMs: Math.round(retrievalMs),
    answerMs: Math.round(answerMs),
    promptTokens: generated.promptTokens,
    completionTokens: generated.completionTokens,
  });

  return {
    answer: generated.text,
    citations,
    fit,
    mode: "llm",
    trace: {
      mode: "llm",
      retrievalMs: Math.round(retrievalMs),
      answerMs: Math.round(answerMs),
      chunksConsidered: chunks.length,
      chunksCited: citations.length,
      model: generated.model,
      promptTokens: generated.promptTokens,
      completionTokens: generated.completionTokens,
      grounded,
    },
  };
}
