import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { embedMany, generateText } from "ai";
import type { AppConfig } from "../config";
import type { RetrievedChunk } from "./types";

/**
 * Provider seam. Everything that talks to an external model lives here, behind
 * narrow functions, so the rest of the pipeline never imports an SDK directly.
 * Swapping Claude for GPT, or OpenAI embeddings for Voyage/a self-hosted model,
 * is a one-file change.
 */

export function hasEmbeddings(config: AppConfig): boolean {
  return Boolean(config.openaiApiKey);
}

export async function embedTexts(texts: string[], config: AppConfig): Promise<number[][]> {
  if (!config.openaiApiKey) {
    throw new Error("embedTexts called without an OpenAI API key");
  }
  const openai = createOpenAI({ apiKey: config.openaiApiKey });
  const { embeddings } = await embedMany({
    model: openai.embedding(config.embeddingModel),
    values: texts,
  });
  return embeddings;
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

export async function generateGroundedAnswer(
  question: string,
  context: RetrievedChunk[],
  config: AppConfig,
): Promise<GeneratedAnswer> {
  if (!config.anthropicApiKey) {
    throw new Error("generateGroundedAnswer called without an Anthropic API key");
  }

  const anthropic = createAnthropic({ apiKey: config.anthropicApiKey });
  const contextBlock = context
    .map((chunk) => `[${chunk.title}] (${chunk.kind})\n${chunk.text}`)
    .join("\n\n---\n\n");

  const { text, usage } = await generateText({
    model: anthropic(config.chatModel),
    system: SYSTEM_PROMPT,
    prompt: `Context:\n\n${contextBlock}\n\n---\n\nQuestion: ${question}`,
    temperature: 0.2,
  });

  return {
    text,
    model: config.chatModel,
    promptTokens: usage?.promptTokens,
    completionTokens: usage?.completionTokens,
  };
}
