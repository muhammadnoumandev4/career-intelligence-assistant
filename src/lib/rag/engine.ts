import { getConfig, type AppConfig } from "../config";
import { logger } from "../logger";
import { chunkDocuments, tokenize } from "./chunk";
import { analyzeFit } from "./fit";
import { hasSufficientContext, isGrounded, REFUSAL_MESSAGE } from "./guardrails";
import { type AssistantIntent, buildRetrievalQuery, detectIntent, extractCapabilityTopic } from "./intent";
import { embedTexts, generateGroundedAnswer, hasEmbeddings } from "./providers";
import { lexicalRetrieve, reciprocalRankFusion, vectorRetrieve } from "./retrieval";
import type { ChatResult, DocumentInput, FitReport, RetrievedChunk } from "./types";

const RETRIEVAL_LIMIT = 5;

function includesAnyToken(text: string, tokens: string[]): boolean {
  const normalized = text.toLowerCase();
  return tokens.some((token) => normalized.includes(token));
}

function sourceLine(chunk: RetrievedChunk): string {
  return `[${chunk.title}] ${chunk.text.replace(/\s+/g, " ").slice(0, 220)}...`;
}

function composeCandidateOverview(fit: FitReport, role: string): DeterministicAnswer {
  const strengths = fit.matched.slice(0, 5).map((signal) => signal.label).join(", ");
  const gapLabels = fit.gaps.slice(0, 3).map((gap) => gap.label).join(", ");
  return {
    answersDirectly: true,
    answer: [
      `For ${role}, the resume is a ${fit.score}% match. The strongest areas the candidate brings are: ${
        strengths || "limited overlap with the role's stated requirements"
      }.`,
      gapLabels
        ? `The role also asks for ${gapLabels}, which the resume does not clearly evidence - worth addressing directly.`
        : "No major required skills are missing for this role.",
      "Ask about overall fit, missing skills, experience alignment, shortlist chances, interview preparation, the RAG architecture, or productionization for a deeper view.",
    ].join("\n\n"),
  };
}

function composeJobComparison(documents: DocumentInput[]): DeterministicAnswer {
  const jobs = documents.filter((document) => document.kind === "job");
  if (jobs.length < 2) {
    const fit = analyzeFit(documents, jobs[0]?.id);
    return composeCandidateOverview(fit, fit.jobTitle ? `the ${fit.jobTitle} role` : "this role");
  }

  const ranked = jobs
    .map((job) => ({ job, fit: analyzeFit(documents, job.id) }))
    .sort((a, b) => b.fit.score - a.fit.score);
  const best = ranked[0];
  const comparison = ranked
    .map(({ job, fit }, index) => `${index + 1}. ${job.title}: ${fit.score}% fit`)
    .join("\n");
  const bestStrengths = best.fit.matched.slice(0, 4).map((signal) => signal.label).join(", ");
  const bestGaps = best.fit.gaps.slice(0, 3).map((signal) => signal.label).join(", ");

  return {
    answersDirectly: true,
    answer: [
      `Best fit among the uploaded job descriptions is ${best.job.title} at ${best.fit.score}%.`,
      comparison,
      bestStrengths
        ? `Why it ranks highest: strongest matches are ${bestStrengths}.`
        : "It ranks highest because it has the least weak overlap against the current resume.",
      bestGaps
        ? `Main gaps to handle for that role: ${bestGaps}.`
        : "No major required gaps stand out for that role.",
    ].join("\n\n"),
  };
}

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
  const intent = detectIntent(message);
  const citations = lexicalRetrieve(buildRetrievalQuery(message, intent, fit), chunks, RETRIEVAL_LIMIT);
  const retrievalMs = performance.now() - startRetrieval;

  const startAnswer = performance.now();
  const { answer, answersDirectly } = composeDeterministicAnswer(message, citations, fit, intent, documents);
  const answerMs = performance.now() - startAnswer;

  // Grounded only when we gave a direct, intent-matched answer that is backed by
  // retrieved evidence. The transparent "closest evidence" path and refusals
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
  intent: AssistantIntent = detectIntent(message),
  documents: DocumentInput[] = [],
): DeterministicAnswer {
  const role = fit.jobTitle ? `the ${fit.jobTitle} role` : "this role";

  if (intent === "jobComparison") {
    return composeJobComparison(documents);
  }

  if (intent === "gaps") {
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
  if (intent === "alignmentGaps") {
    const strengths = fit.matched.slice(0, 5).map((signal) => signal.label).join(", ");
    const gapLabels = fit.gaps.length
      ? fit.gaps.slice(0, 4).map((gap) => gap.label).join(", ")
      : "none - the resume covers every skill this role asks for";
    return {
      answersDirectly: true,
      answer: [
        `Overall fit for ${role} is ${fit.score}%. The strongest alignment is: ${
          strengths || "limited overlap with the role's stated requirements"
        }.`,
        `The main gaps to address are: ${gapLabels}.`,
        "Use the presentation to connect the matched experience to the assignment, then be explicit about how the gaps would be closed in a production version.",
      ].join("\n\n"),
    };
  }
  // "What are my chances of getting shortlisted?" is a fit/likelihood question.
  // It rarely shares vocabulary with the documents, so it is matched on its own
  // hiring-intent terms and answered from the fit report (score + strengths +
  // gaps) rather than refused. Placed before the generic fit branch so it gives
  // the tailored shortlist framing.
  if (intent === "shortlist") {
    const verdict = fit.score >= 75 ? "a strong" : fit.score >= 55 ? "a reasonable" : "a limited";
    const strengths = fit.matched.slice(0, 4).map((signal) => signal.label).join(", ");
    const gapLabels = fit.gaps.slice(0, 3).map((gap) => gap.label).join(", ");
    return {
      answersDirectly: true,
      answer: [
        `On the resume vs ${role}, the fit score is ${fit.score}%, which is ${verdict} signal for getting shortlisted.`,
        strengths
          ? `What works in your favour: ${strengths}.`
          : "There is limited overlap with the role's stated requirements.",
        gapLabels
          ? `What could hold a shortlist back: ${gapLabels}. Addressing these directly in the application would improve the odds.`
          : "No major gaps stand out against this role.",
        "This is a transparent rubric heuristic, not a hiring decision — recruiters weigh signals this score does not capture.",
      ].join("\n\n"),
    };
  }
  if (intent === "productionShortlist") {
    const verdict = fit.score >= 75 ? "a strong" : fit.score >= 55 ? "a reasonable" : "a limited";
    const strengths = fit.matched.slice(0, 4).map((signal) => signal.label).join(", ");
    const gapLabels = fit.gaps.slice(0, 3).map((gap) => gap.label).join(", ");
    return {
      answersDirectly: true,
      answer: [
        "Production path: move ingestion to background jobs, store parsed documents in object storage, persist chunks and metadata in Postgres with pgvector, add hybrid BM25/vector retrieval, stream LLM responses, and deploy with Docker on AWS ECS/Fargate, Cloud Run, Azure Container Apps, or Vercel plus managed Postgres.",
        `Shortlist signal: the resume vs ${role} scores ${fit.score}%, which is ${verdict} signal. Strongest matches: ${
          strengths || "limited overlap with the role's stated requirements"
        }.`,
        gapLabels
          ? `What could hold a shortlist back: ${gapLabels}. Address those directly with a concrete productionization plan.`
          : "No major gaps stand out against this role.",
      ].join("\n\n"),
    };
  }
  if (intent === "alignment") {
    const strengths = fit.matched.slice(0, 5).map((signal) => signal.label).join(", ");
    return {
      answersDirectly: true,
      answer: [
        `Overall fit for ${role} is ${fit.score}%. The strongest alignment is: ${strengths || "limited overlap with the role's stated requirements"}.`,
        "Position the story around forward-deployed ownership: ambiguous requirement intake, fast prototype, measurable engineering decisions, and production-minded trade-offs.",
      ].join("\n\n"),
    };
  }
  if (intent === "interviewQuestions") {
    const strengthQuestions = fit.matched
      .slice(0, 4)
      .map((signal) => `- Be ready to prove ${signal.label} with a concrete project example and measurable outcome.`);
    const gapQuestions = fit.gaps
      .slice(0, 3)
      .map((signal) => `- Be ready to explain how you would close or mitigate the ${signal.label} gap.`);
    const questions = [
      ...strengthQuestions,
      ...gapQuestions,
      "- Be ready to explain the architecture, technical decisions, quality checks, and productionization plan behind the submitted prototype.",
    ].slice(0, 8);
    return {
      answersDirectly: true,
      answer: [
        `For ${role}, these are the interview questions/themes to prepare for from the uploaded resume/JD:`,
        questions.join("\n"),
      ].join("\n\n"),
    };
  }
  if (intent === "interviewPrep") {
    const strengths = fit.matched.slice(0, 4).map((signal) => signal.label).join(", ");
    const gapLabels = fit.gaps.slice(0, 3).map((gap) => gap.label).join(", ");
    return {
      answersDirectly: true,
      answer: [
        `To prepare for the ${fit.jobTitle ? fit.jobTitle : "this role"} interview, lead with your strongest matches: ${
          strengths || "the areas where your experience overlaps the role"
        }. Have a concise STAR story (situation, task, action, measurable result) ready for each.`,
        gapLabels
          ? `Expect the panel to probe where you are lighter — ${gapLabels}. Prepare an honest "here is how I would close that" answer with a concrete plan rather than glossing over it.`
          : "There are no major skill gaps for this role, so focus on depth: be ready to go one level deeper on any claim in your resume.",
        "Also rehearse one project end-to-end: the problem, the decisions and trade-offs you made, and the impact you measured.",
      ].join("\n\n"),
    };
  }
  if (intent === "production") {
    return {
      answersDirectly: true,
      answer: [
        "Production path: move ingestion to background jobs, store parsed documents in object storage, persist chunks and metadata in Postgres with pgvector, add hybrid BM25/vector retrieval, stream LLM responses, and deploy with Docker on AWS ECS/Fargate, Cloud Run, Azure Container Apps, or Vercel plus managed Postgres.",
        "Operational controls should include secrets management, auth, tenant isolation, request tracing, structured logs, retrieval quality evals, prompt/version tracking, rate limits, and human-readable citations.",
      ].join("\n\n"),
    };
  }
  if (intent === "architecture") {
    return {
      answersDirectly: true,
      answer: [
        "The pipeline has clean seams: parser -> chunker -> retriever -> answer composer -> guardrails -> trace. The default mode uses paragraph-aware chunking, TF-IDF lexical retrieval, and grounded templated answers so the demo runs with zero secrets.",
        "With provider keys set, the same seams switch to OpenAI or Google embeddings, hybrid vector + lexical retrieval fused with reciprocal rank fusion, and an LLM (Claude, GPT, or Gemini) for grounded generation — without changing the UI or API contract.",
      ].join("\n\n"),
    };
  }
  if (intent === "capability") {
    const topic = extractCapabilityTopic(message);
    const topicTokens = tokenize(topic);

    if (topicTokens.length === 0) {
      return composeCandidateOverview(fit, role);
    }

    const matchedSignals = fit.matched.filter((signal) =>
      includesAnyToken(`${signal.label} ${signal.evidence}`, topicTokens),
    );
    const gapSignals = fit.gaps.filter((signal) =>
      includesAnyToken(`${signal.label} ${signal.evidence}`, topicTokens),
    );
    const resumeEvidence = citations.filter((chunk) => chunk.kind === "resume" && includesAnyToken(chunk.text, topicTokens));
    const jobEvidence = citations.filter((chunk) => chunk.kind === "job" && includesAnyToken(chunk.text, topicTokens));
    const displayTopic = topic || "that area";

    if (resumeEvidence.length || matchedSignals.length) {
      return {
        answersDirectly: true,
        answer: [
          `Yes — I found evidence for ${displayTopic} in the resume.`,
          matchedSignals.length
            ? `It maps to: ${matchedSignals.map((signal) => signal.label).join(", ")}.`
            : `Relevant evidence: ${sourceLine(resumeEvidence[0])}`,
          jobEvidence.length
            ? `The selected role also appears to ask for this area: ${sourceLine(jobEvidence[0])}`
            : `For ${role}, treat this as a supporting strength rather than a standalone hiring decision.`,
        ].join("\n\n"),
      };
    }

    if (jobEvidence.length || gapSignals.length) {
      return {
        answersDirectly: true,
        answer: [
          `I do not see strong resume evidence for ${displayTopic}.`,
          gapSignals.length
            ? `It maps to a gap area: ${gapSignals.map((signal) => signal.label).join(", ")}.`
            : `The selected role appears to ask for it: ${sourceLine(jobEvidence[0])}`,
          "This is a good area to address honestly with a concrete learning or productionization plan.",
        ].join("\n\n"),
      };
    }
  }

  // Catch-all for candidate-focused questions a recruiter would actually type
  // ("what are his strengths?", "does he have AWS experience?", "why should we
  // hire him?", "summarize the candidate"). These rarely use the exact intent
  // words above, so without this branch they fell through to the refusal. The
  // answer is built from the fit report (always computable from resume + JD),
  // so it works even when the phrasing shares no vocabulary with the documents.
  // Keywords are deliberately candidate-specific (not bare words like "why") so
  // genuinely off-topic questions still drop through to the refusal/evidence path.
  if (intent === "candidate") {
    return composeCandidateOverview(fit, role);
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
// LLM pipeline (activated when any configured generation key is present)
// ---------------------------------------------------------------------------

async function answerWithLlm(
  message: string,
  documents: DocumentInput[],
  fit: FitReport,
  config: AppConfig,
): Promise<ChatResult> {
  const startRetrieval = performance.now();
  const chunks = chunkDocuments(documents);
  const intent = detectIntent(message);
  const retrievalQuery = buildRetrievalQuery(message, intent, fit);

  // The LLM path uses the same domain intent and fit rubric to expand retrieval,
  // but the answer itself is still generated from the retrieved context by the
  // provider. This makes phrasing robust without adding canned answers.
  let citations: RetrievedChunk[];
  let semanticAvailable = false;
  if (hasEmbeddings(config)) {
    const [queryEmbedding] = await embedTexts([retrievalQuery], config);
    const chunkEmbeddings = await embedTexts(chunks.map((c) => c.text), config);
    const dense = vectorRetrieve(queryEmbedding, chunks, chunkEmbeddings, RETRIEVAL_LIMIT);
    const lexical = lexicalRetrieve(retrievalQuery, chunks, RETRIEVAL_LIMIT);
    citations = reciprocalRankFusion([dense, lexical], RETRIEVAL_LIMIT);
    semanticAvailable = true;
  } else {
    citations = lexicalRetrieve(retrievalQuery, chunks, RETRIEVAL_LIMIT);
  }
  const retrievalMs = performance.now() - startRetrieval;

  // Scope is judged generally, not by keyword:
  //  - With embeddings, the model is the scope judge. Its system prompt requires
  //    it to answer only from the provided resume/JD context and to decline when
  //    the context does not contain the answer — so an off-topic question gets a
  //    grounded refusal from the model, and any job-related phrasing is answered.
  //    We therefore do not pre-gate; we always hand the top chunks to the model.
  //  - Without embeddings we have no semantic signal, so we keep the lexical
  //    relevance gate as the only available relevance proxy.
  if (!semanticAvailable && !hasSufficientContext(citations)) {
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
