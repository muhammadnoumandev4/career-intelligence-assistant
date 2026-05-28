import type { EngineMode } from "./rag/types";

/**
 * Runtime configuration, resolved from environment variables.
 *
 * The app is designed to run with ZERO secrets: if no provider keys are
 * present it serves a fully deterministic RAG pipeline. When keys are
 * supplied it upgrades to embeddings + LLM generation. This keeps the local
 * demo reproducible while leaving a real production path one env var away.
 */
export type AppConfig = {
  mode: EngineMode;
  anthropicApiKey?: string;
  openaiApiKey?: string;
  chatModel: string;
  embeddingModel: string;
};

export function getConfig(): AppConfig {
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY?.trim() || undefined;
  const openaiApiKey = process.env.OPENAI_API_KEY?.trim() || undefined;

  // The LLM pipeline needs a generation key. Embeddings are optional: if the
  // embedding key is missing we fall back to lexical retrieval but can still
  // generate grounded answers with the LLM.
  const mode: EngineMode = anthropicApiKey ? "llm" : "deterministic";

  return {
    mode,
    anthropicApiKey,
    openaiApiKey,
    chatModel: process.env.CHAT_MODEL?.trim() || "claude-3-5-sonnet-latest",
    embeddingModel: process.env.EMBEDDING_MODEL?.trim() || "text-embedding-3-small",
  };
}
