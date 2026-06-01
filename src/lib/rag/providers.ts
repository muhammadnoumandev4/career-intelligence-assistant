import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";
import type { AppConfig } from "../config";
import type { RetrievedChunk } from "./types";

/**
 * Provider adapters for the optional LLM pipeline. The deterministic pipeline
 * never imports this module, so the app builds and runs without any SDK keys.
 *
 * Generation supports Anthropic (Claude), OpenAI (GPT), and Google (Gemini),
 * selected by which key is present. Anthropic/OpenAI go through the Vercel AI
 * SDK; Gemini uses a direct REST call to avoid version-coupling the request
 * shape to a fast-moving client. Embeddings are likewise provider-agnostic
 * (OpenAI or Google). Generation and embeddings resolve independently, so they
 * can come from different vendors in the same request. Adding or swapping a
 * provider is a change isolated to this file.
 *
 * Every external call carries an AbortSignal timeout so a slow or hung provider
 * surfaces as an error the engine can catch and fall back from, rather than
 * leaving the request pending. Deeper hardening (retries, circuit breaker,
 * per-tenant rate limits, cost guards) is deliberately left for production and
 * noted in the README.
 */
const PROVIDER_TIMEOUT_MS = 30_000;

export function hasEmbeddings(config: AppConfig): boolean {
  return Boolean(config.embeddingProvider);
}

async function embedWithOpenAI(texts: string[], config: AppConfig): Promise<number[][]> {
  const openai = createOpenAI({ apiKey: config.openaiApiKey });
  const { embeddings } = await embedMany({
    model: openai.embedding(config.embeddingModel),
    values: texts,
  });
  return embeddings;
}

type GeminiBatchEmbedResponse = {
  embeddings?: { values?: number[] }[];
  error?: { message?: string };
};

async function embedWithGemini(texts: string[], config: AppConfig): Promise<number[][]> {
  const model = `models/${config.embeddingModel}`;
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/${model}:batchEmbedContents?key=${config.googleApiKey}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      requests: texts.map((text) => ({ model, content: { parts: [{ text }] } })),
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  const payload = (await response.json()) as GeminiBatchEmbedResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Gemini embedding failed (${response.status})`);
  }
  return (payload.embeddings ?? []).map((embedding) => embedding.values ?? []);
}

/**
 * Provider-agnostic embeddings: routes to whichever provider's key is present
 * (OpenAI preferred, Google as fallback). The rest of the pipeline only depends
 * on getting back number[][], so the vector store and RRF fusion are unchanged.
 */
export async function embedTexts(texts: string[], config: AppConfig): Promise<number[][]> {
  if (config.embeddingProvider === "openai" && config.openaiApiKey) {
    return embedWithOpenAI(texts, config);
  }
  if (config.embeddingProvider === "google" && config.googleApiKey) {
    return embedWithGemini(texts, config);
  }
  throw new Error("embedTexts called without an embedding API key");
}

const SYSTEM_PROMPT = `You are a Career Intelligence Assistant. You compare a candidate's resume against one or more job descriptions.

Rules:
- Answer ONLY using the provided context blocks. Do not invent skills, employers, or requirements.
- Cite the source of each claim inline using its [title] tag exactly as shown in the context.
- If the context does not contain the answer, say so plainly and suggest what document would be needed. Never guess.
- Be concrete and concise. Distinguish what is proven by the resume from what is a gap or an assumption.`;

export type GeneratedAnswer = {
  text: string;
  model: string;
  promptTokens?: number;
  completionTokens?: number;
};

function buildContext(citations: RetrievedChunk[]): string {
  return citations
    .map((chunk) => `[${chunk.title}] (${chunk.kind})\n${chunk.text}`)
    .join("\n\n---\n\n");
}

async function generateWithAnthropic(
  prompt: string,
  config: AppConfig,
): Promise<GeneratedAnswer> {
  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
  const { text, usage } = await generateText({
    model: anthropic(config.chatModel),
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  return {
    text,
    model: config.chatModel,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
  };
}

async function generateWithOpenAI(
  prompt: string,
  config: AppConfig,
): Promise<GeneratedAnswer> {
  const openai = createOpenAI({ apiKey: config.openaiApiKey });
  const { text, usage } = await generateText({
    model: openai(config.chatModel),
    system: SYSTEM_PROMPT,
    prompt,
    temperature: 0.2,
    abortSignal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });
  return {
    text,
    model: config.chatModel,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
  };
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string }[] } }[];
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
  error?: { message?: string };
};

async function generateWithGemini(
  prompt: string,
  config: AppConfig,
): Promise<GeneratedAnswer> {
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    config.chatModel,
  )}:generateContent?key=${config.googleApiKey}`;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      // gemini-flash-latest resolves to a "thinking" model that spends output
      // tokens on internal reasoning. Disable thinking (thinkingBudget: 0) so the
      // budget produces answer text, and give a generous cap for grounded answers.
      generationConfig: {
        temperature: 0.2,
        maxOutputTokens: 2048,
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  const payload = (await response.json()) as GeminiResponse;
  if (!response.ok || payload.error) {
    throw new Error(payload.error?.message ?? `Gemini request failed (${response.status})`);
  }

  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("") ?? "";
  if (!text.trim()) {
    throw new Error("Gemini returned an empty response");
  }

  return {
    text,
    model: config.chatModel,
    promptTokens: payload.usageMetadata?.promptTokenCount,
    completionTokens: payload.usageMetadata?.candidatesTokenCount,
  };
}

export async function generateGroundedAnswer(
  question: string,
  citations: RetrievedChunk[],
  config: AppConfig,
): Promise<GeneratedAnswer> {
  const prompt = `Context:\n\n${buildContext(citations)}\n\n---\n\nQuestion: ${question}`;

  if (config.chatProvider === "anthropic" && config.anthropicApiKey) {
    return generateWithAnthropic(prompt, config);
  }
  if (config.chatProvider === "openai" && config.openaiApiKey) {
    return generateWithOpenAI(prompt, config);
  }
  if (config.chatProvider === "google" && config.googleApiKey) {
    return generateWithGemini(prompt, config);
  }
  throw new Error("generateGroundedAnswer called without a generation API key");
}
